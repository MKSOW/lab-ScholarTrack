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
var CoursesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let CoursesService = CoursesService_1 = class CoursesService {
    prisma;
    logger = new common_1.Logger(CoursesService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        const existing = await this.prisma.course.findUnique({
            where: { code: dto.code },
        });
        if (existing) {
            throw new common_1.ConflictException(`Un cours avec le code "${dto.code}" existe déjà`);
        }
        const teacher = await this.prisma.user.findUnique({
            where: { id: dto.teacherId },
            select: { id: true, role: true },
        });
        if (!teacher || teacher.role !== client_1.Role.TEACHER) {
            throw new common_1.NotFoundException(`Aucun enseignant trouvé avec l'identifiant "${dto.teacherId}"`);
        }
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
    async findAll(user, filter) {
        const page = filter.page ?? 1;
        const limit = filter.limit ?? 10;
        const skip = (page - 1) * limit;
        const where = {};
        if (filter.semester) {
            where.semester = filter.semester;
        }
        if (user.role === client_1.Role.TEACHER) {
            where.teacherId = user.id;
        }
        else if (user.role === client_1.Role.STUDENT) {
            where.enrollments = { some: { studentId: user.id } };
        }
        else if (filter.teacherId) {
            where.teacherId = filter.teacherId;
        }
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
    async findOne(id, user) {
        const course = await this.prisma.course.findUnique({
            where: { id },
            include: {
                assessmentTypes: true,
                teacher: { select: { id: true, name: true, email: true } },
                _count: { select: { enrollments: true } },
            },
        });
        if (!course)
            throw new common_1.NotFoundException('Cours introuvable');
        if (user.role === client_1.Role.TEACHER && course.teacherId !== user.id) {
            throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas le professeur de ce cours");
        }
        if (user.role === client_1.Role.STUDENT) {
            const enrollment = await this.prisma.enrollment.findUnique({
                where: { studentId_courseId: { studentId: user.id, courseId: id } },
            });
            if (!enrollment) {
                throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas inscrit à ce cours");
            }
        }
        return course;
    }
    async update(id, dto) {
        const course = await this.prisma.course.findUnique({ where: { id } });
        if (!course)
            throw new common_1.NotFoundException('Cours introuvable');
        if (dto.code && dto.code !== course.code) {
            const duplicate = await this.prisma.course.findUnique({
                where: { code: dto.code },
            });
            if (duplicate) {
                throw new common_1.ConflictException(`Un cours avec le code "${dto.code}" existe déjà`);
            }
        }
        if (dto.teacherId) {
            const teacher = await this.prisma.user.findUnique({
                where: { id: dto.teacherId },
                select: { role: true },
            });
            if (!teacher || teacher.role !== client_1.Role.TEACHER) {
                throw new common_1.NotFoundException(`Aucun enseignant trouvé avec l'identifiant "${dto.teacherId}"`);
            }
        }
        const updated = await this.prisma.$transaction(async (tx) => {
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
    async remove(id) {
        const course = await this.prisma.course.findUnique({ where: { id } });
        if (!course)
            throw new common_1.NotFoundException('Cours introuvable');
        await this.prisma.course.delete({ where: { id } });
        this.logger.log(`Cours supprimé : ${course.code}`);
        return { message: `Cours "${course.code}" supprimé avec succès` };
    }
    async enroll(courseId, studentId) {
        const student = await this.prisma.user.findUnique({
            where: { id: studentId },
            select: { id: true, role: true, name: true },
        });
        if (!student || student.role !== client_1.Role.STUDENT) {
            throw new common_1.NotFoundException(`Aucun étudiant trouvé avec l'identifiant "${studentId}"`);
        }
        const enrollment = await this.prisma.$transaction(async (tx) => {
            const course = await tx.course.findUnique({
                where: { id: courseId },
                select: { capacity: true, _count: { select: { enrollments: true } } },
            });
            if (!course)
                throw new common_1.NotFoundException('Cours introuvable');
            const existing = await tx.enrollment.findUnique({
                where: { studentId_courseId: { studentId, courseId } },
            });
            if (existing) {
                throw new common_1.ConflictException("L'étudiant est déjà inscrit à ce cours");
            }
            if (course._count.enrollments >= course.capacity) {
                throw new common_1.ConflictException('La capacité maximale de ce cours est atteinte');
            }
            return tx.enrollment.create({
                data: { studentId, courseId },
                include: {
                    student: { select: { id: true, name: true, email: true } },
                    course: { select: { id: true, code: true, name: true } },
                },
            });
        }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
        this.logger.log(`Inscription : ${student.name} → cours ${enrollment.course.code}`);
        return enrollment;
    }
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = CoursesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CoursesService);
//# sourceMappingURL=courses.service.js.map