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
import "./App.css";
import {
  loadSpotifySDK,
  createPlayer,
  SpotifyPlayerInstance,
} from "./lib/spotifyPlayer";

function App() {
  const [status, setStatus] = useState("Sjekker innloggingsstatus...");
  const [token, setToken] = useState<StoredToken | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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

  // Hent brukerdata og spillelister når vi har et gyldig token
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

  const playerCreatedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (playerCreatedRef.current) return;
    playerCreatedRef.current = true;

    let player: SpotifyPlayerInstance | null = null;

    (async () => {
      await loadSpotifySDK();
      player = createPlayer(() => token.access_token);

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
      playerCreatedRef.current = false;
    };
  }, [token]);

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
    setStatus("Logget ut");
  }

  async function handlePlayFirstPlaylist() {
    if (!token || !deviceId || playlists.length === 0) return;
    try {
      const activeDeviceId = await resolveActiveDeviceId(
        token.access_token,
        deviceId,
      );
      if (activeDeviceId !== deviceId) setDeviceId(activeDeviceId);

      await transferPlayback(token.access_token, activeDeviceId);
      await new Promise((r) => setTimeout(r, 300)); // liten pause, gir Spotify tid til å bytte enhet
      await playPlaylist(token.access_token, activeDeviceId, playlists[0].uri);
    } catch (err) {
      console.error("Avspilling feilet:", err);
      setStatus("Kunne ikke starte avspilling: " + (err as Error).message);
    }
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
          <p>{user.email}</p>
          <p>Abonnement: {user.product}</p>
        </div>
      )}

      {playlists.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Dine spillelister</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {playlists
              .filter((playlist) => playlist != null)
              .map((playlist) => (
                <li key={playlist.id} style={{ marginBottom: "0.5rem" }}>
                  {playlist.name ?? "Uten navn"} ({playlist.items?.total ?? 0}{" "}
                  sanger)
                </li>
              ))}
          </ul>
        </div>
      )}

      {deviceId && playlists.length > 0 && (
        <button onClick={handlePlayFirstPlaylist} style={{ marginTop: "1rem" }}>
          {isPlaying ? "Spiller av..." : `Spill "${playlists[0].name}"`}
        </button>
      )}
    </main>
  );
}

export default App;
