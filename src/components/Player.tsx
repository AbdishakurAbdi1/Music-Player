import { NowPlayingTrack } from "../types";
import Controls from "./Controls";
import ProgressBar from "./ProgressBar";

interface PlayerProps {
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

export default function Player({
  track,
  isPlaying,
  positionMs,
  volume,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
}: PlayerProps) {
  if (!track) {
    return (
      <div className="player player-empty">
        <p>Ingenting spilles av ennå</p>
      </div>
    );
  }

  return (
    <div className="player">
      {track.albumImage && (
        <img src={track.albumImage} alt={track.name} className="album-cover" />
      )}
      <div className="track-info">
        <h3>{track.name}</h3>
        <p>{track.artists}</p>
      </div>
      <ProgressBar
        positionMs={positionMs}
        durationMs={track.durationMs}
        onSeek={onSeek}
      />
      <Controls
        isPlaying={isPlaying}
        volume={volume}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onPrev={onPrev}
        onVolumeChange={onVolumeChange}
      />
    </div>
  );
}