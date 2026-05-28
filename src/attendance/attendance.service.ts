import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';

export type AttendanceUser = { id: string; role: Role };

// Seuil de présence en dessous duquel l'étudiant est flaggé "atRisk".
// Lu une fois au chargement du module ; fallback à 0.75 si la variable n'est pas définie.
const AT_RISK_THRESHOLD = Number(
  process.env.ATTENDANCE_AT_RISK_THRESHOLD ?? 0.75,
);

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

  // Calcul des stats de présence pour (étudiant, cours).
  // - Taux = (PRESENT + EXCUSED) / total_séances_non_annulées.
  // - LATE et ABSENT comptent comme absent.
  // - Les séances sans entrée Attendance pour l'étudiant sont comptées comme absences implicites.
  // - atRisk = true si taux < seuil configuré (ATTENDANCE_AT_RISK_THRESHOLD).
  async computeAttendanceStats(
    studentId: string,
    courseId: string,
    requestingUser: AttendanceUser,
  ) {
    // 1. Le cours doit exister
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, name: true, teacherId: true },
    });
    if (!course) throw new NotFoundException('Cours introuvable');

    // 2. RBAC ownership
    //    - STUDENT : uniquement ses propres stats
    //    - TEACHER : uniquement les étudiants de ses cours
    //    - ADMIN  : pas de restriction
    if (
      requestingUser.role === Role.STUDENT &&
      requestingUser.id !== studentId
    ) {
      throw new ForbiddenException(
        'Accès refusé : vous ne pouvez consulter que vos propres statistiques',
      );
    }
    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas le professeur de ce cours",
      );
    }

    // 3. L'étudiant doit être inscrit au cours
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!enrollment) {
      throw new NotFoundException(
        `Étudiant non inscrit au cours "${course.code}"`,
      );
    }

    // 4. Récupération des séances non annulées du cours
    const sessions = await this.prisma.courseSession.findMany({
      where: { courseId, cancelledAt: null },
      select: { id: true },
    });
    const totalSessions = sessions.length;

    // 5. Récupération des présences de l'étudiant pour ces séances uniquement
    const attendances =
      totalSessions === 0
        ? []
        : await this.prisma.attendance.findMany({
            where: {
              studentId,
              courseSessionId: { in: sessions.map((s) => s.id) },
            },
            select: { status: true },
          });

    // 6. Comptage par statut
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const a of attendances) {
      if (a.status === AttendanceStatus.PRESENT) counts.present++;
      else if (a.status === AttendanceStatus.ABSENT) counts.absent++;
      else if (a.status === AttendanceStatus.LATE) counts.late++;
      else if (a.status === AttendanceStatus.EXCUSED) counts.excused++;
    }

    // 7. Séances sans entrée Attendance pour cet étudiant → comptées comme absences implicites
    const implicitAbsent = totalSessions - attendances.length;
    counts.absent += implicitAbsent;

    // 8. Calcul du taux et du flag atRisk
    //    Si aucune séance n'a été tenue, taux = 1 (100%) par convention → atRisk = false.
    const presentCount = counts.present + counts.excused;
    const rate = totalSessions > 0 ? presentCount / totalSessions : 1;

    return {
      studentId,
      courseId,
      courseCode: course.code,
      courseName: course.name,
      totalSessions,
      counts,
      rate: Math.round(rate * 10000) / 10000,
      ratePercent: Math.round(rate * 10000) / 100,
      threshold: AT_RISK_THRESHOLD,
      atRisk: totalSessions > 0 && rate < AT_RISK_THRESHOLD,
    };
  }
}
