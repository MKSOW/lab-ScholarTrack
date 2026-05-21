import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class AssessmentTypeDto {
  @ApiProperty({ example: 'EXAM', description: "Nom du type d'évaluation" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 40, description: 'Poids en pourcentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;
}
