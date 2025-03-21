import querystring from "querystring";

export async function findDuplicatesAsync(spotifyBaseUrl: string, accessToken: string, userId: string, playlists: string[] = []) {

    const playlistResponse = await fetch(`${spotifyBaseUrl}/users/${userId}/playlists`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const playlistObject: {
        items: [{
            id: string,
            name: string,
            tracks: {
                total: number
            }
        }]
    } = await playlistResponse.json();

    const tracks: {
        trackKey: string,
        id: string,
        name: string,
        artists: {
            id: string,
            name: string
        }[],
        playlistIndex: number
    }[] = [];
    const playlistArray: { id: string, name: string }[] = [];
    const trackPromises: Promise<Response>[] = [];

    for(const playlist of playlistObject.items) {

        for (let offset = 0; offset < playlist.tracks.total; offset += 100) {
            const trackOptions = {
                offset: offset,
                limit: 100,
                fields: "items(track(id,name,artists(id,name)))"
            };

            // Since playlists' requests have been divided in chunks, this array is also divided (1,2 -> Playlist 1 | 3,4 -> Playlist 2)
            playlistArray.push(playlist);
            trackPromises.push(
                fetch(`${spotifyBaseUrl}/playlists/${playlist.id}/tracks?${querystring.stringify(trackOptions)}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                })
            );
        }
    }

    await Promise.all(trackPromises);

    for (let i = 0; i < trackPromises.length; i++) {
        const result = await trackPromises[i];
        const resultObject: {
            items: [{
                track: {
                    id: string,
                    name: string,
                    artists: [{
                        id: string,
                        name: string
                    }]
                }
            }]
        } = await result.json();

        if (resultObject && resultObject.items) {
            for (const item of resultObject.items) {
                tracks.push({
                    ...item.track,
                    trackKey: item.track.name + item.track.artists.sort((a, b) => a.name.localeCompare(b.name)).map(a => a.name).join(","),
                    playlistIndex: i
                });
            }
        }
    }

    const duplicates: { name: string, artists: string, playlists: string[] }[] = [];
    const grouped = groupBy(tracks, track => track.trackKey);

    for (const key in grouped) {
        const group = grouped[key];
        if (group.length > 1) {
            const firstItem = group[0];
            duplicates.push({
                name: firstItem.name,
                artists: firstItem.artists.map(a => a.name).join(", "),
                playlists: group.map(g => playlistArray[g.playlistIndex].name)
            });
        }
    }

    return duplicates;
}

export function groupBy<T, K extends keyof any>(arr: T[], key: (i: T) => K) {
    return arr.reduce((groups, item) => {
        (groups[key(item)] ||= []).push(item);
        return groups;
    }, {} as Record<K, T[]>);
}