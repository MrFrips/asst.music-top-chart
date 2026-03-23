/**
 * Last.fm scraper for fetching artist top tracks and albums
 * Enhanced with kworb.net for accurate Spotify play counts
 */

import * as cheerio from 'cheerio';
import { LastfmTrack, LastfmAlbum } from '../types';
import { getAccuratePlayCountWithKworb } from './kworbScraper';
import { formatPlayCount } from './spotifyPlayCountService';

/**
 * Fetches top tracks for an artist from Last.fm with kworb.net integration
 */
export async function fetchLastFmTopTracks(artistName: string): Promise<LastfmTrack[]> {
  try {
    const cleanName = artistName.trim().replace(/\s+/g, '+');
    const url = `https://www.last.fm/music/${encodeURIComponent(cleanName)}/+tracks`;
    
    console.log(`Fetching Last.fm top tracks for: ${artistName}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`Last.fm returned ${response.status} for ${artistName} tracks`);
      
      // If rate limited (429), wait and retry once
      if (response.status === 429) {
        console.log('Rate limited by Last.fm, waiting 2 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Retry once
        const retryResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (retryResponse.ok) {
          const retryHtml = await retryResponse.text();
          return await parseLastFmTracksFromHtml(retryHtml, artistName);
        }
        
        console.log(`Retry failed for ${artistName}`);
        return [];
      }
      
      return [];
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const tracks: LastfmTrack[] = [];
    
    // Scrape top tracks from the chartlist
    const trackRows = $('.chartlist-row');
    console.log(`Found ${trackRows.length} tracks for ${artistName}`);
    
    // Process tracks sequentially to avoid rate limiting
    for (let i = 0; i < trackRows.length && i < 10; i++) {
      const element = trackRows[i];
      const $row = $(element);
      
      const name = $row.find('.chartlist-name a').text().trim();
      const listeners = $row.find('.chartlist-count-bar-value').text().trim();
      const lastfmUrl = 'https://www.last.fm' + $row.find('.chartlist-name a').attr('href');
      
      // Try to get playcount specifically if available
      let playcount = listeners;
      
      // Sometimes listener count is in a different element or title attribute
      const listenersTitle = $row.find('.chartlist-count-bar').attr('title');
      if (listenersTitle) {
        const match = listenersTitle.match(/([\d,]+)\s+listeners/i);
        if (match) {
          playcount = match[1];
        }
      }

      // First, try to find Spotify link in the row (quick check)
      let spotifyUrl = '';
      const spotifyLink = $row.find('a[href*="spotify.com/track"]');
      if (spotifyLink.length > 0) {
        spotifyUrl = spotifyLink.attr('href') || '';
      }
      
      // If no Spotify URL found in row, visit the track page for more details
      if (!spotifyUrl && lastfmUrl) {
        console.log(`Visiting track page for: ${name}`);
        spotifyUrl = await fetchSpotifyUrlFromTrackPage(lastfmUrl);
        
        // Add delay to avoid rate limiting
        if (i < trackRows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (name && lastfmUrl) {
        // Fetch accurate play count using kworb.net + Spotify API
        let spotifyPlayCount: number | undefined;
        let playCountSource: string = 'lastfm';
        
        try {
          const accurateData = await getAccuratePlayCountWithKworb(
            artistName, 
            name, 
            spotifyUrl || undefined, 
            parseInt(playcount.replace(/,/g, '')) || 0
          );
          
          spotifyPlayCount = accurateData.playCount;
          playCountSource = accurateData.source;
          
          console.log(`${playCountSource} play count for "${name}": ${formatPlayCount(spotifyPlayCount)}`);
        } catch (error) {
          console.log(`Failed to get accurate play count for "${name}":`, error);
        }

        tracks.push({
          name,
          playcount: spotifyPlayCount ? spotifyPlayCount.toString() : playcount, // Use accurate play count if available
          listeners: playcount, // Keep Last.fm listeners as fallback
          url: spotifyUrl || lastfmUrl,
          spotifyUrl: spotifyUrl || null,
          lastfmUrl: lastfmUrl,
          spotifyPlayCount: spotifyPlayCount
        });
      }
    }
    
    console.log(`Processed ${tracks.length} tracks for ${artistName}`);
    return tracks;
  } catch (error) {
    console.error(`Error fetching Last.fm tracks for "${artistName}":`, error);
    return [];
  }
}

/**
 * Helper function to parse Last.fm tracks from HTML
 */
async function parseLastFmTracksFromHtml(html: string, artistName: string): Promise<LastfmTrack[]> {
  const $ = cheerio.load(html);
  const tracks: LastfmTrack[] = [];
  
  // Scrape top tracks from the chartlist
  const trackRows = $('.chartlist-row');
  
  // Process tracks sequentially to avoid rate limiting
  for (let i = 0; i < trackRows.length && i < 10; i++) {
    const element = trackRows[i];
    const $row = $(element);
    
    const name = $row.find('.chartlist-name a').text().trim();
    const listeners = $row.find('.chartlist-count-bar-value').text().trim();
    const lastfmUrl = 'https://www.last.fm' + $row.find('.chartlist-name a').attr('href');
    
    // Try to get playcount specifically if available
    let playcount = listeners;
    
    // Sometimes listener count is in a different element or title attribute
    const listenersTitle = $row.find('.chartlist-count-bar').attr('title');
    if (listenersTitle) {
      const match = listenersTitle.match(/([\d,]+)\s+listeners/i);
      if (match) {
        playcount = match[1];
      }
    }

    // Try to find Spotify link in the row
    let spotifyUrl = '';
    const spotifyLink = $row.find('a[href*="spotify.com/track"]');
    if (spotifyLink.length > 0) {
      spotifyUrl = spotifyLink.attr('href') || '';
    }
    
    if (name && lastfmUrl) {
      // Fetch accurate play count using kworb.net + Spotify API
      let spotifyPlayCount: number | undefined;
      let playCountSource: string = 'lastfm';
      
      try {
        const accurateData = await getAccuratePlayCountWithKworb(
          artistName, 
          name, 
          spotifyUrl || undefined, 
          parseInt(playcount.replace(/,/g, '')) || 0
        );
        
        spotifyPlayCount = accurateData.playCount;
        playCountSource = accurateData.source;
        
        console.log(`${playCountSource} play count for "${name}": ${formatPlayCount(spotifyPlayCount)}`);
      } catch (error) {
        console.log(`Failed to get accurate play count for "${name}":`, error);
      }

      tracks.push({
        name,
        playcount: spotifyPlayCount ? spotifyPlayCount.toString() : playcount, // Use accurate play count if available
        listeners: playcount, // Keep Last.fm listeners as fallback
        url: spotifyUrl || lastfmUrl,
        spotifyUrl: spotifyUrl || null,
        lastfmUrl: lastfmUrl,
        spotifyPlayCount: spotifyPlayCount
      });
    }
    
    // Add delay to avoid rate limiting
    if (i < trackRows.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Return top 10 tracks
  return tracks;
}

/**
 * Fetches Spotify URL from an individual Last.fm track page
 */
async function fetchSpotifyUrlFromTrackPage(trackUrl: string): Promise<string> {
  try {
    console.log(`Fetching track page: ${trackUrl}`);
    
    const response = await fetch(trackUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`Track page returned ${response.status}`);
      return '';
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Look for Spotify links in multiple places
    let spotifyUrl = '';
    
    // 1. Check for external links section
    const externalLinks = $('.external-links a[href*="spotify.com/track"]');
    if (externalLinks.length > 0) {
      spotifyUrl = externalLinks.first().attr('href') || '';
    }
    
    // 2. Check for play buttons
    if (!spotifyUrl) {
      const playButtons = $('.header-new-playlink a[href*="spotify.com/track"]');
      if (playButtons.length > 0) {
        spotifyUrl = playButtons.first().attr('href') || '';
      }
    }
    
    // 3. Check for any Spotify track links in the page
    if (!spotifyUrl) {
      const allSpotifyLinks = $('a[href*="spotify.com/track"]');
      if (allSpotifyLinks.length > 0) {
        spotifyUrl = allSpotifyLinks.first().attr('href') || '';
      }
    }
    
    // Clean up the URL
    if (spotifyUrl) {
      // Ensure it's a clean Spotify URL
      const spotifyMatch = spotifyUrl.match(/https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/);
      if (spotifyMatch) {
        spotifyUrl = spotifyMatch[0];
      }
    }
    
    console.log(`Found Spotify URL: ${spotifyUrl || 'none'}`);
    return spotifyUrl;
    
  } catch (error) {
    console.error(`Error fetching track page ${trackUrl}:`, error);
    return '';
  }
}

/**
 * Fetches top albums for an artist from Last.fm
 */
export async function fetchLastFmTopAlbums(artistName: string): Promise<LastfmAlbum[]> {
  try {
    const cleanName = artistName.trim().replace(/\s+/g, '+');
    const url = `https://www.last.fm/music/${encodeURIComponent(cleanName)}/+albums`;
    
    console.log(`Fetching Last.fm top albums for: ${artistName}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`Last.fm returned ${response.status} for ${artistName} albums`);
      return [];
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const albums: LastfmAlbum[] = [];
    
    // Scrape albums from the album grid
    $('.album-grid-item, .resource-list--release-list-item').each((_, element) => {
      const $item = $(element);
      
      const name = $item.find('.album-grid-item-title, .link-block-target').text().trim();
      let listeners = $item.find('.album-grid-item-aux-text, .resource-list--release-list-item-aux-text').text().trim();
      const url = 'https://www.last.fm' + $item.find('a').first().attr('href');
      
      // Clean up listeners count (remove newlines, dates, track counts)
      // Example: "263,402 \n \n \n 24 Nov 2016 . \n 18 tracks" -> "263,402"
      listeners = listeners.split('\n')[0].trim();
      listeners = listeners.replace('scrobbles', '').replace('listeners', '').trim();
      
      // Try to extract listeners from title attribute if available
      const titleAttr = $item.find('.album-grid-item-aux-text, .resource-list--release-list-item-aux-text').attr('title');
      if (titleAttr) {
        const titleMatch = titleAttr.match(/([\d,]+)\s+(?:listeners|scrobbles)/i);
        if (titleMatch) {
          listeners = titleMatch[1];
        }
      }
      
      // Get image URL
      let image = $item.find('img').attr('src') || '';
      if (image) {
        // Try to get high-res image
        image = image.replace('/300x300/', '/770x0/').replace('/174s/', '/770x0/');
      }

      if (name && url) {
        albums.push({
          name,
          playcount: listeners, // Keep as playcount for compatibility but use listeners data
          listeners: listeners, // Add listeners field
          url,
          image
        });
      }
    });
    
    // Remove duplicates by album name (case-insensitive) and keep the one with higher listener count
    const albumMap = new Map<string, LastfmAlbum>();
    
    albums.forEach(album => {
      const key = album.name.toLowerCase();
      const existing = albumMap.get(key);
      
      // If no existing album or new album has higher listener count, replace
      if (!existing || parseInt(album.listeners.replace(/,/g, '')) > parseInt(existing.listeners.replace(/,/g, ''))) {
        albumMap.set(key, album);
      }
    });
    
    const uniqueAlbums = Array.from(albumMap.values());
    
    // Return top 8 albums (deduplicated)
    return uniqueAlbums.slice(0, 8);
  } catch (error) {
    console.error(`Error fetching Last.fm albums for "${artistName}":`, error);
    return [];
  }
}