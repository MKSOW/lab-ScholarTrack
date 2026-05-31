import { PartialType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';

// All fields become optional.
// If assessmentTypes is provided, the weights-sum validation still applies.
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
