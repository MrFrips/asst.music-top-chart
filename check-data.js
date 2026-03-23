const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    const globalArtists = await prisma.artistCurrent.count({ where: { country: 'global' } });
    const idArtists = await prisma.artistCurrent.count({ where: { country: 'id' } });
    const globalTracks = await prisma.trackCurrent.count({ where: { country: 'global' } });
    const idTracks = await prisma.trackCurrent.count({ where: { country: 'id' } });
    
    console.log('Current data counts:');
    console.log('- Global artists:', globalArtists);
    console.log('- Indonesia artists:', idArtists);
    console.log('- Global tracks:', globalTracks);
    console.log('- Indonesia tracks:', idTracks);
    
    if (globalArtists === 0 && idArtists === 0) {
      console.log('No data found. You need to run the cron refresh endpoint.');
      console.log('Start the development server with: npm run dev');
      console.log('Then visit: http://localhost:3000/api/cron/refresh');
    }
    
  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();