import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildCsvRow } from './utils/csv-export';
import { parseEnrollmentCsvBuffer } from './utils/csv-enrollment-parser';

// Attendance rate threshold below which a student is flagged "atRisk".
// Same source of truth as AttendanceService — kept in env so the policy stays consistent.
const AT_RISK_THRESHOLD = Number(
  process.env.ATTENDANCE_AT_RISK_THRESHOLD ?? 0.75,
);

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Aggregated KPIs for an entire semester — admin reporting view.
  // Leverages Prisma aggregations (count, groupBy with _avg) so most of the
  // heavy lifting happens in Postgres, not in Node memory.
  async getSemesterStats(semester: string) {
    // 1. Make sure the semester actually has at least one course — otherwise
    //    we'd return a stats object full of zeros which is misleading.
    const totalCourses = await this.prisma.course.count({
      where: { semester },
    });
    if (totalCourses === 0) {
      throw new NotFoundException(`No course found for semester "${semester}"`);
    }

    // 2. Total enrollments for the semester (not unique students)
    const totalEnrollments = await this.prisma.enrollment.count({
      where: { course: { semester } },
    });

    // 3. Unique students count — uses Prisma `distinct` to avoid double-counting
    //    a student enrolled in multiple courses of the same semester.
    const distinctStudents = await this.prisma.enrollment.findMany({
      where: { course: { semester } },
      distinct: ['studentId'],
      select: { studentId: true },
    });
    const uniqueStudentsCount = distinctStudents.length;

    // 4. Average grade per course — single groupBy query, no N+1.
    //    We compute "simple average" of raw grade values (not the weighted one),
    //    which is acceptable for admin reporting and aligns with the spec.
    const gradesByCourse = await this.prisma.grade.groupBy({
      by: ['courseId'],
      where: { course: { semester } },
      _avg: { value: true },
      _count: { _all: true },
    });

    // 5. Fetch course metadata (code, name) for the courses present in this semester
    const courses = await this.prisma.course.findMany({
      where: { semester },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { code: 'asc' },
    });

    // Build a map for O(1) lookup when merging grade averages with course metadata
    const gradeAvgByCourseId = new Map(
      gradesByCourse.map((g) => [
        g.courseId,
        {
          average: g._avg.value !== null ? Number(g._avg.value) : null,
          gradeCount: g._count._all,
        },
      ]),
    );

    // 6. Per-course attendance stats (needed for atRisk + per-course attendance rate).
    //    We do this with a single SQL aggregation rather than calling AttendanceService
    //    in a loop — keeps the endpoint to a constant number of DB queries.
    const perCourseStats = await this.computePerCourseAttendanceStats(
      courses.map((c) => c.id),
    );

    // 7. Merge per-course rows: metadata + grade average + attendance + atRisk
    const averagePerCourse = courses.map((c) => {
      const grade = gradeAvgByCourseId.get(c.id);
      const attendance = perCourseStats.get(c.id);
      return {
        courseId: c.id,
        courseCode: c.code,
        courseName: c.name,
        studentCount: c._count.enrollments,
        average:
          grade?.average !== undefined && grade.average !== null
            ? Math.round(grade.average * 100) / 100
            : null,
        gradeCount: grade?.gradeCount ?? 0,
        attendanceRate: attendance?.rate ?? 1,
        atRiskCount: attendance?.atRiskCount ?? 0,
      };
    });

    // 8. Global KPIs
    //    - globalAtRiskCount: sum of at-risk students across all courses of the semester
    //      (a student at risk in two courses counts twice — by design, mirrors per-course view)
    //    - globalAttendanceRate: simple mean of per-course rates (validated choice)
    const globalAtRiskCount = averagePerCourse.reduce(
      (sum, c) => sum + c.atRiskCount,
      0,
    );
    const globalAttendanceRate =
      averagePerCourse.length === 0
        ? 1
        : averagePerCourse.reduce((sum, c) => sum + c.attendanceRate, 0) /
          averagePerCourse.length;

    this.logger.log(
      `Semester stats computed for "${semester}" — ${totalCourses} courses, ${uniqueStudentsCount} students`,
    );

    return {
      semester,
      totalCourses,
      totalEnrollments,
      uniqueStudentsCount,
      averagePerCourse,
      globalAtRiskCount,
      globalAttendanceRate: Math.round(globalAttendanceRate * 10000) / 10000,
      threshold: AT_RISK_THRESHOLD,
    };
  }

  // Internal helper — computes attendance rate + at-risk count for each course in `courseIds`.
  // Uses three batched queries (sessions, enrollments, attendances) then groups in memory.
  // Returns a Map keyed by courseId.
  private async computePerCourseAttendanceStats(
    courseIds: string[],
  ): Promise<Map<string, { rate: number; atRiskCount: number }>> {
    const out = new Map<string, { rate: number; atRiskCount: number }>();
    if (courseIds.length === 0) return out;

    // All non-cancelled sessions across the semester's courses, in one query
    const sessions = await this.prisma.courseSession.findMany({
      where: { courseId: { in: courseIds }, cancelledAt: null },
      select: { id: true, courseId: true },
    });

    // All enrollments across the semester's courses, in one query
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: { studentId: true, courseId: true },
    });

    // All attendances for these sessions, in one query
    const sessionIds = sessions.map((s) => s.id);
    const attendances =
      sessionIds.length === 0
        ? []
        : await this.prisma.attendance.findMany({
            where: { courseSessionId: { in: sessionIds } },
            select: {
              studentId: true,
              status: true,
              courseSessionId: true,
            },
          });

    // Build per-course index of sessions
    const sessionsByCourse = new Map<string, string[]>();
    for (const s of sessions) {
      const list = sessionsByCourse.get(s.courseId) ?? [];
      list.push(s.id);
      sessionsByCourse.set(s.courseId, list);
    }

    // Build per-course index of enrolled students
    const studentsByCourse = new Map<string, string[]>();
    for (const e of enrollments) {
      const list = studentsByCourse.get(e.courseId) ?? [];
      list.push(e.studentId);
      studentsByCourse.set(e.courseId, list);
    }

    // Build per-session courseId index, and per-(student,session) status index
    const courseIdBySessionId = new Map(
      sessions.map((s) => [s.id, s.courseId]),
    );
    const statusByStudentAndCourse = new Map<string, AttendanceStatus[]>();
    for (const a of attendances) {
      const courseId = courseIdBySessionId.get(a.courseSessionId);
      if (!courseId) continue;
      const key = `${a.studentId}::${courseId}`;
      const list = statusByStudentAndCourse.get(key) ?? [];
      list.push(a.status);
      statusByStudentAndCourse.set(key, list);
    }

    // Compute per-course average rate + atRisk count
    for (const courseId of courseIds) {
      const courseSessionIds = sessionsByCourse.get(courseId) ?? [];
      const courseStudentIds = studentsByCourse.get(courseId) ?? [];
      const total = courseSessionIds.length;

      if (total === 0 || courseStudentIds.length === 0) {
        out.set(courseId, { rate: 1, atRiskCount: 0 });
        continue;
      }

      let sumRates = 0;
      let atRiskCount = 0;
      for (const studentId of courseStudentIds) {
        const statuses =
          statusByStudentAndCourse.get(`${studentId}::${courseId}`) ?? [];
        let present = 0;
        for (const s of statuses) {
          if (s === AttendanceStatus.PRESENT || s === AttendanceStatus.EXCUSED)
            present++;
        }
        const rate = present / total;
        sumRates += rate;
        if (rate < AT_RISK_THRESHOLD) atRiskCount++;
      }
      out.set(courseId, {
        rate: Math.round((sumRates / courseStudentIds.length) * 10000) / 10000,
        atRiskCount,
      });
    }

    return out;
  }

  // Bulk enrollment import — all-or-nothing: if any row fails validation or would
  // exceed course capacity, the entire import is rejected with a full error report.
  // CSV format (header required): studentId,courseId
  async importEnrollmentsFromCsv(file: Express.Multer.File): Promise<{
    imported: number;
    summary: { courseId: string; courseCode: string; enrolled: number }[];
  }> {
    const { rows, parseError } = parseEnrollmentCsvBuffer(file.buffer);
    if (parseError) throw new BadRequestException(parseError);
    if (rows.length === 0) {
      throw new BadRequestException(
        'Le fichier CSV ne contient aucune ligne de données',
      );
    }

    // Pre-load all referenced entities in 3 parallel queries (no N+1)
    const uniqueCourseIds = [
      ...new Set(rows.map((r) => r.courseId).filter(Boolean)),
    ];
    const uniqueStudentIds = [
      ...new Set(rows.map((r) => r.studentId).filter(Boolean)),
    ];

    const [courses, students, existingEnrollments] = await Promise.all([
      this.prisma.course.findMany({
        where: { id: { in: uniqueCourseIds } },
        select: {
          id: true,
          code: true,
          capacity: true,
          _count: { select: { enrollments: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { id: { in: uniqueStudentIds }, role: Role.STUDENT },
        select: { id: true },
      }),
      this.prisma.enrollment.findMany({
        where: {
          studentId: { in: uniqueStudentIds },
          courseId: { in: uniqueCourseIds },
        },
        select: { studentId: true, courseId: true },
      }),
    ]);

    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const studentIdSet = new Set(students.map((s) => s.id));
    const enrolledPairs = new Set(
      existingEnrollments.map((e) => `${e.studentId}::${e.courseId}`),
    );
    const seenInFile = new Set<string>();

    type ImportError = {
      row: number;
      error: string;
      data: Record<string, string>;
    };
    const errors: ImportError[] = [];
    const validRows: typeof rows = [];

    for (const row of rows) {
      const data = { studentId: row.studentId, courseId: row.courseId };

      if (!row.studentId) {
        errors.push({
          row: row.rowNumber,
          error: 'Le champ studentId est requis',
          data,
        });
        continue;
      }
      if (!row.courseId) {
        errors.push({
          row: row.rowNumber,
          error: 'Le champ courseId est requis',
          data,
        });
        continue;
      }
      if (!courseMap.has(row.courseId)) {
        errors.push({
          row: row.rowNumber,
          error: `Cours "${row.courseId}" introuvable`,
          data,
        });
        continue;
      }
      if (!studentIdSet.has(row.studentId)) {
        errors.push({
          row: row.rowNumber,
          error: `Étudiant "${row.studentId}" introuvable ou n'a pas le rôle STUDENT`,
          data,
        });
        continue;
      }
      if (enrolledPairs.has(`${row.studentId}::${row.courseId}`)) {
        const code = courseMap.get(row.courseId)!.code;
        errors.push({
          row: row.rowNumber,
          error: `L'étudiant "${row.studentId}" est déjà inscrit au cours "${code}"`,
          data,
        });
        continue;
      }

      const compositeKey = `${row.studentId}::${row.courseId}`;
      if (seenInFile.has(compositeKey)) {
        errors.push({
          row: row.rowNumber,
          error: `Doublon dans le fichier CSV : même étudiant et même cours déjà présents`,
          data,
        });
        continue;
      }

      seenInFile.add(compositeKey);
      validRows.push(row);
    }

    // Capacity check — grouped by course so the whole batch is evaluated at once
    const newCountByCourse = new Map<string, number>();
    for (const row of validRows) {
      newCountByCourse.set(
        row.courseId,
        (newCountByCourse.get(row.courseId) ?? 0) + 1,
      );
    }
    for (const [courseId, newCount] of newCountByCourse) {
      const course = courseMap.get(courseId)!;
      const available = course.capacity - course._count.enrollments;
      if (newCount > available) {
        const affected = validRows.filter((r) => r.courseId === courseId);
        for (const row of affected) {
          errors.push({
            row: row.rowNumber,
            error: `Cours "${course.code}" : capacité insuffisante — ${available} place(s) disponible(s), ${newCount} demandée(s)`,
            data: { studentId: row.studentId, courseId: row.courseId },
          });
        }
      }
    }

    // All-or-nothing: any error aborts the whole import
    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: `Import annulé : ${errors.length} erreur(s) détectée(s)`,
        errors,
      });
    }

    // All rows are valid — insert in a single transaction
    await this.prisma.$transaction(
      validRows.map((row) =>
        this.prisma.enrollment.create({
          data: { studentId: row.studentId, courseId: row.courseId },
        }),
      ),
    );

    // Build per-course summary
    const summaryMap = new Map<
      string,
      { courseCode: string; enrolled: number }
    >();
    for (const row of validRows) {
      const course = courseMap.get(row.courseId)!;
      const entry = summaryMap.get(row.courseId) ?? {
        courseCode: course.code,
        enrolled: 0,
      };
      entry.enrolled++;
      summaryMap.set(row.courseId, entry);
    }

    const summary = [...summaryMap.entries()].map(
      ([courseId, { courseCode, enrolled }]) => ({
        courseId,
        courseCode,
        enrolled,
      }),
    );

    this.logger.log(
      `Enrollment CSV import: ${validRows.length} enrollment(s) created across ${summary.length} course(s)`,
    );

    return { imported: validRows.length, summary };
  }

  // CSV export — one row per (student, course) enrollment for the semester.
  // Columns: studentId, studentName, studentEmail, courseCode, courseName,
  //          weightedAverage, isComplete, attendanceRate, atRisk
  async exportSemesterCsv(semester: string): Promise<string> {
    const courses = await this.prisma.course.findMany({
      where: { semester },
      select: {
        id: true,
        code: true,
        name: true,
        assessmentTypes: { select: { id: true, weight: true } },
      },
      orderBy: { code: 'asc' },
    });
    if (courses.length === 0) {
      throw new NotFoundException(`No course found for semester "${semester}"`);
    }

    const courseIds = courses.map((c) => c.id);

    // Single query — all enrollments with embedded student data
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: {
        studentId: true,
        courseId: true,
        student: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ student: { name: 'asc' } }, { course: { code: 'asc' } }],
    });

    // Single query — all grades for the semester
    const grades = await this.prisma.grade.findMany({
      where: { courseId: { in: courseIds } },
      select: {
        studentId: true,
        courseId: true,
        assessmentTypeId: true,
        value: true,
      },
    });

    const attendanceRates =
      await this.computePerStudentCourseAttendanceRates(courseIds);

    // courseId → course object (with assessment types)
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    // (studentId::courseId) → Map<assessmentTypeId, gradeValue>
    const gradesByKey = new Map<string, Map<string, number>>();
    for (const g of grades) {
      const key = `${g.studentId}::${g.courseId}`;
      const map = gradesByKey.get(key) ?? new Map<string, number>();
      map.set(g.assessmentTypeId, Number(g.value));
      gradesByKey.set(key, map);
    }

    const HEADER =
      'studentId,studentName,studentEmail,courseCode,courseName,weightedAverage,isComplete,attendanceRate,atRisk';
    const lines: string[] = [HEADER];

    for (const e of enrollments) {
      const course = courseMap.get(e.courseId)!;
      const compositeKey = `${e.studentId}::${e.courseId}`;
      const gradeMap =
        gradesByKey.get(compositeKey) ?? new Map<string, number>();

      // Weighted average — same formula as GradesService.getWeightedAverage
      let weightedSum = 0;
      let coveredWeight = 0;
      for (const at of course.assessmentTypes) {
        const w = Number(at.weight);
        const grade = gradeMap.get(at.id);
        if (grade !== undefined) {
          weightedSum += (grade * w) / 100;
          coveredWeight += w;
        }
      }
      // isComplete when all assessment types (summing to 100) have been graded
      const isComplete =
        course.assessmentTypes.length > 0 && coveredWeight === 100;
      const weightedAverage =
        coveredWeight > 0
          ? parseFloat(((weightedSum / coveredWeight) * 100).toFixed(2))
          : null;

      const attendanceRate = attendanceRates.get(compositeKey) ?? 1;
      const atRisk = attendanceRate < AT_RISK_THRESHOLD;

      lines.push(
        buildCsvRow([
          e.student.id,
          e.student.name,
          e.student.email,
          course.code,
          course.name,
          weightedAverage !== null ? weightedAverage.toFixed(2) : '',
          isComplete ? 'true' : 'false',
          (Math.round(attendanceRate * 10000) / 10000).toString(),
          atRisk ? 'true' : 'false',
        ]),
      );
    }

    this.logger.log(
      `CSV export semester "${semester}" — ${enrollments.length} row(s) generated`,
    );

    return lines.join('\n');
  }

  // Returns per-(student, course) attendance rate for every enrolled student.
  // Key format: `${studentId}::${courseId}`, value: 0–1 rate.
  // Rate defaults to 1 when a course has no sessions (no data = no penalty).
  private async computePerStudentCourseAttendanceRates(
    courseIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (courseIds.length === 0) return out;

    const sessions = await this.prisma.courseSession.findMany({
      where: { courseId: { in: courseIds }, cancelledAt: null },
      select: { id: true, courseId: true },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: { studentId: true, courseId: true },
    });

    const sessionIds = sessions.map((s) => s.id);
    const attendances =
      sessionIds.length === 0
        ? []
        : await this.prisma.attendance.findMany({
            where: { courseSessionId: { in: sessionIds } },
            select: { studentId: true, status: true, courseSessionId: true },
          });

    // Session count per course + reverse lookup sessionId → courseId
    const sessionCountByCourse = new Map<string, number>();
    const courseIdBySessionId = new Map<string, string>();
    for (const s of sessions) {
      sessionCountByCourse.set(
        s.courseId,
        (sessionCountByCourse.get(s.courseId) ?? 0) + 1,
      );
      courseIdBySessionId.set(s.id, s.courseId);
    }

    // Present/excused count per (student, course)
    const presentCountByKey = new Map<string, number>();
    for (const a of attendances) {
      if (
        a.status !== AttendanceStatus.PRESENT &&
        a.status !== AttendanceStatus.EXCUSED
      )
        continue;
      const courseId = courseIdBySessionId.get(a.courseSessionId);
      if (!courseId) continue;
      const key = `${a.studentId}::${courseId}`;
      presentCountByKey.set(key, (presentCountByKey.get(key) ?? 0) + 1);
    }

    for (const e of enrollments) {
      const key = `${e.studentId}::${e.courseId}`;
      const total = sessionCountByCourse.get(e.courseId) ?? 0;
      if (total === 0) {
        out.set(key, 1);
        continue;
      }
      const present = presentCountByKey.get(key) ?? 0;
      out.set(key, present / total);
    }

    return out;
  }
}
