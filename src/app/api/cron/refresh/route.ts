import { NextResponse } from 'next/server';
import { statsProvider } from '@/lib/services/statsProvider';

// Force dynamic rendering since we use request.url and headers
export const dynamic = 'force-dynamic';

/**
 * Cron endpoint for refreshing stats
 * Can be called manually with admin secret or by Vercel cron
 */
export async function GET(request: Request) {
  try {
    // Check for admin secret if provided (for manual refresh)
    const { searchParams } = new URL(request.url);
    const adminSecret = searchParams.get('secret');
    
    // Vercel cron sends Authorization header with Bearer token
    const authHeader = request.headers.get('authorization');
    const cronSecret = authHeader?.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '')
      : null;
    
    const expectedSecret = process.env.ADMIN_SECRET;
    
    // Allow if:
    // 1. Vercel cron (has authorization header with Bearer token matching ADMIN_SECRET)
    // 2. Manual call with ?secret=ADMIN_SECRET query param
    // 3. No secret required in development
    if (process.env.NODE_ENV === 'production') {
      const isValidCron = cronSecret === expectedSecret;
      const isValidManual = adminSecret === expectedSecret;
      
      if (!isValidCron && !isValidManual) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    // Run refresh in background (don't wait for completion to avoid timeout)
    statsProvider.refreshAllStats().catch(error => {
      console.error('Background refresh error:', error);
    });
    
    return NextResponse.json({ 
      message: 'Refresh started',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error starting refresh:', error);
    return NextResponse.json(
      { error: 'Failed to start refresh' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual refresh (alternative to GET with secret)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const adminSecret = body.secret || request.headers.get('x-admin-secret');
    
    const expectedSecret = process.env.ADMIN_SECRET;
    
    if (process.env.NODE_ENV === 'production' && adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Run refresh
    await statsProvider.refreshAllStats();
    
    return NextResponse.json({ 
      message: 'Refresh completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error during refresh:', error);
    return NextResponse.json(
      { error: 'Failed to refresh stats' },
      { status: 500 }
    );
  }
}

