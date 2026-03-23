import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Force dynamic rendering since we use params
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ artistId: string }> | { artistId: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const country = searchParams.get('country') || 'global';
    
    // Get artist name from artistId (which is actually the artist name in our current setup)
    const artistName = decodeURIComponent(resolvedParams.artistId);
    
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Fetch snapshots for this artist
    const snapshots = await prisma.artistSnapshot.findMany({
      where: {
        artistName,
        country,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    
    // Transform data for charts
    const chartData = snapshots.map(snapshot => ({
      date: snapshot.createdAt.toISOString(),
      monthlyListeners: snapshot.monthlyListeners,
      rank: snapshot.rank,
      listenersDelta: snapshot.listenersDelta || 0,
    }));
    
    return NextResponse.json({ 
      artistName,
      country,
      history: chartData,
      dataPoints: chartData.length,
    });
  } catch (error) {
    console.error('Error fetching artist history:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch artist history',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}