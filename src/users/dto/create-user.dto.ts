import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty({ example: 'Alice Martin' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide' })
  name: string;

  @ApiProperty({ example: 'motdepasse123', minLength: 8 })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  password: string;

  @ApiProperty({ enum: ['STUDENT', 'TEACHER'], example: 'STUDENT' })
  @IsIn(['STUDENT', 'TEACHER'], {
    message: "Le rôle doit être 'STUDENT' ou 'TEACHER'",
  })
  role: 'STUDENT' | 'TEACHER';
}
