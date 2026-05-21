import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// DTO des query params de GET /courses.
// Les query params arrivent toujours en chaîne de caractères :
// @Type(() => Number) les convertit en nombre (le ValidationPipe a transform: true).
export class FilterCoursesDto {
  @ApiPropertyOptional({
    example: '2025-S1',
    description: 'Filtrer par semestre',
  })
  @IsString()
  @IsOptional()
  semester?: string;

  @ApiPropertyOptional({
    example: 'clxxxteacherid',
    description: 'Filtrer par enseignant (admin uniquement)',
  })
  @IsString()
  @IsOptional()
  teacherId?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Numéro de page (défaut : 1)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    description: "Nombre d'éléments par page (défaut : 10, max : 100)",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
