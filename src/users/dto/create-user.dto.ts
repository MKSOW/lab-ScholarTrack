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
  @IsEmail({}, { message: 'Invalid email' })
  email: string;

  @ApiProperty({ example: 'Alice Martin' })
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;

  @ApiProperty({ example: 'motdepasse123', minLength: 8 })
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  password: string;

  @ApiProperty({ enum: ['STUDENT', 'TEACHER'], example: 'STUDENT' })
  @IsIn(['STUDENT', 'TEACHER'], {
    message: "Role must be 'STUDENT' or 'TEACHER'",
  })
  role: 'STUDENT' | 'TEACHER';
}
