import { RateLimitMiddleware } from './rate-limit.middleware';
import { Request, Response } from 'express';

function makeReq(ip: string): Partial<Request> {
  return { ip, socket: { remoteAddress: ip } } as Partial<Request>;
}

function makeRes(): { status: jest.Mock; json: jest.Mock } {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('RateLimitMiddleware', () => {
  const MAX = 3;
  const WINDOW = 1000;
  let currentTime: number;
  let middleware: RateLimitMiddleware;

  beforeEach(() => {
    currentTime = 0;
    middleware = new RateLimitMiddleware(MAX, WINDOW, () => currentTime);
  });

  it('laisse passer la premiere requete', () => {
    const next = jest.fn();
    middleware.use(
      makeReq('1.1.1.1') as Request,
      makeRes() as unknown as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('laisse passer tant que le seuil nest pas atteint', () => {
    const next = jest.fn();
    for (let i = 0; i < MAX; i++) {
      middleware.use(
        makeReq('1.1.1.1') as Request,
        makeRes() as unknown as Response,
        next,
      );
    }
    expect(next).toHaveBeenCalledTimes(MAX);
  });

  it('retourne 429 quand le seuil est depasse', () => {
    const next = jest.fn();
    const res = makeRes();
    for (let i = 0; i < MAX; i++) {
      middleware.use(
        makeReq('1.1.1.1') as Request,
        makeRes() as unknown as Response,
        next,
      );
    }
    middleware.use(
      makeReq('1.1.1.1') as Request,
      res as unknown as Response,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(MAX);
  });

  it('ne bloque pas une IP differente', () => {
    const next = jest.fn();
    for (let i = 0; i < MAX + 1; i++) {
      middleware.use(
        makeReq('1.1.1.1') as Request,
        makeRes() as unknown as Response,
        next,
      );
    }
    middleware.use(
      makeReq('2.2.2.2') as Request,
      makeRes() as unknown as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(MAX + 1);
  });

  it('remet le compteur a zero apres expiration de la fenetre', () => {
    const next = jest.fn();
    for (let i = 0; i < MAX; i++) {
      middleware.use(
        makeReq('1.1.1.1') as Request,
        makeRes() as unknown as Response,
        next,
      );
    }
    currentTime = WINDOW + 1;
    middleware.use(
      makeReq('1.1.1.1') as Request,
      makeRes() as unknown as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(MAX + 1);
  });
});
