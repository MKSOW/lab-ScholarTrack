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
import { CreateSessionDto } from './dto/create-session.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';

export type AttendanceUser = { id: string; role: Role };

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Création d'une séance — un Teacher ne peut créer que pour ses propres cours
  async createSession(dto: CreateSessionDto, requestingUser: AttendanceUser) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, code: true, teacherId: true },
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

    const session = await this.prisma.courseSession.create({
      data: {
        courseId: dto.courseId,
        date: new Date(dto.date),
        topic: dto.topic,
      },
      include: {
        course: { select: { id: true, code: true, name: true } },
      },
    });

    this.logger.log(
      `Séance créée : ${course.code} — ${session.date.toISOString()}`,
    );
    return session;
  }

  // Liste des séances d'un cours — accès filtré selon le rôle
  async findSessionsByCourse(courseId: string, requestingUser: AttendanceUser) {
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

    // Un étudiant doit être inscrit au cours pour voir ses séances
    if (requestingUser.role === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: {
          studentId_courseId: { studentId: requestingUser.id, courseId },
        },
      });
      if (!enrollment) {
        throw new ForbiddenException(
          "Accès refusé : vous n'êtes pas inscrit à ce cours",
        );
      }
    }

    return this.prisma.courseSession.findMany({
      where: { courseId },
      include: { _count: { select: { attendances: true } } },
      orderBy: { date: 'desc' },
    });
  }

  // Annulation d'une séance — soft delete via cancelledAt
  async cancelSession(sessionId: string, requestingUser: AttendanceUser) {
    const session = await this.prisma.courseSession.findUnique({
      where: { id: sessionId },
      include: { course: { select: { teacherId: true, code: true } } },
    });
    if (!session) throw new NotFoundException('Séance introuvable');

    if (
      requestingUser.role === Role.TEACHER &&
      session.course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas le professeur de ce cours",
      );
    }

    if (session.cancelledAt) {
      throw new ConflictException('Cette séance est déjà annulée');
    }

    const updated = await this.prisma.courseSession.update({
      where: { id: sessionId },
      data: { cancelledAt: new Date() },
    });

    this.logger.log(
      `Séance annulée : ${session.course.code} — ${updated.date.toISOString()}`,
    );
    return updated;
  }

  // Enregistrement en masse — toutes les présences validées avant toute écriture.
  // Si une seule entrée est invalide → 422 avec rapport, aucune ligne touchée.
  // Upsert pour permettre la correction d'une présence déjà saisie.
  async recordAttendances(
    sessionId: string,
    dto: RecordAttendanceDto,
    requestingUser: AttendanceUser,
  ) {
    // 1. La séance doit exister
    const session = await this.prisma.courseSession.findUnique({
      where: { id: sessionId },
      include: {
        course: { select: { id: true, teacherId: true, code: true } },
      },
    });
    if (!session) throw new NotFoundException('Séance introuvable');

    // 2. La séance ne doit pas être annulée
    if (session.cancelledAt) {
      throw new BadRequestException(
        "Impossible d'enregistrer des présences sur une séance annulée",
      );
    }

    // 3. Un TEACHER ne peut saisir que pour ses propres cours
    if (
      requestingUser.role === Role.TEACHER &&
      session.course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas le professeur de ce cours",
      );
    }

    // 4. Pré-chargement des étudiants inscrits (évite N+1 queries)
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: session.course.id },
      select: { studentId: true },
    });
    const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));

    // 5. Validation complète — collecte de toutes les erreurs avant toute écriture
    const errors: { index: number; studentId: string; error: string }[] = [];
    const seenInRequest = new Set<string>();

    dto.attendances.forEach((item, index) => {
      if (!enrolledStudentIds.has(item.studentId)) {
        errors.push({
          index,
          studentId: item.studentId,
          error: `Étudiant non inscrit au cours "${session.course.code}"`,
        });
        return;
      }
      if (seenInRequest.has(item.studentId)) {
        errors.push({
          index,
          studentId: item.studentId,
          error:
            'Doublon : cet étudiant apparaît plusieurs fois dans la requête',
        });
        return;
      }
      seenInRequest.add(item.studentId);
    });

    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: `Enregistrement annulé : ${errors.length} erreur(s) détectée(s)`,
        errors,
      });
    }

    // 6. Transaction upsert — atomique : tout ou rien
    const results = await this.prisma.$transaction(
      dto.attendances.map((item) =>
        this.prisma.attendance.upsert({
          where: {
            studentId_courseSessionId: {
              studentId: item.studentId,
              courseSessionId: sessionId,
            },
          },
          update: { status: item.status, recordedAt: new Date() },
          create: {
            studentId: item.studentId,
            courseSessionId: sessionId,
            status: item.status,
          },
        }),
      ),
    );

    this.logger.log(
      `Présences enregistrées : ${results.length} pour séance ${session.id} (cours ${session.course.code})`,
    );

    return {
      recorded: results.length,
      sessionId,
      course: { code: session.course.code },
    };
  }
}
