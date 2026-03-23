import { prisma } from '../db';
import { scrapeKworbTopArtistsByListeners } from '../scraping/kworbArtists';
import { scrapeKworbGlobalDailyTracks } from '../scraping/kworbTracks';
import { scrapeKworbIndonesiaArtists, scrapeKworbIndonesiaDailyTracks } from '../scraping/kworbIndonesia';
import { scrapeKworbCountryArtists, scrapeKworbCountryDailyTracks, getCountriesToScrape } from '../scraping/kworbCountry';
import { resolveArtistMetadata, resolveEnhancedArtistMetadata, resolveTrackMetadata } from '../spotify/metadata';
import { fetchArtistBiography } from '../scraping/wikipediaBio';
import { fetchLastFmArtistImages } from '../scraping/lastfmImages';
import { fetchLastFmTopTracks, fetchLastFmTopAlbums } from '../scraping/lastfmTracks';
import { scrapeKworbArtistTopSongs } from '../scraping/kworbArtistDetails';
import { fetchLastFmArtistInfo } from '../scraping/lastfmGenres';
import { fetchMusicBrainzData } from '../scraping/musicbrainz';
import { ArtistStat, TrackStat } from '../types';

export interface SpotifyStatsProvider {
  refreshAllStats(): Promise<void>;
  getTopArtists(limit: number, country?: string): Promise<ArtistStat[]>;
  getTopTracks(limit: number, country?: string): Promise<TrackStat[]>;
}

class SpotifyStatsProviderImpl implements SpotifyStatsProvider {
  /**
   * Refreshes all stats by scraping kworb, storing snapshots, computing deltas, and enriching with Spotify metadata
   */
  async refreshAllStats(): Promise<void> {
    console.log('Starting stats refresh...');

    try {
      // Step 1: Scrape global kworb charts
      console.log('Scraping global kworb artists...');
      const artistRaws = await scrapeKworbTopArtistsByListeners();
      console.log(`Scraped ${artistRaws.length} global artists`);

      console.log('Scraping global kworb tracks...');
      const trackRaws = await scrapeKworbGlobalDailyTracks();
      console.log(`Scraped ${trackRaws.length} global tracks`);

      // Step 2: Clean up invalid track entries (tracks with suspiciously small daily streams or invalid names)
      await this.cleanupInvalidTracks('global');

      // Step 3: Store global snapshots
      await this.storeArtistSnapshots(artistRaws, 'global');
      await this.storeTrackSnapshots(trackRaws, 'global');

      // Step 4: Update global current stats with rank deltas
      await this.updateArtistCurrents(artistRaws, 'global');
      await this.updateTrackCurrents(trackRaws, 'global');

      // Step 5: Scrape all configured countries (excluding global, which was already processed)
      const countries = getCountriesToScrape().filter(c => c !== 'global');
      for (const countryCode of countries) {
        console.log(`Scraping ${countryCode} artists...`);
        let countryArtistRaws;
        let countryTrackRaws;

        // Use legacy ID scrapers for backward compatibility, generic scraper for others
        if (countryCode === 'id') {
          countryArtistRaws = await scrapeKworbIndonesiaArtists();
          countryTrackRaws = await scrapeKworbIndonesiaDailyTracks();
        } else {
          countryArtistRaws = await scrapeKworbCountryArtists(countryCode);
          countryTrackRaws = await scrapeKworbCountryDailyTracks(countryCode);
        }

        console.log(`Scraped ${countryArtistRaws.length} ${countryCode} artists`);
        console.log(`Scraped ${countryTrackRaws.length} ${countryCode} tracks`);

        await this.cleanupInvalidTracks(countryCode);
        await this.storeArtistSnapshots(countryArtistRaws, countryCode);
        await this.storeTrackSnapshots(countryTrackRaws, countryCode);
        await this.updateArtistCurrents(countryArtistRaws, countryCode);
        await this.updateTrackCurrents(countryTrackRaws, countryCode);
      }

      console.log('Stats refresh completed successfully');
    } catch (error) {
      console.error('Error refreshing stats:', error);
      throw error;
    }
  }

