import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog, getAuditContextFromRequest } from '../utils/audit.js';
import { validateAndNormalizeCpfCnpj } from '../utils/cpf-cnpj.js';
import { sendEmail } from '../services/email.service.js';
import {
  buildTemplateContext,
  replaceTemplateVariables,
} from '../utils/template-variables.js';

import { getFrontendUrl } from '../utils/frontend-url.js';
import { normalizeEmail } from '../utils/email.js';

const router = Router();
const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET ?? 'secret';

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const accountId = req.accountId;
    if (!userId || !accountId) {
      res.status(401).json({ success: false, error: { message: 'Não autenticado' } });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, name: true, role: true },
    });
    const account = await prisma.account.findFirst({
      where: { id: accountId, deletedAt: null },
      select: { id: true, name: true, userId: true },
    });
    if (!user || !account) {
      res.status(401).json({ success: false, error: { message: 'Usuário ou conta não encontrados' } });
      return;
    }
    const isOwner = account.userId === userId;
    const collaboration = isOwner
      ? null
      : await prisma.accountCollaborator.findFirst({
          where: { accountId, userId, deletedAt: null },
          select: { role: true, status: true },
        });
    const collaboratorRole = isOwner ? 'owner' : (collaboration?.role === 'manager' ? 'manager' : 'seller');
    res.json({
      success: true,
      data: {
        user,
        account: { id: account.id, name: account.name },
        isAccountOwner: isOwner,
        collaboratorRole,
      },
    });
  } catch (e) {
    console.error('GET /me error:', e);
    res.status(500).json({ success: false, error: { message: 'Erro ao buscar usuário' } });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email: rawEmail, password, name } = req.body;

    if (!rawEmail || !password || !name) {
      res.status(400).json({
        success: false,
        error: { message: 'Email, senha e nome são obrigatórios' },
      });
      return;
    }

    const email = normalizeEmail(rawEmail);

    // Verificar se usuário já existe (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: { message: 'Email já cadastrado' },
      });
      return;
    }

    // Criar usuário (armazena em minúsculas)
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Criar conta padrão (nome da empresa zerado; usuário preenche em Configurações)
    const account = await prisma.account.create({
      data: {
        name: '',
        userId: user.id,
        status: 'active',
      },
    });

    // Gerar token
    const payload = { userId: user.id, accountId: account.id };
    const secret: jwt.Secret = process.env.JWT_SECRET ?? 'secret';
    const signOptions: jwt.SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
    };
    const token = jwt.sign(payload, secret, signOptions);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        account: {
          id: account.id,
          name: account.name,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Erro ao criar conta' },
    });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email: rawEmail, password } = req.body;

    if (!rawEmail || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Email e senha são obrigatórios' },
      });
      return;
    }

    const email = normalizeEmail(rawEmail);

    // Buscar usuário (exclui excluídos, case-insensitive)
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
      include: {
        accounts: {
          where: { deletedAt: null },
          take: 1,
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { message: 'Credenciais inválidas' },
      });
      return;
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: { message: 'Credenciais inválidas' },
      });
      return;
    }

    // Buscar conta: primeiro como dono, depois como colaborador ativo
    let account = user.accounts[0];
    if (!account) {
      const activeCollaboration = await prisma.accountCollaborator.findFirst({
        where: { userId: user.id, status: 'active', deletedAt: null },
        include: { account: true },
      });
      if (activeCollaboration) {
        account = activeCollaboration.account;
      } else {
        const anyCollaboration = await prisma.accountCollaborator.findFirst({
          where: { userId: user.id, deletedAt: null },
        });
        if (anyCollaboration) {
          res.status(403).json({
            success: false,
            error: { message: 'Acesso bloqueado. Sua conta de colaborador está inativa.' },
          });
          return;
        }
        account = await prisma.account.create({
          data: {
            name: '',
            userId: user.id,
            status: 'active',
          },
        });
      }
    }

    // Usuários comuns (dono e colaboradores): se conta já está vencida ou data de vencimento passou, bloquear acesso
    if (user.role !== 'admin') {
      const now = new Date();
      if (account.status === 'vencido') {
        res.status(403).json({
          success: false,
          error: { message: 'Conta vencida. Entre em contato com o suporte.' },
        });
        return;
      }
      if (account.trialEndsAt && account.trialEndsAt < now) {
        await prisma.account.update({
          where: { id: account.id },
          data: { status: 'vencido' },
        });
        res.status(403).json({
          success: false,
          error: { message: 'Conta vencida. Entre em contato com o suporte.' },
        });
        return;
      }
    }

    const payload = { userId: user.id, accountId: account.id };
    const secret: jwt.Secret = process.env.JWT_SECRET ?? 'secret';
    const signOptions: jwt.SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
    };
    const token = jwt.sign(payload, secret, signOptions);

    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: user.id,
      action: 'login',
      entity: 'User',
      entityId: user.id,
      payload: { description: `Login realizado por '${user.name}'` },
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        account: {
          id: account.id,
          name: account.name,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Erro ao fazer login' },
    });
  }
});

