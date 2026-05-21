import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

// Instance Prisma dédiée à Better Auth (séparée du PrismaService NestJS).
// Better Auth est instancié en dehors du contexte NestJS, donc il ne peut pas
// utiliser l'injection de dépendances — il a besoin de son propre client.
const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Préfixe de toutes les routes d'auth générées par Better Auth
  basePath: '/api/auth',

  secret: process.env.BETTER_AUTH_SECRET,

  // Origines autorisées à faire des requêtes cross-origin vers l'API
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3006'],

  emailAndPassword: {
    enabled: true,
    // Pas d'auto-connexion après création de compte :
    // les comptes sont créés par l'admin, pas par l'utilisateur lui-même
    autoSignIn: false,
  },

  user: {
    additionalFields: {
      // Champ métier ajouté au modèle User de Better Auth.
      // input: false → ne peut pas être fourni lors du sign-up public
      role: {
        type: 'string',
        required: false,
        defaultValue: 'STUDENT',
        input: false,
      },
    },
  },
});

// Type inféré de la session Better Auth (inclut user + role).
// Utilisé dans les guards et décorateurs de l'application.
export type AuthSession = typeof auth.$Infer.Session;
