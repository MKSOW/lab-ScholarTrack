import { NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
export declare class RateLimitMiddleware implements NestMiddleware {
    private readonly maxRequests;
    private readonly windowMs;
    private readonly now;
    private readonly store;
    constructor(maxRequests?: number, windowMs?: number, now?: () => number);
    use(req: Request, res: Response, next: NextFunction): void;
}
