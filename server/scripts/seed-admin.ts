/**
 * Seed script: creates admin user suporte@pratiko.app.br (Tcadmin55!) and Account.
 * Run from server (after prisma generate): npm run seed:admin
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/services/prisma.service.js';

const ADMIN_EMAIL = 'suporte@pratiko.app.br';
const ADMIN_PASSWORD = 'Tcadmin55!';
const ADMIN_NAME = 'Suporte Admin';

async function seed() {
  const existing = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL, deletedAt: null },
  });

  if (existing) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists. Skipping.`);
    await prisma.$disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      name: ADMIN_NAME,
      role: 'admin',
    },
  });

  await prisma.account.create({
    data: {
      name: 'Conta Suporte',
      userId: user.id,
      status: 'active',
    },
  });

  console.log(`Admin user created: ${ADMIN_EMAIL} (role: admin)`);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
