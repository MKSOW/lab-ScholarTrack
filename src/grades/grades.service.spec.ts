import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GradesService } from './grades.service';

// ─── Mock types ──────────────────────────────────────────────────────────────

type PrismaMock = {
  course: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  enrollment: { findUnique: jest.Mock; findMany: jest.Mock };
  assessmentType: { findFirst: jest.Mock; findMany: jest.Mock };
  grade: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
};

const makePrismaMock = (): PrismaMock => ({
  course: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  enrollment: { findUnique: jest.fn(), findMany: jest.fn() },
  assessmentType: { findFirst: jest.fn(), findMany: jest.fn() },
  grade: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
});

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const ADMIN = { id: 'admin-1', role: Role.ADMIN };
const TEACHER = { id: 'teacher-1', role: Role.TEACHER };
const OTHER_TEACHER = { id: 'teacher-2', role: Role.TEACHER };
const STUDENT_USER = { id: 'student-1', role: Role.STUDENT };
const OTHER_STUDENT = { id: 'student-2', role: Role.STUDENT };

const COURSE = {
  id: 'c-1',
  code: 'MATH101',
  name: 'Math',
  teacherId: TEACHER.id,
};
const STUDENT_DB = { id: STUDENT_USER.id, role: Role.STUDENT, name: 'Alice' };

