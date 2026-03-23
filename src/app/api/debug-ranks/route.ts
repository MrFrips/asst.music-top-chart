import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const country = searchParams.get('country') || 'id';
        const cleanup = searchParams.get('cleanup') === 'true';

        // --- ARTISTS ---
        const artists = await prisma.artistCurrent.findMany({
            where: { country },
            select: { id: true, artistName: true, rank: true, lastUpdated: true },
            orderBy: { rank: 'asc' },
        });

        const artistDups = findDuplicates(artists, 'artistName');

        let deletedArtists = 0;
        if (cleanup && artistDups.length > 0) {
            console.log('Cleaning up artist duplicates...');
            deletedArtists = await deleteStaleRecords(prisma.artistCurrent, artistDups);
        }

        // --- TRACKS ---
        const tracks = await prisma.trackCurrent.findMany({
            where: { country },
            select: { id: true, trackName: true, artistName: true, rank: true, lastUpdated: true },
            orderBy: { rank: 'asc' },
        });

        const trackDups = findDuplicates(tracks, 'trackName');

        let deletedTracks = 0;
        if (cleanup && trackDups.length > 0) {
            console.log('Cleaning up track duplicates...');
            deletedTracks = await deleteStaleRecords(prisma.trackCurrent, trackDups);
        }

        return NextResponse.json({
            mode: cleanup ? 'CLEANUP_EXECUTED' : 'DRY_RUN',
            country,
            artists: {
                total: artists.length,
                duplicatesFound: artistDups.length,
                deleted: deletedArtists,
                examples: artistDups.slice(0, 5)
            },
            tracks: {
                total: tracks.length,
                duplicatesFound: trackDups.length,
                deleted: deletedTracks,
                examples: trackDups.slice(0, 5)
            }
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

function findDuplicates(items: any[], nameField: string) {
    const byRank: Record<number, any[]> = {};
    items.forEach(i => {
        if (!byRank[i.rank]) byRank[i.rank] = [];
        byRank[i.rank].push(i);
    });

    const duplicates: any[] = [];
    Object.entries(byRank).forEach(([rank, rankItems]) => {
        if (rankItems.length > 1) {
            // Sort by lastUpdated DESC (newest first)
            const sorted = rankItems.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
            // The first one is the winner. The rest are duplicates to delete.
            const winner = sorted[0];
            const losers = sorted.slice(1);

            duplicates.push({
                rank: parseInt(rank),
                winner: { name: winner[nameField], lastUpdated: winner.lastUpdated },
                losers: losers.map(l => ({ id: l.id, name: l[nameField], lastUpdated: l.lastUpdated }))
            });
        }
    });
    return duplicates;
}

async function deleteStaleRecords(model: any, duplicateGroups: any[]) {
    let count = 0;
    for (const group of duplicateGroups) {
        const idsToDelete = group.losers.map((l: any) => l.id);
        if (idsToDelete.length > 0) {
            await model.deleteMany({
                where: { id: { in: idsToDelete } }
            });
            count += idsToDelete.length;
        }
    }
    return count;
}
