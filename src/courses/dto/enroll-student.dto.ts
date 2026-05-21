import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EnrollStudentDto {
  @ApiProperty({
    example: 'clxxxstudentid',
    description: "Identifiant de l'étudiant à inscrire",
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;
}