/** Forgot password: email or CPF/CNPJ. Sends reset link. When by CPF/CNPJ returns email so user can confirm. */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { emailOrCpfCnpj } = req.body as { emailOrCpfCnpj?: string };
    const input = typeof emailOrCpfCnpj === 'string' ? emailOrCpfCnpj.trim() : '';
    if (!input) {
      res.status(400).json({ success: false, error: { message: 'Informe o e-mail ou CPF/CNPJ' } });
      return;
    }

    const isEmail = input.includes('@');
    let user: { id: string; email: string; name: string } | null = null;

    if (isEmail) {
      const emailNorm = normalizeEmail(input);
      user = await prisma.user.findFirst({
        where: { email: { equals: emailNorm, mode: 'insensitive' }, deletedAt: null },
        select: { id: true, email: true, name: true },
      });
    } else {
      const { valid, normalized } = validateAndNormalizeCpfCnpj(input);
      if (!valid || (normalized.length !== 11 && normalized.length !== 14)) {
        res.status(400).json({ success: false, error: { message: 'CPF ou CNPJ inválido' } });
        return;
      }
      user = await prisma.user.findFirst({
        where: { cpfCnpj: normalized, deletedAt: null },
        select: { id: true, email: true, name: true },
      });
    }

    const payload = { userId: user?.id, purpose: 'password_reset' as const };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const resetLink = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    if (user) {
      const template = await prisma.notificationTemplate.findFirst({
        where: {
          trigger: 'password_recovery',
          channel: 'email',
          active: true,
          deletedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
      });

      let subject: string;
      let body: string;

      if (template?.subject && template?.body) {
        const ctx = buildTemplateContext({
          userName: user.name,
          resetPasswordLink: resetLink,
        });
        subject = replaceTemplateVariables(template.subject, ctx);
        body = replaceTemplateVariables(template.body, ctx);
      } else {
        subject = 'Redefinição de senha - DescompliCAR';
        body = `Olá, ${user.name}.\n\nVocê solicitou a redefinição de senha. Acesse o link abaixo (válido por 1 hora):\n\n${resetLink}\n\nSe não foi você, ignore este e-mail.`;
      }

      const isHtml = body.includes('<') && body.includes('>');
      const textFallback = isHtml
        ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : body;
      const result = await sendEmail(
        user.email,
        subject,
        textFallback,
        isHtml ? body : undefined
      );

      await prisma.emailLog.create({
        data: {
          to: user.email,
          subject,
          status: result.sent ? 'success' : 'error',
          errorMessage: result.error ?? null,
          origin: 'password_recovery',
          templateId: template?.id ?? null,
        },
      });
      if (template) {
        await prisma.notificationTemplateUsageLog.create({
          data: {
            templateId: template.id,
            trigger: 'password_recovery',
            channel: 'email',
            recipientInfo: user.email,
            success: result.sent,
            errorMessage: result.error ?? null,
          },
        });
      }

      if (result.sent) {
        console.log(`[forgot-password] Email enviado para ${user.email}`);
      } else {
        console.warn('[forgot-password] Falha ao enviar email (SMTP não configurado ou erro)');
      }
    }

    if (isEmail) {
      res.json({ success: true, data: { message: 'Se o e-mail estiver cadastrado, você receberá as instruções em breve.' } });
      return;
    }
    if (user) {
      res.json({ success: true, data: { message: 'O e-mail foi enviado para o endereço cadastrado.', email: user.email } });
      return;
    }
    res.status(404).json({ success: false, error: { message: 'Nenhum usuário encontrado com este CPF/CNPJ' } });
  } catch (e) {
    console.error('Forgot password error:', e);
    res.status(500).json({ success: false, error: { message: 'Erro ao processar. Tente novamente.' } });
  }
});

/** Reset password with token from email. */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ success: false, error: { message: 'Token e nova senha (mín. 6 caracteres) são obrigatórios' } });
      return;
    }
    let payload: { userId?: string; purpose?: string };
    try {
      payload = jwt.verify(token, JWT_SECRET) as { userId: string; purpose: string };
    } catch {
      res.status(400).json({ success: false, error: { message: 'Link expirado ou inválido. Solicite uma nova redefinição.' } });
      return;
    }
    if (payload.purpose !== 'password_reset' || !payload.userId) {
      res.status(400).json({ success: false, error: { message: 'Link inválido' } });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
    });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: user.id,
      action: 'password_reset',
      entity: 'User',
      entityId: user.id,
      payload: {
        description: `Senha redefinida por e-mail para '${user.name}' (${user.email})`,
        entityName: user.name,
      },
    });
    res.json({ success: true, data: { message: 'Senha alterada. Faça login com a nova senha.' } });
  } catch (e) {
    console.error('Reset password error:', e);
    res.status(500).json({ success: false, error: { message: 'Erro ao redefinir senha.' } });
  }
});

