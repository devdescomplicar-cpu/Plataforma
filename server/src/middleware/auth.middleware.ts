import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.service.js';

export interface AuthRequest extends Request {
  userId?: string;
  accountId?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        error: { message: 'Token não informado' },
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      userId: string;
      accountId: string;
    };

    req.userId = decoded.userId;
    req.accountId = decoded.accountId;

    const user = await prisma.user.findFirst({
      where: { id: decoded.userId, deletedAt: null },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { message: 'Usuário não encontrado' },
      });
      return;
    }

    let account = await prisma.account.findFirst({
      where: { id: decoded.accountId, userId: user.id, deletedAt: null },
    });

    if (!account) {
      res.status(401).json({
        success: false,
        error: { message: 'Conta não encontrada' },
      });
      return;
    }

    // Usuários comuns: se vencido ou data de vencimento passou, bloquear acesso
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

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { message: 'Token inválido ou expirado' },
    });
  }
};

/**
 * Requires authMiddleware to run first. Checks that the authenticated user has role 'admin'.
 */
export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Não autenticado' },
      });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true },
    });
    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: { message: 'Acesso negado. Apenas administradores podem acessar esta área.' },
      });
      return;
    }
    next();
  } catch (e) {
    console.error('[adminMiddleware]', e);
    res.status(500).json({
      success: false,
      error: { message: 'Erro ao verificar permissão' },
    });
  }
};
