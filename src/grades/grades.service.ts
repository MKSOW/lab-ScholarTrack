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

  // Moyenne pondérée d'un étudiant dans un cours.
  // Formule : Σ(note.value × assessmentType.weight / 100)
  // Retourne aussi un détail par type d'évaluation et un flag isComplete
  // (false si certains types d'évaluation n'ont pas encore de note).
  async getWeightedAverage(
    studentId: string,
    courseId: string,
    requestingUser: GradeUser,
  ) {
    // Contrôle d'accès : un étudiant ne voit que sa propre moyenne
    if (
      requestingUser.role === Role.STUDENT &&
      requestingUser.id !== studentId
    ) {
      throw new ForbiddenException(
        'Accès refusé : vous ne pouvez consulter que votre propre moyenne',
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
    if (!course) throw new NotFoundException('Cours introuvable');

    // Un Teacher ne peut voir que les moyennes de son propre cours
    if (
      requestingUser.role === Role.TEACHER &&
      course.teacherId !== requestingUser.id
    ) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas le professeur de ce cours",
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

    // Vérifier que l'étudiant est inscrit au cours
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!enrollment) {
      throw new BadRequestException(
        `L'étudiant "${student.name}" n'est pas inscrit au cours "${course.code}"`,
      );
    }

    const grades = await this.prisma.grade.findMany({
      where: { studentId, courseId },
      select: { assessmentTypeId: true, value: true },
    });

    // Indexer les notes par assessmentTypeId pour une recherche en O(1)
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
    // Si la moyenne est partielle, on la ramène sur les poids déjà saisis
    // pour éviter une moyenne artificiellement basse
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

  // Import CSV tout-ou-rien : toutes les lignes sont validées avant toute écriture.
  // Si une seule ligne est invalide → 422 avec rapport d'erreurs complet, 0 insertion.
  async importFromCsv(
    courseId: string,
    file: Express.Multer.File,
    requestingUser: GradeUser,
  ) {
    // Contrôle d'accès
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, name: true, teacherId: true },
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

    // Étape 1 — Parse CSV
    const { rows, parseError } = parseCsvBuffer(file.buffer);
    if (parseError) throw new BadRequestException(parseError);
    if (rows.length === 0)
      throw new BadRequestException(
        'Le fichier CSV ne contient aucune ligne de données',
      );

    // Étape 2 — Pré-chargement en base (évite N+1 queries lors de la validation)
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
    // Clé composite pour détecter les doublons existants en base
    const existingGradeKeys = new Set(
      existingGrades.map((g) => `${g.studentId}::${g.assessmentTypeId}`),
    );
    // Clé composite pour détecter les doublons dans le fichier CSV lui-même
    const seenInFile = new Set<string>();

    // Étape 3 — Validation complète de toutes les lignes (collecte toutes les erreurs)
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
          error: 'Le champ studentId est requis',
          data: rowData,
        });
        continue;
      }
      if (!row.assessmentTypeId) {
        errors.push({
          row: row.rowNumber,
          error: 'Le champ assessmentTypeId est requis',
          data: rowData,
        });
        continue;
      }

      const numValue = parseFloat(row.value);
      if (isNaN(numValue) || numValue < 0 || numValue > 20) {
        errors.push({
          row: row.rowNumber,
          error: `Valeur invalide "${row.value}" — doit être un nombre entre 0 et 20`,
          data: rowData,
        });
        continue;
      }

      if (!enrolledStudentIds.has(row.studentId)) {
        errors.push({
          row: row.rowNumber,
          error: `L'étudiant "${row.studentId}" n'est pas inscrit au cours "${course.code}"`,
          data: rowData,
        });
        continue;
      }

      if (!assessmentTypeIds.has(row.assessmentTypeId)) {
        errors.push({
          row: row.rowNumber,
          error: `Type d'évaluation "${row.assessmentTypeId}" introuvable dans le cours "${course.code}"`,
          data: rowData,
        });
        continue;
      }

      const compositeKey = `${row.studentId}::${row.assessmentTypeId}`;

      if (existingGradeKeys.has(compositeKey)) {
        errors.push({
          row: row.rowNumber,
          error: `Une note existe déjà en base pour cet étudiant et ce type d'évaluation`,
          data: rowData,
        });
        continue;
      }

      if (seenInFile.has(compositeKey)) {
        errors.push({
          row: row.rowNumber,
          error: `Doublon dans le fichier CSV : même étudiant et même type d'évaluation déjà présents`,
          data: rowData,
        });
        continue;
      }

      seenInFile.add(compositeKey);
    }

    // Étape 4 — Si des erreurs → on n'écrit rien (tout-ou-rien)
    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: `Import annulé : ${errors.length} erreur(s) détectée(s)`,
        errors,
      });
    }

    // Étape 5 — Toutes les lignes sont valides : insertion en transaction
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
      `Import CSV cours "${course.code}" : ${validRows.length} note(s) importée(s) par user ${requestingUser.id}`,
    );

    return {
      imported: validRows.length,
      course: { code: course.code, name: course.name },
    };
  }
}
