import { PrismaClient } from '@prisma/client';

class PrismaService {
  private static instance: PrismaService;
  public prisma: PrismaClient;

  private constructor() {
    // Força a recriação do Prisma Client para garantir que está usando a versão mais recente
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    
    // Verifica se o campo cpfCnpj está disponível (para debug)
    if (process.env.NODE_ENV === 'development') {
      const clientFields = Object.keys(this.prisma.client.fields || {});
      if (!clientFields.includes('cpfCnpj')) {
        console.warn('⚠️  Campo cpfCnpj não encontrado no Prisma Client. Execute: npx prisma generate');
      }
    }
  }

  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  public async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  public async reconnect(): Promise<void> {
    await this.prisma.$disconnect();
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    await this.prisma.$connect();
  }
}

export const prismaService = PrismaService.getInstance();
export const prisma = prismaService.prisma;