/** Update own profile (name, email, phone, cpfCnpj). Colaboradores não podem alterar. */
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.isAccountOwner) {
      res.status(403).json({ success: false, error: { message: 'Colaboradores não podem alterar o perfil da conta.' } });
      return;
    }
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Não autenticado' } });
      return;
    }

    const body = req.body as {
      name?: string;
      email?: string;
      phone?: string | null;
      cpfCnpj?: string | null;
    };

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } });
      return;
    }

    // Validar CPF/CNPJ se fornecido
    if (body.cpfCnpj !== undefined) {
      const raw = body.cpfCnpj === null || body.cpfCnpj === '' ? '' : String(body.cpfCnpj).trim();
      const { valid, normalized } = validateAndNormalizeCpfCnpj(raw);
      if (!valid && raw !== '') {
        res.status(400).json({
          success: false,
          error: { message: 'CPF ou CNPJ inválido. Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).' },
        });
        return;
      }
      body.cpfCnpj = normalized || null;
    }

    // Validar email se fornecido (case-insensitive)
    if (body.email !== undefined && body.email.trim() !== '') {
      const emailNorm = normalizeEmail(body.email);
      const existing = await prisma.user.findFirst({
        where: { email: { equals: emailNorm, mode: 'insensitive' }, id: { not: userId }, deletedAt: null },
      });
      if (existing) {
        res.status(400).json({ success: false, error: { message: 'E-mail já cadastrado para outro usuário' } });
        return;
      }
    }

    // Atualizar usuário (e-mail armazenado em minúsculas)
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.email !== undefined && { email: normalizeEmail(body.email) }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(body.cpfCnpj !== undefined && { cpfCnpj: body.cpfCnpj }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpfCnpj: true,
        role: true,
      },
    });

    const changes: { field: string; label: string; oldValue: unknown; newValue: unknown }[] = [];
    if (body.name !== undefined && body.name.trim() !== user.name) {
      changes.push({ field: 'name', label: 'Nome', oldValue: user.name, newValue: body.name.trim() });
    }
    if (body.email !== undefined && body.email.trim() !== user.email) {
      changes.push({ field: 'email', label: 'E-mail', oldValue: user.email, newValue: body.email.trim() });
    }
    if (body.phone !== undefined) {
      const newPhone = body.phone?.trim() || null;
      if (newPhone !== (user.phone ?? null)) {
        changes.push({ field: 'phone', label: 'Telefone', oldValue: user.phone ?? null, newValue: newPhone });
      }
    }
    if (body.cpfCnpj !== undefined) {
      const newCpf = body.cpfCnpj ?? null;
      if (newCpf !== (user.cpfCnpj ?? null)) {
        changes.push({ field: 'cpfCnpj', label: 'CPF/CNPJ', oldValue: user.cpfCnpj ?? null, newValue: newCpf });
      }
    }
    const profileDesc =
      changes.length > 0
        ? `Perfil de '${user.name}': ${changes.map((c) => c.label).join(', ')} alterados`
        : `Perfil de '${user.name}' (nenhum campo alterado)`;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId!,
      action: 'update',
      entity: 'User',
      entityId: userId,
      payload: {
        description: profileDesc,
        summary: changes.length ? `Alterado(s): ${changes.map((c) => c.label).join(', ')}` : 'Nenhum campo alterado',
        changes: changes.length ? changes : undefined,
        entityName: user.name,
      },
    });

    res.json({
      success: true,
      data: { user: updated },
    });
  } catch (e) {
    console.error('Update profile error:', e);
    res.status(500).json({ success: false, error: { message: 'Erro ao atualizar perfil.' } });
  }
});

/** Change password (requires current password). Colaboradores não podem alterar. */
router.put('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.isAccountOwner) {
      res.status(403).json({ success: false, error: { message: 'Colaboradores não podem alterar a senha da conta.' } });
      return;
    }
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Não autenticado' } });
      return;
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: { message: 'Senha atual e nova senha são obrigatórias' },
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: { message: 'A nova senha deve ter no mínimo 6 caracteres' },
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } });
      return;
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: { message: 'Senha atual incorreta' },
      });
      return;
    }

    // Atualizar senha
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId!,
      action: 'password_change',
      entity: 'User',
      entityId: userId,
      payload: {
        description: `Senha alterada por '${user.name}'`,
        entityName: user.name,
      },
    });

    res.json({
      success: true,
      data: { message: 'Senha alterada com sucesso' },
    });
  } catch (e) {
    console.error('Change password error:', e);
    res.status(500).json({ success: false, error: { message: 'Erro ao alterar senha.' } });
  }
});

export default router;
