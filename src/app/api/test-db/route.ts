import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// Test endpoint to diagnose database connection issues
// Access at: /api/test-db
export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL 
      ? process.env.DATABASE_URL.substring(0, 30) + '...' 
      : 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
  };

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      status: 'error',
      message: 'DATABASE_URL environment variable is not set',
      diagnostics,
    }, { status: 500 });
  }

  // Check connection string format
  const dbUrl = process.env.DATABASE_URL;
  const hasSslMode = dbUrl.includes('sslmode=');
  const isNeon = dbUrl.includes('neon.tech');
  const isPooled = dbUrl.includes('pooler') || dbUrl.includes('pgbouncer');

  diagnostics.connectionString = {
    hasSslMode,
    isNeon,
    isPooled,
    length: dbUrl.length,
  };

  // Try to connect to database
  try {
    // Simple connection test
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT version() as version`;
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection successful',
      diagnostics: {
        ...diagnostics,
        connectionTest: 'passed',
        databaseVersion: result,
      },
    });
  } catch (error: any) {
    // Enhanced error information
    const errorDetails = {
      message: error.message,
      code: error.code,
      meta: error.meta,
      name: error.name,
    };

    // Check for common error patterns
    let suggestions: string[] = [];
    
    if (error.code === 'P1001') {
      suggestions.push('Cannot reach database server - check connection string and network');
      suggestions.push('Verify Neon database is active in Neon console');
      suggestions.push('Check if Hostinger allows outbound connections to *.neon.tech');
    }
    
    if (error.code === 'P1000') {
      suggestions.push('Authentication failed - check username and password in connection string');
    }
    
    if (error.message?.includes('SSL') || error.message?.includes('TLS')) {
      suggestions.push('SSL/TLS error - ensure connection string includes ?sslmode=require');
    }
    
    if (!hasSslMode && isNeon) {
      suggestions.push('Neon requires SSL - add ?sslmode=require to connection string');
    }
    
    if (!isPooled && isNeon) {
      suggestions.push('Consider using pooled connection URL from Neon for better performance');
    }

    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: errorDetails,
      diagnostics: {
        ...diagnostics,
        connectionTest: 'failed',
        suggestions,
      },
    }, { status: 500 });
  }
}
