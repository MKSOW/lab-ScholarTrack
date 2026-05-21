import { PrismaClient, Role } from '@prisma/client';
import { auth } from '../src/auth/auth';

const prisma = new PrismaClient();

// Récupère une variable d'environnement obligatoire — échoue tôt si absente.
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${key}`);
  }
  return value;
}

// Crée un utilisateur s'il n'existe pas déjà (seed idempotent).
// Passe par Better Auth pour que le mot de passe soit hashé correctement,
// puis met à jour le rôle (Better Auth crée tout en STUDENT par défaut).
async function seedUser(opts: {
  email: string;
  password: string;
  name: string;
  role: Role;
}): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: opts.email },
  });
  if (existing) {
    console.log(
      `ℹ️  Déjà présent : ${opts.email} (${existing.role}) — id=${existing.id}`,
    );
    return existing.id;
  }

  const response = await auth.api.signUpEmail({
    body: {
      email: opts.email,
      name: opts.name,
      password: opts.password,
    },
  });

  await prisma.user.update({
    where: { id: response.user.id },
    data: { role: opts.role, emailVerified: true },
  });

  console.log(`✅ ${opts.role} créé : ${opts.email} — id=${response.user.id}`);
  return response.user.id;
}

async function main() {
  const seedPassword = requireEnv('SEED_PASSWORD');

  // --- Admin (mot de passe dédié, distinct des comptes de test) ---
  await seedUser({
    email: requireEnv('ADMIN_EMAIL'),
    password: requireEnv('ADMIN_PASSWORD'),
    name: process.env.ADMIN_NAME ?? 'Default Admin',
    role: Role.ADMIN,
  });

  // --- Enseignants ---
  const teachers = [
    {
      email: requireEnv('TEACHER_1_EMAIL'),
      name: requireEnv('TEACHER_1_NAME'),
    },
    {
      email: requireEnv('TEACHER_2_EMAIL'),
      name: requireEnv('TEACHER_2_NAME'),
    },
  ];
  for (const teacher of teachers) {
    await seedUser({ ...teacher, password: seedPassword, role: Role.TEACHER });
  }

  // --- Étudiants ---
  const students = [
    {
      email: requireEnv('STUDENT_1_EMAIL'),
      name: requireEnv('STUDENT_1_NAME'),
    },
    {
      email: requireEnv('STUDENT_2_EMAIL'),
      name: requireEnv('STUDENT_2_NAME'),
    },
    {
      email: requireEnv('STUDENT_3_EMAIL'),
      name: requireEnv('STUDENT_3_NAME'),
    },
  ];
  for (const student of students) {
    await seedUser({ ...student, password: seedPassword, role: Role.STUDENT });
  }

  console.log('\n🌱 Seed terminé.');
}

main()
  .catch((e) => {
    console.error('❌ Seed échoué :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
