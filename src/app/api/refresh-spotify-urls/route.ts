import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchLastFmTopTracks } from '@/lib/scraping/lastfmTracks';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistName = searchParams.get('artist');
  const force = searchParams.get('force') === 'true';

  try {
    if (artistName) {
      // Refresh specific artist
      console.log(`Refreshing Spotify URLs for: ${artistName}`);
      const tracks = await fetchLastFmTopTracks(artistName);
      
      if (tracks.length > 0) {
        await prisma.artistCurrent.update({
          where: { 
            artistName_country: { 
              artistName: artistName, 
              country: 'global' 
            } 
          },
          data: {
            topTracks: JSON.stringify(tracks),
            lastUpdated: new Date()
          }
        });
        
        return NextResponse.json({
          success: true,
          artist: artistName,
          tracksUpdated: tracks.length,
          tracksWithSpotify: tracks.filter(t => t.spotifyUrl).length,
          tracks
        });
      }
      
      return NextResponse.json({
        success: false,
        artist: artistName,
        message: 'No tracks found'
      });
    }

    // Refresh all artists (limited to top 100 for performance)
    console.log('Refreshing Spotify URLs for all top artists...');
    const artists = await prisma.artistCurrent.findMany({
      where: { country: 'global' },
      orderBy: { rank: 'asc' },
      take: 100,
      select: { artistName: true, rank: true }
    });

    let updatedCount = 0;
    let totalTracks = 0;
    let tracksWithSpotify = 0;

    for (const artist of artists) {
      console.log(`Processing ${artist.artistName} (rank #${artist.rank})...`);
      
      try {
        const tracks = await fetchLastFmTopTracks(artist.artistName);
        
        if (tracks.length > 0) {
          await prisma.artistCurrent.update({
            where: { 
              artistName_country: { 
                artistName: artist.artistName, 
                country: 'global' 
              } 
            },
            data: {
              topTracks: JSON.stringify(tracks),
              lastUpdated: new Date()
            }
          });
          
          updatedCount++;
          totalTracks += tracks.length;
          tracksWithSpotify += tracks.filter(t => t.spotifyUrl).length;
          
          console.log(`✅ Updated ${artist.artistName}: ${tracks.length} tracks, ${tracks.filter(t => t.spotifyUrl).length} with Spotify URLs`);
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing ${artist.artistName}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      artistsUpdated: updatedCount,
      totalTracks,
      tracksWithSpotify,
      spotifyUrlRate: totalTracks > 0 ? (tracksWithSpotify / totalTracks * 100).toFixed(1) + '%' : '0%'
    });

  } catch (error) {
    console.error('Error refreshing Spotify URLs:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}