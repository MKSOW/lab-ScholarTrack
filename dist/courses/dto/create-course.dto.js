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
exports.CreateCourseDto = exports.WeightsSumConstraint = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const assessment_type_dto_1 = require("./assessment-type.dto");
let WeightsSumConstraint = class WeightsSumConstraint {
    validate(types) {
        if (!Array.isArray(types) || types.length === 0)
            return false;
        const sum = types.reduce((acc, t) => acc + Number(t.weight ?? 0), 0);
        return Math.abs(sum - 100) < 0.01;
    }
    defaultMessage() {
        return "La somme des poids des types d'évaluation doit être égale à 100";
    }
};
exports.WeightsSumConstraint = WeightsSumConstraint;
exports.WeightsSumConstraint = WeightsSumConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'weightsSum', async: false })
], WeightsSumConstraint);
class CreateCourseDto {
    code;
    name;
    description;
    capacity;
    semester;
    teacherId;
    assessmentTypes;
}
exports.CreateCourseDto = CreateCourseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MATH101', description: 'Code unique du cours' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCourseDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Mathématiques avancées' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCourseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cours de maths pour M1', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCourseDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 30, description: 'Nombre maximum d\'étudiants inscrits' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateCourseDto.prototype, "capacity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-S1', description: 'Semestre (ex: 2025-S1)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCourseDto.prototype, "semester", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'clxxxid123', description: 'Identifiant de l\'enseignant' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCourseDto.prototype, "teacherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [assessment_type_dto_1.AssessmentTypeDto],
        description: 'Types d\'évaluation avec leurs poids (somme = 100)',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => assessment_type_dto_1.AssessmentTypeDto),
    (0, class_validator_1.Validate)(WeightsSumConstraint),
    __metadata("design:type", Array)
], CreateCourseDto.prototype, "assessmentTypes", void 0);
//# sourceMappingURL=create-course.dto.js.map