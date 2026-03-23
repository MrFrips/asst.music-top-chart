import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get the most recent update time from either artists or tracks
    const [latestArtist, latestTrack] = await Promise.all([
      prisma.artistCurrent.findFirst({
        orderBy: { lastUpdated: 'desc' },
        select: { lastUpdated: true },
      }),
      prisma.trackCurrent.findFirst({
        orderBy: { lastUpdated: 'desc' },
        select: { lastUpdated: true },
      }),
    ]);
    
    const lastUpdated = latestArtist?.lastUpdated || latestTrack?.lastUpdated || null;
    
    return NextResponse.json({ 
      lastUpdated: lastUpdated?.toISOString() || null,
    });
  } catch (error) {
    console.error('Error fetching last updated:', error);
    return NextResponse.json(
      { error: 'Failed to fetch last updated' },
      { status: 500 }
    );
  }
}

