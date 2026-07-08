interface ProgressBarProps {
  positionMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function ProgressBar({
  positionMs,
  durationMs,
  onSeek,
}: ProgressBarProps) {
  return (
    <div className="progress-bar">
      <span className="time">{formatTime(positionMs)}</span>
      <input
        type="range"
        min={0}
        max={durationMs || 1}
        value={positionMs}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <span className="time">{formatTime(durationMs)}</span>
    </div>
  );
}