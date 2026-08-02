import { SpotifyPlaylist, SpotifyUser } from "../lib/spotifyApi";

interface PlaylistSelectViewProps {
  user: SpotifyUser | null;
  playlists: SpotifyPlaylist[];
  onSelect: (playlist: SpotifyPlaylist) => void;
  onLogout: () => void;
}

export default function PlaylistSelectView({
  user,
  playlists,
  onSelect,
  onLogout,
}: PlaylistSelectViewProps) {
  return (
    <main className="view select-view">
      <div className="select-header">
        <h1>Abdi's Player</h1>
        {user && <p>Hei, {user.display_name}</p>}
        <button onClick={onLogout} className="logout-link">
          Logg ut
        </button>
      </div>

      <h2>Velg en spilleliste</h2>
      <ul className="playlist-grid">
        {playlists
          .filter((playlist) => playlist != null)
          .map((playlist) => (
            <li
              key={playlist.id}
              className="playlist-card"
              onClick={() => onSelect(playlist)}
            >
              {playlist.images?.[0]?.url && (
                <img src={playlist.images[0].url} alt={playlist.name} />
              )}
              <p>{playlist.name ?? "Uten navn"}</p>
              <span>{playlist.items?.total ?? 0} sanger</span>
            </li>
          ))}
      </ul>
    </main>
  );
}