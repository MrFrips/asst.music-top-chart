import { NextResponse } from 'next/server';
import { scrapeKworbArtistTopSongs, scrapeKworbArtistTopVideos } from '@/lib/scraping/kworbArtistDetails';
import { prisma } from '@/lib/db';

// Force dynamic rendering since we query the database and scrape external data
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ artistId: string }> | { artistId: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const artistId = resolvedParams.artistId;
    
    // Get artist from database - try global first, then any country
    let artist = await prisma.artistCurrent.findFirst({
      where: {
        OR: [
          { artistId: artistId, country: 'global' },
          { artistName: decodeURIComponent(artistId), country: 'global' },
        ],
      },
    });
    
    // If not found in global, try any country
    if (!artist) {
      artist = await prisma.artistCurrent.findFirst({
        where: {
          OR: [
            { artistId: artistId },
            { artistName: decodeURIComponent(artistId) },
          ],
        },
      });
    }
    
    if (!artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }
    
    // Scrape top songs if we have a Spotify ID
    let topSongs = null;
    if (artist.artistId) {
      topSongs = await scrapeKworbArtistTopSongs(artist.artistId);
    }
    
    // Scrape top YouTube videos using artist name
    const topVideos = await scrapeKworbArtistTopVideos(artist.artistName);
    
    return NextResponse.json({
      artist: {
        name: artist.artistName,
        artistId: artist.artistId,
        imageUrl: artist.imageUrl,
        spotifyUrl: artist.spotifyUrl,
        genres: artist.genres ? JSON.parse(artist.genres) : null,
        monthlyListeners: artist.monthlyListeners,
        rank: artist.rank,
        // Enhanced metadata for About section
        followers: artist.followers,
        popularity: artist.popularity,
        images: artist.images ? JSON.parse(artist.images) : null,  // Parse JSON string
        biography: artist.biography,
        socialLinks: artist.socialLinks,
        originCountry: artist.originCountry,
        countryCode: artist.countryCode,
        birthDate: artist.birthDate,
      },
      topSongs: topSongs?.topSongs || [],
      topVideos: topVideos || [],
      // Last.fm data for About section
      topTracks: artist.topTracks ? JSON.parse(artist.topTracks) : [],
      topAlbums: artist.topAlbums ? JSON.parse(artist.topAlbums) : [],
      similarArtists: artist.similarArtists ? JSON.parse(artist.similarArtists) : [],
    });
  } catch (error) {
    console.error('Error fetching artist details:', error);
    
    // Enhanced error logging for database connection issues
    if (error instanceof Error) {
      // Log Prisma-specific errors
      if ('code' in error) {
        console.error('Prisma error code:', (error as any).code);
        console.error('Prisma error meta:', (error as any).meta);
      }
      
      // Log connection-related errors
      if (error.message.includes('Can\'t reach database') || 
          error.message.includes('P1001') ||
          error.message.includes('connection')) {
        console.error('Database connection error detected');
        console.error('DATABASE_URL is set:', !!process.env.DATABASE_URL);
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch artist details',
        // Include error details in development for debugging
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      },
      { status: 500 }
    );
  }
}

