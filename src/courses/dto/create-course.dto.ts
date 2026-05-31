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

// Verifies that the sum of assessment-type weights is exactly 100.
// Business rule: the weights must cover 100% of the final grade.
@ValidatorConstraint({ name: 'weightsSum', async: false })
export class WeightsSumConstraint implements ValidatorConstraintInterface {
  validate(types: AssessmentTypeDto[]) {
    if (!Array.isArray(types) || types.length === 0) return false;
    const sum = types.reduce((acc, t) => acc + Number(t.weight ?? 0), 0);
    return Math.abs(sum - 100) < 0.01;
  }

  defaultMessage() {
    return 'The sum of assessment-type weights must equal 100';
  }
}

export class CreateCourseDto {
  @ApiProperty({ example: 'MATH101', description: 'Unique course code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Advanced Mathematics' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Maths course for M1', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 30,
    description: 'Maximum number of enrolled students',
  })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ example: '2025-S1', description: 'Semester (e.g. 2025-S1)' })
  @IsString()
  @IsNotEmpty()
  semester: string;

  @ApiProperty({
    example: 'clxxxid123',
    description: 'Teacher id',
  })
  @IsString()
  @IsNotEmpty()
  teacherId: string;

  @ApiProperty({
    type: [AssessmentTypeDto],
    description: 'Assessment types with their weights (sum = 100)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssessmentTypeDto)
  @Validate(WeightsSumConstraint)
  assessmentTypes: AssessmentTypeDto[];
}
