import { Role } from '@prisma/client';
import { CreateGradeDto } from './dto/create-grade.dto';
import { GradesService } from './grades.service';
type RequestUser = {
    id: string;
    role: Role;
};
export declare class GradesController {
    private readonly gradesService;
    constructor(gradesService: GradesService);
    create(dto: CreateGradeDto, req: {
        user: RequestUser;
    }): Promise<{
        student: {
            id: string;
            email: string;
            name: string;
        };
        course: {
            id: string;
            name: string;
            code: string;
        };
        assessmentType: {
            id: string;
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        id: string;
        value: import("@prisma/client/runtime/library").Decimal;
        comment: string | null;
        gradedAt: Date;
        studentId: string;
        courseId: string;
        assessmentTypeId: string;
    }>;
    findByCourse(courseId: string, req: {
        user: RequestUser;
    }): Promise<({
        student: {
            id: string;
            email: string;
            name: string;
        };
        assessmentType: {
            id: string;
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        id: string;
        value: import("@prisma/client/runtime/library").Decimal;
        comment: string | null;
        gradedAt: Date;
        studentId: string;
        courseId: string;
        assessmentTypeId: string;
    })[]>;
    findByStudent(studentId: string, req: {
        user: RequestUser;
    }): Promise<({
        course: {
            id: string;
            name: string;
            code: string;
            semester: string;
        };
        assessmentType: {
            id: string;
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        id: string;
        value: import("@prisma/client/runtime/library").Decimal;
        comment: string | null;
        gradedAt: Date;
        studentId: string;
        courseId: string;
        assessmentTypeId: string;
    })[]>;
    getWeightedAverage(studentId: string, courseId: string, req: {
        user: RequestUser;
    }): Promise<{
        student: {
            id: string;
            name: string;
        };
        course: {
            id: string;
            code: string;
            name: string;
        };
        average: number | null;
        isComplete: boolean;
        coveredWeight: number;
        details: {
            assessmentType: string;
            weight: number;
            grade: number | null;
            contribution: number | null;
        }[];
    }>;
}
export {};
