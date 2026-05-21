"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitMiddleware = void 0;
const common_1 = require("@nestjs/common");
class RateLimitMiddleware {
    maxRequests;
    windowMs;
    now;
    store = new Map();
    constructor(maxRequests = 100, windowMs = 15 * 60 * 1000, now = Date.now) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.now = now;
    }
    use(req, res, next) {
        const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
        const timestamp = this.now();
        const entry = this.store.get(ip);
        if (!entry || timestamp - entry.windowStart >= this.windowMs) {
            this.store.set(ip, { count: 1, windowStart: timestamp });
            next();
            return;
        }
        if (entry.count >= this.maxRequests) {
            res.status(common_1.HttpStatus.TOO_MANY_REQUESTS).json({
                statusCode: 429,
                message: 'Trop de requetes. Reessayez dans 15 minutes.',
            });
            return;
        }
        entry.count++;
        next();
    }
}
exports.RateLimitMiddleware = RateLimitMiddleware;
//# sourceMappingURL=rate-limit.middleware.js.map