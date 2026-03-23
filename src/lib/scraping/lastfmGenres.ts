/**
 * Last.fm scraper for fetching artist genre tags and similar artists
 */

import * as cheerio from 'cheerio';

export interface LastfmGenre {
  name: string;
  url: string;
  count?: number;
}

export interface SimilarArtist {
  name: string;
  url: string;
  image?: string;
  match?: number;
}

/**
 * Fetches genre tags for an artist from Last.fm
 */
export async function fetchLastFmGenres(artistName: string): Promise<LastfmGenre[]> {
  try {
    const cleanName = artistName.trim().replace(/\s+/g, '+');
    const url = `https://www.last.fm/music/${encodeURIComponent(cleanName)}/+tags`;
    
    console.log(`Fetching Last.fm genres for: ${artistName}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`Last.fm returned ${response.status} for ${artistName} genres`);
      return [];
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const genres: LastfmGenre[] = [];
    
    // Scrape genre tags from the tags section
    $('.tag-list .tag, .catalogue-tags .tag').each((_, element) => {
      const $tag = $(element);
      const name = $tag.find('a').text().trim();
      const tagUrl = 'https://www.last.fm' + $tag.find('a').attr('href');
      const countText = $tag.find('.tag-count').text().trim();
      const count = countText ? parseInt(countText.replace(/[(),]/g, '')) : undefined;
      
      if (name) {
        genres.push({
          name,
          url: tagUrl,
          count
        });
      }
    });
    
    // Alternative selector for tags
    if (genres.length === 0) {
      $('.tag-item, .tag').each((_, element) => {
        const $tag = $(element);
        const name = $tag.text().trim();
        const tagUrl = 'https://www.last.fm' + $tag.find('a').attr('href');
        
        if (name && !name.includes('listeners') && name.length > 1) {
          genres.push({
            name,
            url: tagUrl || `https://www.last.fm/tag/${encodeURIComponent(name)}`
          });
        }
      });
    }
    
    // Remove duplicates and sort by count (if available)
    const uniqueGenres = genres.filter((genre, index, self) => 
      index === self.findIndex(g => g.name.toLowerCase() === genre.name.toLowerCase())
    );
    
    return uniqueGenres.slice(0, 10); // Return top 10 genres
  } catch (error) {
    console.error(`Error fetching Last.fm genres for "${artistName}":`, error);
    return [];
  }
}

/**
 * Parses similar artists from Last.fm HTML
 */
function parseSimilarArtists($: cheerio.CheerioAPI): SimilarArtist[] {
  const similarArtists: SimilarArtist[] = [];
  
  // Scrape similar artists from the similar artists section
  $('.similar-artists-item, .catalogue-item').each((_, element) => {
    const $item = $(element);
    const name = $item.find('.similar-artists-item-name, .catalogue-item-name').text().trim();
    const artistUrl = 'https://www.last.fm' + $item.find('a').first().attr('href');
    const image = $item.find('img').attr('src');
    
    // Try to get match percentage
    const matchText = $item.find('.similar-artists-item-match, .catalogue-item-match').text().trim();
    const match = matchText ? parseFloat(matchText.replace('%', '')) : undefined;
    
    if (name && artistUrl) {
      similarArtists.push({
        name,
        url: artistUrl,
        image: image ? image.replace('/174s/', '/770x0/').replace('/300x300/', '/770x0/') : undefined,
        match
      });
    }
  });
  
  // Alternative selector for similar artists
  if (similarArtists.length === 0) {
    $('.resource-list--artist-list-item').each((_, element) => {
      const $item = $(element);
      const name = $item.find('.resource-list--artist-list-item-name').text().trim();
      const artistUrl = 'https://www.last.fm' + $item.find('a').first().attr('href');
      const image = $item.find('img').attr('src');
      
      if (name && artistUrl) {
        similarArtists.push({
          name,
          url: artistUrl,
          image: image ? image.replace('/174s/', '/770x0/').replace('/300x300/', '/770x0/') : undefined
        });
      }
    });
  }

  return similarArtists;
}

/**
 * Fetches similar artists for an artist from Last.fm
 */
export async function fetchLastFmSimilarArtists(artistName: string): Promise<SimilarArtist[]> {
  try {
    const cleanName = artistName.trim().replace(/\s+/g, '+');
    const baseUrl = `https://www.last.fm/music/${encodeURIComponent(cleanName)}/+similar`;
    
    console.log(`Fetching Last.fm similar artists for: ${artistName}`);
    
    const fetchPage = async (pageUrl: string) => {
      try {
        const response = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (!response.ok) {
          console.log(`Last.fm returned ${response.status} for ${pageUrl}`);
          return [];
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        return parseSimilarArtists($);
      } catch (err) {
        console.error(`Error fetching page ${pageUrl}:`, err);
        return [];
      }
    };

    // Fetch page 1
    let allArtists = await fetchPage(baseUrl);

    // If we have fewer than 16, try page 2
    if (allArtists.length < 16) {
      console.log(`Found ${allArtists.length} similar artists on page 1, fetching page 2...`);
      const page2Artists = await fetchPage(`${baseUrl}?page=2`);
      allArtists = [...allArtists, ...page2Artists];
    }
    
    // Remove duplicates
    const uniqueArtists = allArtists.filter((artist, index, self) => 
      index === self.findIndex(a => a.name.toLowerCase() === artist.name.toLowerCase())
    );
    
    return uniqueArtists.slice(0, 16); // Return top 16 similar artists
  } catch (error) {
    console.error(`Error fetching Last.fm similar artists for "${artistName}":`, error);
    return [];
  }
}

/**
 * Fetches both genres and similar artists in one call
 */
export async function fetchLastFmArtistInfo(artistName: string) {
  const [genres, similarArtists] = await Promise.all([
    fetchLastFmGenres(artistName),
    fetchLastFmSimilarArtists(artistName)
  ]);
  
  return {
    genres,
    similarArtists
  };
}