import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EnrollStudentDto {
  @ApiProperty({
    example: 'clxxxstudentid',
    description: 'Id of the student to enroll',
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;
}
