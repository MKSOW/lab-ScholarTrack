"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GradesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const csv_parser_1 = require("./utils/csv-parser");
let GradesService = GradesService_1 = class GradesService {
    prisma;
    logger = new common_1.Logger(GradesService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto, requestingUser) {
        const course = await this.prisma.course.findUnique({
            where: { id: dto.courseId },
            select: { id: true, code: true, teacherId: true },
        });
        if (!course)
            throw new common_1.NotFoundException('Cours introuvable');
        if (requestingUser.role === client_1.Role.TEACHER &&
            course.teacherId !== requestingUser.id) {
            throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas le professeur de ce cours");
        }
        const student = await this.prisma.user.findUnique({
            where: { id: dto.studentId },
            select: { id: true, role: true, name: true },
        });
        if (!student || student.role !== client_1.Role.STUDENT) {
            throw new common_1.NotFoundException(`Aucun étudiant trouvé avec l'identifiant "${dto.studentId}"`);
        }
        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                studentId_courseId: {
                    studentId: dto.studentId,
                    courseId: dto.courseId,
                },
            },
        });
        if (!enrollment) {
            throw new common_1.BadRequestException(`L'étudiant "${student.name}" n'est pas inscrit au cours "${course.code}"`);
        }
        const assessmentType = await this.prisma.assessmentType.findFirst({
            where: { id: dto.assessmentTypeId, courseId: dto.courseId },
        });
        if (!assessmentType) {
            throw new common_1.NotFoundException(`Type d'évaluation introuvable ou n'appartient pas au cours "${course.code}"`);
        }
        const existing = await this.prisma.grade.findFirst({
            where: {
                studentId: dto.studentId,
                courseId: dto.courseId,
                assessmentTypeId: dto.assessmentTypeId,
            },
        });
        if (existing) {
            throw new common_1.ConflictException(`Une note existe déjà pour "${student.name}" — type "${assessmentType.name}"`);
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
        this.logger.log(`Note saisie : ${student.name} — ${assessmentType.name} — ${dto.value}/20 (cours ${course.code})`);
        return grade;
    }
    async findByCourse(courseId, requestingUser) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { id: true, teacherId: true, code: true },
        });
        if (!course)
            throw new common_1.NotFoundException('Cours introuvable');
        if (requestingUser.role === client_1.Role.TEACHER &&
            course.teacherId !== requestingUser.id) {
            throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas le professeur de ce cours");
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
    async getWeightedAverage(studentId, courseId, requestingUser) {
        if (requestingUser.role === client_1.Role.STUDENT &&
            requestingUser.id !== studentId) {
            throw new common_1.ForbiddenException('Accès refusé : vous ne pouvez consulter que votre propre moyenne');
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
        if (!course)
            throw new common_1.NotFoundException('Cours introuvable');
        if (requestingUser.role === client_1.Role.TEACHER &&
            course.teacherId !== requestingUser.id) {
            throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas le professeur de ce cours");
        }
        const student = await this.prisma.user.findUnique({
            where: { id: studentId },
            select: { id: true, role: true, name: true },
        });
        if (!student || student.role !== client_1.Role.STUDENT) {
            throw new common_1.NotFoundException(`Aucun étudiant trouvé avec l'identifiant "${studentId}"`);
        }
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId } },
        });
        if (!enrollment) {
            throw new common_1.BadRequestException(`L'étudiant "${student.name}" n'est pas inscrit au cours "${course.code}"`);
        }
        const grades = await this.prisma.grade.findMany({
            where: { studentId, courseId },
            select: { assessmentTypeId: true, value: true },
        });
        const gradeMap = new Map(grades.map((g) => [g.assessmentTypeId, Number(g.value)]));
        let weightedSum = 0;
        let coveredWeight = 0;
        const details = course.assessmentTypes.map((at) => {
            const weight = Number(at.weight);
            const grade = gradeMap.get(at.id) ?? null;
            const contribution = grade !== null ? parseFloat(((grade * weight) / 100).toFixed(2)) : null;
            if (grade !== null) {
                weightedSum += (grade * weight) / 100;
                coveredWeight += weight;
            }
            return { assessmentType: at.name, weight, grade, contribution };
        });
        const isComplete = coveredWeight === 100;
        const average = coveredWeight > 0
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
    async findByStudent(studentId, requestingUser) {
        if (requestingUser.role === client_1.Role.STUDENT &&
            requestingUser.id !== studentId) {
            throw new common_1.ForbiddenException('Accès refusé : vous ne pouvez consulter que vos propres notes');
        }
        const student = await this.prisma.user.findUnique({
            where: { id: studentId },
            select: { id: true, role: true, name: true },
        });
        if (!student || student.role !== client_1.Role.STUDENT) {
            throw new common_1.NotFoundException(`Aucun étudiant trouvé avec l'identifiant "${studentId}"`);
        }
        const courseFilter = requestingUser.role === client_1.Role.TEACHER
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
    async importFromCsv(courseId, file, requestingUser) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { id: true, code: true, name: true, teacherId: true },
        });
        if (!course)
            throw new common_1.NotFoundException('Cours introuvable');
        if (requestingUser.role === client_1.Role.TEACHER &&
            course.teacherId !== requestingUser.id) {
            throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas le professeur de ce cours");
        }
        const { rows, parseError } = (0, csv_parser_1.parseCsvBuffer)(file.buffer);
        if (parseError)
            throw new common_1.BadRequestException(parseError);
        if (rows.length === 0)
            throw new common_1.BadRequestException('Le fichier CSV ne contient aucune ligne de données');
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
        const existingGradeKeys = new Set(existingGrades.map((g) => `${g.studentId}::${g.assessmentTypeId}`));
        const seenInFile = new Set();
        const errors = [];
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
        if (errors.length > 0) {
            throw new common_1.UnprocessableEntityException({
                message: `Import annulé : ${errors.length} erreur(s) détectée(s)`,
                errors,
            });
        }
        const validRows = rows.filter((r) => !isNaN(parseFloat(r.value)));
        await this.prisma.$transaction(validRows.map((row) => this.prisma.grade.create({
            data: {
                studentId: row.studentId,
                courseId,
                assessmentTypeId: row.assessmentTypeId,
                value: parseFloat(row.value),
                comment: row.comment,
            },
        })));
        this.logger.log(`Import CSV cours "${course.code}" : ${validRows.length} note(s) importée(s) par user ${requestingUser.id}`);
        return {
            imported: validRows.length,
            course: { code: course.code, name: course.name },
        };
    }
};
exports.GradesService = GradesService;
exports.GradesService = GradesService = GradesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GradesService);
//# sourceMappingURL=grades.service.js.map