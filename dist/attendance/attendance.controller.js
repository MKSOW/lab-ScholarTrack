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
exports.AttendanceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const attendance_service_1 = require("./attendance.service");
const create_session_dto_1 = require("./dto/create-session.dto");
const record_attendance_dto_1 = require("./dto/record-attendance.dto");
let AttendanceController = class AttendanceController {
    attendanceService;
    constructor(attendanceService) {
        this.attendanceService = attendanceService;
    }
    createSession(dto, req) {
        return this.attendanceService.createSession(dto, req.user);
    }
    findSessionsByCourse(courseId, req) {
        return this.attendanceService.findSessionsByCourse(courseId, req.user);
    }
    recordAttendances(sessionId, dto, req) {
        return this.attendanceService.recordAttendances(sessionId, dto, req.user);
    }
    cancelSession(id, req) {
        return this.attendanceService.cancelSession(id, req.user);
    }
};
exports.AttendanceController = AttendanceController;
__decorate([
    (0, common_1.Post)('sessions'),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Créer une séance (teacher du cours ou admin)',
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Séance créée avec succès' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Cours introuvable' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_session_dto_1.CreateSessionDto, Object]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "createSession", null);
__decorate([
    (0, common_1.Get)('sessions/course/:courseId'),
    (0, swagger_1.ApiOperation)({
        summary: "Lister les séances d'un cours — teacher (propriétaire), student (inscrit) ou admin",
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Liste des séances' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Cours introuvable' }),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "findSessionsByCourse", null);
__decorate([
    (0, common_1.Post)('sessions/:sessionId/record'),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Enregistrer en masse les présences d\'une séance — upsert atomique tout-ou-rien',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Présences enregistrées' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Séance annulée' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Séance introuvable' }),
    (0, swagger_1.ApiResponse)({
        status: 422,
        description: 'Erreurs détectées — rapport complet, aucune écriture',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, record_attendance_dto_1.RecordAttendanceDto, Object]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "recordAttendances", null);
__decorate([
    (0, common_1.Patch)('sessions/:id/cancel'),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Annuler une séance (soft delete via cancelledAt)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Séance annulée' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Accès refusé' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Séance introuvable' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Séance déjà annulée' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "cancelSession", null);
exports.AttendanceController = AttendanceController = __decorate([
    (0, swagger_1.ApiTags)('attendance'),
    (0, common_1.Controller)('attendance'),
    __metadata("design:paramtypes", [attendance_service_1.AttendanceService])
], AttendanceController);
//# sourceMappingURL=attendance.controller.js.map