import { HttpStatus, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// PAS de @Injectable() : les paramètres primitifs du constructeur (number, Function)
// ne peuvent pas être résolus par le système DI de NestJS.
// Ce middleware est instancié manuellement dans AppModule.configure().
export class RateLimitMiddleware implements NestMiddleware {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxRequests: number = 100,
    private readonly windowMs: number = 15 * 60 * 1000,
    // Injecté pour les tests : permet de contrôler le temps sans mock global
    private readonly now: () => number = Date.now,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const timestamp = this.now();

    const entry = this.store.get(ip);

    if (!entry || timestamp - entry.windowStart >= this.windowMs) {
      // Premiere requete ou fenetre expiree : nouvelle fenetre
      this.store.set(ip, { count: 1, windowStart: timestamp });
      next();
      return;
    }

    if (entry.count >= this.maxRequests) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: 429,
        message: 'Trop de requetes. Reessayez dans 15 minutes.',
      });
      return;
    }

    entry.count++;
    next();
  }
}
