import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

// Minimal Prisma mock — only the methods AdminService touches.
type PrismaMock = {
  course: { count: jest.Mock; findMany: jest.Mock };
  enrollment: { count: jest.Mock; findMany: jest.Mock; create: jest.Mock };
  grade: { groupBy: jest.Mock; findMany: jest.Mock };
  courseSession: { findMany: jest.Mock };
  attendance: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

const makePrismaMock = (): PrismaMock => ({
  course: { count: jest.fn(), findMany: jest.fn() },
  enrollment: { count: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  grade: { groupBy: jest.fn(), findMany: jest.fn() },
  courseSession: { findMany: jest.fn() },
  attendance: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  $transaction: jest.fn(),
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

  describe('exportSemesterCsv', () => {
    it('throws NotFoundException when semester has no courses', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      await expect(service.exportSemesterCsv('2099-S1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a CSV string whose first line is the expected header', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'c1', code: 'MATH101', name: 'Math', assessmentTypes: [] },
      ]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([]) // exportSemesterCsv enrollments query
        .mockResolvedValueOnce([]); // computePerStudentCourseAttendanceRates enrollments
      prisma.grade.findMany.mockResolvedValue([]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const csv = await service.exportSemesterCsv('2026-S1');
      const header = csv.split('\n')[0];
      expect(header).toBe(
        'studentId,studentName,studentEmail,courseCode,courseName,weightedAverage,isComplete,attendanceRate,atRisk',
      );
    });

    it('computes the weighted average correctly when grades cover all weights', async () => {
      // Course with two assessment types: CC 40%, EXAM 60%
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'MATH101',
          name: 'Math',
          assessmentTypes: [
            { id: 'at-cc', weight: '40' },
            { id: 'at-exam', weight: '60' },
          ],
        },
      ]);
      // One enrolled student
      prisma.enrollment.findMany
        .mockResolvedValueOnce([
          {
            studentId: 'st-1',
            courseId: 'c1',
            student: { id: 'st-1', name: 'Alice', email: 'alice@test.com' },
          },
        ])
        .mockResolvedValueOnce([{ studentId: 'st-1', courseId: 'c1' }]);
      // CC = 10, EXAM = 15 → (10*40/100 + 15*60/100) / 1 → weightedSum=4+9=13 coveredWeight=100
      // average = (13/100)*100 = 13.00
      prisma.grade.findMany.mockResolvedValue([
        {
          studentId: 'st-1',
          courseId: 'c1',
          assessmentTypeId: 'at-cc',
          value: '10',
        },
        {
          studentId: 'st-1',
          courseId: 'c1',
          assessmentTypeId: 'at-exam',
          value: '15',
        },
      ]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const csv = await service.exportSemesterCsv('2026-S1');
      const dataRow = csv.split('\n')[1];
      const cols = dataRow.split(',');
      // weightedAverage column (index 5)
      expect(cols[5]).toBe('13.00');
      // isComplete column (index 6) — both weights covered → 100
      expect(cols[6]).toBe('true');
    });

    it('leaves weightedAverage empty and isComplete=false when no grades exist', async () => {
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'PHY101',
          name: 'Physics',
          assessmentTypes: [{ id: 'at-exam', weight: '100' }],
        },
      ]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([
          {
            studentId: 'st-1',
            courseId: 'c1',
            student: { id: 'st-1', name: 'Bob', email: 'bob@test.com' },
          },
        ])
        .mockResolvedValueOnce([{ studentId: 'st-1', courseId: 'c1' }]);
      prisma.grade.findMany.mockResolvedValue([]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const csv = await service.exportSemesterCsv('2026-S1');
      const cols = csv.split('\n')[1].split(',');
      expect(cols[5]).toBe(''); // weightedAverage
      expect(cols[6]).toBe('false'); // isComplete
    });

    it('marks atRisk=true when attendance rate is below threshold', async () => {
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'BIO101',
          name: 'Biology',
          assessmentTypes: [],
        },
      ]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([
          {
            studentId: 'st-1',
            courseId: 'c1',
            student: { id: 'st-1', name: 'Carol', email: 'carol@test.com' },
          },
        ])
        .mockResolvedValueOnce([{ studentId: 'st-1', courseId: 'c1' }]);
      prisma.grade.findMany.mockResolvedValue([]);
      // 2 sessions; student present for 0 → rate=0 → atRisk=true
      prisma.courseSession.findMany.mockResolvedValue([
        { id: 's1', courseId: 'c1' },
        { id: 's2', courseId: 'c1' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const csv = await service.exportSemesterCsv('2026-S1');
      const cols = csv.split('\n')[1].split(',');
      expect(cols[7]).toBe('0'); // attendanceRate
      expect(cols[8]).toBe('true'); // atRisk
    });

    it('escapes commas in student names by wrapping the cell in double-quotes', async () => {
      prisma.course.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'CS101',
          name: 'Computer Science',
          assessmentTypes: [],
        },
      ]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([
          {
            studentId: 'st-1',
            courseId: 'c1',
            student: {
              id: 'st-1',
              name: 'Doe, John',
              email: 'doe@test.com',
            },
          },
        ])
        .mockResolvedValueOnce([{ studentId: 'st-1', courseId: 'c1' }]);
      prisma.grade.findMany.mockResolvedValue([]);
      prisma.courseSession.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const csv = await service.exportSemesterCsv('2026-S1');
      // The name contains a comma so it must be quoted
      expect(csv).toContain('"Doe, John"');
    });
  });

  describe('importEnrollmentsFromCsv', () => {
    // Helper to create a fake Multer file from a CSV string
    const makeCsvFile = (content: string): Express.Multer.File =>
      ({
        buffer: Buffer.from(content, 'utf-8'),
        mimetype: 'text/csv',
        originalname: 'enrollments.csv',
      }) as Express.Multer.File;

    it('throws BadRequestException when the file is empty', async () => {
      await expect(
        service.importEnrollmentsFromCsv(makeCsvFile('')),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the CSV header is invalid', async () => {
      await expect(
        service.importEnrollmentsFromCsv(
          makeCsvFile('student,course\nst-1,c1'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnprocessableEntityException when a studentId is missing', async () => {
      // Pre-load: course exists, student pre-load doesn't matter
      prisma.course.findMany.mockResolvedValue([
        { id: 'c1', code: 'MATH101', capacity: 30, _count: { enrollments: 0 } },
      ]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.enrollment.findMany.mockResolvedValue([]);

      await expect(
        service.importEnrollmentsFromCsv(
          makeCsvFile('studentId,courseId\n,c1'),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when a course does not exist', async () => {
      prisma.course.findMany.mockResolvedValue([]); // no courses found
      prisma.user.findMany.mockResolvedValue([{ id: 'st-1' }]);
      prisma.enrollment.findMany.mockResolvedValue([]);

      await expect(
        service.importEnrollmentsFromCsv(
          makeCsvFile('studentId,courseId\nst-1,unknown-course'),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when a student does not exist or is not STUDENT', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'c1', code: 'MATH101', capacity: 30, _count: { enrollments: 0 } },
      ]);
      prisma.user.findMany.mockResolvedValue([]); // student not found with role STUDENT
      prisma.enrollment.findMany.mockResolvedValue([]);

      await expect(
        service.importEnrollmentsFromCsv(
          makeCsvFile('studentId,courseId\nst-ghost,c1'),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when a student is already enrolled', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'c1', code: 'MATH101', capacity: 30, _count: { enrollments: 1 } },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'st-1' }]);
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'st-1', courseId: 'c1' }, // already enrolled
      ]);

      await expect(
        service.importEnrollmentsFromCsv(
          makeCsvFile('studentId,courseId\nst-1,c1'),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException for a CSV-level duplicate pair', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'c1', code: 'MATH101', capacity: 30, _count: { enrollments: 0 } },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'st-1' }]);
      prisma.enrollment.findMany.mockResolvedValue([]);

      // Same pair twice in the file
      await expect(
        service.importEnrollmentsFromCsv(
          makeCsvFile('studentId,courseId\nst-1,c1\nst-1,c1'),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when the import would exceed course capacity', async () => {
      prisma.course.findMany.mockResolvedValue([
        // capacity=1, already 1 enrolled → 0 slots left
        { id: 'c1', code: 'MATH101', capacity: 1, _count: { enrollments: 1 } },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'st-1' }]);
      prisma.enrollment.findMany.mockResolvedValue([]);

      await expect(
        service.importEnrollmentsFromCsv(
          makeCsvFile('studentId,courseId\nst-1,c1'),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('inserts all valid rows and returns the correct summary on success', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'c1', code: 'MATH101', capacity: 10, _count: { enrollments: 0 } },
        { id: 'c2', code: 'PHY101', capacity: 10, _count: { enrollments: 2 } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'st-1' },
        { id: 'st-2' },
        { id: 'st-3' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.importEnrollmentsFromCsv(
        makeCsvFile('studentId,courseId\nst-1,c1\nst-2,c1\nst-3,c2'),
      );

      expect(result.imported).toBe(3);
      const mathSummary = result.summary.find(
        (s) => s.courseCode === 'MATH101',
      );
      const phySummary = result.summary.find((s) => s.courseCode === 'PHY101');
      expect(mathSummary?.enrolled).toBe(2);
      expect(phySummary?.enrolled).toBe(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('error report contains all row-level errors before stopping', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'c1', code: 'MATH101', capacity: 10, _count: { enrollments: 0 } },
      ]);
      prisma.user.findMany.mockResolvedValue([]); // no valid students
      prisma.enrollment.findMany.mockResolvedValue([]);

      // Both rows should produce errors (student not found)
      try {
        await service.importEnrollmentsFromCsv(
          makeCsvFile('studentId,courseId\nst-1,c1\nst-2,c1'),
        );
        fail('Expected UnprocessableEntityException');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        const body = (err as UnprocessableEntityException).getResponse() as {
          errors: unknown[];
        };
        expect(body.errors).toHaveLength(2);
      }
    });
  });
});
