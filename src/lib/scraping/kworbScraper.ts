/**
 * Kworb.net scraper for accurate Spotify streaming data
 * Kworb provides actual Spotify play counts for tracks and artists
 */

import * as cheerio from 'cheerio';

/**
 * Fetches actual Spotify play counts from kworb.net
 * @param artistName - Artist name
 * @param trackName - Track name
 * @returns Actual play count or null if not found
 */
export async function fetchKworbPlayCount(artistName: string, trackName: string): Promise<number | null> {
  try {
    // Clean up artist and track names for URL
    const cleanArtist = artistName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTrack = trackName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Try to find the track on kworb.net
    const searchUrl = `https://kworb.net/spotify/track/search.html?q=${encodeURIComponent(`${artistName} ${trackName}`)}`;
    
    console.log(`Searching kworb.net for: ${artistName} - ${trackName}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`Kworb.net returned ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Look for the track in the search results
    const rows = $('table tbody tr');
    
    for (let i = 0; i < rows.length; i++) {
      const $row = $(rows[i]);
      const cells = $row.find('td');
      
      if (cells.length >= 4) {
        const artist = $(cells[1]).text().trim();
        const track = $(cells[2]).text().trim();
        const playsText = $(cells[3]).text().trim();
        
        // Check if this matches our artist and track
        if (artist.toLowerCase().includes(artistName.toLowerCase()) && 
            track.toLowerCase().includes(trackName.toLowerCase())) {
          
          // Parse the play count
          const plays = parseInt(playsText.replace(/,/g, ''));
          if (!isNaN(plays) && plays > 0) {
            console.log(`Found kworb.net play count: ${plays.toLocaleString()} for ${artistName} - ${trackName}`);
            return plays;
          }
        }
      }
    }
    
    console.log(`No kworb.net data found for ${artistName} - ${trackName}`);
    return null;
    
  } catch (error) {
    console.error(`Error fetching kworb.net data:`, error);
    return null;
  }
}

/**
 * Fetches artist's top tracks from kworb.net
 * @param artistName - Artist name
 * @returns Array of tracks with actual Spotify play counts
 */
export async function fetchKworbArtistTracks(artistName: string): Promise<Array<{
  name: string;
  playCount: number;
  url?: string;
}>> {
  try {
    // Clean artist name for URL
    const cleanArtist = artistName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Try to find artist page on kworb.net
    const artistUrl = `https://kworb.net/spotify/artist/${cleanArtist}.html`;
    
    console.log(`Fetching kworb.net artist page: ${artistUrl}`);
    
    const response = await fetch(artistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`Kworb.net artist page returned ${response.status}`);
      
      // Try alternative URL format
      const altUrl = `https://kworb.net/spotify/artist/${encodeURIComponent(artistName)}.html`;
      const altResponse = await fetch(altUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      if (!altResponse.ok) {
        return [];
      }
      
      const altHtml = await altResponse.text();
      return parseKworbArtistTracks(altHtml);
    }
    
    const html = await response.text();
    return parseKworbArtistTracks(html);
    
  } catch (error) {
    console.error(`Error fetching kworb.net artist data:`, error);
    return [];
  }
}

/**
 * Parses kworb.net artist page for track data
 */
function parseKworbArtistTracks(html: string): Array<{
  name: string;
  playCount: number;
  url?: string;
}> {
  const $ = cheerio.load(html);
  const tracks: Array<{ name: string; playCount: number; url?: string }> = [];
  
  // Look for the tracks table
  const table = $('table').first();
  const rows = table.find('tbody tr');
  
  for (let i = 0; i < rows.length && i < 20; i++) {
    const $row = $(rows[i]);
    const cells = $row.find('td');
    
    if (cells.length >= 4) {
      const rank = $(cells[0]).text().trim();
      const trackName = $(cells[1]).text().trim();
      const playsText = $(cells[2]).text().trim();
      
      // Skip header rows
      if (rank && !isNaN(parseInt(rank))) {
        const plays = parseInt(playsText.replace(/,/g, ''));
        if (!isNaN(plays) && plays > 0) {
          tracks.push({
            name: trackName,
            playCount: plays
          });
        }
      }
    }
  }
  
  return tracks;
}

/**
 * Gets the most accurate play count available using multiple sources
 * @param artistName - Artist name
 * @param trackName - Track name
 * @param spotifyUrl - Spotify URL (if available)
 * @param lastfmListeners - Last.fm listeners (fallback)
 * @returns Best available play count data
 */
export async function getAccuratePlayCountWithKworb(
  artistName: string,
  trackName: string,
  spotifyUrl?: string,
  lastfmListeners: number = 0
): Promise<{
  playCount: number;
  source: 'kworb' | 'spotify' | 'lastfm';
  trackName: string;
  artistName: string;
}> {
  // Try kworb.net first (most accurate)
  const kworbCount = await fetchKworbPlayCount(artistName, trackName);
  if (kworbCount) {
    return {
      playCount: kworbCount,
      source: 'kworb',
      trackName,
      artistName
    };
  }
  
  // Try Spotify API if we have a URL
  if (spotifyUrl) {
    const trackId = extractSpotifyTrackId(spotifyUrl);
    if (trackId) {
      // Import dynamically to avoid circular dependencies
      const { fetchSpotifyTrackData } = await import('./spotifyPlayCountService');
      const spotifyData = await fetchSpotifyTrackData(trackId);
      if (spotifyData) {
        return {
          playCount: spotifyData.playCount,
          source: 'spotify',
          trackName: spotifyData.trackName,
          artistName: spotifyData.artistName
        };
      }
    }
  }
  
  // Fallback to Last.fm listeners
  return {
    playCount: lastfmListeners,
    source: 'lastfm',
    trackName,
    artistName
  };
}

/**
 * Extracts Spotify track ID from a Spotify URL
 */
function extractSpotifyTrackId(spotifyUrl: string): string | null {
  if (!spotifyUrl || !spotifyUrl.includes('spotify.com/track/')) {
    return null;
  }

  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}