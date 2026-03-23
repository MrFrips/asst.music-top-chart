import 'server-only';
import * as cheerio from 'cheerio';

export interface ArtistTopSong {
  trackName: string;
  totalStreams: number; // raw count
  dailyStreams: number; // raw count
  spotifyUrl?: string; // Spotify track URL
}

export interface ArtistTopVideo {
  videoTitle: string;
  totalViews: number;
  yesterdayViews: number;
  youtubeUrl?: string; // YouTube video URL
}

export interface ArtistDetails {
  topSongs: ArtistTopSong[];
  topVideos?: ArtistTopVideo[];
}

/**
 * Scrapes kworb.net for a specific artist's top songs
 * URL format: https://kworb.net/spotify/artist/{spotifyId}_songs.html
 */
export async function scrapeKworbArtistTopSongs(spotifyId: string, limit: number = 3): Promise<ArtistDetails | null> {
  try {
    const url = `https://kworb.net/spotify/artist/${spotifyId}_songs.html`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const topSongs: ArtistTopSong[] = [];
    
    // Find the main table with tracks - look for table with "Song Title", "Streams", "Daily" columns
    $('table.sortable tr, table.addpos tr').each((index, element) => {
      // Skip header row
      if (index === 0) return;
      
      // Stop after getting requested number of songs
      if (topSongs.length >= limit) return false;
      
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 3) {
        // Track name is in the first column (index 0) with a link
        const $trackLink = $(cells[0]).find('a').first();
        const trackName = $trackLink.text().trim() || $(cells[0]).text().trim();
        
        if (!trackName) return;
        
        // Extract Spotify track URL from the link
        // Links are already full URLs: https://open.spotify.com/track/{trackId}
        let spotifyUrl: string | undefined;
        const trackHref = $trackLink.attr('href');
        if (trackHref) {
          // Check if it's already a full Spotify URL
          if (trackHref.startsWith('https://open.spotify.com/track/')) {
            spotifyUrl = trackHref;
          } else if (trackHref.includes('track/')) {
            // Handle relative URLs like ../track/{trackId}.html
            const trackIdMatch = trackHref.match(/track\/([^\/\?\.]+)/);
            if (trackIdMatch) {
              spotifyUrl = `https://open.spotify.com/track/${trackIdMatch[1]}`;
            }
          }
        }
        
        // Total streams is in the second column (index 1)
        const streamsText = $(cells[1]).text().trim();
        const totalStreams = parseNumber(streamsText);
        
        // Daily streams is in the third column (index 2)
        const dailyText = $(cells[2]).text().trim();
        const dailyStreams = parseNumber(dailyText);
        
        // If we found the track name and streams, add it
        if (trackName && totalStreams > 0) {
          topSongs.push({
            trackName,
            totalStreams,
            dailyStreams,
            spotifyUrl,
          });
        }
      }
    });
    
    return { topSongs };
  } catch (error) {
    console.error(`Error scraping artist top songs for ${spotifyId}:`, error);
    return null;
  }
}

/**
 * Scrapes kworb.net for a specific artist's top YouTube videos
 * URL format: https://kworb.net/youtube/artist/{artistSlug}.html
 * The artist slug is typically the artist name in lowercase with spaces replaced by nothing or hyphens
 */
export async function scrapeKworbArtistTopVideos(artistName: string): Promise<ArtistTopVideo[] | null> {
  try {
    // Convert artist name to slug format (lowercase, remove all non-alphanumeric characters)
    // Example: "The Weeknd" -> "theweeknd"
    const artistSlug = artistName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    
    const url = `https://kworb.net/youtube/artist/${artistSlug}.html`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const topVideos: ArtistTopVideo[] = [];
    
    // Find the main table with videos - structure: Video, Views, Yesterday, Published
    $('table.sortable tr, table.addpos tr').each((index, element) => {
      // Skip header row
      if (index === 0) return;
      
      // Stop after getting top 3
      if (topVideos.length >= 3) return false;
      
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 3) {
        // Video title is in the first column (index 0) with a link
        const $videoLink = $(cells[0]).find('a').first();
        const videoTitle = $videoLink.text().trim() || $(cells[0]).text().trim();
        
        if (!videoTitle) return;
        
        // Try to extract YouTube video ID from the link
        let youtubeUrl: string | undefined;
        const videoHref = $videoLink.attr('href');
        if (videoHref) {
          // Link format: ../video/{videoId}.html
          const videoIdMatch = videoHref.match(/video\/([^\/]+)\.html/);
          if (videoIdMatch) {
            youtubeUrl = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
          }
        }
        
        // Total views is in the second column (index 1)
        const viewsText = $(cells[1]).text().trim();
        const totalViews = parseViewsNumber(viewsText);
        
        // Yesterday views is in the third column (index 2)
        const yesterdayText = $(cells[2]).text().trim();
        const yesterdayViews = parseViewsNumber(yesterdayText);
        
        // If we found the video title and views, add it
        if (videoTitle && totalViews > 0) {
          topVideos.push({
            videoTitle,
            totalViews,
            yesterdayViews,
            youtubeUrl,
          });
        }
      }
    });
    
    return topVideos.slice(0, 3);
  } catch (error) {
    console.error(`Error scraping artist top videos for ${artistName}:`, error);
    return null;
  }
}

/**
 * Parses a views number string that may contain commas
 * Returns the number of views
 */
function parseViewsNumber(text: string): number {
  if (!text) return 0;
  
  // Remove commas and spaces
  let cleaned = text.replace(/[, ]/g, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Parses a number string that may contain commas, decimals
 * The numbers on kworb are already in millions (e.g., "123,752.8" = 123.7528 million)
 * Returns value in millions
 */
function parseNumber(text: string): number {
  if (!text) return 0;
  
  // Remove commas and spaces
  let cleaned = text.replace(/[, ]/g, '');
  
  // The numbers are already in millions format (e.g., "123,752.8")
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

