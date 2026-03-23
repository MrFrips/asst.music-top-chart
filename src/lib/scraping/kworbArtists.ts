import 'server-only';
import * as cheerio from 'cheerio';
import { ArtistStatRaw } from '../types';

/**
 * Scrapes kworb.net for top artists by monthly listeners
 * URL: https://kworb.net/spotify/listeners.html
 */
export async function scrapeKworbTopArtistsByListeners(): Promise<ArtistStatRaw[]> {
  try {
    // Use Node's native fetch to avoid axios/undici issues
    const response = await fetch('https://kworb.net/spotify/listeners.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const artists: ArtistStatRaw[] = [];
    
    // Find the main table - kworb typically uses a table with class "addpos" or similar
    // The table structure: rank, artist name, monthly listeners, daily change
    $('table tr').each((index, element) => {
      // Skip header row
      if (index === 0) return;
      
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 3) {
        // Extract rank (first column, may have position number)
        const rankText = $row.find('td').first().text().trim();
        const rank = parseInt(rankText.replace(/[^\d]/g, ''), 10);
        
        if (isNaN(rank)) return;
        
        // Artist name is typically in the second column
        const artistName = $(cells[1]).text().trim();
        
        if (!artistName) return;
        
        // Monthly listeners (third column)
        const listenersText = $(cells[2]).text().trim();
        const monthlyListeners = parseNumber(listenersText);
        
        // Daily change (fourth column, if present)
        let listenersDelta: number | undefined;
        if (cells.length >= 4) {
          const deltaText = $(cells[3]).text().trim();
          listenersDelta = parseDelta(deltaText);
        }
        
        artists.push({
          name: artistName,
          rank,
          monthlyListeners,
          listenersDelta,
        });
      }
    });
    
    const limit = parseInt(process.env.TOP_ARTISTS_LIMIT || '25', 10);
    return artists.slice(0, limit);
  } catch (error) {
    console.error('Error scraping kworb artists:', error);
    throw new Error(`Failed to scrape kworb artists: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parses a number string that may contain commas, decimals, or units (M, K)
 */
function parseNumber(text: string): number {
  if (!text) return 0;
  
  // Remove commas and spaces
  let cleaned = text.replace(/[, ]/g, '');
  
  // Handle units (M = million, K = thousand)
  let multiplier = 1;
  if (cleaned.endsWith('M')) {
    multiplier = 1000000;
    cleaned = cleaned.replace('M', '');
  } else if (cleaned.endsWith('K')) {
    multiplier = 1000;
    cleaned = cleaned.replace('K', '');
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * multiplier);
}

/**
 * Parses a delta string (e.g., "+1.2M", "-50K", "0")
 */
function parseDelta(text: string): number | undefined {
  if (!text || text === '0' || text === '-') return undefined;
  
  const cleaned = text.trim();
  const isNegative = cleaned.startsWith('-');
  const numText = cleaned.replace(/[+\-]/g, '');
  
  const num = parseNumber(numText);
  return isNegative ? -num : num;
}

