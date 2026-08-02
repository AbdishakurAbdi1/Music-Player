import { SpotifyPlaylist } from "../lib/spotifyApi";
import { NowPlayingTrack } from "../types";
import Player from "./Player";

interface PlayerViewProps {
  playlists: SpotifyPlaylist[];
  activePlaylistId: string | null;
  onSelectPlaylist: (playlist: SpotifyPlaylist) => void;
  onBack: () => void;
  track: NowPlayingTrack | null;
  isPlaying: boolean;
  positionMs: number;
  volume: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (ms: number) => void;
  onVolumeChange: (volume: number) => void;
}

export default function PlayerView({
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onBack,
  ...playerProps
}: PlayerViewProps) {
  return (
    <div className="player-view">
      <aside className="sidebar">
        <button className="back-link" onClick={onBack}>
          ← Abdi's Player
        </button>
        <ul className="sidebar-playlist-list">
          {playlists
            .filter((playlist) => playlist != null)
            .map((playlist) => (
              <li
                key={playlist.id}
                className={
                  "sidebar-playlist-item" +
                  (playlist.id === activePlaylistId ? " active" : "")
                }
                onClick={() => onSelectPlaylist(playlist)}
              >
                {playlist.name ?? "Uten navn"}
              </li>
            ))}
        </ul>
      </aside>

      <section className="player-main">
        <Player {...playerProps} />
      </section>
    </div>
  );
}