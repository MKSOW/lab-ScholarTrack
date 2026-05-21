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
exports.GradesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const create_grade_dto_1 = require("./dto/create-grade.dto");
const grades_service_1 = require("./grades.service");
let GradesController = class GradesController {
    gradesService;
    constructor(gradesService) {
        this.gradesService = gradesService;
    }
    create(dto, req) {
        return this.gradesService.create(dto, req.user);
    }
    findByCourse(courseId, req) {
        return this.gradesService.findByCourse(courseId, req.user);
    }
    findByStudent(studentId, req) {
        return this.gradesService.findByStudent(studentId, req.user);
    }
};
exports.GradesController = GradesController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Saisir une note (teacher du cours ou admin)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Note saisie avec succès' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Étudiant non inscrit au cours' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Cours, étudiant ou type évaluation introuvable',
    }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: "Note déjà saisie pour ce type d'évaluation",
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_grade_dto_1.CreateGradeDto, Object]),
    __metadata("design:returntype", void 0)
], GradesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('course/:courseId'),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: "Notes d'un cours (teacher propriétaire ou admin)" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Liste des notes du cours' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Cours introuvable' }),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GradesController.prototype, "findByCourse", null);
__decorate([
    (0, common_1.Get)('student/:studentId'),
    (0, swagger_1.ApiOperation)({
        summary: "Notes d'un étudiant — student : ses propres notes ; teacher : ses cours uniquement ; admin : tout",
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Liste des notes de l'étudiant" }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Étudiant introuvable' }),
    __param(0, (0, common_1.Param)('studentId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GradesController.prototype, "findByStudent", null);
exports.GradesController = GradesController = __decorate([
    (0, swagger_1.ApiTags)('grades'),
    (0, common_1.Controller)('grades'),
    __metadata("design:paramtypes", [grades_service_1.GradesService])
], GradesController);
//# sourceMappingURL=grades.controller.js.map