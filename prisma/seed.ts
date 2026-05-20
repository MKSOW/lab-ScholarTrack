import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Lecture stricte des variables d'environnement
  // On échoue tôt si une variable critique manque
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? 'Default Admin';

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'Missing required env vars: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env',
    );
  }

  // ⚠️ Pour l'instant on ne stocke PAS encore le password.
  // Better Auth (Phase 2) le hashera et le stockera dans la table `accounts`.
  // On garde la variable lue ici pour valider qu'elle est bien définie,
  // et on l'utilisera dans le seed une fois Better Auth branché.
  void adminPassword;

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: adminName,
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  console.log(`✅ Admin seeded: ${admin.email} (id=${admin.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });