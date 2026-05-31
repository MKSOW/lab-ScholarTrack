import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 'clxxxcourse1', description: 'Course id' })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({
    example: '2026-06-12T09:00:00Z',
    description: 'Session date and time (ISO 8601)',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    example: 'Chapter 3 — Integrals',
    required: false,
    description: 'Session theme or topic',
  })
  @IsString()
  @IsOptional()
  topic?: string;
}
