import { PrismaClient, Role } from '@prisma/client';
import { auth } from '../src/auth/auth';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? 'Default Admin';

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans .env',
    );
  }

  // Seed idempotent : ne recrée pas l'admin s'il existe déjà
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (existing) {
    console.log(`ℹ️  Admin déjà présent : ${adminEmail}`);
    return;
  }

  // Créer le compte via Better Auth pour que le mot de passe soit hashé
  // et stocké dans la table `accounts` (format attendu par Better Auth)
  const response = await auth.api.signUpEmail({
    body: {
      email: adminEmail,
      name: adminName,
      password: adminPassword,
    },
  });

  // Passer le rôle à ADMIN (Better Auth crée avec STUDENT par défaut)
  await prisma.user.update({
    where: { id: response.user.id },
    data: { role: Role.ADMIN, emailVerified: true },
  });

  console.log(`✅ Admin seeded : ${adminEmail} (id=${response.user.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Seed échoué :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
