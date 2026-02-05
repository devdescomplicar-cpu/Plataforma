/**
 * Altera a senha de um usuário por e-mail.
 * Uso: npx tsx scripts/set-password.ts <email> <novaSenha>
 * Ex: npx tsx scripts/set-password.ts paulothiagobh@gmail.com teste123
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/services/prisma.service.js';

const email = process.argv[2];
const newPassword = process.argv[3];

async function main() {
  if (!email || !newPassword) {
    console.error('Uso: npx tsx scripts/set-password.ts <email> <novaSenha>');
    process.exit(1);
  }

  const emailNorm = String(email).trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: 'insensitive' }, deletedAt: null },
  });

  if (!user) {
    console.error(`Usuário com e-mail ${email} não encontrado.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  console.log(`Senha do usuário ${user.email} alterada com sucesso.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
