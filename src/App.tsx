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
import LoginView from "./components/LoginView";
import PlaylistSelectView from "./components/PlaylistSelectView";
import PlayerView from "./components/PlayerView";
import "./App.css";

type View = "login" | "select" | "player";

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

  const [view, setView] = useState<View>("login");
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(
    null
  );

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

  // Bytt view basert på innloggingsstatus
  useEffect(() => {
    if (token) {
      setView((v) => (v === "login" ? "select" : v));
    } else {
      setView("login");
    }
  }, [token]);

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
        }
      );

      player.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        setIsPlaying(!state.paused);
        setPositionMs(state.position);

        const current = state.track_window?.current_track;
        if (current) {
          setNowPlaying({
            id: current.id,
            name: current.name,
            artists: current.artists.map((a: any) => a.name).join(", "),
            album: current.album?.name ?? "",
            albumImage: current.album?.images?.[0]?.url ?? null,
            durationMs: state.duration,
          });
        }
      });

      player.addListener(
        "initialization_error",
        ({ message }: { message: string }) =>
          console.error("Init-feil:", message)
      );
      player.addListener(
        "authentication_error",
        ({ message }: { message: string }) =>
          console.error("Auth-feil:", message)
      );
      player.addListener(
        "account_error",
        ({ message }: { message: string }) =>
          console.error("Konto-feil (krever Premium):", message)
      );

      await player.connect();
    })();

    return () => {
      player?.disconnect();
      playerInstanceRef.current = null;
      playerCreatedRef.current = false;
    };
  }, [token]);

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
    setActivePlaylistId(null);
    setStatus("Logget ut");
  }

  async function handleSelectPlaylist(playlist: SpotifyPlaylist) {
    if (!token || !deviceId) return;
    setActivePlaylistId(playlist.id);
    setView("player");
    try {
      const activeDeviceId = await resolveActiveDeviceId(
        token.access_token,
        deviceId
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

  if (view === "login") {
    return <LoginView status={status} onLogin={handleLogin} />;
  }

  if (view === "select") {
    return (
      <PlaylistSelectView
        user={user}
        playlists={playlists}
        onSelect={handleSelectPlaylist}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <PlayerView
      playlists={playlists}
      activePlaylistId={activePlaylistId}
      onSelectPlaylist={handleSelectPlaylist}
      onBack={() => setView("select")}
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
  );
}

export default App;