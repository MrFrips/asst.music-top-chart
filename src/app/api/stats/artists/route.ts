import { NextResponse } from 'next/server';
import { statsProvider } from '@/lib/services/statsProvider';

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || process.env.TOP_ARTISTS_LIMIT || '25', 10);
    const sortBy = searchParams.get('sortBy') || 'rank'; // 'rank' or 'dailyChange'
    const country = searchParams.get('country') || 'global';

    let artists = await statsProvider.getTopArtists(limit, country);

    // Calculate isNew flag
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    artists = artists.map(artist => {
      let isNew = false;
      if (artist.firstSeenDate) {
        const firstSeen = new Date(artist.firstSeenDate);
        if (firstSeen > yesterday) {
          isNew = true;
        }
      }
      return { ...artist, isNew };
    });

    // If sorting by daily change, sort by listenersDelta
    if (sortBy === 'dailyChange') {
      artists = artists
        .filter(a => a.listenersDelta !== null)
        .sort((a, b) => {
          const aDelta = Math.abs(a.listenersDelta ?? 0);
          const bDelta = Math.abs(b.listenersDelta ?? 0);
          return bDelta - aDelta; // Descending by absolute change
        })
        .slice(0, limit);
    }

    return NextResponse.json({ artists });
  } catch (error) {
    console.error('Error fetching artists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artists' },
      { status: 500 }
    );
  }
}

