import { MusicPlayer, Track } from "./ui/music-player";
import { NowPlayingTrack } from "../types";
import { useRef } from "react";

interface SpotifyMusicPlayerProps {
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

export default function SpotifyMusicPlayer({
  track,
  isPlaying,
  positionMs,
  volume,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
}: SpotifyMusicPlayerProps) {
  // Holder styr på forrige rapporterte tid, slik at vi kan skille mellom
  // naturlig sekund-for-sekund fremdrift (ikke spol) og et faktisk klikk
  // på progress-baren (spol) komponenten skiller ikke selv mellom disse.
  const lastReportedTimeRef = useRef(Math.floor(positionMs / 1000));

  if (!track) {
    return (
      <div className="flex items-center justify-center text-white/50 p-12">
        Ingenting spilles av ennå
      </div>
    );
  }

  const mappedTrack: Track = {
    id: track.id,
    title: track.name,
    artist: track.artists,
    album: track.album,
    artwork: track.albumImage ?? "/placeholder.svg",
    duration: Math.floor(track.durationMs / 1000),
  };

  return (
    <MusicPlayer
      key={track.id}
      theme="midnight"
      currentTrack={mappedTrack}
      queue={[mappedTrack]}
      currentIndex={0}
      initialTime={Math.floor(positionMs / 1000)}
      autoPlay={isPlaying}
      showEqualizer={true}
      className="rounded-xl"
      onPlayPause={() => onPlayPause()}
      onTimeChange={(newTime) => {
        const diff = Math.abs(newTime - lastReportedTimeRef.current - 1);
        lastReportedTimeRef.current = newTime;
        // Et hopp på mer enn 2 sekunder er sannsynligvis et klikk på
        // progressbaren, ikke naturlig sekund-for-sekund fremdrift
        if (diff > 2) {
          onSeek(newTime * 1000);
        }
      }}
      onTrackEnd={onNext}
      onTrackChange={(_track, index) => {
        if (index === 0) onPrev();
        else onNext();
      }}
      onVolumeChange={(vol) => onVolumeChange(vol / 100)}
    />
  );
}