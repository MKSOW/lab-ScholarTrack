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
    description: 'Student id',
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
    description: 'PRESENT, ABSENT, LATE or EXCUSED',
  })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}

export class RecordAttendanceDto {
  @ApiProperty({
    type: [AttendanceItemDto],
    description:
      'List of attendances to record in a single request. Upsert: replaces an already-recorded attendance.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  attendances: AttendanceItemDto[];
}
