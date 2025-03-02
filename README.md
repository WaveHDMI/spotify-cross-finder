<p style="text-align: center">
  <h2 style="text-align: center">
    Spotify cross-finder
  </h2>

  <p style="text-align: center">
    A Typescript project to see what tracks are duplicated across a specific user's public playlists.
    <br>
    <a href="https://github.com/WaveHDMI/spotify-cross-finder/issues">Issues</a>
  </p>
</p>

## How to use

1. Run the index.ts file
2. Access via browser the URL [http://localhost:8888/login](http://localhost:8888/login)
3. Login through your spotify profile
4. After the login and the message "Ok, you're good to go!" should appear
5. Go to [http://localhost:8888/duplicates?user_id=<user_id>](http://localhost:8888/duplicates?user_id=<user_id>) where `<user_id>` is the target's username (The `Spotify user ID` described in [this page](https://developer.spotify.com/documentation/web-api/concepts/spotify-uris-ids))
6. If everything went fine, you should see now a json output with the duplicate songs and which playlists contains them
