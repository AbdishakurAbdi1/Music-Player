import { useEffect, useState, useRef } from "react";
import { loginWithSpotify, refreshAccessToken } from "./lib/spotifyAuth";
import {
  saveToken,
  loadToken,
  clearToken,
  StoredToken,
} from "./lib/tokenStore";
import {
  getCurrentUser,
  getUserPlaylists,
  SpotifyUser,
  SpotifyPlaylist,
  transferPlayback,
  playPlaylist,
  resolveActiveDeviceId,
} from "./lib/spotifyApi";
import {
  loadSpotifySDK,
  createPlayer,
  SpotifyPlayerInstance,
} from "./lib/spotifyPlayer";
import { NowPlayingTrack } from "./types";
import Player from "./components/Player";
import "./App.css";

function App() {
  const [status, setStatus] = useState("Sjekker innloggingsstatus...");
  const [token, setToken] = useState<StoredToken | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolume] = useState(0.5);

  const playerInstanceRef = useRef<SpotifyPlayerInstance | null>(null);
  const playerCreatedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const stored = await loadToken();
      if (!stored) {
        setStatus("Ikke innlogget");
        return;
      }

      if (Date.now() > stored.expires_at) {
        try {
          const refreshed = await refreshAccessToken(stored.refresh_token);
          const newToken: StoredToken = {
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token ?? stored.refresh_token,
            expires_at: Date.now() + refreshed.expires_in * 1000,
          };
          await saveToken(newToken);
          setToken(newToken);
          setStatus("Innlogget (token fornyet)");
        } catch (err) {
          console.error(err);
          await clearToken();
          setStatus("Sesjonen utløpt, logg inn på nytt");
        }
      } else {
        setToken(stored);
        setStatus("Innlogget");
      }
    })();
  }, []);

  useEffect(() => {
    if (!token) return;

    (async () => {
      const [userResult, playlistResult] = await Promise.allSettled([
        getCurrentUser(token.access_token),
        getUserPlaylists(token.access_token),
      ]);

      if (userResult.status === "fulfilled") {
        setUser(userResult.value);
      } else {
        console.error("Kunne ikke hente brukerprofil:", userResult.reason);
      }

      if (playlistResult.status === "fulfilled") {
        setPlaylists(playlistResult.value);
      } else {
        console.error("Kunne ikke hente spillelister:", playlistResult.reason);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (playerCreatedRef.current) return;
    playerCreatedRef.current = true;

    let player: SpotifyPlayerInstance | null = null;

    (async () => {
      await loadSpotifySDK();
      player = createPlayer(() => token.access_token);
      playerInstanceRef.current = player;

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        console.log("Spiller klar med device ID:", device_id);
        setDeviceId(device_id);
      });

      player.addListener(
        "not_ready",
        ({ device_id }: { device_id: string }) => {
          console.log("Enhet gikk offline:", device_id);
        },
      );

      player.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        setIsPlaying(!state.paused);
        setPositionMs(state.position);

        const current = state.track_window?.current_track;
        if (current) {
          setNowPlaying({
            name: current.name,
            artists: current.artists.map((a: any) => a.name).join(", "),
            albumImage: current.album?.images?.[0]?.url ?? null,
            durationMs: state.duration,
          });
        }
      });

      player.addListener(
        "initialization_error",
        ({ message }: { message: string }) =>
          console.error("Init-feil:", message),
      );
      player.addListener(
        "authentication_error",
        ({ message }: { message: string }) =>
          console.error("Auth-feil:", message),
      );
      player.addListener("account_error", ({ message }: { message: string }) =>
        console.error("Konto-feil (krever Premium):", message),
      );

      await player.connect();
    })();

    return () => {
      player?.disconnect();
      playerInstanceRef.current = null;
      playerCreatedRef.current = false;
    };
  }, [token]);

  // Tikker progresjonen lokalt mens en sang spiller, siden SDK-en kun
  // rapporterer posisjon når noe faktisk endrer seg (ikke kontinuerlig)
  useEffect(() => {
    if (!isPlaying || !nowPlaying) return;
    const interval = setInterval(() => {
      setPositionMs((p) => Math.min(p + 1000, nowPlaying.durationMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, nowPlaying]);

  async function handleLogin() {
    setStatus("Logger inn...");
    try {
      const result = await loginWithSpotify();
      const newToken: StoredToken = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: Date.now() + result.expires_in * 1000,
      };
      await saveToken(newToken);
      setToken(newToken);
      setStatus("Innlogget!");
    } catch (err) {
      console.error(err);
      setStatus("Innlogging feilet: " + (err as Error).message);
    }
  }

  async function handleLogout() {
    await clearToken();
    setToken(null);
    setUser(null);
    setPlaylists([]);
    setNowPlaying(null);
    setStatus("Logget ut");
  }

  async function handlePlayPlaylist(playlist: SpotifyPlaylist) {
    if (!token || !deviceId) return;
    try {
      const activeDeviceId = await resolveActiveDeviceId(
        token.access_token,
        deviceId,
      );
      if (activeDeviceId !== deviceId) setDeviceId(activeDeviceId);

      await transferPlayback(token.access_token, activeDeviceId);
      await new Promise((r) => setTimeout(r, 300));
      await playPlaylist(token.access_token, activeDeviceId, playlist.uri);
    } catch (err) {
      console.error("Avspilling feilet:", err);
      setStatus("Kunne ikke starte avspilling: " + (err as Error).message);
    }
  }

  async function handleTogglePlay() {
    await playerInstanceRef.current?.togglePlay();
  }

  async function handleNext() {
    await playerInstanceRef.current?.nextTrack();
  }

  async function handlePrev() {
    await playerInstanceRef.current?.previousTrack();
  }

  async function handleSeek(ms: number) {
    await playerInstanceRef.current?.seek(ms);
    setPositionMs(ms);
  }

  async function handleVolumeChange(newVolume: number) {
    setVolume(newVolume);
    await playerInstanceRef.current?.setVolume(newVolume);
}

  return (
    <main className="container">
      <h1>Music Player</h1>
      <p>{status}</p>

      {token ? (
        <button onClick={handleLogout}>Logg ut</button>
      ) : (
        <button onClick={handleLogin}>Logg inn med Spotify</button>
      )}

      {user && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2>{user.display_name}</h2>
          <p>Abonnement: {user.product}</p>
        </div>
      )}

      <Player
        track={nowPlaying}
        isPlaying={isPlaying}
        positionMs={positionMs}
        volume={volume}
        onPlayPause={handleTogglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
      />

      {playlists.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Dine spillelister</h3>
          <ul className="playlist-list">
            {playlists
              .filter((playlist) => playlist != null)
              .map((playlist) => (
                <li
                  key={playlist.id}
                  className="playlist-item"
                  onClick={() => handlePlayPlaylist(playlist)}
                >
                  {playlist.name ?? "Uten navn"} ({playlist.items?.total ?? 0}{" "}
                  sanger)
                </li>
              ))}
          </ul>
        </div>
      )}
    </main>
  );
}

export default App;