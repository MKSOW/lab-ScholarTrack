import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class AssessmentTypeDto {
  @ApiProperty({ example: 'EXAM', description: 'Assessment type name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 40, description: 'Weight as a percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;
}
