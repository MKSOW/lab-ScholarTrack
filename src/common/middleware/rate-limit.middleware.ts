import { HttpStatus, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// NO @Injectable(): the primitive constructor params (number, Function)
// cannot be resolved by NestJS's DI system.
// This middleware is instantiated manually in AppModule.configure().
export class RateLimitMiddleware implements NestMiddleware {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxRequests: number = 100,
    private readonly windowMs: number = 15 * 60 * 1000,
    // Injected for tests: lets us control time without a global mock
    private readonly now: () => number = Date.now,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const timestamp = this.now();

    const entry = this.store.get(ip);

    if (!entry || timestamp - entry.windowStart >= this.windowMs) {
      // First request or expired window: start a new window
      this.store.set(ip, { count: 1, windowStart: timestamp });
      next();
      return;
    }

    if (entry.count >= this.maxRequests) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: 429,
        message: 'Too many requests. Try again in 15 minutes.',
      });
      return;
    }

    entry.count++;
    next();
  }
}
