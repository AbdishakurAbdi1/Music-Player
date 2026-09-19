# Music Player (in progress)

Dette prosjektet er en desktop-musikkspiller. Jeg var nysgjerrig på hvordan man lager en desktop og mer erfaring med integrering med APIer.

## Hva appen gjør

Man logger inn med din egen Spotify konto, velger en spilleliste, og styrer avspilling (play/pause, fremdrift, volum) direkte fra appen.

## Teknologier

- **[Tauri](https://tauri.app/)** rammeverk for å bygge desktop-apper med en Rust backend og web frontend
- **[React](https://react.dev/)** + **TypeScript** frontend
- **[Vite](https://vitejs.dev/)** build verktøy/dev server
- **[Tailwind CSS](https://tailwindcss.com/)** styling
- **[Spotify Web API](https://developer.spotify.com/documentation/web-api)** og **Web Playback SDK** henting av spillelister og avspilling av musikk
- OAuth 2.0 (PKCE flyt) for autentisering og innlogging mot Spotify

## Filstruktur

- `src/components` – UI-komponenter (login, spillelisteutvalg, avspiller)
- `src/lib` – Spotify-integrasjon (PKCE-auth, API-kall, avspiller, tokenlagring)
- `src-tauri` – Rust-backend/desktop-shell (Tauri)

## Kjøre prosjektet

```bash
npm install
npm run tauri dev
```

## Anbefalt IDE-oppsett

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
