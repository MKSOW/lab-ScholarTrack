import { NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

// Minimal Prisma mock — only the methods AdminService.getSemesterStats touches.
type PrismaMock = {
  course: { count: jest.Mock; findMany: jest.Mock };
  enrollment: { count: jest.Mock; findMany: jest.Mock };
  grade: { groupBy: jest.Mock };
  courseSession: { findMany: jest.Mock };
  attendance: { findMany: jest.Mock };
};

const makePrismaMock = (): PrismaMock => ({
  course: { count: jest.fn(), findMany: jest.fn() },
  enrollment: { count: jest.fn(), findMany: jest.fn() },
  grade: { groupBy: jest.fn() },
  courseSession: { findMany: jest.fn() },
  attendance: { findMany: jest.fn() },
});

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AdminService(prisma as unknown as PrismaService);
  });

  describe('getSemesterStats', () => {
    it('throws NotFoundException when the semester has no courses', async () => {
      prisma.course.count.mockResolvedValue(0);
      await expect(service.getSemesterStats('2099-S1')).rejects.toThrow(
        NotFoundException,
      );
      // No reason to hit any other table if there is no course
      expect(prisma.enrollment.count).not.toHaveBeenCalled();
    });

    it('returns totalCourses, totalEnrollments and uniqueStudentsCount', async () => {
      prisma.course.count.mockResolvedValue(2);
      prisma.enrollment.count.mockResolvedValue(5);
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'st-1' },
        { studentId: 'st-2' },
        { studentId: 'st-3' },
      ]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'MATH101',
          name: 'Math',
          _count: { enrollments: 3 },
        },
        {
          id: 'c2',
          code: 'PHY101',
          name: 'Physics',
          _count: { enrollments: 2 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const stats = await service.getSemesterStats('2026-S1');
      expect(stats.totalCourses).toBe(2);
      expect(stats.totalEnrollments).toBe(5);
      expect(stats.uniqueStudentsCount).toBe(3);
      expect(stats.semester).toBe('2026-S1');
    });

    it('uses prisma `distinct` to count unique students (no double counting)', async () => {
      prisma.course.count.mockResolvedValue(1);
      prisma.enrollment.count.mockResolvedValue(0);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      await service.getSemesterStats('2026-S1');

      // The 2nd call to enrollment is the distinct query
      type DistinctCall = [{ distinct?: string[] }];
      const enrollmentCalls = prisma.enrollment.findMany.mock
        .calls as unknown as DistinctCall[];
      expect(enrollmentCalls[0][0].distinct).toEqual(['studentId']);
    });

    it('merges grade averages from groupBy with course metadata', async () => {
      prisma.course.count.mockResolvedValue(2);
      prisma.enrollment.count.mockResolvedValue(0);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.grade.groupBy.mockResolvedValue([
        { courseId: 'c1', _avg: { value: 13.456 }, _count: { _all: 10 } },
        { courseId: 'c2', _avg: { value: 8.0 }, _count: { _all: 5 } },
      ]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'MATH101',
          name: 'Math',
          _count: { enrollments: 5 },
        },
        {
          id: 'c2',
          code: 'PHY101',
          name: 'Physics',
          _count: { enrollments: 5 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const stats = await service.getSemesterStats('2026-S1');
      const math = stats.averagePerCourse.find((c) => c.courseId === 'c1');
      const phy = stats.averagePerCourse.find((c) => c.courseId === 'c2');
      // Rounded to 2 decimals
      expect(math?.average).toBe(13.46);
      expect(math?.gradeCount).toBe(10);
      expect(phy?.average).toBe(8);
      expect(phy?.gradeCount).toBe(5);
    });

    it('returns average=null and gradeCount=0 for a course that has no grades yet', async () => {
      prisma.course.count.mockResolvedValue(1);
      prisma.enrollment.count.mockResolvedValue(0);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.grade.groupBy.mockResolvedValue([]); // no grades at all
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'CHEM101',
          name: 'Chemistry',
          _count: { enrollments: 0 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const stats = await service.getSemesterStats('2026-S1');
      expect(stats.averagePerCourse[0].average).toBeNull();
      expect(stats.averagePerCourse[0].gradeCount).toBe(0);
    });

    it('computes per-course attendance rate and atRisk count from a single batched query', async () => {
      prisma.course.count.mockResolvedValue(1);
      prisma.enrollment.count.mockResolvedValue(2);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([]) // distinct call
        .mockResolvedValueOnce([
          // batched enrollments for attendance
          { studentId: 'st-1', courseId: 'c1' },
          { studentId: 'st-2', courseId: 'c1' },
        ]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'MATH101',
          name: 'Math',
          _count: { enrollments: 2 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1', courseId: 'c1' },
        { id: 's2', courseId: 'c1' },
      ]);
      // st-1: 2 present → rate 1.0 → not atRisk
      // st-2: 0 present (no entry) → rate 0.0 → atRisk
      prisma.attendance.findMany.mockResolvedValue([
        {
          studentId: 'st-1',
          status: AttendanceStatus.PRESENT,
          courseSessionId: 's1',
        },
        {
          studentId: 'st-1',
          status: AttendanceStatus.PRESENT,
          courseSessionId: 's2',
        },
      ]);

      const stats = await service.getSemesterStats('2026-S1');
      const course = stats.averagePerCourse[0];
      expect(course.attendanceRate).toBe(0.5); // (1.0 + 0.0) / 2 students
      expect(course.atRiskCount).toBe(1); // st-2 below threshold
    });

    it('counts EXCUSED as present in the attendance rate', async () => {
      prisma.course.count.mockResolvedValue(1);
      prisma.enrollment.count.mockResolvedValue(1);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ studentId: 'st-1', courseId: 'c1' }]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'MATH101',
          name: 'Math',
          _count: { enrollments: 1 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1', courseId: 'c1' },
        { id: 's2', courseId: 'c1' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        {
          studentId: 'st-1',
          status: AttendanceStatus.PRESENT,
          courseSessionId: 's1',
        },
        {
          studentId: 'st-1',
          status: AttendanceStatus.EXCUSED,
          courseSessionId: 's2',
        },
      ]);

      const stats = await service.getSemesterStats('2026-S1');
      expect(stats.averagePerCourse[0].attendanceRate).toBe(1);
      expect(stats.averagePerCourse[0].atRiskCount).toBe(0);
    });

    it('treats LATE and ABSENT as not-present', async () => {
      prisma.course.count.mockResolvedValue(1);
      prisma.enrollment.count.mockResolvedValue(1);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ studentId: 'st-1', courseId: 'c1' }]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'MATH101',
          name: 'Math',
          _count: { enrollments: 1 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1', courseId: 'c1' },
        { id: 's2', courseId: 'c1' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        {
          studentId: 'st-1',
          status: AttendanceStatus.LATE,
          courseSessionId: 's1',
        },
        {
          studentId: 'st-1',
          status: AttendanceStatus.ABSENT,
          courseSessionId: 's2',
        },
      ]);

      const stats = await service.getSemesterStats('2026-S1');
      expect(stats.averagePerCourse[0].attendanceRate).toBe(0);
      expect(stats.averagePerCourse[0].atRiskCount).toBe(1);
    });

    it('excludes cancelled sessions from the denominator', async () => {
      prisma.course.count.mockResolvedValue(1);
      prisma.enrollment.count.mockResolvedValue(1);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ studentId: 'st-1', courseId: 'c1' }]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'MATH101',
          name: 'Math',
          _count: { enrollments: 1 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1', courseId: 'c1' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        {
          studentId: 'st-1',
          status: AttendanceStatus.PRESENT,
          courseSessionId: 's1',
        },
      ]);

      const stats = await service.getSemesterStats('2026-S1');
      // The query uses cancelledAt: null in its where clause
      type SessionsCall = [{ where: { cancelledAt: null } }];
      const sessionCalls = prisma.courseSession.findMany.mock
        .calls as unknown as SessionsCall[];
      expect(sessionCalls[0][0].where.cancelledAt).toBeNull();
      // And 1 session held + 1 present → rate 1
      expect(stats.averagePerCourse[0].attendanceRate).toBe(1);
    });

    it('aggregates globalAtRiskCount as the sum of per-course atRiskCount', async () => {
      prisma.course.count.mockResolvedValue(2);
      prisma.enrollment.count.mockResolvedValue(4);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { studentId: 'st-1', courseId: 'c1' },
          { studentId: 'st-2', courseId: 'c1' },
          { studentId: 'st-3', courseId: 'c2' },
          { studentId: 'st-4', courseId: 'c2' },
        ]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'C1',
          name: 'C1',
          _count: { enrollments: 2 },
        },
        {
          id: 'c2',
          code: 'C2',
          name: 'C2',
          _count: { enrollments: 2 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1', courseId: 'c1' },
        { id: 's2', courseId: 'c2' },
      ]);
      // c1: 1 atRisk (st-2). c2: 2 atRisk (st-3, st-4)
      prisma.attendance.findMany.mockResolvedValue([
        {
          studentId: 'st-1',
          status: AttendanceStatus.PRESENT,
          courseSessionId: 's1',
        },
        // st-2, st-3, st-4 have no entries → implicit absences → rate 0 → atRisk
      ]);

      const stats = await service.getSemesterStats('2026-S1');
      expect(stats.globalAtRiskCount).toBe(3);
    });

    it('aggregates globalAttendanceRate as the mean of per-course rates', async () => {
      prisma.course.count.mockResolvedValue(2);
      prisma.enrollment.count.mockResolvedValue(2);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { studentId: 'st-1', courseId: 'c1' },
          { studentId: 'st-2', courseId: 'c2' },
        ]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'C1',
          name: 'C1',
          _count: { enrollments: 1 },
        },
        {
          id: 'c2',
          code: 'C2',
          name: 'C2',
          _count: { enrollments: 1 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1', courseId: 'c1' },
        { id: 's2', courseId: 'c2' },
      ]);
      // c1: st-1 present → rate 1
      // c2: st-2 absent → rate 0
      prisma.attendance.findMany.mockResolvedValue([
        {
          studentId: 'st-1',
          status: AttendanceStatus.PRESENT,
          courseSessionId: 's1',
        },
      ]);

      const stats = await service.getSemesterStats('2026-S1');
      // (1 + 0) / 2 = 0.5
      expect(stats.globalAttendanceRate).toBe(0.5);
    });

    it('exposes the configured threshold in the response', async () => {
      prisma.course.count.mockResolvedValue(1);
      prisma.enrollment.count.mockResolvedValue(0);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.grade.groupBy.mockResolvedValue([]);
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'C1',
          name: 'C1',
          _count: { enrollments: 0 },
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const stats = await service.getSemesterStats('2026-S1');
      // Default threshold is 0.75 unless ATTENDANCE_AT_RISK_THRESHOLD is set
      expect(typeof stats.threshold).toBe('number');
      expect(stats.threshold).toBeGreaterThan(0);
      expect(stats.threshold).toBeLessThanOrEqual(1);
    });
  });
});
