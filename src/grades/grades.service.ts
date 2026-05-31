import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { parseCsvBuffer } from './utils/csv-parser';

export type GradeUser = { id: string; role: Role };

/**
 * Grade business logic: single grade entry, weighted average computation,
 * per-student / per-course listings with RBAC, and the all-or-nothing CSV
 * bulk import. All persistence goes through the injected PrismaService.
 */
@Injectable()
export class GradesService {
  private readonly logger = new Logger(GradesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a single grade after enforcing course existence, teacher ownership,
   * student enrollment, assessment-type membership and uniqueness.
   */
  async create(dto: CreateGradeDto, requestingUser: GradeUser) {
    // 1. The course must exist
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, code: true, teacherId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    // 2. A TEACHER may only record grades for their own courses
    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    // 3. The student must exist and have the STUDENT role
    const student = await this.prisma.user.findUnique({
      where: { id: dto.studentId },
      select: { id: true, role: true, name: true },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException(
        `No student found with id "${dto.studentId}"`,
      );
    }

    // 4. The student must be enrolled in the course
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: dto.studentId,
          courseId: dto.courseId,
        },
      },
    });
    if (!enrollment) {
      throw new BadRequestException(
        `Student "${student.name}" is not enrolled in course "${course.code}"`,
      );
    }

    // 5. The assessment type must belong to the course
    const assessmentType = await this.prisma.assessmentType.findFirst({
      where: { id: dto.assessmentTypeId, courseId: dto.courseId },
    });
    if (!assessmentType) {
      throw new NotFoundException(
        `Assessment type not found or does not belong to course "${course.code}"`,
      );
    }

    // 6. A grade already exists for this student / course / assessment-type combination
    const existing = await this.prisma.grade.findFirst({
      where: {
        studentId: dto.studentId,
        courseId: dto.courseId,
        assessmentTypeId: dto.assessmentTypeId,
      },
    });
    if (existing) {
      throw new ConflictException(
        `A grade already exists for "${student.name}" — type "${assessmentType.name}"`,
      );
    }

    const grade = await this.prisma.grade.create({
      data: {
        value: dto.value,
        comment: dto.comment,
        studentId: dto.studentId,
        courseId: dto.courseId,
        assessmentTypeId: dto.assessmentTypeId,
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        assessmentType: { select: { id: true, name: true, weight: true } },
        course: { select: { id: true, code: true, name: true } },
      },
    });

    this.logger.log(
      `Grade recorded: ${student.name} — ${assessmentType.name} — ${dto.value}/20 (course ${course.code})`,
    );
    return grade;
  }

  // All grades of a course, accessible to the owning Teacher and the Admin
  async findByCourse(courseId: string, requestingUser: GradeUser) {
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

    return this.prisma.grade.findMany({
      where: { courseId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        assessmentType: { select: { id: true, name: true, weight: true } },
      },
      orderBy: [{ student: { name: 'asc' } }, { gradedAt: 'desc' }],
    });
  }

  /**
   * Weighted average of a student in a course.
   * Formula: Σ(grade.value × assessmentType.weight / 100).
   * Also returns a per-assessment-type breakdown and an isComplete flag
   * (false when some assessment types have no grade yet).
   */
  async getWeightedAverage(
    studentId: string,
    courseId: string,
    requestingUser: GradeUser,
  ) {
    // Access control: a student may only see their own average
    if (
      requestingUser.role === Role.STUDENT &&
      requestingUser.id !== studentId
    ) {
      throw new ForbiddenException(
        'Access denied: you may only view your own average',
      );
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        code: true,
        name: true,
        teacherId: true,
        assessmentTypes: { select: { id: true, name: true, weight: true } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    // A Teacher may only see averages of their own course
    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, name: true },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException(`No student found with id "${studentId}"`);
    }

    // Ensure the student is enrolled in the course
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!enrollment) {
      throw new BadRequestException(
        `Student "${student.name}" is not enrolled in course "${course.code}"`,
      );
    }

    const grades = await this.prisma.grade.findMany({
      where: { studentId, courseId },
      select: { assessmentTypeId: true, value: true },
    });

    // Index grades by assessmentTypeId for O(1) lookup
    const gradeMap = new Map(
      grades.map((g) => [g.assessmentTypeId, Number(g.value)]),
    );

    let weightedSum = 0;
    let coveredWeight = 0;

    const details = course.assessmentTypes.map((at) => {
      const weight = Number(at.weight);
      const grade = gradeMap.get(at.id) ?? null;
      const contribution =
        grade !== null ? parseFloat(((grade * weight) / 100).toFixed(2)) : null;

      if (grade !== null) {
        weightedSum += (grade * weight) / 100;
        coveredWeight += weight;
      }

      return { assessmentType: at.name, weight, grade, contribution };
    });

    const isComplete = coveredWeight === 100;
    // If the average is partial, normalize it over the weights already recorded
    // to avoid an artificially low average
    const average =
      coveredWeight > 0
        ? parseFloat(((weightedSum / coveredWeight) * 100).toFixed(2))
        : null;

    return {
      student: { id: student.id, name: student.name },
      course: { id: course.id, code: course.code, name: course.name },
      average,
      isComplete,
      coveredWeight,
      details,
    };
  }

  // Grades of a student:
  // - STUDENT → only their own grades (all subjects)
  // - TEACHER → the student's grades only in the courses they teach
  // - ADMIN   → all the student's grades
  async findByStudent(studentId: string, requestingUser: GradeUser) {
    // A student may only view their own grades
    if (
      requestingUser.role === Role.STUDENT &&
      requestingUser.id !== studentId
    ) {
      throw new ForbiddenException(
        'Access denied: you may only view your own grades',
      );
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, name: true },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException(`No student found with id "${studentId}"`);
    }

    // A Teacher only sees grades in their own courses
    const courseFilter =
      requestingUser.role === Role.TEACHER
        ? { course: { teacherId: requestingUser.id } }
        : {};

    return this.prisma.grade.findMany({
      where: { studentId, ...courseFilter },
      include: {
        course: {
          select: { id: true, code: true, name: true, semester: true },
        },
        assessmentType: { select: { id: true, name: true, weight: true } },
      },
      orderBy: { gradedAt: 'desc' },
    });
  }

  /**
   * All-or-nothing CSV import: every row is validated before any write.
   * If a single row is invalid → 422 with a full error report and 0 insert.
   */
  async importFromCsv(
    courseId: string,
    file: Express.Multer.File,
    requestingUser: GradeUser,
  ) {
    // Access control
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

    // Step 1 — Parse CSV
    const { rows, parseError } = parseCsvBuffer(file.buffer);
    if (parseError) throw new BadRequestException(parseError);
    if (rows.length === 0)
      throw new BadRequestException('The CSV file contains no data rows');

    // Step 2 — Preload from the database (avoids N+1 queries during validation)
    const [assessmentTypes, enrollments, existingGrades] = await Promise.all([
      this.prisma.assessmentType.findMany({
        where: { courseId },
        select: { id: true, name: true },
      }),
      this.prisma.enrollment.findMany({
        where: { courseId },
        select: { studentId: true },
      }),
      this.prisma.grade.findMany({
        where: { courseId },
        select: { studentId: true, assessmentTypeId: true },
      }),
    ]);

    const assessmentTypeIds = new Set(assessmentTypes.map((at) => at.id));
    const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));
    // Composite key to detect duplicates already existing in the database
    const existingGradeKeys = new Set(
      existingGrades.map((g) => `${g.studentId}::${g.assessmentTypeId}`),
    );
    // Composite key to detect duplicates within the CSV file itself
    const seenInFile = new Set<string>();

    // Step 3 — Full validation of every row (collects all errors)
    const errors: {
      row: number;
      error: string;
      data: Record<string, string | undefined>;
    }[] = [];

    for (const row of rows) {
      const rowData = {
        studentId: row.studentId,
        assessmentTypeId: row.assessmentTypeId,
        value: row.value,
        comment: row.comment,
      };

      if (!row.studentId) {
        errors.push({
          row: row.rowNumber,
          error: 'The studentId field is required',
          data: rowData,
        });
        continue;
      }
      if (!row.assessmentTypeId) {
        errors.push({
          row: row.rowNumber,
          error: 'The assessmentTypeId field is required',
          data: rowData,
        });
        continue;
      }

      const numValue = parseFloat(row.value);
      if (isNaN(numValue) || numValue < 0 || numValue > 20) {
        errors.push({
          row: row.rowNumber,
          error: `Invalid value "${row.value}" — must be a number between 0 and 20`,
          data: rowData,
        });
        continue;
      }

      if (!enrolledStudentIds.has(row.studentId)) {
        errors.push({
          row: row.rowNumber,
          error: `Student "${row.studentId}" is not enrolled in course "${course.code}"`,
          data: rowData,
        });
        continue;
      }

      if (!assessmentTypeIds.has(row.assessmentTypeId)) {
        errors.push({
          row: row.rowNumber,
          error: `Assessment type "${row.assessmentTypeId}" not found in course "${course.code}"`,
          data: rowData,
        });
        continue;
      }

      const compositeKey = `${row.studentId}::${row.assessmentTypeId}`;

      if (existingGradeKeys.has(compositeKey)) {
        errors.push({
          row: row.rowNumber,
          error: `A grade already exists in the database for this student and assessment type`,
          data: rowData,
        });
        continue;
      }

      if (seenInFile.has(compositeKey)) {
        errors.push({
          row: row.rowNumber,
          error: `Duplicate in the CSV file: same student and same assessment type already present`,
          data: rowData,
        });
        continue;
      }

      seenInFile.add(compositeKey);
    }

    // Step 4 — If there are errors → write nothing (all-or-nothing)
    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: `Import cancelled: ${errors.length} error(s) detected`,
        errors,
      });
    }

    // Step 5 — Every row is valid: insert within a transaction
    const validRows = rows.filter((r) => !isNaN(parseFloat(r.value)));

    await this.prisma.$transaction(
      validRows.map((row) =>
        this.prisma.grade.create({
          data: {
            studentId: row.studentId,
            courseId,
            assessmentTypeId: row.assessmentTypeId,
            value: parseFloat(row.value),
            comment: row.comment,
          },
        }),
      ),
    );

    this.logger.log(
      `CSV import course "${course.code}": ${validRows.length} grade(s) imported by user ${requestingUser.id}`,
    );

    return {
      imported: validRows.length,
      course: { code: course.code, name: course.name },
    };
  }
}