  /**
   * Stores artist snapshots in the database
   */
  private async storeArtistSnapshots(artists: Array<{ name: string; rank: number; monthlyListeners: number; listenersDelta?: number }>, country: string = 'global'): Promise<void> {
    await prisma.artistSnapshot.createMany({
      data: artists.map(a => ({
        artistName: a.name,
        country,
        rank: a.rank,
        monthlyListeners: a.monthlyListeners,
        listenersDelta: a.listenersDelta ?? null,
      })),
    });
  }

  /**
   * Stores track snapshots in the database
   */
  private async storeTrackSnapshots(tracks: Array<{ trackName: string; artistName: string; rank: number; dailyStreams: number; totalStreams?: number }>, country: string = 'global'): Promise<void> {
    await prisma.trackSnapshot.createMany({
      data: tracks.map(t => ({
        trackName: t.trackName,
        artistName: t.artistName,
        country,
        rank: t.rank,
        dailyStreams: BigInt(t.dailyStreams),
        totalStreams: t.totalStreams ? BigInt(t.totalStreams) : null,
      })),
    });
  }

  /**
   * Gets the daily baseline snapshot (first snapshot of current day, or last snapshot from previous day)
   * This ensures rankDelta represents daily change from midnight to midnight
   * 
   * Note: This should be called BEFORE storing today's snapshots to get the correct baseline
   */
  private async getDailyBaselineArtistSnapshot(artistName: string, country: string): Promise<{ rank: number; monthlyListeners: number } | null> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Always use the last snapshot from before today (previous day)
    // This ensures rankDelta represents daily change from yesterday's close
    const previousDaySnapshot = await prisma.artistSnapshot.findFirst({
      where: {
        artistName,
        country,
        createdAt: {
          lt: todayStart,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return previousDaySnapshot ? { rank: previousDaySnapshot.rank, monthlyListeners: previousDaySnapshot.monthlyListeners } : null;
  }

  /**
   * Gets the daily baseline snapshot for tracks (first snapshot of current day, or last snapshot from previous day)
   * This ensures rankDelta represents daily change from midnight to midnight
   * 
   * Note: This should be called BEFORE storing today's snapshots to get the correct baseline
   */
  private async getDailyBaselineTrackSnapshot(trackName: string, artistName: string, country: string): Promise<{ rank: number } | null> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Always use the last snapshot from before today (previous day)
    const previousDaySnapshot = await prisma.trackSnapshot.findFirst({
      where: {
        trackName,
        artistName,
        country,
        createdAt: {
          lt: todayStart,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return previousDaySnapshot ? { rank: previousDaySnapshot.rank } : null;
  }

  /**
   * Updates artist current stats, computing rank deltas and enriching with Spotify metadata
   */
  private async updateArtistCurrents(artists: Array<{ name: string; rank: number; monthlyListeners: number; listenersDelta?: number }>, country: string = 'global'): Promise<void> {
    const startTime = new Date();
    // Add a small buffer to ensure we don't delete what we just updated (though logic shouldn't allow it)
    // Actually, simply using the time BEFORE the batch works perfectly.

    for (const artist of artists) {
      // Get daily baseline rank (first snapshot of today, or last snapshot from previous day)
      // This ensures rankDelta represents daily change from midnight to midnight
      const dailyBaseline = await this.getDailyBaselineArtistSnapshot(artist.name, country);
      const previousRank = dailyBaseline?.rank ?? null;

      // rankDelta: negative = moved up (better rank), positive = moved down (worse rank)
      // Example: rank 10 -> 5 (moved up) = 5 - 10 = -5 (negative)
      //          rank 5 -> 10 (moved down) = 10 - 5 = 5 (positive)
      // Note: This compares current rank to the rank at the start of the day (midnight baseline)
      const rankDelta = previousRank !== null ? artist.rank - previousRank : null;

      // Calculate listenersDelta if not provided (for Indonesia, compare with daily baseline)
      // Use daily baseline to ensure Daily Movers shows change from midnight to midnight
      let listenersDelta = artist.listenersDelta;
      if (listenersDelta === undefined) {
        // Use the daily baseline snapshot (first of today, or last from previous day)
        // This ensures Daily Movers represents daily change from midnight to midnight
        const dailyBaseline = await this.getDailyBaselineArtistSnapshot(artist.name, country);
        if (dailyBaseline) {
          // Calculate delta from daily baseline's monthlyListeners
          listenersDelta = artist.monthlyListeners - dailyBaseline.monthlyListeners;
        }
      }

      // Get existing current record to check if we need to enrich metadata
      const existing = await prisma.artistCurrent.findUnique({
        where: { artistName_country: { artistName: artist.name, country } },
      });

      let artistId = existing?.artistId ?? null;
      let imageUrl = existing?.imageUrl ?? null;
      let genres = existing?.genres ?? null;
      let spotifyUrl = existing?.spotifyUrl ?? null;
      let followers = existing?.followers ?? null;
      let popularity = existing?.popularity ?? null;
      let images = existing?.images ?? null;
      let biography = existing?.biography ?? null;
      let socialLinks = existing?.socialLinks ?? null;
      let originCountry = existing?.originCountry ?? null;
      let countryCode = existing?.countryCode ?? null;
      let birthDate = existing?.birthDate ?? null;
      let topTracks = existing?.topTracks ?? null;
      let topAlbums = existing?.topAlbums ?? null;
      let similarArtists = existing?.similarArtists ?? null;
      let peakRank = existing?.peakRank ?? null;
      let peakRankDate = existing?.peakRankDate ?? null;

      // Update Peak Rank
      if (peakRank === null || artist.rank < peakRank) {
        peakRank = artist.rank;
        peakRankDate = new Date();
      }

      // Enrich with Spotify metadata if not already done
      if (!artistId) {
        console.log(`Enriching basic metadata for artist: ${artist.name}`);
        const metadata = await resolveArtistMetadata(artist.name);
        if (metadata) {
          artistId = metadata.spotifyId;
          imageUrl = metadata.imageUrl ?? null;
          genres = metadata.genres ? JSON.stringify(metadata.genres) : null;
          spotifyUrl = metadata.url ?? null;
        }
        // Add a small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check if we need to enhance metadata (only for missing data)
      const isTopArtist = artist.rank <= 500;

      // Check if we need to refresh tracks (if missing or if using old Last.fm listener counts instead of Kworb streams)
      // Kworb data sets listeners to "0" and uses spotifyPlayCount. Old data has actual listener counts.
      let needsTrackRefresh = !topTracks || !topAlbums;
      if (topTracks && artistId) {
        // Quick string check to avoid parsing JSON for every artist
        // If it doesn't have "listeners":"0", it's likely old Last.fm data
        if (!topTracks.includes('"listeners":"0"')) {
          needsTrackRefresh = true;
        }
      }

      // Need basic enhancement if we are missing detailed stats
      let needsEnhancement = !followers || !biography || needsTrackRefresh || !originCountry || !birthDate || !socialLinks;

      // Check if we need to replace Spotify duplicate images with Last.fm
      let needsImageEnhancement = false;
      if (images && !needsEnhancement) {
        try {
          const parsedImages = JSON.parse(images);
          // Only enhance images if we have less than 3 images or all are from Spotify
          needsImageEnhancement = parsedImages.length < 3 || parsedImages.every((img: any) =>
            img.url && img.url.includes('spotifycdn.com')
          );
        } catch (e) {
          needsImageEnhancement = true;
        }
      } else if (!images) {
        needsImageEnhancement = true; // No images at all
      }

      // Check if we need to fetch genres and similar artists
      let needsGenreEnhancement = !genres || !similarArtists;

      // Also check if we have less than 16 similar artists (old limit was 8)
      if (similarArtists && !needsGenreEnhancement) {
        try {
          const parsedSimilar = JSON.parse(similarArtists);
          if (Array.isArray(parsedSimilar) && parsedSimilar.length < 16) {
            needsGenreEnhancement = true;
            console.log(`Force refreshing similar artists for ${artist.name} (found ${parsedSimilar.length}, target 16)`);
          }
        } catch (e) {
          needsGenreEnhancement = true;
        }
      }

      // For top 500 artists, only enrich if missing data or need image enhancement
      // For others, only if missing essential metadata (performance)
      if (artistId && (isTopArtist && (needsEnhancement || needsImageEnhancement || needsGenreEnhancement))) {
        console.log(`🔄 Enriching ${artist.name} (rank #${artist.rank}, country: ${country}) - needsEnhancement: ${needsEnhancement}, needsImageEnhancement: ${needsImageEnhancement}, needsGenreEnhancement: ${needsGenreEnhancement}`);

        // Fetch enhanced Spotify data (followers, popularity, images)
        const enhancedMetadata = await resolveEnhancedArtistMetadata(artistId);
        let spotifyImages: any[] = [];
        if (enhancedMetadata) {
          followers = enhancedMetadata.followers ?? null;
          popularity = enhancedMetadata.popularity ?? null;
          spotifyImages = enhancedMetadata.images || [];
        }

        // Fetch Wikipedia biography (but skip Wikipedia images in favor of Last.fm)
        if (!biography) {
          const wikipediaData = await fetchArtistBiography(artist.name);
          if (wikipediaData) {
            biography = wikipediaData.biography ?? null;
          }
        }

        // Fetch MusicBrainz data (Origin Country, Birth Date, & Links)
        // Check if we need MB data (missing core data or missing specific links)
        let socialLinksObj: any = socialLinks ? JSON.parse(socialLinks) : {};
        const needsMbData = !originCountry || !birthDate || !countryCode || !socialLinksObj.homepage || !socialLinksObj.instagram;

        if (needsMbData) {
          const mbData = await fetchMusicBrainzData(artist.name);
          if (mbData) {
            if (mbData.originCountry) originCountry = mbData.originCountry;
            if (mbData.countryCode) countryCode = mbData.countryCode;
            if (mbData.birthDate) birthDate = mbData.birthDate;

            if (mbData.homepage) socialLinksObj.homepage = mbData.homepage;
            if (mbData.instagram) socialLinksObj.instagram = mbData.instagram;

            if (Object.keys(socialLinksObj).length > 0) {
              socialLinks = JSON.stringify(socialLinksObj);
            }
          }
        }

        // Fetch Top Tracks and Albums (if missing or needs refresh)
        if (needsTrackRefresh) {
          console.log(`🎵 Fetching top tracks & albums for ${artist.name}...`);

          let tracks: any[] = [];

          // Try fetching from Kworb first using artistId
          if (artistId) {
            console.log(`🎵 Fetching Kworb top tracks for ${artist.name}...`);
            const kworbData = await scrapeKworbArtistTopSongs(artistId, 10);
            if (kworbData && kworbData.topSongs.length > 0) {
              tracks = kworbData.topSongs.map(song => ({
                name: song.trackName,
                playcount: song.totalStreams.toString(),
                listeners: "0",
                url: song.spotifyUrl || '',
                spotifyUrl: song.spotifyUrl || null,
                lastfmUrl: '',
                spotifyPlayCount: song.totalStreams
              }));
              console.log(`✅ Found ${tracks.length} tracks from Kworb`);
            }
          }

          // Fallback to Last.fm if Kworb failed
          if (tracks.length === 0) {
            console.log(`⚠️ Kworb tracks missing, falling back to Last.fm for ${artist.name}`);
            const lastFmTracks = await fetchLastFmTopTracks(artist.name);
            if (lastFmTracks.length > 0) {
              tracks = lastFmTracks;
            }
          }

          // Always fetch albums from Last.fm
          const albums = await fetchLastFmTopAlbums(artist.name);

          if (tracks.length > 0) {
            topTracks = JSON.stringify(tracks);
            console.log(`✅ Found ${tracks.length} top tracks`);
          }

          if (albums.length > 0) {
            topAlbums = JSON.stringify(albums);
            console.log(`✅ Found ${albums.length} top albums`);
          }
        }

        // Fetch Last.fm genres and similar artists (only if missing)
        if (needsGenreEnhancement) {
          console.log(`🏷️ Fetching Last.fm genres & similar artists for ${artist.name}...`);
          const { genres: lastFmGenres, similarArtists: lastFmSimilarArtists } = await fetchLastFmArtistInfo(artist.name);

          if (lastFmGenres.length > 0) {
            genres = JSON.stringify(lastFmGenres);
            console.log(`✅ Found ${lastFmGenres.length} genres`);
          }

          if (lastFmSimilarArtists.length > 0) {
            similarArtists = JSON.stringify(lastFmSimilarArtists);
            console.log(`✅ Found ${lastFmSimilarArtists.length} similar artists`);
          }
        }

        // Only fetch Last.fm images if we need image enhancement
        if (needsImageEnhancement) {
          console.log(`📸 Fetching Last.fm images for ${artist.name} (needs image enhancement)...`);
          const lastFmImages = await fetchLastFmArtistImages(artist.name);
          console.log(`✅ Last.fm found ${lastFmImages.length} images for ${artist.name}`);

          // Combine images: 1 from Spotify + 2 from Last.fm = 3 total
          const combinedImages: any[] = [];

          // Add largest Spotify image first
          if (spotifyImages.length > 0) {
            const largestSpotify = spotifyImages.reduce((prev, current) =>
              (prev.height * prev.width) > (current.height * current.width) ? prev : current
            );
            combinedImages.push(largestSpotify);
            console.log(`✅ Added Spotify image for ${artist.name}`);
          } else {
            console.log(`⚠️ No Spotify images for ${artist.name}`);
          }

          // Add Last.fm images (up to 2 for total of 3)
          if (lastFmImages.length > 0) {
            lastFmImages.slice(0, 2).forEach((lastFmUrl, index) => {
              combinedImages.push({
                url: lastFmUrl,
                height: 770,
                width: 770,
              });
              console.log(`✅ Added Last.fm image ${index + 1} for ${artist.name}`);
            });
          } else {
            console.log(`⚠️ No Last.fm images found for ${artist.name}`);
          }

          console.log(`🎯 Total images for ${artist.name}: ${combinedImages.length}`);
          images = combinedImages.length > 0 ? JSON.stringify(combinedImages) : null;
        } else {
          console.log(`📸 Skipping Last.fm images for ${artist.name} (already has good images)`);
        }

        // Add a small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 150));
      } else if (artistId && !isTopArtist && needsEnhancement) {
        // For non-top artists, only fetch essential metadata
        console.log(`🔄 Enriching non-top artist ${artist.name} (essential metadata only)`);

        // Fetch enhanced Spotify data (followers, popularity, images)
        const enhancedMetadata = await resolveEnhancedArtistMetadata(artistId);
        if (enhancedMetadata) {
          followers = enhancedMetadata.followers ?? null;
          popularity = enhancedMetadata.popularity ?? null;
        }

        // Fetch Wikipedia biography
        if (!biography) {
          const wikipediaData = await fetchArtistBiography(artist.name);
          if (wikipediaData) {
            biography = wikipediaData.biography ?? null;
          }
        }

        // Fetch MusicBrainz data (Origin Country, Birth Date, & Links) for non-top artists too
        let socialLinksObj: any = socialLinks ? JSON.parse(socialLinks) : {};
        const needsMbData = !originCountry || !birthDate || !countryCode || !socialLinksObj.homepage || !socialLinksObj.instagram;

        if (needsMbData) {
          const mbData = await fetchMusicBrainzData(artist.name);
          if (mbData) {
            if (mbData.originCountry) originCountry = mbData.originCountry;
            if (mbData.countryCode) countryCode = mbData.countryCode;
            if (mbData.birthDate) birthDate = mbData.birthDate;

            if (mbData.homepage) socialLinksObj.homepage = mbData.homepage;
            if (mbData.instagram) socialLinksObj.instagram = mbData.instagram;

            if (Object.keys(socialLinksObj).length > 0) {
              socialLinks = JSON.stringify(socialLinksObj);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Upsert current record
      await prisma.artistCurrent.upsert({
        where: { artistName_country: { artistName: artist.name, country } },
        update: {
          rank: artist.rank,
          previousRank,
          rankDelta,
          monthlyListeners: artist.monthlyListeners,
          listenersDelta: listenersDelta ?? null,
          artistId: artistId ?? undefined,
          imageUrl: imageUrl ?? undefined,
          genres: genres ?? undefined,
          spotifyUrl: spotifyUrl ?? undefined,
          followers: followers ?? undefined,
          popularity: popularity ?? undefined,
          images: images ?? undefined,
          biography: biography ?? undefined,
          socialLinks: socialLinks ?? undefined,
          originCountry: originCountry ?? undefined,
          countryCode: countryCode ?? undefined,
          birthDate: birthDate ?? undefined,
          topTracks: topTracks ?? undefined,
          topAlbums: topAlbums ?? undefined,
          similarArtists: similarArtists ?? undefined,
          peakRank: peakRank ?? undefined,
          peakRankDate: peakRankDate ?? undefined,
          lastUpdated: new Date(),
        },
        create: {
          artistName: artist.name,
          country,
          rank: artist.rank,
          previousRank,
          rankDelta,
          monthlyListeners: artist.monthlyListeners,
          listenersDelta: listenersDelta ?? null,
          artistId: artistId ?? null,
          imageUrl: imageUrl ?? null,
          genres: genres ?? null,
          spotifyUrl: spotifyUrl ?? null,
          followers: followers ?? null,
          popularity: popularity ?? null,
          images: images ?? null,
          biography: biography ?? null,
          socialLinks: socialLinks ?? null,
          originCountry: originCountry ?? null,
          countryCode: countryCode ?? null,
          birthDate: birthDate ?? null,
          topTracks: topTracks ?? null,
          topAlbums: topAlbums ?? null,
          similarArtists: similarArtists ?? null,
          peakRank: artist.rank,
          peakRankDate: new Date(),
          firstSeenDate: new Date(),
        },
      });
    }

    // CLEANUP: Remove stale artists that were not updated in this batch
    // This prevents duplicate ranks when artists drop out of the top list
    console.log(`Cleaning up stale artists for ${country}...`);
    const cleanupResult = await prisma.artistCurrent.deleteMany({
      where: {
        country,
        lastUpdated: {
          lt: startTime,
        },
      },
    });
    console.log(`Deleted ${cleanupResult.count} stale artists in ${country} `);
  }

  /**
   * Updates track current stats, computing rank deltas and enriching with Spotify metadata
   */
  private async updateTrackCurrents(tracks: Array<{ trackName: string; artistName: string; rank: number; dailyStreams: number; totalStreams?: number }>, country: string = 'global'): Promise<void> {
    const startTime = new Date();
    for (const track of tracks) {
      // Get daily baseline rank (first snapshot of today, or last snapshot from previous day)
      // This ensures rankDelta represents daily change from midnight to midnight
      const dailyBaseline = await this.getDailyBaselineTrackSnapshot(track.trackName, track.artistName, country);
      const previousRank = dailyBaseline?.rank ?? null;

      // rankDelta: negative = moved up (better rank), positive = moved down (worse rank)
      // Example: rank 10 -> 5 (moved up) = 5 - 10 = -5 (negative)
      //          rank 5 -> 10 (moved down) = 10 - 5 = 5 (positive)
      // Note: This compares current rank to the rank at the start of the day (midnight baseline)
      const rankDelta = previousRank !== null ? track.rank - previousRank : null;

      // Get existing current record to check if we need to enrich metadata
      const existing = await prisma.trackCurrent.findUnique({
        where: {
          trackName_artistName_country: {
            trackName: track.trackName,
            artistName: track.artistName,
            country,
          },
        },
      });

      let trackId = existing?.trackId ?? null;
      let imageUrl = existing?.imageUrl ?? null;
      let previewUrl = existing?.previewUrl ?? null;
      let spotifyUrl = existing?.spotifyUrl ?? null;

      // Enrich with Spotify metadata if not already done
      if (!trackId) {
        console.log(`Enriching metadata for track: ${track.trackName} by ${track.artistName} `);
        const metadata = await resolveTrackMetadata(track.trackName, track.artistName);
        if (metadata) {
          trackId = metadata.spotifyId;
          imageUrl = metadata.imageUrl ?? null;
          previewUrl = metadata.previewUrl ?? null;
          spotifyUrl = metadata.url ?? null;
        }
        // Add a small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Upsert current record
      await prisma.trackCurrent.upsert({
        where: {
          trackName_artistName_country: {
            trackName: track.trackName,
            artistName: track.artistName,
            country,
          },
        },
        update: {
          rank: track.rank,
          previousRank,
          rankDelta,
          dailyStreams: BigInt(track.dailyStreams),
          totalStreams: track.totalStreams ? BigInt(track.totalStreams) : null,
          trackId: trackId ?? undefined,
          imageUrl: imageUrl ?? undefined,
          previewUrl: previewUrl,
          spotifyUrl: spotifyUrl ?? undefined,
          lastUpdated: new Date(),
        },
        create: {
          trackName: track.trackName,
          artistName: track.artistName,
          country,
          rank: track.rank,
          previousRank,
          rankDelta,
          dailyStreams: BigInt(track.dailyStreams),
          totalStreams: track.totalStreams ? BigInt(track.totalStreams) : null,
          trackId: trackId ?? null,
          imageUrl: imageUrl ?? null,
          previewUrl: previewUrl ?? null,
          spotifyUrl: spotifyUrl ?? null,
        },
      });
    }

    // CLEANUP: Remove stale tracks
    console.log(`Cleaning up stale tracks for ${country}...`);
    const cleanupResult = await prisma.trackCurrent.deleteMany({
      where: {
        country,
        lastUpdated: {
          lt: startTime,
        },
      },
    });
    console.log(`Deleted ${cleanupResult.count} stale tracks in ${country} `);
  }

  /**
   * Gets top artists from the database
   */
  async getTopArtists(limit: number = parseInt(process.env.TOP_ARTISTS_LIMIT || '25', 10), country: string = 'global'): Promise<ArtistStat[]> {
    const artists = await prisma.artistCurrent.findMany({
      where: { country },
      orderBy: { rank: 'asc' },
      take: limit,
    });

    return artists.map(a => ({
      artistId: a.artistId,
      name: a.artistName,
      rank: a.rank,
      previousRank: a.previousRank,
      rankDelta: a.rankDelta,
      monthlyListeners: a.monthlyListeners,
      listenersDelta: a.listenersDelta,
      imageUrl: a.imageUrl ?? undefined,
      genres: a.genres ? JSON.parse(a.genres) : undefined,
      spotifyUrl: a.spotifyUrl ?? undefined,
      lastUpdated: a.lastUpdated,
      // Enhanced metadata for About section
      followers: a.followers ?? undefined,
      popularity: a.popularity ?? undefined,
      images: a.images ?? undefined,
      biography: a.biography ?? undefined,
      socialLinks: a.socialLinks ?? undefined,
      originCountry: a.originCountry ?? undefined,
      countryCode: a.countryCode ?? undefined,
      birthDate: a.birthDate ?? undefined,
      topTracks: a.topTracks ?? undefined,
      topAlbums: a.topAlbums ?? undefined,
      similarArtists: a.similarArtists ?? undefined,
      firstSeenDate: a.firstSeenDate ?? undefined,
    }));
  }

  /**
   * Cleans up invalid track entries from the database
   * Removes tracks with suspiciously small daily streams or invalid names
   */
  private async cleanupInvalidTracks(country: string = 'global'): Promise<void> {
    console.log(`Cleaning up invalid tracks for ${country}...`);

    // Find and delete tracks with suspiciously small daily streams (< 100,000)
    // These are likely invalid entries from previous scrapes
    const invalidTracks = await prisma.trackCurrent.findMany({
      where: {
        country,
        dailyStreams: {
          lt: BigInt(100000),
        },
      },
    });

    if (invalidTracks.length > 0) {
      console.log(`Found ${invalidTracks.length} tracks with suspiciously small daily streams`);

      // Delete from TrackCurrent
      await prisma.trackCurrent.deleteMany({
        where: {
          country,
          dailyStreams: {
            lt: BigInt(100000),
          },
        },
      });

      // Also delete corresponding snapshots
      for (const track of invalidTracks) {
        await prisma.trackSnapshot.deleteMany({
          where: {
            trackName: track.trackName,
            artistName: track.artistName,
            country,
          },
        });
      }
    }

    // Find and delete tracks with invalid names (just symbols like "=", "+", "-", etc.)
    const allTracks = await prisma.trackCurrent.findMany({
      where: { country },
    });

    const tracksToDelete = allTracks.filter(track => {
      const trackName = track.trackName.trim();
      // Skip if track name is just symbols or too short
      return (
        trackName.length < 2 ||
        /^[=\+\-\s]+$/.test(trackName) ||
        /^[\d\s\-=]+$/.test(trackName) ||
        !/[a-zA-Z]/.test(trackName)
      );
    });

    if (tracksToDelete.length > 0) {
      console.log(`Found ${tracksToDelete.length} tracks with invalid names`);

      for (const track of tracksToDelete) {
        // Delete from TrackCurrent
        await prisma.trackCurrent.deleteMany({
          where: {
            trackName: track.trackName,
            artistName: track.artistName,
            country,
          },
        });

        // Delete from TrackSnapshot
        await prisma.trackSnapshot.deleteMany({
          where: {
            trackName: track.trackName,
            artistName: track.artistName,
            country,
          },
        });
      }
    }

    console.log(`Cleanup completed for ${country}`);
  }

  /**
   * Gets top tracks from the database
   */
  async getTopTracks(limit: number = parseInt(process.env.TOP_TRACKS_LIMIT || '25', 10), country: string = 'global'): Promise<TrackStat[]> {
    const tracks = await prisma.trackCurrent.findMany({
      where: { country },
      orderBy: { rank: 'asc' },
      take: limit,
    });

    return tracks.map(t => ({
      trackId: t.trackId,
      name: t.trackName,
      mainArtistName: t.artistName,
      rank: t.rank,
      previousRank: t.previousRank,
      rankDelta: t.rankDelta,
      dailyStreams: Number(t.dailyStreams),
      totalStreams: t.totalStreams ? Number(t.totalStreams) : undefined,
      imageUrl: t.imageUrl ?? undefined,
      previewUrl: t.previewUrl ?? undefined,
      spotifyUrl: t.spotifyUrl ?? undefined,
      lastUpdated: t.lastUpdated,
    }));
  }
}

export const statsProvider: SpotifyStatsProvider = new SpotifyStatsProviderImpl();

