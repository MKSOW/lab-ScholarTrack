import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}

// Silences unused-import warning if Prisma types aren't directly referenced.
// (Prisma namespace stays available for future typings on this service.)
export type _AdminPrismaNs = Prisma.BatchPayload;
