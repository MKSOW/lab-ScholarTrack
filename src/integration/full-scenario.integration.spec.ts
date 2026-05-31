import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesController } from '../courses/courses.controller';
import { CoursesService } from '../courses/courses.service';
import { CapacityPipe } from '../courses/pipes/capacity.pipe';
import { GradesController } from '../grades/grades.controller';
import { GradesService } from '../grades/grades.service';

/**
 * Integration test — full end-to-end scenario.
 *
 * Architecture choice: we do NOT use the HTTP layer (supertest), because it
 * would pull in Better Auth (ESM) and `req.user` resolution by its guard.
 * Instead, we wire the REAL controllers + services + pipe through a NestJS
 * TestingModule, all sharing a single *stateful in-memory* PrismaService double.
 * State created in one step is read back in the next, like a real database —
 * which lets us play a realistic business scenario and integrate several units
 * together (real DI), beyond a simple unit test.
 */

// ─── In-memory Prisma fake ─────────────────────────────────────────────────────

interface Store {
  users: Array<{ id: string; role: Role; name: string; email: string }>;
  courses: Array<{
    id: string;
    code: string;
    name: string;
    description?: string;
    capacity: number;
    semester: string;
    teacherId: string;
    createdAt: Date;
  }>;
  assessmentTypes: Array<{
    id: string;
    name: string;
    weight: number;
    courseId: string;
  }>;
  enrollments: Array<{
    id: string;
    studentId: string;
    courseId: string;
    createdAt: Date;
  }>;
  grades: Array<{
    id: string;
    value: number;
    comment?: string;
    studentId: string;
    courseId: string;
    assessmentTypeId: string;
    gradedAt: Date;
  }>;
}

/** Builds a PrismaService double covering exactly the surface used by
 *  CoursesService, GradesService and CapacityPipe in this scenario. */
function createPrismaFake(store: Store) {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  const enrichCourse = (c: Store['courses'][number]) => ({
    ...c,
    assessmentTypes: store.assessmentTypes.filter((a) => a.courseId === c.id),
    teacher: store.users.find((u) => u.id === c.teacherId) ?? null,
    _count: {
      enrollments: store.enrollments.filter((e) => e.courseId === c.id).length,
    },
  });

  const fake = {
    user: {
      findUnique: ({ where }: { where: { id?: string; email?: string } }) =>
        Promise.resolve(
          store.users.find(
            (u) =>
              (where.id !== undefined && u.id === where.id) ||
              (where.email !== undefined && u.email === where.email),
          ) ?? null,
        ),
    },

    course: {
      findUnique: ({ where }: { where: { id?: string; code?: string } }) => {
        const found = store.courses.find(
          (c) =>
            (where.id !== undefined && c.id === where.id) ||
            (where.code !== undefined && c.code === where.code),
        );
        return Promise.resolve(found ? enrichCourse(found) : null);
      },
      create: ({
        data,
      }: {
        data: {
          code: string;
          name: string;
          description?: string;
          capacity: number;
          semester: string;
          teacherId: string;
          assessmentTypes: { create: Array<{ name: string; weight: number }> };
        };
      }) => {
        const course = {
          id: nextId('course'),
          code: data.code,
          name: data.name,
          description: data.description,
          capacity: data.capacity,
          semester: data.semester,
          teacherId: data.teacherId,
          createdAt: new Date(),
        };
        store.courses.push(course);
        for (const at of data.assessmentTypes.create) {
          store.assessmentTypes.push({
            id: nextId('at'),
            name: at.name,
            weight: at.weight,
            courseId: course.id,
          });
        }
        return Promise.resolve(enrichCourse(course));
      },
    },

    enrollment: {
      findUnique: ({
        where,
      }: {
        where: { studentId_courseId: { studentId: string; courseId: string } };
      }) => {
        const { studentId, courseId } = where.studentId_courseId;
        return Promise.resolve(
          store.enrollments.find(
            (e) => e.studentId === studentId && e.courseId === courseId,
          ) ?? null,
        );
      },
      findMany: ({ where }: { where: { courseId: string } }) =>
        Promise.resolve(
          store.enrollments.filter((e) => e.courseId === where.courseId),
        ),
      create: ({ data }: { data: { studentId: string; courseId: string } }) => {
        const enrollment = {
          id: nextId('enr'),
          studentId: data.studentId,
          courseId: data.courseId,
          createdAt: new Date(),
        };
        store.enrollments.push(enrollment);
        const course = store.courses.find((c) => c.id === data.courseId)!;
        const student = store.users.find((u) => u.id === data.studentId)!;
        return Promise.resolve({ ...enrollment, course, student });
      },
    },

    assessmentType: {
      findFirst: ({ where }: { where: { id: string; courseId: string } }) =>
        Promise.resolve(
          store.assessmentTypes.find(
            (a) => a.id === where.id && a.courseId === where.courseId,
          ) ?? null,
        ),
      findMany: ({ where }: { where: { courseId: string } }) =>
        Promise.resolve(
          store.assessmentTypes.filter((a) => a.courseId === where.courseId),
        ),
    },

    grade: {
      findFirst: ({
        where,
      }: {
        where: {
          studentId: string;
          courseId: string;
          assessmentTypeId: string;
        };
      }) =>
        Promise.resolve(
          store.grades.find(
            (g) =>
              g.studentId === where.studentId &&
              g.courseId === where.courseId &&
              g.assessmentTypeId === where.assessmentTypeId,
          ) ?? null,
        ),
      findMany: ({
        where,
      }: {
        where: { studentId?: string; courseId: string };
      }) =>
        Promise.resolve(
          store.grades.filter(
            (g) =>
              g.courseId === where.courseId &&
              (where.studentId === undefined ||
                g.studentId === where.studentId),
          ),
        ),
      create: ({
        data,
      }: {
        data: {
          value: number;
          comment?: string;
          studentId: string;
          courseId: string;
          assessmentTypeId: string;
        };
      }) => {
        const grade = {
          id: nextId('grade'),
          value: data.value,
          comment: data.comment,
          studentId: data.studentId,
          courseId: data.courseId,
          assessmentTypeId: data.assessmentTypeId,
          gradedAt: new Date(),
        };
        store.grades.push(grade);
        return Promise.resolve({
          ...grade,
          student: store.users.find((u) => u.id === grade.studentId) ?? null,
          assessmentType:
            store.assessmentTypes.find(
              (a) => a.id === grade.assessmentTypeId,
            ) ?? null,
          course: store.courses.find((c) => c.id === grade.courseId) ?? null,
        });
      },
    },

    // $transaction: callback form (receives the transaction = the fake itself)
    // or array form (promises already started → Promise.all).
    $transaction: (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof fake) => unknown)(fake)
        : Promise.all(arg as Promise<unknown>[]),
  };

  return fake;
}

