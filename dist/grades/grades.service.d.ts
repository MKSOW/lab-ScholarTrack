import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
export type GradeUser = {
    id: string;
    role: Role;
};
export declare class GradesService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    create(dto: CreateGradeDto, requestingUser: GradeUser): Promise<{
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
    findByCourse(courseId: string, requestingUser: GradeUser): Promise<({
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
    getWeightedAverage(studentId: string, courseId: string, requestingUser: GradeUser): Promise<{
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
    findByStudent(studentId: string, requestingUser: GradeUser): Promise<({
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
    importFromCsv(courseId: string, file: Express.Multer.File, requestingUser: GradeUser): Promise<{
        imported: number;
        course: {
            code: string;
            name: string;
        };
    }>;
}
