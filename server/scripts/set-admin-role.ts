/**
 * Sets user suporte@pratiko.app.br to role 'admin'.
 * Run from server: npx tsx scripts/set-admin-role.ts
 */
import 'dotenv/config';
import { prisma } from '../src/services/prisma.service.js';

const ADMIN_EMAIL = 'suporte@pratiko.app.br';

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL, deletedAt: null },
  });

  if (!user) {
    console.log(`User ${ADMIN_EMAIL} not found. Run seed:admin to create.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  if (user.role === 'admin') {
    console.log(`User ${ADMIN_EMAIL} is already admin.`);
    await prisma.$disconnect();
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' },
  });

  console.log(`User ${ADMIN_EMAIL} updated to role: admin`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
