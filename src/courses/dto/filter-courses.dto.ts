import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// DTO for the GET /courses query params.
// Query params always arrive as strings:
// @Type(() => Number) converts them to numbers (the ValidationPipe has transform: true).
export class FilterCoursesDto {
  @ApiPropertyOptional({
    example: '2025-S1',
    description: 'Filter by semester',
  })
  @IsString()
  @IsOptional()
  semester?: string;

  @ApiPropertyOptional({
    example: 'clxxxteacherid',
    description: 'Filter by teacher (admin only)',
  })
  @IsString()
  @IsOptional()
  teacherId?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (default: 1)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Items per page (default: 10, max: 100)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
