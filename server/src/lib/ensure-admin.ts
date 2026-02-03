/**
 * Garante que o usuário admin padrão existe (suporte@pratiko.app.br).
 * Chamado no startup do app para ambientes novos/deploy.
 */
import bcrypt from 'bcrypt';
import { prisma } from '../services/prisma.service.js';

const ADMIN_EMAIL = 'suporte@pratiko.app.br';
const ADMIN_PASSWORD = 'Tcadmin55!';
const ADMIN_NAME = 'Suporte Admin';

export async function ensureAdminUser(): Promise<void> {
  try {
    const existing = await prisma.user.findFirst({
      where: { email: ADMIN_EMAIL, deletedAt: null },
    });

    if (existing) {
      console.log(`[seed] Admin ${ADMIN_EMAIL} já existe.`);
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

    console.log(`[seed] Admin criado: ${ADMIN_EMAIL} (role: admin)`);
  } catch (err) {
    console.error('[seed] Erro ao garantir admin:', err);
    // Não derruba o app; migrações ou primeiro login podem falhar até corrigir
  }
}
