import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService, AttendanceUser } from './attendance.service';

// Minimal Prisma mock: every method that AttendanceService touches is a jest.fn(),
// so each test can set its own return value via mockResolvedValue / mockImplementation.
type PrismaMock = {
  course: { findUnique: jest.Mock };
  courseSession: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  enrollment: { findUnique: jest.Mock; findMany: jest.Mock };
  attendance: { findMany: jest.Mock; upsert: jest.Mock };
  $transaction: jest.Mock;
};

const makePrismaMock = (): PrismaMock => ({
  course: { findUnique: jest.fn() },
  courseSession: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  enrollment: { findUnique: jest.fn(), findMany: jest.fn() },
  attendance: { findMany: jest.fn(), upsert: jest.fn() },
  $transaction: jest.fn(),
});

const TEACHER_OWNER: AttendanceUser = { id: 'teacher-1', role: Role.TEACHER };
const TEACHER_OTHER: AttendanceUser = { id: 'teacher-2', role: Role.TEACHER };
const STUDENT_SELF: AttendanceUser = { id: 'student-1', role: Role.STUDENT };
const STUDENT_OTHER: AttendanceUser = { id: 'student-2', role: Role.STUDENT };
const ADMIN: AttendanceUser = { id: 'admin-1', role: Role.ADMIN };

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AttendanceService(prisma as unknown as PrismaService);
  });

  // --------------------------------------------------------------------------
  // createSession
  // --------------------------------------------------------------------------
  describe('createSession', () => {
    const dto = {
      courseId: 'course-1',
      date: '2026-06-12T09:00:00Z',
      topic: 'Chapter 3',
    };

    it('throws NotFoundException when course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.createSession(dto, TEACHER_OWNER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when TEACHER is not the course owner', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        code: 'MATH101',
        teacherId: TEACHER_OWNER.id,
      });
      await expect(service.createSession(dto, TEACHER_OTHER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates a session when TEACHER owns the course', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        code: 'MATH101',
        teacherId: TEACHER_OWNER.id,
      });
      prisma.courseSession.create.mockResolvedValue({
        id: 'session-1',
        date: new Date(dto.date),
        course: { id: 'course-1', code: 'MATH101', name: 'Math' },
      });
      await expect(
        service.createSession(dto, TEACHER_OWNER),
      ).resolves.toMatchObject({ id: 'session-1' });
      expect(prisma.courseSession.create).toHaveBeenCalledTimes(1);
    });

    it('allows ADMIN to create a session for any course', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        code: 'MATH101',
        teacherId: TEACHER_OWNER.id,
      });
      prisma.courseSession.create.mockResolvedValue({
        id: 'session-1',
        date: new Date(dto.date),
        course: { id: 'course-1', code: 'MATH101', name: 'Math' },
      });
      await expect(service.createSession(dto, ADMIN)).resolves.toMatchObject({
        id: 'session-1',
      });
    });
  });

  // --------------------------------------------------------------------------
  // findSessionsByCourse
  // --------------------------------------------------------------------------
  describe('findSessionsByCourse', () => {
    it('throws NotFoundException when course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.findSessionsByCourse('course-1', TEACHER_OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        teacherId: TEACHER_OWNER.id,
        code: 'MATH101',
      });
      await expect(
        service.findSessionsByCourse('course-1', TEACHER_OTHER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when STUDENT is not enrolled', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        teacherId: TEACHER_OWNER.id,
        code: 'MATH101',
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(
        service.findSessionsByCourse('course-1', STUDENT_SELF),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns sessions when STUDENT is enrolled', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        teacherId: TEACHER_OWNER.id,
        code: 'MATH101',
      });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 'session-1', date: new Date(), _count: { attendances: 5 } },
      ]);
      await expect(
        service.findSessionsByCourse('course-1', STUDENT_SELF),
      ).resolves.toHaveLength(1);
    });

    it('allows ADMIN to list sessions of any course', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        teacherId: TEACHER_OWNER.id,
        code: 'MATH101',
      });
      prisma.courseSession.findMany.mockResolvedValue([]);
      await expect(
        service.findSessionsByCourse('course-1', ADMIN),
      ).resolves.toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // cancelSession
  // --------------------------------------------------------------------------
  describe('cancelSession', () => {
    it('throws NotFoundException when session does not exist', async () => {
      prisma.courseSession.findUnique.mockResolvedValue(null);
      await expect(
        service.cancelSession('session-1', TEACHER_OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: null,
        course: { teacherId: TEACHER_OWNER.id, code: 'MATH101' },
      });
      await expect(
        service.cancelSession('session-1', TEACHER_OTHER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when session is already cancelled', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: new Date(),
        course: { teacherId: TEACHER_OWNER.id, code: 'MATH101' },
      });
      await expect(
        service.cancelSession('session-1', TEACHER_OWNER),
      ).rejects.toThrow(ConflictException);
    });

    it('soft-deletes the session via cancelledAt', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: null,
        course: { teacherId: TEACHER_OWNER.id, code: 'MATH101' },
      });
      prisma.courseSession.update.mockResolvedValue({
        id: 'session-1',
        date: new Date(),
        cancelledAt: new Date(),
      });

      await service.cancelSession('session-1', TEACHER_OWNER);

      // Inspect the call args with a fully-typed view of the mock to satisfy
      // @typescript-eslint/no-unsafe-* without losing type safety.
      type UpdateArg = { where: { id: string }; data: { cancelledAt: Date } };
      const updateCalls = prisma.courseSession.update.mock
        .calls as unknown as Array<[UpdateArg]>;
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0][0].where).toEqual({ id: 'session-1' });
      expect(updateCalls[0][0].data.cancelledAt).toBeInstanceOf(Date);
    });
  });

  // --------------------------------------------------------------------------
  // recordAttendances
  // --------------------------------------------------------------------------
  describe('recordAttendances', () => {
    const dto = {
      attendances: [
        { studentId: 'student-1', status: AttendanceStatus.PRESENT },
        { studentId: 'student-2', status: AttendanceStatus.ABSENT },
      ],
    };

    it('throws NotFoundException when session does not exist', async () => {
      prisma.courseSession.findUnique.mockResolvedValue(null);
      await expect(
        service.recordAttendances('session-1', dto, TEACHER_OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when session is cancelled', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: new Date(),
        course: {
          id: 'course-1',
          teacherId: TEACHER_OWNER.id,
          code: 'MATH101',
        },
      });
      await expect(
        service.recordAttendances('session-1', dto, TEACHER_OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: null,
        course: {
          id: 'course-1',
          teacherId: TEACHER_OWNER.id,
          code: 'MATH101',
        },
      });
      await expect(
        service.recordAttendances('session-1', dto, TEACHER_OTHER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 422 when a student is not enrolled in the course', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: null,
        course: {
          id: 'course-1',
          teacherId: TEACHER_OWNER.id,
          code: 'MATH101',
        },
      });
      // Only student-1 is enrolled; student-2 in the dto will trigger 422
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'student-1' },
      ]);
      await expect(
        service.recordAttendances('session-1', dto, TEACHER_OWNER),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws 422 on duplicate studentId in the request', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: null,
        course: {
          id: 'course-1',
          teacherId: TEACHER_OWNER.id,
          code: 'MATH101',
        },
      });
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'student-1' },
      ]);
      const dupDto = {
        attendances: [
          { studentId: 'student-1', status: AttendanceStatus.PRESENT },
          { studentId: 'student-1', status: AttendanceStatus.ABSENT },
        ],
      };
      await expect(
        service.recordAttendances('session-1', dupDto, TEACHER_OWNER),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('records all attendances via $transaction on success', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: null,
        course: {
          id: 'course-1',
          teacherId: TEACHER_OWNER.id,
          code: 'MATH101',
        },
      });
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'student-1' },
        { studentId: 'student-2' },
      ]);
      prisma.$transaction.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);

      const result = await service.recordAttendances(
        'session-1',
        dto,
        TEACHER_OWNER,
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.recorded).toBe(2);
      expect(result.sessionId).toBe('session-1');
    });

    it('allows ADMIN to record attendances on any course', async () => {
      prisma.courseSession.findUnique.mockResolvedValue({
        id: 'session-1',
        cancelledAt: null,
        course: {
          id: 'course-1',
          teacherId: TEACHER_OWNER.id,
          code: 'MATH101',
        },
      });
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'student-1' },
        { studentId: 'student-2' },
      ]);
      prisma.$transaction.mockResolvedValue([{}, {}]);
      await expect(
        service.recordAttendances('session-1', dto, ADMIN),
      ).resolves.toMatchObject({ recorded: 2 });
    });
  });

  // --------------------------------------------------------------------------
  // computeAttendanceStats (per-student)
  // --------------------------------------------------------------------------
  describe('computeAttendanceStats', () => {
    const courseFound = {
      id: 'course-1',
      code: 'MATH101',
      name: 'Math',
      teacherId: TEACHER_OWNER.id,
    };

    it('throws NotFoundException when course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.computeAttendanceStats('student-1', 'course-1', ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when STUDENT requests another student stats', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      await expect(
        service.computeAttendanceStats('student-1', 'course-1', STUDENT_OTHER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      await expect(
        service.computeAttendanceStats('student-1', 'course-1', TEACHER_OTHER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when student is not enrolled', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(
        service.computeAttendanceStats('student-1', 'course-1', ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns rate=1 and atRisk=false when no session has been held', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      prisma.courseSession.findMany.mockResolvedValue([]);

      const stats = await service.computeAttendanceStats(
        'student-1',
        'course-1',
        ADMIN,
      );
      expect(stats.totalSessions).toBe(0);
      expect(stats.rate).toBe(1);
      expect(stats.atRisk).toBe(false);
      // No session → no attendance query needed
      expect(prisma.attendance.findMany).not.toHaveBeenCalled();
    });

    it('reaches 100% when all attendances are PRESENT or EXCUSED', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.EXCUSED },
        { status: AttendanceStatus.PRESENT },
      ]);

      const stats = await service.computeAttendanceStats(
        'student-1',
        'course-1',
        ADMIN,
      );
      expect(stats.rate).toBe(1);
      expect(stats.ratePercent).toBe(100);
      expect(stats.atRisk).toBe(false);
      expect(stats.counts).toEqual({
        present: 2,
        absent: 0,
        late: 0,
        excused: 1,
      });
    });

    it('counts LATE as absent (not part of the rate)', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.LATE },
        { status: AttendanceStatus.LATE },
      ]);

      const stats = await service.computeAttendanceStats(
        'student-1',
        'course-1',
        ADMIN,
      );
      expect(stats.rate).toBe(0);
      expect(stats.counts.late).toBe(2);
      expect(stats.atRisk).toBe(true);
    });

    it('counts sessions without an attendance entry as implicit absences', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      // 4 non-cancelled sessions, but only 2 attendance entries → 2 implicit absences
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
        { id: 's4' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
      ]);

      const stats = await service.computeAttendanceStats(
        'student-1',
        'course-1',
        ADMIN,
      );
      expect(stats.totalSessions).toBe(4);
      expect(stats.counts.absent).toBe(2);
      expect(stats.rate).toBe(0.5);
    });

    it('sets atRisk=true when rate is strictly below the threshold (default 0.75)', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      // 6 present / 9 sessions = 66.67% < 75% → atRisk
      prisma.courseSession.findMany.mockResolvedValue(
        Array.from({ length: 9 }, (_, i) => ({ id: `s${i}` })),
      );
      prisma.attendance.findMany.mockResolvedValue([
        ...Array.from({ length: 6 }, () => ({
          status: AttendanceStatus.PRESENT,
        })),
        ...Array.from({ length: 3 }, () => ({
          status: AttendanceStatus.ABSENT,
        })),
      ]);

      const stats = await service.computeAttendanceStats(
        'student-1',
        'course-1',
        ADMIN,
      );
      expect(stats.atRisk).toBe(true);
    });

    it('sets atRisk=false when rate is at or above the threshold', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      // 3 present / 4 sessions = 75% → NOT atRisk (boundary check, strict <)
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
        { id: 's4' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.ABSENT },
      ]);

      const stats = await service.computeAttendanceStats(
        'student-1',
        'course-1',
        ADMIN,
      );
      expect(stats.atRisk).toBe(false);
    });

    it('allows STUDENT to view their OWN stats', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      prisma.courseSession.findMany.mockResolvedValue([]);

      await expect(
        service.computeAttendanceStats('student-1', 'course-1', STUDENT_SELF),
      ).resolves.toMatchObject({ studentId: 'student-1' });
    });
  });

  // --------------------------------------------------------------------------
  // computeCourseAttendanceStats (class-wide)
  // --------------------------------------------------------------------------
  describe('computeCourseAttendanceStats', () => {
    const courseFound = {
      id: 'course-1',
      code: 'MATH101',
      name: 'Math',
      teacherId: TEACHER_OWNER.id,
    };

    it('throws NotFoundException when course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.computeCourseAttendanceStats('course-1', ADMIN, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      await expect(
        service.computeCourseAttendanceStats('course-1', TEACHER_OTHER, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns one entry per enrolled student with the right rate', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'student-1', student: { id: 'student-1', name: 'Alice' } },
        { studentId: 'student-2', student: { id: 'student-2', name: 'Bob' } },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { studentId: 'student-1', status: AttendanceStatus.PRESENT },
        { studentId: 'student-1', status: AttendanceStatus.PRESENT },
        { studentId: 'student-2', status: AttendanceStatus.ABSENT },
        { studentId: 'student-2', status: AttendanceStatus.ABSENT },
      ]);

      const result = await service.computeCourseAttendanceStats(
        'course-1',
        ADMIN,
        {},
      );
      expect(result.totalStudents).toBe(2);
      expect(result.students).toHaveLength(2);
      const alice = result.students.find((s) => s.studentId === 'student-1');
      const bob = result.students.find((s) => s.studentId === 'student-2');
      expect(alice?.rate).toBe(1);
      expect(alice?.atRisk).toBe(false);
      expect(bob?.rate).toBe(0);
      expect(bob?.atRisk).toBe(true);
    });

    it('atRiskCount reflects the full enrolled list even when filter is active', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'student-1', student: { id: 'student-1', name: 'Alice' } },
        { studentId: 'student-2', student: { id: 'student-2', name: 'Bob' } },
        { studentId: 'student-3', student: { id: 'student-3', name: 'Chloe' } },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.attendance.findMany.mockResolvedValue([
        { studentId: 'student-1', status: AttendanceStatus.PRESENT },
        { studentId: 'student-2', status: AttendanceStatus.ABSENT },
        { studentId: 'student-3', status: AttendanceStatus.ABSENT },
      ]);

      const filtered = await service.computeCourseAttendanceStats(
        'course-1',
        ADMIN,
        { atRisk: true },
      );
      expect(filtered.totalStudents).toBe(3);
      expect(filtered.atRiskCount).toBe(2); // computed on full list
      expect(filtered.students).toHaveLength(2); // filtered list
      expect(filtered.students.every((s) => s.atRisk)).toBe(true);
    });

    it('uses exactly 4 Prisma queries regardless of student count (N+1 protection)', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      // Simulate a large class
      const bigEnrollments = Array.from({ length: 100 }, (_, i) => ({
        studentId: `student-${i}`,
        student: { id: `student-${i}`, name: `Student ${i}` },
      }));
      prisma.enrollment.findMany.mockResolvedValue(bigEnrollments);
      prisma.courseSession.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.attendance.findMany.mockResolvedValue([]);

      await service.computeCourseAttendanceStats('course-1', ADMIN, {});

      // Anti-N+1 guarantee: 1 course + 1 enrollments + 1 sessions + 1 attendances = 4
      expect(prisma.course.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.enrollment.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.courseSession.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.attendance.findMany).toHaveBeenCalledTimes(1);
    });

    it('skips the attendance query when there are no sessions or no enrollments', async () => {
      prisma.course.findUnique.mockResolvedValue(courseFound);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.courseSession.findMany.mockResolvedValue([]);

      const result = await service.computeCourseAttendanceStats(
        'course-1',
        ADMIN,
        {},
      );
      expect(result.totalStudents).toBe(0);
      expect(result.students).toEqual([]);
      expect(prisma.attendance.findMany).not.toHaveBeenCalled();
    });
  });
});
