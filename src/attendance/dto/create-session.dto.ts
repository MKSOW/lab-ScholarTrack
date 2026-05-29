import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 'clxxxcourse1', description: 'Identifiant du cours' })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({
    example: '2026-06-12T09:00:00Z',
    description: 'Date et heure de la séance (ISO 8601)',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    example: 'Chapitre 3 — Intégrales',
    required: false,
    description: 'Thème ou sujet de la séance',
  })
  @IsString()
  @IsOptional()
  topic?: string;
}
