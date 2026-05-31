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
    description: 'Student id',
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ example: 'clxxxcourse1', description: 'Course id' })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({
    example: 'clxxxassessment1',
    description: 'Assessment type id (must belong to the course)',
  })
  @IsString()
  @IsNotEmpty()
  assessmentTypeId: string;

  @ApiProperty({
    example: 14.5,
    description: 'Grade out of 20 (0.00 → 20.00)',
    minimum: 0,
    maximum: 20,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  value: number;

  @ApiProperty({ example: 'Good work', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}
