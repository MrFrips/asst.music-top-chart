import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Database connection:', databaseUrl ? 'Configured' : 'Missing DATABASE_URL');
  }
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Execute a database operation with automatic retry on connection errors.
 * Neon free tier auto-suspends after idle, causing P1001/connection closed errors.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isConnectionError = error?.code === 'P1001' || 
        error?.message?.includes('Closed') ||
        error?.message?.includes("Can't reach database server");
      
      if (isConnectionError && attempt < retries) {
        console.warn(`DB connection error (attempt ${attempt}/${retries}), reconnecting...`);
        await prisma.$disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        await prisma.$connect();
        continue;
      }
      throw error;
    }
  }
  throw new Error('withRetry: exhausted retries');
}

if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

