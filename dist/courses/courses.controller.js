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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const check_ownership_decorator_1 = require("../auth/decorators/check-ownership.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const ownership_guard_1 = require("../auth/guards/ownership.guard");
const courses_service_1 = require("./courses.service");
const capacity_pipe_1 = require("./pipes/capacity.pipe");
const create_course_dto_1 = require("./dto/create-course.dto");
const enroll_student_dto_1 = require("./dto/enroll-student.dto");
const filter_courses_dto_1 = require("./dto/filter-courses.dto");
const update_course_dto_1 = require("./dto/update-course.dto");
let CoursesController = class CoursesController {
    coursesService;
    constructor(coursesService) {
        this.coursesService = coursesService;
    }
    create(dto) {
        return this.coursesService.create(dto);
    }
    enroll(courseId, dto) {
        return this.coursesService.enroll(courseId, dto.studentId);
    }
    findAll(filter, req) {
        return this.coursesService.findAll(req.user, filter);
    }
    findOne(id, req) {
        return this.coursesService.findOne(id, req.user);
    }
    update(id, dto) {
        return this.coursesService.update(id, dto);
    }
    remove(id) {
        return this.coursesService.remove(id);
    }
};
exports.CoursesController = CoursesController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Créer un cours (admin uniquement)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Cours créé avec succès' }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Données invalides ou somme des poids ≠ 100',
    }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Code cours déjà utilisé' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_course_dto_1.CreateCourseDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/enroll'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Inscrire un étudiant à un cours (admin uniquement)',
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Étudiant inscrit avec succès' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Cours ou étudiant introuvable' }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: 'Cours complet ou étudiant déjà inscrit',
    }),
    __param(0, (0, common_1.Param)('id', capacity_pipe_1.CapacityPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, enroll_student_dto_1.EnrollStudentDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "enroll", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Lister les cours — filtrage (semestre, enseignant) et pagination',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Liste paginée des cours' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [filter_courses_dto_1.FilterCoursesDto, Object]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: "Obtenir le détail d'un cours" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Détail du cours' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Cours introuvable' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.TEACHER),
    (0, check_ownership_decorator_1.CheckOwnership)('id'),
    (0, common_1.UseGuards)(ownership_guard_1.OwnershipGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Mettre à jour un cours (admin ou professeur propriétaire)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Cours mis à jour' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Cours introuvable' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_course_dto_1.UpdateCourseDto]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Supprimer un cours (admin uniquement)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Cours supprimé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Cours introuvable' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CoursesController.prototype, "remove", null);
exports.CoursesController = CoursesController = __decorate([
    (0, swagger_1.ApiTags)('courses'),
    (0, common_1.Controller)('courses'),
    __metadata("design:paramtypes", [courses_service_1.CoursesService])
], CoursesController);
//# sourceMappingURL=courses.controller.js.map