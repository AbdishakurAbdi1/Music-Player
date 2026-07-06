import { PLAYER_NAME } from "./spotifyPlayer";

const BASE_URL = "https://api.spotify.com/v1";

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
  product: string; // premium
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string,
  images: { url: string }[];
  items: { total: number };
}

interface PlaylistsResponse {
  items: SpotifyPlaylist[];
}

async function spotifyFetch<T>(
  endpoint: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Spotify API-feil: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

export async function getCurrentUser(
  accessToken: string,
): Promise<SpotifyUser> {
  return spotifyFetch<SpotifyUser>("/me", accessToken);
}

export async function getUserPlaylists(
  accessToken: string,
): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<PlaylistsResponse>(
    "/me/playlists?limit=20",
    accessToken,
  );
  //console.log("Rå spilleliste-data:", data.items[0]);
  return data.items;
}

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  name: string;
}

interface DevicesResponse {
  devices: SpotifyDevice[];
}

export async function getAvailableDevices(
  accessToken: string,
): Promise<SpotifyDevice[]> {
  const data = await spotifyFetch<DevicesResponse>(
    "/me/player/devices",
    accessToken,
  );
  return data.devices;
}

// Spotify kan av og til rapportere flere enheter med samme navn hvis den
// lokale SDK-en har koblet til på nytt (f.eks. pga. HMR i dev-modus) uten at
// den forrige enheten er fjernet server-side ennå. Vi kan derfor ikke stole
// blindt på den sist mottatte device_id fra "ready"-eventet – vi må sjekke
// hvilken enhet Spotify faktisk har registrert før vi overfører avspilling.
export async function resolveActiveDeviceId(
  accessToken: string,
  preferredDeviceId: string,
  maxRetries = 5,
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const devices = await getAvailableDevices(accessToken);
    const match =
      devices.find((d) => d.id === preferredDeviceId) ??
      devices.find((d) => d.name === PLAYER_NAME);

    if (match) return match.id;

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error("Fant ingen tilgjengelig Spotify-enhet.");
}

export async function transferPlayback(
  accessToken: string,
  deviceId: string,
  maxRetries = 5,
): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(`${BASE_URL}/me/player`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });

    if (response.ok) return;

    // Spotify trenger av og til litt tid før en nyopprettet enhet blir
    // synlig i Connect-systemet, og gir 404 ("Device not found") i mellomtiden.
    if (response.status === 404 && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    throw new Error(
      `Kunne ikke overføre avspilling: ${response.status} ${response.statusText}`,
    );
  }
}

export async function playPlaylist(
  accessToken: string,
  deviceId: string,
  playlistUri: string
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context_uri: playlistUri }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Kunne ikke starte avspilling: ${response.status} ${response.statusText}`,
    );
  }
}