const makeCsvFile = (content: string): Express.Multer.File =>
  ({
    buffer: Buffer.from(content, 'utf-8'),
    mimetype: 'text/csv',
    originalname: 'grades.csv',
  }) as Express.Multer.File;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GradesService', () => {
  let service: GradesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new GradesService(prisma as unknown as PrismaService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      courseId: COURSE.id,
      studentId: STUDENT_USER.id,
      assessmentTypeId: 'at-1',
      value: 14,
      comment: undefined,
    };

    it('throws NotFoundException when the course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, TEACHER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when TEACHER grades another teacher's course", async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      await expect(service.create(dto, OTHER_TEACHER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the student does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, TEACHER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the user exists but is not STUDENT', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.user.findUnique.mockResolvedValue({
        ...STUDENT_DB,
        role: Role.TEACHER,
      });
      await expect(service.create(dto, TEACHER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the student is not enrolled', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, TEACHER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when the assessment type does not belong to the course', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      prisma.assessmentType.findFirst.mockResolvedValue(null);
      await expect(service.create(dto, TEACHER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when a grade already exists for this student + assessment type', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      prisma.assessmentType.findFirst.mockResolvedValue({
        id: 'at-1',
        name: 'CC',
      });
      prisma.grade.findFirst.mockResolvedValue({ id: 'g-existing' });
      await expect(service.create(dto, TEACHER)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates and returns the grade when all checks pass (TEACHER)', async () => {
      const createdGrade = { id: 'g-new', value: 14 };
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      prisma.assessmentType.findFirst.mockResolvedValue({
        id: 'at-1',
        name: 'CC',
      });
      prisma.grade.findFirst.mockResolvedValue(null);
      prisma.grade.create.mockResolvedValue(createdGrade);

      await expect(service.create(dto, TEACHER)).resolves.toBe(createdGrade);
      type CreateArg = {
        data: { value: number; studentId: string; courseId: string };
      };
      const createCalls = prisma.grade.create.mock.calls as unknown as [
        CreateArg,
      ][];
      expect(createCalls[0][0].data.value).toBe(dto.value);
      expect(createCalls[0][0].data.studentId).toBe(dto.studentId);
      expect(createCalls[0][0].data.courseId).toBe(dto.courseId);
    });

    it('ADMIN can grade any course regardless of teacherId', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      prisma.assessmentType.findFirst.mockResolvedValue({
        id: 'at-1',
        name: 'CC',
      });
      prisma.grade.findFirst.mockResolvedValue(null);
      prisma.grade.create.mockResolvedValue({ id: 'g-new' });

      await expect(service.create(dto, ADMIN)).resolves.toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('findByCourse', () => {
    it('throws NotFoundException when the course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.findByCourse('c-x', TEACHER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when TEACHER requests another teacher's course grades", async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      await expect(
        service.findByCourse(COURSE.id, OTHER_TEACHER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns grades when called by the course teacher', async () => {
      const grades = [{ id: 'g-1' }, { id: 'g-2' }];
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.grade.findMany.mockResolvedValue(grades);

      const result = await service.findByCourse(COURSE.id, TEACHER);
      expect(result).toEqual(grades);
    });

    it('ADMIN can access any course grades', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.grade.findMany.mockResolvedValue([]);
      await expect(
        service.findByCourse(COURSE.id, ADMIN),
      ).resolves.toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('getWeightedAverage', () => {
    const courseWithTypes = {
      ...COURSE,
      assessmentTypes: [
        { id: 'at-cc', name: 'CC', weight: '40' },
        { id: 'at-exam', name: 'EXAM', weight: '60' },
      ],
    };

    it("throws ForbiddenException when STUDENT requests another student's average", async () => {
      await expect(
        service.getWeightedAverage(OTHER_STUDENT.id, COURSE.id, STUDENT_USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.getWeightedAverage(STUDENT_USER.id, COURSE.id, ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when TEACHER requests grades in another teacher's course", async () => {
      prisma.course.findUnique.mockResolvedValue(courseWithTypes);
      await expect(
        service.getWeightedAverage(STUDENT_USER.id, COURSE.id, OTHER_TEACHER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the student does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(courseWithTypes);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.getWeightedAverage(STUDENT_USER.id, COURSE.id, TEACHER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the student is not enrolled', async () => {
      prisma.course.findUnique.mockResolvedValue(courseWithTypes);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(
        service.getWeightedAverage(STUDENT_USER.id, COURSE.id, TEACHER),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns average=null and isComplete=false when no grades exist', async () => {
      prisma.course.findUnique.mockResolvedValue(courseWithTypes);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      prisma.grade.findMany.mockResolvedValue([]);

      const result = await service.getWeightedAverage(
        STUDENT_USER.id,
        COURSE.id,
        TEACHER,
      );
      expect(result.average).toBeNull();
      expect(result.isComplete).toBe(false);
      expect(result.coveredWeight).toBe(0);
    });

    it('returns partial average and isComplete=false when only some grades exist', async () => {
      // Only CC graded (weight=40). EXAM missing.
      // weightedSum = 10 * 40/100 = 4, coveredWeight = 40
      // average = (4/40)*100 = 10.00
      prisma.course.findUnique.mockResolvedValue(courseWithTypes);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      prisma.grade.findMany.mockResolvedValue([
        { assessmentTypeId: 'at-cc', value: '10' },
      ]);

      const result = await service.getWeightedAverage(
        STUDENT_USER.id,
        COURSE.id,
        TEACHER,
      );
      expect(result.average).toBe(10);
      expect(result.isComplete).toBe(false);
      expect(result.coveredWeight).toBe(40);
    });

    it('returns correct weighted average and isComplete=true when all grades exist', async () => {
      // CC=10 (weight 40) + EXAM=15 (weight 60)
      // weightedSum = 4 + 9 = 13, coveredWeight = 100
      // average = (13/100)*100 = 13.00
      prisma.course.findUnique.mockResolvedValue(courseWithTypes);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      prisma.grade.findMany.mockResolvedValue([
        { assessmentTypeId: 'at-cc', value: '10' },
        { assessmentTypeId: 'at-exam', value: '15' },
      ]);

      const result = await service.getWeightedAverage(
        STUDENT_USER.id,
        COURSE.id,
        TEACHER,
      );
      expect(result.average).toBe(13);
      expect(result.isComplete).toBe(true);
      expect(result.details).toHaveLength(2);
    });

    it('STUDENT can access their own average', async () => {
      prisma.course.findUnique.mockResolvedValue(courseWithTypes);
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      prisma.grade.findMany.mockResolvedValue([]);

      await expect(
        service.getWeightedAverage(STUDENT_USER.id, COURSE.id, STUDENT_USER),
      ).resolves.toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('findByStudent', () => {
    it("throws ForbiddenException when STUDENT requests another student's grades", async () => {
      await expect(
        service.findByStudent(OTHER_STUDENT.id, STUDENT_USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the student does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.findByStudent(STUDENT_USER.id, ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the user is not a STUDENT', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...STUDENT_DB,
        role: Role.TEACHER,
      });
      await expect(
        service.findByStudent(STUDENT_USER.id, ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('ADMIN gets all grades for a student (no course filter)', async () => {
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.grade.findMany.mockResolvedValue([]);

      await service.findByStudent(STUDENT_USER.id, ADMIN);

      type GradeWhere = { where: Record<string, unknown> };
      const adminCalls = prisma.grade.findMany.mock.calls as unknown as [
        GradeWhere,
      ][];
      expect(adminCalls[0][0].where).not.toHaveProperty('course');
    });

    it('TEACHER gets only grades in their own courses', async () => {
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.grade.findMany.mockResolvedValue([]);

      await service.findByStudent(STUDENT_USER.id, TEACHER);

      type TeacherWhere = { where: { course?: { teacherId: string } } };
      const teacherCalls = prisma.grade.findMany.mock.calls as unknown as [
        TeacherWhere,
      ][];
      expect(teacherCalls[0][0].where.course?.teacherId).toBe(TEACHER.id);
    });

    it('STUDENT can read their own grades', async () => {
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.grade.findMany.mockResolvedValue([{ id: 'g-1' }]);

      const result = await service.findByStudent(STUDENT_USER.id, STUDENT_USER);
      expect(result).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('importFromCsv', () => {
    const VALID_HEADER = 'studentId,assessmentTypeId,value,comment';

    it('throws NotFoundException when the course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,at-1,14,`),
          ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when TEACHER imports for another teacher's course", async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,at-1,14,`),
          OTHER_TEACHER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for an empty file', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      await expect(
        service.importFromCsv(COURSE.id, makeCsvFile(''), ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the CSV header is invalid', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile('bad,header\nst-1,at-1,14,'),
          ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the file has only a header and no data rows', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([]);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.grade.findMany.mockResolvedValue([]);
      await expect(
        service.importFromCsv(COURSE.id, makeCsvFile(VALID_HEADER), ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnprocessableEntityException when a row has a missing studentId', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.grade.findMany.mockResolvedValue([]);

      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\n,at-1,14,`),
          ADMIN,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when a row has a missing assessmentTypeId', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'st-1' }]);
      prisma.grade.findMany.mockResolvedValue([]);

      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,,14,`),
          ADMIN,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('skips blank lines in the CSV without raising an error', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'st-1' }]);
      prisma.grade.findMany.mockResolvedValue([]);
      prisma.$transaction.mockResolvedValue([]);

      // Blank line between two data rows — parser must skip it
      const csv = `${VALID_HEADER}\nst-1,at-1,14,\n\n`;
      const result = await service.importFromCsv(
        COURSE.id,
        makeCsvFile(csv),
        ADMIN,
      );
      expect(result.imported).toBe(1);
    });

    it('throws UnprocessableEntityException when a grade value is out of range', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'st-1' }]);
      prisma.grade.findMany.mockResolvedValue([]);

      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,at-1,25,`), // 25 > 20
          ADMIN,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when a student is not enrolled', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([]); // no enrollments
      prisma.grade.findMany.mockResolvedValue([]);

      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,at-1,14,`),
          ADMIN,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when the assessment type does not belong to the course', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([]); // no assessment types
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'st-1' }]);
      prisma.grade.findMany.mockResolvedValue([]);

      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,at-unknown,14,`),
          ADMIN,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when a grade already exists in DB for this pair', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'st-1' }]);
      prisma.grade.findMany.mockResolvedValue([
        { studentId: 'st-1', assessmentTypeId: 'at-1' }, // already exists
      ]);

      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,at-1,14,`),
          ADMIN,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException for a CSV-level duplicate pair', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'st-1' }]);
      prisma.grade.findMany.mockResolvedValue([]);

      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,at-1,14,\nst-1,at-1,12,`),
          ADMIN,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('error report collects all errors before stopping (no early exit)', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([]);
      prisma.enrollment.findMany.mockResolvedValue([]);
      prisma.grade.findMany.mockResolvedValue([]);

      // Both rows invalid: no studentId on row 2, value NaN on row 3
      try {
        await service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\n,at-1,14,\nst-1,at-1,abc,`),
          ADMIN,
        );
        fail('Expected UnprocessableEntityException');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        const body = (err as UnprocessableEntityException).getResponse() as {
          errors: unknown[];
        };
        expect(body.errors.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('inserts all valid rows and returns imported count and course info', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
        { id: 'at-2', name: 'EXAM' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'st-1' },
        { studentId: 'st-2' },
      ]);
      prisma.grade.findMany.mockResolvedValue([]);
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.importFromCsv(
        COURSE.id,
        makeCsvFile(
          `${VALID_HEADER}\nst-1,at-1,14,\nst-1,at-2,18,Note finale\nst-2,at-1,10,`,
        ),
        ADMIN,
      );

      expect(result.imported).toBe(3);
      expect(result.course.code).toBe(COURSE.code);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('TEACHER can import grades for their own course', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.assessmentType.findMany.mockResolvedValue([
        { id: 'at-1', name: 'CC' },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'st-1' }]);
      prisma.grade.findMany.mockResolvedValue([]);
      prisma.$transaction.mockResolvedValue([]);

      await expect(
        service.importFromCsv(
          COURSE.id,
          makeCsvFile(`${VALID_HEADER}\nst-1,at-1,14,`),
          TEACHER,
        ),
      ).resolves.toMatchObject({ imported: 1 });
    });
  });
});
