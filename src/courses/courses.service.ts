import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

export type CourseUser = { id: string; role: Role };

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourseDto) {
    const existing = await this.prisma.course.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Un cours avec le code "${dto.code}" existe déjà`,
      );
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId },
      select: { id: true, role: true },
    });
    if (!teacher || teacher.role !== Role.TEACHER) {
      throw new NotFoundException(
        `Aucun enseignant trouvé avec l'identifiant "${dto.teacherId}"`,
      );
    }

    // Transaction : on crée le cours et ses types d'évaluation ensemble.
    // Si la création des assessment types échoue, le cours est annulé.
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

    this.logger.log(`Cours créé : ${course.code} — ${course.name}`);
    return course;
  }

  async findAll(user: CourseUser) {
    if (user.role === Role.ADMIN) {
      return this.prisma.course.findMany({
        include: {
          assessmentTypes: true,
          teacher: { select: { id: true, name: true, email: true } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.TEACHER) {
      return this.prisma.course.findMany({
        where: { teacherId: user.id },
        include: {
          assessmentTypes: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // STUDENT : seulement les cours auxquels il est inscrit
    return this.prisma.course.findMany({
      where: { enrollments: { some: { studentId: user.id } } },
      include: {
        assessmentTypes: true,
        teacher: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: CourseUser) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        assessmentTypes: true,
        teacher: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    });

    if (!course) throw new NotFoundException('Cours introuvable');

    if (user.role === Role.TEACHER && course.teacherId !== user.id) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas le professeur de ce cours",
      );
    }

    if (user.role === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.id, courseId: id } },
      });
      if (!enrollment) {
        throw new ForbiddenException(
          "Accès refusé : vous n'êtes pas inscrit à ce cours",
        );
      }
    }

    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Cours introuvable');

    if (dto.code && dto.code !== course.code) {
      const duplicate = await this.prisma.course.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new ConflictException(
          `Un cours avec le code "${dto.code}" existe déjà`,
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
          `Aucun enseignant trouvé avec l'identifiant "${dto.teacherId}"`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Si de nouveaux types d'évaluation sont fournis, on supprime les anciens
      // et on recrée — plus simple qu'un upsert individuel
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

    this.logger.log(`Cours mis à jour : ${updated.code}`);
    return updated;
  }

  async remove(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Cours introuvable');

    await this.prisma.course.delete({ where: { id } });
    this.logger.log(`Cours supprimé : ${course.code}`);
    return { message: `Cours "${course.code}" supprimé avec succès` };
  }
}
