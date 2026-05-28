import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Optional filter for the class-wide stats endpoint.
// Query strings always carry text, hence the explicit transform to boolean.
export class FilterStatsDto {
  @ApiPropertyOptional({
    description:
      'If true, only return students flagged as atRisk (rate < threshold). Otherwise, return all enrolled students.',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  atRisk?: boolean;
}
