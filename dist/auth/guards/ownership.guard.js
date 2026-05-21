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
exports.OwnershipGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const check_ownership_decorator_1 = require("../decorators/check-ownership.decorator");
let OwnershipGuard = class OwnershipGuard {
    reflector;
    prisma;
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const paramName = this.reflector.getAllAndOverride(check_ownership_decorator_1.CHECK_OWNERSHIP_KEY, [context.getHandler(), context.getClass()]);
        if (!paramName)
            return true;
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user)
            return false;
        if (user.role === client_1.Role.ADMIN)
            return true;
        if (user.role !== client_1.Role.TEACHER)
            return true;
        const courseId = request.params[paramName];
        if (!courseId)
            return true;
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { teacherId: true },
        });
        if (!course) {
            throw new common_1.NotFoundException('Cours introuvable');
        }
        if (course.teacherId !== user.id) {
            throw new common_1.ForbiddenException("Accès refusé : vous n'êtes pas le professeur de ce cours");
        }
        return true;
    }
};
exports.OwnershipGuard = OwnershipGuard;
exports.OwnershipGuard = OwnershipGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService])
], OwnershipGuard);
//# sourceMappingURL=ownership.guard.js.map