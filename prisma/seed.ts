import { PrismaClient, Role } from '@prisma/client';
import { auth } from '../src/auth/auth';

const prisma = new PrismaClient();

// Reads a required environment variable — fails fast if missing.
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

// Creates a user if it does not already exist (idempotent seed).
// Goes through Better Auth so the password is hashed correctly,
// then updates the role (Better Auth creates everything as STUDENT by default).
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
      `ℹ️  Already present: ${opts.email} (${existing.role}) — id=${existing.id}`,
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

  console.log(
    `✅ ${opts.role} created: ${opts.email} — id=${response.user.id}`,
  );
  return response.user.id;
}

async function main() {
  const seedPassword = requireEnv('SEED_PASSWORD');

  // --- Admin (dedicated password, distinct from test accounts) ---
  await seedUser({
    email: requireEnv('ADMIN_EMAIL'),
    password: requireEnv('ADMIN_PASSWORD'),
    name: process.env.ADMIN_NAME ?? 'Default Admin',
    role: Role.ADMIN,
  });

  // --- Teachers ---
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

  // --- Students ---
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

  console.log('\n🌱 Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
