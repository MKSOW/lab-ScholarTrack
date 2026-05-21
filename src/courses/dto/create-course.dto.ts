import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AssessmentTypeDto } from './assessment-type.dto';

// Vérifie que la somme des poids des types d'évaluation est exactement 100.
// Contrainte métier : les pondérations doivent couvrir 100% de la note finale.
@ValidatorConstraint({ name: 'weightsSum', async: false })
export class WeightsSumConstraint implements ValidatorConstraintInterface {
  validate(types: AssessmentTypeDto[]) {
    if (!Array.isArray(types) || types.length === 0) return false;
    const sum = types.reduce((acc, t) => acc + Number(t.weight ?? 0), 0);
    return Math.abs(sum - 100) < 0.01;
  }

  defaultMessage() {
    return "La somme des poids des types d'évaluation doit être égale à 100";
  }
}

export class CreateCourseDto {
  @ApiProperty({ example: 'MATH101', description: 'Code unique du cours' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Mathématiques avancées' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Cours de maths pour M1', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 30,
    description: "Nombre maximum d'étudiants inscrits",
  })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ example: '2025-S1', description: 'Semestre (ex: 2025-S1)' })
  @IsString()
  @IsNotEmpty()
  semester: string;

  @ApiProperty({
    example: 'clxxxid123',
    description: "Identifiant de l'enseignant",
  })
  @IsString()
  @IsNotEmpty()
  teacherId: string;

  @ApiProperty({
    type: [AssessmentTypeDto],
    description: "Types d'évaluation avec leurs poids (somme = 100)",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssessmentTypeDto)
  @Validate(WeightsSumConstraint)
  assessmentTypes: AssessmentTypeDto[];
}
