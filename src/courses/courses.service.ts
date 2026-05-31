import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { FilterCoursesDto } from './dto/filter-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

export type CourseUser = { id: string; role: Role };

/**
 * Course business logic: CRUD with per-role rights, assessment-type weighting,
 * role-aware filtering/pagination, and capacity-safe student enrollment.
 * All persistence goes through the injected PrismaService.
 */
@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Creates a course and its assessment types within a single transaction. */
  async create(dto: CreateCourseDto) {
    const existing = await this.prisma.course.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `A course with code "${dto.code}" already exists`,
      );
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId },
      select: { id: true, role: true },
    });
    if (!teacher || teacher.role !== Role.TEACHER) {
      throw new NotFoundException(
        `No teacher found with id "${dto.teacherId}"`,
      );
    }

    // Transaction: create the course and its assessment types together.
    // If the assessment-type creation fails, the course is rolled back.
    const course = await this.prisma.$transaction(async (tx) => {
      return tx.course.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          capacity: dto.capacity,
          semester: dto.semester,
          teacherId: dto.teacherId,
          assessmentTypes: {
            create: dto.assessmentTypes.map((at) => ({
              name: at.name,
              weight: at.weight,
            })),
          },
        },
        include: {
          assessmentTypes: true,
          teacher: { select: { id: true, name: true, email: true } },
        },
      });
    });

    this.logger.log(`Course created: ${course.code} — ${course.name}`);
    return course;
  }

  /** Lists courses with role-based scoping and pagination. */
  async findAll(user: CourseUser, filter: FilterCoursesDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const skip = (page - 1) * limit;

    // Build the filter: common base + role-based restriction
    const where: Prisma.CourseWhereInput = {};
    if (filter.semester) {
      where.semester = filter.semester;
    }

    if (user.role === Role.TEACHER) {
      // A teacher only sees their own courses
      where.teacherId = user.id;
    } else if (user.role === Role.STUDENT) {
      // A student only sees the courses they are enrolled in
      where.enrollments = { some: { studentId: user.id } };
    } else if (filter.teacherId) {
      // Admin only: optional filter by teacher
      where.teacherId = filter.teacherId;
    }

    // findMany + count run in a single transaction (one DB round-trip).
    // count uses the same where → total consistent with the paginated data.
    const [data, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        include: {
          assessmentTypes: true,
          teacher: { select: { id: true, name: true, email: true } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Returns a single course detail with role-based access checks. */
  async findOne(id: string, user: CourseUser) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        assessmentTypes: true,
        teacher: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    });

    if (!course) throw new NotFoundException('Course not found');

    if (user.role === Role.TEACHER && course.teacherId !== user.id) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    if (user.role === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.id, courseId: id } },
      });
      if (!enrollment) {
        throw new ForbiddenException(
          'Access denied: you are not enrolled in this course',
        );
      }
    }

    return course;
  }

  /** Updates a course; assessment types are replaced when provided. */
  async update(id: string, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');

    if (dto.code && dto.code !== course.code) {
      const duplicate = await this.prisma.course.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new ConflictException(
          `A course with code "${dto.code}" already exists`,
        );
      }
    }

    if (dto.teacherId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: dto.teacherId },
        select: { role: true },
      });
      if (!teacher || teacher.role !== Role.TEACHER) {
        throw new NotFoundException(
          `No teacher found with id "${dto.teacherId}"`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // If new assessment types are provided, delete the old ones and recreate
      // them — simpler than an individual upsert
      if (dto.assessmentTypes) {
        await tx.assessmentType.deleteMany({ where: { courseId: id } });
      }

      return tx.course.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          capacity: dto.capacity,
          semester: dto.semester,
          teacherId: dto.teacherId,
          ...(dto.assessmentTypes && {
            assessmentTypes: {
              create: dto.assessmentTypes.map((at) => ({
                name: at.name,
                weight: at.weight,
              })),
            },
          }),
        },
        include: { assessmentTypes: true },
      });
    });

    this.logger.log(`Course updated: ${updated.code}`);
    return updated;
  }

  /** Hard-deletes a course. */
  async remove(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');

    await this.prisma.course.delete({ where: { id } });
    this.logger.log(`Course deleted: ${course.code}`);
    return { message: `Course "${course.code}" deleted successfully` };
  }

  /**
   * Enrolls a student. Capacity and duplicate checks run in the same
   * (serializable) transaction as the enrollment creation to avoid race
   * conditions.
   */
  async enroll(courseId: string, studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, name: true },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException(`No student found with id "${studentId}"`);
    }

    const enrollment = await this.prisma.$transaction(
      async (tx) => {
        const course = await tx.course.findUnique({
          where: { id: courseId },
          select: { capacity: true, _count: { select: { enrollments: true } } },
        });
        if (!course) throw new NotFoundException('Course not found');

        const existing = await tx.enrollment.findUnique({
          where: { studentId_courseId: { studentId, courseId } },
        });
        if (existing) {
          throw new ConflictException(
            'The student is already enrolled in this course',
          );
        }

        if (course._count.enrollments >= course.capacity) {
          throw new ConflictException(
            'The maximum capacity of this course has been reached',
          );
        }

        return tx.enrollment.create({
          data: { studentId, courseId },
          include: {
            student: { select: { id: true, name: true, email: true } },
            course: { select: { id: true, code: true, name: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `Enrollment: ${student.name} → course ${enrollment.course.code}`,
    );
    return enrollment;
  }
}
