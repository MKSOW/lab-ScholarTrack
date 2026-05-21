import { PartialType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';

// Tous les champs deviennent optionnels.
// Si assessmentTypes est fourni, la validation de la somme des poids s'applique quand même.
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
