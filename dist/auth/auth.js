"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const better_auth_1 = require("better-auth");
const prisma_1 = require("better-auth/adapters/prisma");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.auth = (0, better_auth_1.betterAuth)({
    database: (0, prisma_1.prismaAdapter)(prisma, {
        provider: 'postgresql',
    }),
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3006'],
    emailAndPassword: {
        enabled: true,
        autoSignIn: false,
    },
    user: {
        additionalFields: {
            role: {
                type: 'string',
                required: false,
                defaultValue: 'STUDENT',
                input: false,
            },
        },
    },
});
//# sourceMappingURL=auth.js.map