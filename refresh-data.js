const { PrismaClient } = require('@prisma/client');
const { fetchKworbData } = require('./src/lib/scraping/kworbScraper');
const { fetchKworbIndonesiaData } = require('./src/lib/scraping/kworbIndonesia');
const { fetchKworbTracksData } = require('./src/lib/scraping/kworbTracks');

const prisma = new PrismaClient();

async function refreshAllData() {
  console.log('Starting data refresh...');
  
  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await prisma.artistCurrent.deleteMany({});
    await prisma.trackCurrent.deleteMany({});
    await prisma.artistSnapshot.deleteMany({});
    await prisma.trackSnapshot.deleteMany({});
    
    // Fetch and store Global Top Artists
    console.log('Fetching Global Top Artists...');
    const globalArtists = await fetchKworbData();
    for (const artist of globalArtists) {
      await prisma.artistCurrent.create({
        data: {
          artistName: artist.name,
          country: 'global',
          rank: artist.rank,
          monthlyListeners: artist.monthlyListeners,
          listenersDelta: artist.listenersDelta || 0,
          imageUrl: artist.imageUrl,
          lastUpdated: new Date()
        }
      });
    }
    
    // Fetch and store Indonesia Top Artists
    console.log('Fetching Indonesia Top Artists...');
    const indonesiaArtists = await fetchKworbIndonesiaData();
    for (const artist of indonesiaArtists) {
      await prisma.artistCurrent.create({
        data: {
          artistName: artist.name,
          country: 'id',
          rank: artist.rank,
          monthlyListeners: artist.monthlyListeners,
          listenersDelta: artist.listenersDelta || 0,
          imageUrl: artist.imageUrl,
          lastUpdated: new Date()
        }
      });
    }
    
    // Fetch and store Global Top Tracks
    console.log('Fetching Global Top Tracks...');
    const globalTracks = await fetchKworbTracksData();
    for (const track of globalTracks) {
      await prisma.trackCurrent.create({
        data: {
          trackName: track.name,
          artistName: track.artist,
          country: 'global',
          rank: track.rank,
          dailyStreams: BigInt(track.dailyStreams),
          totalStreams: track.totalStreams ? BigInt(track.totalStreams) : null,
          imageUrl: track.imageUrl,
          lastUpdated: new Date()
        }
      });
    }
    
    console.log('Data refresh completed successfully!');
    
  } catch (error) {
    console.error('Error during data refresh:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the refresh
refreshAllData();