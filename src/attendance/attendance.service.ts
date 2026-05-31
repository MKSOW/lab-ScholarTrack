import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { FilterStatsDto } from './dto/filter-stats.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';

export type AttendanceUser = { id: string; role: Role };

// Attendance rate threshold below which a student is flagged "atRisk".
// Read once at module load; falls back to 0.75 when the env variable is not set.
const AT_RISK_THRESHOLD = Number(
  process.env.ATTENDANCE_AT_RISK_THRESHOLD ?? 0.75,
);

/**
 * Attendance business logic: session creation/cancellation (soft delete),
 * bulk all-or-nothing attendance recording, and attendance-rate / atRisk
 * computation per student and class-wide. All persistence goes through the
 * injected PrismaService.
 */
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Create a session — a Teacher can only create for their own courses
  async createSession(dto: CreateSessionDto, requestingUser: AttendanceUser) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, code: true, teacherId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    const session = await this.prisma.courseSession.create({
      data: {
        courseId: dto.courseId,
        date: new Date(dto.date),
        topic: dto.topic,
      },
      include: {
        course: { select: { id: true, code: true, name: true } },
      },
    });

    this.logger.log(
      `Session created: ${course.code} — ${session.date.toISOString()}`,
    );
    return session;
  }

  // List a course's sessions — access filtered by role
  async findSessionsByCourse(courseId: string, requestingUser: AttendanceUser) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true, code: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    // A student must be enrolled in the course to see its sessions
    if (requestingUser.role === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: {
          studentId_courseId: { studentId: requestingUser.id, courseId },
        },
      });
      if (!enrollment) {
        throw new ForbiddenException(
          'Access denied: you are not enrolled in this course',
        );
      }
    }

    return this.prisma.courseSession.findMany({
      where: { courseId },
      include: { _count: { select: { attendances: true } } },
      orderBy: { date: 'desc' },
    });
  }

  // Cancel a session — soft delete via cancelledAt
  async cancelSession(sessionId: string, requestingUser: AttendanceUser) {
    const session = await this.prisma.courseSession.findUnique({
      where: { id: sessionId },
      include: { course: { select: { teacherId: true, code: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');

    if (
      requestingUser.role === Role.TEACHER &&
      session.course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    if (session.cancelledAt) {
      throw new ConflictException('This session is already cancelled');
    }

    const updated = await this.prisma.courseSession.update({
      where: { id: sessionId },
      data: { cancelledAt: new Date() },
    });

    this.logger.log(
      `Session cancelled: ${session.course.code} — ${updated.date.toISOString()}`,
    );
    return updated;
  }

  // Bulk recording — all attendances validated before any write.
  // If a single entry is invalid → 422 with a report, no row touched.
  // Upsert to allow correcting an already-recorded attendance.
  async recordAttendances(
    sessionId: string,
    dto: RecordAttendanceDto,
    requestingUser: AttendanceUser,
  ) {
    // 1. The session must exist
    const session = await this.prisma.courseSession.findUnique({
      where: { id: sessionId },
      include: {
        course: { select: { id: true, teacherId: true, code: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    // 2. The session must not be cancelled
    if (session.cancelledAt) {
      throw new BadRequestException(
        'Cannot record attendances for a cancelled session',
      );
    }

    // 3. A TEACHER can only record for their own courses
    if (
      requestingUser.role === Role.TEACHER &&
      session.course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    // 4. Preload enrolled students (avoids N+1 queries)
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: session.course.id },
      select: { studentId: true },
    });
    const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));

    // 5. Full validation — collect all errors before any write
    const errors: { index: number; studentId: string; error: string }[] = [];
    const seenInRequest = new Set<string>();

    dto.attendances.forEach((item, index) => {
      if (!enrolledStudentIds.has(item.studentId)) {
        errors.push({
          index,
          studentId: item.studentId,
          error: `Student not enrolled in course "${session.course.code}"`,
        });
        return;
      }
      if (seenInRequest.has(item.studentId)) {
        errors.push({
          index,
          studentId: item.studentId,
          error:
            'Duplicate: this student appears multiple times in the request',
        });
        return;
      }
      seenInRequest.add(item.studentId);
    });

    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: `Recording cancelled: ${errors.length} error(s) detected`,
        errors,
      });
    }

    // 6. Upsert transaction — atomic: all or nothing
    const results = await this.prisma.$transaction(
      dto.attendances.map((item) =>
        this.prisma.attendance.upsert({
          where: {
            studentId_courseSessionId: {
              studentId: item.studentId,
              courseSessionId: sessionId,
            },
          },
          update: { status: item.status, recordedAt: new Date() },
          create: {
            studentId: item.studentId,
            courseSessionId: sessionId,
            status: item.status,
          },
        }),
      ),
    );

    this.logger.log(
      `Attendances recorded: ${results.length} for session ${session.id} (course ${session.course.code})`,
    );

    return {
      recorded: results.length,
      sessionId,
      course: { code: session.course.code },
    };
  }

  // Attendance stats for a (student, course) pair.
  // - Rate = (PRESENT + EXCUSED) / total_non_cancelled_sessions.
  // - LATE and ABSENT count as absent.
  // - Sessions with no Attendance entry for the student are counted as implicit absences.
  // - atRisk = true when rate < configured threshold (ATTENDANCE_AT_RISK_THRESHOLD).
  async computeAttendanceStats(
    studentId: string,
    courseId: string,
    requestingUser: AttendanceUser,
  ) {
    // 1. Course must exist
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, name: true, teacherId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    // 2. RBAC ownership
    //    - STUDENT: own stats only
    //    - TEACHER: only students of their own courses
    //    - ADMIN:  unrestricted
    if (
      requestingUser.role === Role.STUDENT &&
      requestingUser.id !== studentId
    ) {
      throw new ForbiddenException(
        'Access denied: you can only view your own statistics',
      );
    }
    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    // 3. Student must be enrolled in the course
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!enrollment) {
      throw new NotFoundException(
        `Student is not enrolled in course "${course.code}"`,
      );
    }

    // 4. Fetch non-cancelled sessions of the course
    const sessions = await this.prisma.courseSession.findMany({
      where: { courseId, cancelledAt: null },
      select: { id: true },
    });
    const totalSessions = sessions.length;

    // 5. Fetch the student's attendances for these sessions only
    const attendances =
      totalSessions === 0
        ? []
        : await this.prisma.attendance.findMany({
            where: {
              studentId,
              courseSessionId: { in: sessions.map((s) => s.id) },
            },
            select: { status: true },
          });

    // 6. Count by status
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const a of attendances) {
      if (a.status === AttendanceStatus.PRESENT) counts.present++;
      else if (a.status === AttendanceStatus.ABSENT) counts.absent++;
      else if (a.status === AttendanceStatus.LATE) counts.late++;
      else if (a.status === AttendanceStatus.EXCUSED) counts.excused++;
    }

    // 7. Sessions with no Attendance entry for this student → counted as implicit absences
    const implicitAbsent = totalSessions - attendances.length;
    counts.absent += implicitAbsent;

    // 8. Compute rate and atRisk flag
    //    If no session has been held, rate = 1 (100%) by convention → atRisk = false.
    const presentCount = counts.present + counts.excused;
    const rate = totalSessions > 0 ? presentCount / totalSessions : 1;

    return {
      studentId,
      courseId,
      courseCode: course.code,
      courseName: course.name,
      totalSessions,
      counts,
      rate: Math.round(rate * 10000) / 10000,
      ratePercent: Math.round(rate * 10000) / 100,
      threshold: AT_RISK_THRESHOLD,
      atRisk: totalSessions > 0 && rate < AT_RISK_THRESHOLD,
    };
  }

  // Attendance stats for an ENTIRE class — teacher view.
  // Optimized to avoid the N+1 problem: only 4 DB queries total
  // regardless of class size (vs 5×N with a naive loop).
  // The atRisk filter narrows the returned list without affecting the top-level summary.
  async computeCourseAttendanceStats(
    courseId: string,
    requestingUser: AttendanceUser,
    filter: FilterStatsDto,
  ) {
    // Query 1/4: course + TEACHER/ADMIN RBAC
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, name: true, teacherId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    // Query 2/4: course enrollments + each student's name
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      select: {
        studentId: true,
        student: { select: { id: true, name: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    // Query 3/4: non-cancelled sessions
    const sessions = await this.prisma.courseSession.findMany({
      where: { courseId, cancelledAt: null },
      select: { id: true },
    });
    const totalSessions = sessions.length;
    const sessionIds = sessions.map((s) => s.id);
    const enrolledStudentIds = enrollments.map((e) => e.studentId);

    // Query 4/4: ALL attendances for ALL students across these sessions, in a single pass.
    // This is the anti-N+1 trick: pull everything into memory once, then compute without further queries.
    const allAttendances =
      totalSessions === 0 || enrolledStudentIds.length === 0
        ? []
        : await this.prisma.attendance.findMany({
            where: {
              courseSessionId: { in: sessionIds },
              studentId: { in: enrolledStudentIds },
            },
            select: { studentId: true, status: true },
          });

    // Group by student (Map avoids the O(n²) cost of running a filter on every iteration)
    const attendancesByStudent = new Map<string, AttendanceStatus[]>();
    for (const a of allAttendances) {
      const list = attendancesByStudent.get(a.studentId) ?? [];
      list.push(a.status);
      attendancesByStudent.set(a.studentId, list);
    }

    // Per-student stats — pure in-memory loop, no DB query
    const students = enrollments.map((e) => {
      const studentAttendances = attendancesByStudent.get(e.studentId) ?? [];
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const status of studentAttendances) {
        if (status === AttendanceStatus.PRESENT) counts.present++;
        else if (status === AttendanceStatus.ABSENT) counts.absent++;
        else if (status === AttendanceStatus.LATE) counts.late++;
        else if (status === AttendanceStatus.EXCUSED) counts.excused++;
      }
      // Sessions with no Attendance entry for this student = implicit absences
      const implicitAbsent = totalSessions - studentAttendances.length;
      counts.absent += implicitAbsent;

      const presentCount = counts.present + counts.excused;
      const rate = totalSessions > 0 ? presentCount / totalSessions : 1;

      return {
        studentId: e.studentId,
        studentName: e.student.name,
        counts,
        rate: Math.round(rate * 10000) / 10000,
        ratePercent: Math.round(rate * 10000) / 100,
        atRisk: totalSessions > 0 && rate < AT_RISK_THRESHOLD,
      };
    });

    // Top-level summary: always computed on the FULL list (the filter does not affect global counts)
    const atRiskCount = students.filter((s) => s.atRisk).length;

    // Apply the filter only to the returned list
    const filteredStudents = filter.atRisk
      ? students.filter((s) => s.atRisk)
      : students;

    return {
      courseId,
      courseCode: course.code,
      courseName: course.name,
      totalSessions,
      threshold: AT_RISK_THRESHOLD,
      totalStudents: enrollments.length,
      atRiskCount,
      students: filteredStudents,
    };
  }
}
