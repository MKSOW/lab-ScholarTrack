import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
type RequestUser = {
    id: string;
    role: Role;
};
export declare class AttendanceController {
    private readonly attendanceService;
    constructor(attendanceService: AttendanceService);
    createSession(dto: CreateSessionDto, req: {
        user: RequestUser;
    }): Promise<{
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
    findSessionsByCourse(courseId: string, req: {
        user: RequestUser;
    }): Promise<({
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
    recordAttendances(sessionId: string, dto: RecordAttendanceDto, req: {
        user: RequestUser;
    }): Promise<{
        recorded: number;
        sessionId: string;
        course: {
            code: string;
        };
    }>;
    cancelSession(id: string, req: {
        user: RequestUser;
    }): Promise<{
        id: string;
        date: Date;
        topic: string | null;
        cancelledAt: Date | null;
        createdAt: Date;
        courseId: string;
    }>;
}
export {};
