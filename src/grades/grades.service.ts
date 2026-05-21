import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';

export type GradeUser = { id: string; role: Role };

@Injectable()
export class GradesService {
  private readonly logger = new Logger(GradesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGradeDto, requestingUser: GradeUser) {
    // 1. Le cours doit exister
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, code: true, teacherId: true },
    });
    if (!course) throw new NotFoundException('Cours introuvable');

    // 2. Un TEACHER ne peut saisir des notes que pour ses propres cours
    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas le professeur de ce cours",
      );
    }

    // 3. L'étudiant doit exister et avoir le rôle STUDENT
    const student = await this.prisma.user.findUnique({
      where: { id: dto.studentId },
      select: { id: true, role: true, name: true },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException(
        `Aucun étudiant trouvé avec l'identifiant "${dto.studentId}"`,
      );
    }

    // 4. L'étudiant doit être inscrit au cours
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
        `L'étudiant "${student.name}" n'est pas inscrit au cours "${course.code}"`,
      );
    }

    // 5. Le type d'évaluation doit appartenir au cours
    const assessmentType = await this.prisma.assessmentType.findFirst({
      where: { id: dto.assessmentTypeId, courseId: dto.courseId },
    });
    if (!assessmentType) {
      throw new NotFoundException(
        `Type d'évaluation introuvable ou n'appartient pas au cours "${course.code}"`,
      );
    }

    // 6. Une note existe déjà pour cette combinaison étudiant / cours / type d'évaluation
    const existing = await this.prisma.grade.findFirst({
      where: {
        studentId: dto.studentId,
        courseId: dto.courseId,
        assessmentTypeId: dto.assessmentTypeId,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Une note existe déjà pour "${student.name}" — type "${assessmentType.name}"`,
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
      `Note saisie : ${student.name} — ${assessmentType.name} — ${dto.value}/20 (cours ${course.code})`,
    );
    return grade;
  }

  // Toutes les notes d'un cours, accessibles au Teacher propriétaire et à l'Admin
  async findByCourse(courseId: string, requestingUser: GradeUser) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true, code: true },
    });
    if (!course) throw new NotFoundException('Cours introuvable');

    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas le professeur de ce cours",
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

  // Notes d'un étudiant :
  // - STUDENT → uniquement ses propres notes (toutes les matières)
  // - TEACHER → notes de l'étudiant uniquement dans les cours qu'il enseigne
  // - ADMIN   → toutes les notes de l'étudiant
  async findByStudent(studentId: string, requestingUser: GradeUser) {
    // Un étudiant ne peut consulter que ses propres notes
    if (
      requestingUser.role === Role.STUDENT &&
      requestingUser.id !== studentId
    ) {
      throw new ForbiddenException(
        'Accès refusé : vous ne pouvez consulter que vos propres notes',
      );
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, name: true },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException(
        `Aucun étudiant trouvé avec l'identifiant "${studentId}"`,
      );
    }

    // Un Teacher ne voit que les notes dans ses cours
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
}
