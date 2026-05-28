import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
export type AttendanceUser = {
    id: string;
    role: Role;
};
export declare class AttendanceService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    createSession(dto: CreateSessionDto, requestingUser: AttendanceUser): Promise<{
        course: {
            id: string;
            code: string;
            name: string;
        };
    } & {
        id: string;
        date: Date;
        topic: string | null;
        cancelledAt: Date | null;
        createdAt: Date;
        courseId: string;
    }>;
    findSessionsByCourse(courseId: string, requestingUser: AttendanceUser): Promise<({
        _count: {
            attendances: number;
        };
    } & {
        id: string;
        date: Date;
        topic: string | null;
        cancelledAt: Date | null;
        createdAt: Date;
        courseId: string;
    })[]>;
    cancelSession(sessionId: string, requestingUser: AttendanceUser): Promise<{
        id: string;
        date: Date;
        topic: string | null;
        cancelledAt: Date | null;
        createdAt: Date;
        courseId: string;
    }>;
    recordAttendances(sessionId: string, dto: RecordAttendanceDto, requestingUser: AttendanceUser): Promise<{
        recorded: number;
        sessionId: string;
        course: {
            code: string;
        };
    }>;
}
