import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Filtre optionnel pour l'endpoint vue classe.
// Le query string transmet toujours du texte, d'où la transformation explicite vers boolean.
export class FilterStatsDto {
  @ApiPropertyOptional({
    description:
      'Si true, ne renvoie que les étudiants flaggés atRisk (taux < seuil). Sinon, renvoie tous les inscrits.',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  atRisk?: boolean;
}
