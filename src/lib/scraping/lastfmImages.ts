/**
 * Last.fm scraper for fetching artist images
 * Last.fm has excellent user-uploaded artist photos
 */

import * as cheerio from 'cheerio';

export async function fetchLastFmArtistImages(artistName: string): Promise<string[]> {
  try {
    // Clean artist name for URL
    const cleanName = artistName
      .trim()
      .replace(/\s+/g, '+'); // Last.fm uses + in URLs
    
    const url = `https://www.last.fm/music/${encodeURIComponent(cleanName)}/+images`;
    
    console.log(`Fetching Last.fm images for: ${artistName}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`Last.fm returned ${response.status} for ${artistName}`);
      return [];
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const imageUrls: string[] = [];
    
    // Last.fm shows images in a grid with specific selectors
    // Look for image elements in the photos grid
    $('img.image-list-image, img.gallery-image, img[data-src], .image-list img').each((_, element) => {
      const $img = $(element);
      
      // Try different attributes where Last.fm might store image URLs
      let imageUrl = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
      
      if (imageUrl) {
        // Last.fm often serves thumbnails, try to get larger version
        // Replace /avatar170s/ with /770x0/ or /300x0/ for larger images
        imageUrl = imageUrl
          .replace('/avatar170s/', '/770x0/')
          .replace('/avatar70s/', '/770x0/')
          .replace('/50s/', '/770x0/')
          .replace('/64s/', '/770x0/');
        
        // Only add unique URLs and skip tiny placeholders
        if (imageUrl.includes('lastfm') && 
            !imageUrl.includes('avatar/') && 
            !imageUrls.includes(imageUrl) &&
            !imageUrl.includes('2a96cbd8b46e442fc41c2b86b821562f')) { // Default avatar hash
          imageUrls.push(imageUrl);
        }
      }
    });
    
    // Also check for larger images in different selectors
    $('a.image-list-item-wrapper img, .gallery-item img').each((_, element) => {
      const $img = $(element);
      let imageUrl = $img.attr('src') || $img.attr('data-src');
      
      if (imageUrl) {
        imageUrl = imageUrl
          .replace('/avatar170s/', '/770x0/')
          .replace('/avatar70s/', '/770x0/')
          .replace('/50s/', '/770x0/')
          .replace('/64s/', '/770x0/');
        
        if (imageUrl.includes('lastfm') && 
            !imageUrl.includes('avatar/') && 
            !imageUrls.includes(imageUrl) &&
            !imageUrl.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
          imageUrls.push(imageUrl);
        }
      }
    });
    
    console.log(`Found ${imageUrls.length} images on Last.fm for ${artistName}`);
    
    // Return first 2 images only (we want Spotify + 2 Last.fm = 3 total)
    return imageUrls.slice(0, 2);
  } catch (error) {
    console.error(`Error fetching Last.fm images for "${artistName}":`, error);
    return [];
  }
}