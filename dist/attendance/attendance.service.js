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
var AttendanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let AttendanceService = AttendanceService_1 = class AttendanceService {
    prisma;
    logger = new common_1.Logger(AttendanceService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createSession(dto, requestingUser) {
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
        this.logger.log(`Séance créée : ${course.code} — ${session.date.toISOString()}`);
        return session;
    }
    async findSessionsByCourse(courseId, requestingUser) {
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
        if (requestingUser.role === client_1.Role.STUDENT) {
            const enrollment = await this.prisma.enrollment.findUnique({
                where: {
                    studentId_courseId: { studentId: requestingUser.id, courseId },
                },
            });
            if (!enrollment) {
                throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas inscrit à ce cours");
            }
        }
        return this.prisma.courseSession.findMany({
            where: { courseId },
            include: { _count: { select: { attendances: true } } },
            orderBy: { date: 'desc' },
        });
    }
    async cancelSession(sessionId, requestingUser) {
        const session = await this.prisma.courseSession.findUnique({
            where: { id: sessionId },
            include: { course: { select: { teacherId: true, code: true } } },
        });
        if (!session)
            throw new common_1.NotFoundException('Séance introuvable');
        if (requestingUser.role === client_1.Role.TEACHER &&
            session.course.teacherId !== requestingUser.id) {
            throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas le professeur de ce cours");
        }
        if (session.cancelledAt) {
            throw new common_1.ConflictException('Cette séance est déjà annulée');
        }
        const updated = await this.prisma.courseSession.update({
            where: { id: sessionId },
            data: { cancelledAt: new Date() },
        });
        this.logger.log(`Séance annulée : ${session.course.code} — ${updated.date.toISOString()}`);
        return updated;
    }
    async recordAttendances(sessionId, dto, requestingUser) {
        const session = await this.prisma.courseSession.findUnique({
            where: { id: sessionId },
            include: {
                course: { select: { id: true, teacherId: true, code: true } },
            },
        });
        if (!session)
            throw new common_1.NotFoundException('Séance introuvable');
        if (session.cancelledAt) {
            throw new common_1.BadRequestException("Impossible d'enregistrer des présences sur une séance annulée");
        }
        if (requestingUser.role === client_1.Role.TEACHER &&
            session.course.teacherId !== requestingUser.id) {
            throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas le professeur de ce cours");
        }
        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId: session.course.id },
            select: { studentId: true },
        });
        const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));
        const errors = [];
        const seenInRequest = new Set();
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
                    error: 'Doublon : cet étudiant apparaît plusieurs fois dans la requête',
                });
                return;
            }
            seenInRequest.add(item.studentId);
        });
        if (errors.length > 0) {
            throw new common_1.UnprocessableEntityException({
                message: `Enregistrement annulé : ${errors.length} erreur(s) détectée(s)`,
                errors,
            });
        }
        const results = await this.prisma.$transaction(dto.attendances.map((item) => this.prisma.attendance.upsert({
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
        })));
        this.logger.log(`Présences enregistrées : ${results.length} pour séance ${session.id} (cours ${session.course.code})`);
        return {
            recorded: results.length,
            sessionId,
            course: { code: session.course.code },
        };
    }
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = AttendanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map