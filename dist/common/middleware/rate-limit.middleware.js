"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitMiddleware = void 0;
const common_1 = require("@nestjs/common");
let RateLimitMiddleware = class RateLimitMiddleware {
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
};
exports.RateLimitMiddleware = RateLimitMiddleware;
exports.RateLimitMiddleware = RateLimitMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Number, Number, Function])
], RateLimitMiddleware);
//# sourceMappingURL=rate-limit.middleware.js.map