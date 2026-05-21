import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateGradeDto {
  @ApiProperty({
    example: 'clxxxstudent1',
    description: "Identifiant de l'étudiant",
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ example: 'clxxxcourse1', description: 'Identifiant du cours' })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({
    example: 'clxxxassessment1',
    description: "Identifiant du type d'évaluation (doit appartenir au cours)",
  })
  @IsString()
  @IsNotEmpty()
  assessmentTypeId: string;

  @ApiProperty({
    example: 14.5,
    description: 'Note sur 20 (0.00 → 20.00)',
    minimum: 0,
    maximum: 20,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  value: number;

  @ApiProperty({ example: 'Bon travail', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}
