const { PrismaClient } = require('@prisma/client');
const { fetchLastFmTopTracks } = require('./src/lib/scraping/lastfmTracks');

const prisma = new PrismaClient();

async function refreshArtistTracks() {
  console.log('Refreshing Spotify URLs for existing artists...');
  
  try {
    // Get top artists
    const artists = await prisma.artistCurrent.findMany({
      where: { country: 'global' },
      orderBy: { rank: 'asc' },
      take: 50, // Start with top 50
      select: { artistName: true, rank: true }
    });

    console.log(`Found ${artists.length} artists to refresh`);

    let updatedCount = 0;
    let totalTracks = 0;
    let tracksWithSpotify = 0;

    for (const artist of artists) {
      console.log(`\n🔄 Processing ${artist.artistName} (rank #${artist.rank})...`);
      
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
          
          // Check Bruno Mars specifically
          if (artist.artistName === 'Bruno Mars') {
            console.log('\n🎯 Bruno Mars tracks:');
            tracks.forEach((track, i) => {
              console.log(`  ${i+1}. ${track.name} - ${track.spotifyUrl || 'No Spotify URL'}`);
            });
          }
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing ${artist.artistName}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Updated ${updatedCount} artists`);
    console.log(`📈 Total tracks: ${totalTracks}`);
    console.log(`🎵 Tracks with Spotify URLs: ${tracksWithSpotify}`);
    console.log(`📊 Spotify URL rate: ${totalTracks > 0 ? (tracksWithSpotify / totalTracks * 100).toFixed(1) + '%' : '0%'}`);

  } catch (error) {
    console.error('Error refreshing tracks:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the refresh
refreshArtistTracks().catch(console.error);