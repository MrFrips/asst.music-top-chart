/**
 * Spotify web scraping for actual play counts
 * This scrapes the actual play counts from Spotify's web interface
 */

import * as cheerio from 'cheerio';

/**
 * Scrapes actual play count from Spotify track page
 * @param spotifyUrl - Full Spotify track URL
 * @returns Actual play count or null if not found
 */
export async function scrapeSpotifyPlayCount(spotifyUrl: string): Promise<number | null> {
  try {
    const trackId = extractSpotifyTrackId(spotifyUrl);
    if (!trackId) {
      return null;
    }

    // Construct the Spotify track page URL
    const spotifyTrackUrl = `https://open.spotify.com/track/${trackId}`;
    
    console.log(`Scraping Spotify play count from: ${spotifyTrackUrl}`);
    
    const response = await fetch(spotifyTrackUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      console.log(`Spotify returned ${response.status} for ${spotifyTrackUrl}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for play count in various possible locations
    let playCountText = '';

    // Method 1: Look for play count in meta tags or data attributes
    const playCountSelectors = [
      'meta[property="music:play_count"]',
      'meta[name="play_count"]',
      '[data-testid="play-count"]',
      '.play-count',
      '.stream-count',
      '[data-testid="stream-count"]',
      'span[aria-label*="play"]',
      'span[aria-label*="stream"]',
    ];

    for (const selector of playCountSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        playCountText = element.attr('content') || element.text() || element.attr('aria-label') || '';
        if (playCountText) break;
      }
    }

    // Method 2: Look in the page content for play count patterns
    if (!playCountText) {
      const pageText = $('body').text();
      
      // Look for patterns like "2,930,739,746 plays" or "2.9B plays"
      const playCountPatterns = [
        /([\d,]+)\s*(?:plays?|streams?|listens?)/gi,
        /([\d.]+\s*[KMB])\s*(?:plays?|streams?|listens?)/gi,
      ];

      for (const pattern of playCountPatterns) {
        const match = pageText.match(pattern);
        if (match && match[0]) {
          playCountText = match[0];
          break;
        }
      }
    }

    // Method 3: Look for JSON-LD data
    if (!playCountText) {
      const jsonLdScripts = $('script[type="application/ld+json"]');
      jsonLdScripts.each((_, element) => {
        try {
          const jsonData = JSON.parse($(element).html() || '');
          if (jsonData.playCount || jsonData.streamCount) {
            playCountText = jsonData.playCount || jsonData.streamCount;
            return false; // break the loop
          }
        } catch (e) {
          // Ignore parsing errors
        }
      });
    }

    if (playCountText) {
      // Clean and parse the play count
      const cleanCount = playCountText
        .replace(/[^\d,]/g, '')
        .replace(/,/g, '')
        .trim();

      const playCount = parseInt(cleanCount, 10);
      
      if (!isNaN(playCount) && playCount > 0) {
        console.log(`Found Spotify play count: ${playCount.toLocaleString()}`);
        return playCount;
      }
    }

    console.log(`No play count found for ${spotifyTrackUrl}`);
    return null;

  } catch (error) {
    console.error(`Error scraping Spotify play count for ${spotifyUrl}:`, error);
    return null;
  }
}

/**
 * Extracts Spotify track ID from a Spotify URL
 * @param spotifyUrl - Full Spotify track URL
 * @returns Track ID or null if invalid URL
 */
export function extractSpotifyTrackId(spotifyUrl: string): string | null {
  if (!spotifyUrl || !spotifyUrl.includes('spotify.com/track/')) {
    return null;
  }

  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Formats play count for display
 * @param playCount - Number of plays
 * @returns Formatted string
 */
export function formatPlayCount(playCount: number): string {
  if (playCount >= 1000000000) {
    return (playCount / 1000000000).toFixed(1) + 'B';
  } else if (playCount >= 1000000) {
    return (playCount / 1000000).toFixed(1) + 'M';
  } else if (playCount >= 1000) {
    return (playCount / 1000).toFixed(1) + 'K';
  } else {
    return playCount.toLocaleString();
  }
}