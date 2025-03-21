import express from "express";
import {generateRandomString} from "ts-randomstring/lib"
import querystring from "querystring";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import {findDuplicatesAsync} from "./utils";

const stateKey = 'spotify_auth_state';
const tokenKey = 'spotify_auth_token';
const refreshTokenKey = 'spotify_auth_refresh_token';

const clientId = 'a35f78ded74b4d1a9d8a50686a784d83';
const clientSecret = '3b7f0deb3c444c828c3a4d0d3bb4e948';
const spotifyBaseUrl = 'https://api.spotify.com/v1';
const redirectUri = 'http://localhost:8888/callback';

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());

app.get('/', (request, response) => {

    const accessToken = request.cookies[tokenKey];
    if (!accessToken) {
        response.redirect("/login");
    } else {
        response.send("Ok, you're good to go!");
    }

});

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
        response.send(`Error 400: state_mismatch`);
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

app.post('/find-duplicates', async (request, response) => {

    const playlists = request.body.playlist != null ? request.body.playlists as string[] : [];
    const duplicates = await findDuplicatesAsync(spotifyBaseUrl, request.cookies[tokenKey], request.query.user_id as string, playlists);
    response.json(duplicates);

});

app.post('/delete-duplicates', async (request, response) => {

    const playlists = request.body.playlist != null ? request.body.playlists as string[] : [];
    const duplicates = await findDuplicatesAsync(spotifyBaseUrl, request.cookies[tokenKey], request.query.user_id as string, playlists);
    // TODO
    response.json(duplicates);

});

app.listen(8888, () => {
    console.log(`SpotifyCrossFinder app listening on localhost:8888`);
});