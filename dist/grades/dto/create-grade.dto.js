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
exports.CreateGradeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateGradeDto {
    studentId;
    courseId;
    assessmentTypeId;
    value;
    comment;
}
exports.CreateGradeDto = CreateGradeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'clxxxstudent1',
        description: "Identifiant de l'étudiant",
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateGradeDto.prototype, "studentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'clxxxcourse1', description: 'Identifiant du cours' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateGradeDto.prototype, "courseId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'clxxxassessment1',
        description: "Identifiant du type d'évaluation (doit appartenir au cours)",
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateGradeDto.prototype, "assessmentTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 14.5,
        description: 'Note sur 20 (0.00 → 20.00)',
        minimum: 0,
        maximum: 20,
    }),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], CreateGradeDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bon travail', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateGradeDto.prototype, "comment", void 0);
//# sourceMappingURL=create-grade.dto.js.map