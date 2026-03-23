import { NextRequest, NextResponse } from 'next/server';
import { fetchLastFmTopTracks } from '@/lib/scraping/lastfmTracks';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistName = searchParams.get('artist');

  if (!artistName) {
    return NextResponse.json({ error: 'Artist name is required' }, { status: 400 });
  }

  try {
    console.log(`Testing Spotify URL scraping for: ${artistName}`);
    const tracks = await fetchLastFmTopTracks(artistName);
    
    const summary = {
      artist: artistName,
      totalTracks: tracks.length,
      tracksWithSpotify: tracks.filter(t => t.spotifyUrl).length,
      tracks: tracks.map((track, index) => ({
        position: index + 1,
        name: track.name,
        spotifyUrl: track.spotifyUrl || null,
        lastfmUrl: track.lastfmUrl,
        hasSpotify: !!track.spotifyUrl
      }))
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error testing Spotify scraping:', error);
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
  }
}