// ─── Fixtures & helpers ────────────────────────────────────────────────────────

const ADMIN = { id: 'admin-1', role: Role.ADMIN };
const TEACHER = { id: 'teacher-1', role: Role.TEACHER };
const STUDENT_1 = { id: 'student-1', role: Role.STUDENT };
const STUDENT_2 = { id: 'student-2', role: Role.STUDENT };
const STUDENT_3 = { id: 'student-3', role: Role.STUDENT };

const seedUsers = (store: Store) => {
  store.users.push(
    { ...ADMIN, name: 'Admin', email: 'admin@x.com' },
    { ...TEACHER, name: 'Prof Smith', email: 'smith@x.com' },
    { ...STUDENT_1, name: 'Alice', email: 'alice@x.com' },
    { ...STUDENT_2, name: 'Bob', email: 'bob@x.com' },
    { ...STUDENT_3, name: 'Charlie', email: 'charlie@x.com' },
  );
};

const makeCsvFile = (content: string): Express.Multer.File =>
  ({ buffer: Buffer.from(content, 'utf-8') }) as Express.Multer.File;

// ─── Scenario ──────────────────────────────────────────────────────────────────

describe('Full scenario (integration) — course → enrollment → grades → average → CSV', () => {
  let store: Store;
  let coursesController: CoursesController;
  let gradesController: GradesController;
  let capacityPipe: CapacityPipe;

  beforeEach(async () => {
    store = {
      users: [],
      courses: [],
      assessmentTypes: [],
      enrollments: [],
      grades: [],
    };
    seedUsers(store);
    const prismaFake = createPrismaFake(store);

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController, GradesController],
      providers: [
        CoursesService,
        GradesService,
        CapacityPipe,
        { provide: PrismaService, useValue: prismaFake },
      ],
    }).compile();

    coursesController = moduleRef.get(CoursesController);
    gradesController = moduleRef.get(GradesController);
    capacityPipe = moduleRef.get(CapacityPipe);
  });

  it('runs the full business flow end to end', async () => {
    // ── 1. Admin creates a course (capacity 2, 2 assessment types) ────────────
    const course = await coursesController.create({
      code: 'MATH101',
      name: 'Algebra',
      capacity: 2,
      semester: '2026-S1',
      teacherId: TEACHER.id,
      assessmentTypes: [
        { name: 'CC', weight: 40 },
        { name: 'Examen', weight: 60 },
      ],
    });

    expect(course.code).toBe('MATH101');
    expect(course.assessmentTypes).toHaveLength(2);
    const ccId = course.assessmentTypes.find((a) => a.name === 'CC')!.id;
    const examId = course.assessmentTypes.find((a) => a.name === 'Examen')!.id;

    // ── 2. Admin enrolls Alice — the CapacityPipe runs upstream ──────────
    const checkedId = await capacityPipe.transform(course.id);
    expect(checkedId).toBe(course.id);
    const enrollment = await coursesController.enroll(checkedId, {
      studentId: STUDENT_1.id,
    });
    expect(enrollment.student.id).toBe(STUDENT_1.id);
    expect(store.enrollments).toHaveLength(1);

    // ── 3. Re-enroll Alice → 409 (the service detects the duplicate) ──────────────
    await expect(
      coursesController.enroll(course.id, { studentId: STUDENT_1.id }),
    ).rejects.toBeInstanceOf(ConflictException);

    // ── 4. Enroll Bob (capacity 2 → OK), then Charlie → pipe rejects (full) ─
    await coursesController.enroll(await capacityPipe.transform(course.id), {
      studentId: STUDENT_2.id,
    });
    await expect(capacityPipe.transform(course.id)).rejects.toBeInstanceOf(
      ConflictException,
    );

    // ── 5. The teacher records Alice's CC grade ────────────────────────────────
    const grade = await gradesController.create(
      {
        courseId: course.id,
        studentId: STUDENT_1.id,
        assessmentTypeId: ccId,
        value: 14,
      },
      { user: TEACHER },
    );
    expect(grade.value).toBe(14);

    // Duplicate grade → 409
    await expect(
      gradesController.create(
        {
          courseId: course.id,
          studentId: STUDENT_1.id,
          assessmentTypeId: ccId,
          value: 12,
        },
        { user: TEACHER },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    // Grade for Charlie (not enrolled) → 400
    await expect(
      gradesController.create(
        {
          courseId: course.id,
          studentId: STUDENT_3.id,
          assessmentTypeId: ccId,
          value: 10,
        },
        { user: TEACHER },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // ── 6. Partial average (only CC recorded) → isComplete false ─────────
    const partial = await gradesController.getWeightedAverage(
      STUDENT_1.id,
      course.id,
      { user: TEACHER },
    );
    expect(partial.isComplete).toBe(false);
    expect(partial.coveredWeight).toBe(40);
    expect(partial.average).toBe(14); // normalized over the covered weight

    // ── 7. CSV import of Alice's exam grade → all-or-nothing ───────────────
    const csv = `studentId,assessmentTypeId,value,comment\n${STUDENT_1.id},${examId},16,Good`;
    const report = await gradesController.importFromCsv(
      course.id,
      makeCsvFile(csv),
      { user: TEACHER },
    );
    expect(report.imported).toBe(1);
    expect(store.grades).toHaveLength(2);

    // ── 8. Average now complete: (14×40 + 16×60)/100 = 15.2 ─────────────
    const full = await gradesController.getWeightedAverage(
      STUDENT_1.id,
      course.id,
      { user: TEACHER },
    );
    expect(full.isComplete).toBe(true);
    expect(full.coveredWeight).toBe(100);
    expect(full.average).toBe(15.2);
  });

  it("enforces RBAC: a student cannot read another student's average", async () => {
    const course = await coursesController.create({
      code: 'PHY101',
      name: 'Physics',
      capacity: 5,
      semester: '2026-S1',
      teacherId: TEACHER.id,
      assessmentTypes: [{ name: 'CC', weight: 100 }],
    });
    await coursesController.enroll(course.id, { studentId: STUDENT_1.id });

    // Bob (student-2) tries to read Alice's average (student-1)
    await expect(
      gradesController.getWeightedAverage(STUDENT_1.id, course.id, {
        user: STUDENT_2,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects the whole CSV import if a single row is invalid (all-or-nothing)', async () => {
    const course = await coursesController.create({
      code: 'BIO101',
      name: 'Biology',
      capacity: 5,
      semester: '2026-S1',
      teacherId: TEACHER.id,
      assessmentTypes: [{ name: 'CC', weight: 100 }],
    });
    const ccId = course.assessmentTypes[0].id;
    await coursesController.enroll(course.id, { studentId: STUDENT_1.id });

    // 2 rows: the 1st valid, the 2nd has an out-of-range grade (> 20)
    const csv =
      `studentId,assessmentTypeId,value,comment\n` +
      `${STUDENT_1.id},${ccId},15,ok\n` +
      `${STUDENT_1.id},${ccId},42,outofrange`;

    await expect(
      gradesController.importFromCsv(course.id, makeCsvFile(csv), {
        user: TEACHER,
      }),
    ).rejects.toThrow();
    // No grade inserted: all-or-nothing respected
    expect(store.grades).toHaveLength(0);
  });
});
