import { load, Store } from "@tauri-apps/plugin-store";

export interface StoredToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix-timestamp (ms) for når access_token utløper
}

let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load("auth.json", { autoSave: true, defaults: {} });
  }
  return storeInstance;
}

export async function saveToken(token: StoredToken): Promise<void> {
  const store = await getStore();
  await store.set("spotify_token", token);
  await store.save();
}

export async function loadToken(): Promise<StoredToken | null> {
  const store = await getStore();
  const token = await store.get<StoredToken>("spotify_token");
  return token ?? null;
}

export async function clearToken(): Promise<void> {
  const store = await getStore();
  await store.delete("spotify_token");
  await store.save();
}
