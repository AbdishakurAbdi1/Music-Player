import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from "lucide-react";

interface ControlsProps {
  isPlaying: boolean;
  volume: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onVolumeChange: (volume: number) => void;
}

export default function Controls({
  isPlaying,
  volume,
  onPlayPause,
  onNext,
  onPrev,
  onVolumeChange,
}: ControlsProps) {
  return (
    <div className="controls-wrapper">
      <div className="controls">
        <button onClick={onPrev} aria-label="Forrige sang">
          <SkipBack size={22} />
        </button>
        <button
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pause" : "Spill av"}
          className="play-button"
        >
          {isPlaying ? <Pause size={26} /> : <Play size={26} />}
        </button>
        <button onClick={onNext} aria-label="Neste sang">
          <SkipForward size={22} />
        </button>
      </div>

      <div className="volume-control">
        {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="Volum"
        />
      </div>
    </div>
  );
}