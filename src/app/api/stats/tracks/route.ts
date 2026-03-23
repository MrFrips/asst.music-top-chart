import { NextResponse } from 'next/server';
import { statsProvider } from '@/lib/services/statsProvider';

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || process.env.TOP_TRACKS_LIMIT || '25', 10);
    const country = searchParams.get('country') || 'global';
    
    const tracks = await statsProvider.getTopTracks(limit, country);
    
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}

