import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AttendanceItemDto {
  @ApiProperty({
    example: 'clxxxstudent1',
    description: "Identifiant de l'étudiant",
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
    description: 'PRESENT, ABSENT, LATE ou EXCUSED',
  })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}

export class RecordAttendanceDto {
  @ApiProperty({
    type: [AttendanceItemDto],
    description:
      'Liste des présences à enregistrer en une seule requête. Upsert : remplace une présence déjà saisie.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  attendances: AttendanceItemDto[];
}
