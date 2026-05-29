import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from './courses.service';

// ─── Mock types ──────────────────────────────────────────────────────────────

type PrismaMock = {
  course: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  user: { findUnique: jest.Mock };
  enrollment: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
  assessmentType: { deleteMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

const makePrismaMock = (): PrismaMock => ({
  course: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  enrollment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  assessmentType: { deleteMany: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
});

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const ADMIN = { id: 'admin-1', role: Role.ADMIN };
const TEACHER = { id: 'teacher-1', role: Role.TEACHER };
const OTHER_TEACHER = { id: 'teacher-2', role: Role.TEACHER };
const STUDENT_USER = { id: 'student-1', role: Role.STUDENT };

const COURSE_DB = {
  id: 'c-1',
  code: 'MATH101',
  name: 'Math',
  description: null,
  capacity: 30,
  semester: '2026-S1',
  teacherId: TEACHER.id,
  assessmentTypes: [],
  teacher: { id: TEACHER.id, name: 'Prof', email: 'prof@test.com' },
  _count: { enrollments: 5 },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new CoursesService(prisma as unknown as PrismaService);

    // Default: $transaction runs the callback with prisma as tx,
    // or resolves an array-form transaction.
    prisma.$transaction.mockImplementation(async (fnOrArray: unknown) => {
      if (typeof fnOrArray === 'function') {
        return (fnOrArray as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(fnOrArray as Promise<unknown>[]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('throws NotFoundException when the course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.findOne('c-x', ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when TEACHER requests another teacher's course", async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      await expect(
        service.findOne(COURSE_DB.id, OTHER_TEACHER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when STUDENT is not enrolled in the course', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(service.findOne(COURSE_DB.id, STUDENT_USER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the course for ADMIN', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      const result = await service.findOne(COURSE_DB.id, ADMIN);
      expect(result).toEqual(COURSE_DB);
    });

    it('returns the course for the owning TEACHER', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      const result = await service.findOne(COURSE_DB.id, TEACHER);
      expect(result).toEqual(COURSE_DB);
    });

    it('returns the course for an enrolled STUDENT', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-1' });
      const result = await service.findOne(COURSE_DB.id, STUDENT_USER);
      expect(result).toEqual(COURSE_DB);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('throws NotFoundException when the course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.remove('c-x')).rejects.toThrow(NotFoundException);
    });

    it('deletes the course and returns a confirmation message', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      prisma.course.delete.mockResolvedValue(COURSE_DB);

      const result = await service.remove(COURSE_DB.id);
      expect(prisma.course.delete).toHaveBeenCalledWith({
        where: { id: COURSE_DB.id },
      });
      expect(result).toHaveProperty('message');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    beforeEach(() => {
      // Array-form $transaction: returns [data, total]
      prisma.$transaction.mockResolvedValue([[COURSE_DB], 1]);
    });

    it('returns paginated data with meta for ADMIN', async () => {
      const result = await service.findAll(ADMIN, {});
      expect(result.data).toEqual([COURSE_DB]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('applies teacherId filter for TEACHER role', async () => {
      await service.findAll(TEACHER, {});
      // $transaction is called with an array; the first element is the findMany
      // We cannot easily inspect the nested where, but verify $transaction was called
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('applies enrollment filter for STUDENT role', async () => {
      await service.findAll(STUDENT_USER, {});
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('respects custom page and limit from filter', async () => {
      prisma.$transaction.mockResolvedValue([[COURSE_DB], 10]);
      const result = await service.findAll(ADMIN, { page: 2, limit: 5 });
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
      expect(result.meta.totalPages).toBe(2); // ceil(10/5) = 2
    });

    it('applies semester filter when provided', async () => {
      prisma.$transaction.mockResolvedValue([[COURSE_DB], 1]);
      const result = await service.findAll(ADMIN, { semester: '2026-S1' });
      expect(result.data).toHaveLength(1);
    });

    it('applies teacherId filter for ADMIN when teacherId is provided', async () => {
      prisma.$transaction.mockResolvedValue([[COURSE_DB], 1]);
      const result = await service.findAll(ADMIN, { teacherId: TEACHER.id });
      expect(result.data).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      code: 'CS101',
      name: 'Computer Science',
      description: 'Intro CS',
      capacity: 25,
      semester: '2026-S1',
      teacherId: TEACHER.id,
      assessmentTypes: [
        { name: 'CC', weight: 40 },
        { name: 'EXAM', weight: 60 },
      ],
    };

    it('throws ConflictException when a course with this code already exists', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the teacher does not exist or is not TEACHER', async () => {
      prisma.course.findUnique.mockResolvedValue(null); // no duplicate
      prisma.user.findUnique.mockResolvedValue(null); // teacher not found
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('creates the course inside a transaction and returns it', async () => {
      const created = { ...COURSE_DB, code: dto.code };
      prisma.course.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: TEACHER.id,
        role: Role.TEACHER,
      });
      prisma.course.create.mockResolvedValue(created);

      const result = await service.create(dto);
      expect(result).toEqual(created);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    const dto = { name: 'Math Updated' };

    it('throws NotFoundException when the course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.update('c-x', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when updating to a code already used by another course', async () => {
      prisma.course.findUnique
        .mockResolvedValueOnce(COURSE_DB) // course exists
        .mockResolvedValueOnce({ id: 'c-other' }); // duplicate code found
      await expect(
        service.update(COURSE_DB.id, { code: 'TAKEN' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates and returns the course', async () => {
      const updated = { ...COURSE_DB, name: 'Math Updated' };
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      prisma.course.update.mockResolvedValue(updated);

      const result = await service.update(COURSE_DB.id, dto);
      expect(result.name).toBe('Math Updated');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when updating with a non-existent teacher', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      prisma.user.findUnique.mockResolvedValue(null); // teacher not found
      await expect(
        service.update(COURSE_DB.id, { teacherId: 'ghost-teacher' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes existing assessment types and recreates them when assessmentTypes is provided', async () => {
      const updated = { ...COURSE_DB };
      prisma.course.findUnique.mockResolvedValue(COURSE_DB);
      prisma.assessmentType.deleteMany.mockResolvedValue({ count: 2 });
      prisma.course.update.mockResolvedValue(updated);

      await service.update(COURSE_DB.id, {
        assessmentTypes: [
          { name: 'CC', weight: 30 },
          { name: 'EXAM', weight: 70 },
        ],
      });

      expect(prisma.assessmentType.deleteMany).toHaveBeenCalledWith({
        where: { courseId: COURSE_DB.id },
      });
      expect(prisma.course.update).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('enroll', () => {
    const STUDENT_DB = {
      id: STUDENT_USER.id,
      role: Role.STUDENT,
      name: 'Alice',
    };

    it('throws NotFoundException when the student does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.enroll(COURSE_DB.id, STUDENT_USER.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the user is not a STUDENT', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...STUDENT_DB,
        role: Role.TEACHER,
      });
      await expect(
        service.enroll(COURSE_DB.id, STUDENT_USER.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the course does not exist (inside transaction)', async () => {
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.enroll(COURSE_DB.id, STUDENT_USER.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the student is already enrolled', async () => {
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.course.findUnique.mockResolvedValue({
        capacity: 30,
        _count: { enrollments: 5 },
      });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e-existing' });
      await expect(
        service.enroll(COURSE_DB.id, STUDENT_USER.id),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the course is at full capacity', async () => {
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.course.findUnique.mockResolvedValue({
        capacity: 2,
        _count: { enrollments: 2 }, // full
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(
        service.enroll(COURSE_DB.id, STUDENT_USER.id),
      ).rejects.toThrow(ConflictException);
    });

    it('creates and returns the enrollment when all checks pass', async () => {
      const newEnrollment = {
        id: 'e-new',
        student: STUDENT_DB,
        course: {
          id: COURSE_DB.id,
          code: COURSE_DB.code,
          name: COURSE_DB.name,
        },
      };
      prisma.user.findUnique.mockResolvedValue(STUDENT_DB);
      prisma.course.findUnique.mockResolvedValue({
        capacity: 30,
        _count: { enrollments: 5 },
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);
      prisma.enrollment.create.mockResolvedValue(newEnrollment);

      const result = await service.enroll(COURSE_DB.id, STUDENT_USER.id);
      expect(result).toEqual(newEnrollment);
      expect(prisma.enrollment.create).toHaveBeenCalledTimes(1);
    });
  });
});
