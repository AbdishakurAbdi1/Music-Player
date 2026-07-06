import { start, onUrl, cancel } from "@fabianlars/tauri-plugin-oauth";
import { open } from "@tauri-apps/plugin-shell";
import { createPkcePair } from "./pkce";

const CLIENT_ID = "80a833f3471442c2a3888080cc2ecee9";
const REDIRECT_PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function loginWithSpotify(): Promise<TokenResponse> {
  const { codeVerifier, codeChallenge } = await createPkcePair();

  // Starter en lokal server på port 8888 som venter på redirecten fra Spotify
  const port = await start({ ports: [REDIRECT_PORT] });

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);

  // Åpner Spotify-innloggingen
  await open(authUrl.toString());

  return new Promise((resolve, reject) => {
    onUrl(async (url) => {
      try {
        const redirectedUrl = new URL(url);
        const code = redirectedUrl.searchParams.get("code");
        const error = redirectedUrl.searchParams.get("error");

        try {
          await cancel(port);
        } catch {}

        if (error || !code) {
          reject(new Error(error ?? "Ingen kode mottatt fra Spotify"));
          return;
        }

        const tokenResponse = await exchangeCodeForToken(code, codeVerifier);
        resolve(tokenResponse);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error("Kunne ikke hente token fra Spotify");
  }

  return response.json();
}
