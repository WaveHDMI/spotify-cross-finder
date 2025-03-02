import express from "express";
import { generateRandomString } from "ts-randomstring/lib"
import querystring from "querystring";
import cookieParser from "cookie-parser";

const stateKey = 'spotify_auth_state';
const tokenKey = 'spotify_auth_token';
const refreshTokenKey = 'spotify_auth_refresh_token';

const clientId = 'a35f78ded74b4d1a9d8a50686a784d83';
const clientSecret = '3b7f0deb3c444c828c3a4d0d3bb4e948';
const spotifyBaseUrl = 'https://api.spotify.com/v1';
const redirectUri = 'http://localhost:8888/callback';

const app = express();
app.use(cookieParser());

app.get('/login', (request, response) => {

    const state = generateRandomString({ length: 16 });
    response.cookie(stateKey, state);

    const scope = 'playlist-read-private playlist-read-collaborative';

    response.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: clientId,
            scope: scope,
            redirect_uri: redirectUri,
            state: state
        }));
});

app.get('/callback', async (request, response) => {

    const code = request.query.code || null;
    const state = request.query.state || null;
    const storedState: string = request.cookies ? request.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        response.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        response.clearCookie(stateKey);

        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code + '',
                redirect_uri: redirectUri,
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
            }
        });

        if (tokenResponse.status === 200) {
            const tokenObject = await tokenResponse.json();

            response.cookie(tokenKey, tokenObject.access_token);
            response.cookie(refreshTokenKey, tokenObject.refresh_token);

            response.send("Ok, you're good to go!");
        } else {
            response.send(`Error ${tokenResponse.status}: ${tokenResponse.statusText}`);
        }
    }

});

app.get('/duplicates', async (request, response) => {

    const accessToken = request.cookies[tokenKey];

    const playlistResponse = await fetch(`${spotifyBaseUrl}/users/${request.query.user_id}/playlists`, {
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
                    trackKey: item.track.name + item.track.artists.sort((a, b) => a.name.localeCompare(b.name)).join(","),
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

    response.json(duplicates);
});

app.listen(8888, () => {
    console.log(`SpotifyCrossFinder app listening on localhost:8888`);
})

const groupBy = <T, K extends keyof any>(arr: T[], key: (i: T) => K) =>
    arr.reduce((groups, item) => {
        (groups[key(item)] ||= []).push(item);
        return groups;
    }, {} as Record<K, T[]>);
