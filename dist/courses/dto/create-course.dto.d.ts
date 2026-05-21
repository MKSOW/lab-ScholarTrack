import { ValidatorConstraintInterface } from 'class-validator';
import { AssessmentTypeDto } from './assessment-type.dto';
export declare class WeightsSumConstraint implements ValidatorConstraintInterface {
    validate(types: AssessmentTypeDto[]): boolean;
    defaultMessage(): string;
}
export declare class CreateCourseDto {
    code: string;
    name: string;
    description?: string;
    capacity: number;
    semester: string;
    teacherId: string;
    assessmentTypes: AssessmentTypeDto[];
}
