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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapacityPipe = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let CapacityPipe = class CapacityPipe {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async transform(courseId) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: {
                capacity: true,
                _count: { select: { enrollments: true } },
            },
        });
        if (!course) {
            throw new common_1.NotFoundException('Cours introuvable');
        }
        if (course._count.enrollments >= course.capacity) {
            throw new common_1.ConflictException(`Cours complet : capacité maximale de ${course.capacity} étudiant(s) atteinte`);
        }
        return courseId;
    }
};
exports.CapacityPipe = CapacityPipe;
exports.CapacityPipe = CapacityPipe = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CapacityPipe);
//# sourceMappingURL=capacity.pipe.js.map