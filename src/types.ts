export interface NowPlayingTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  albumImage: string | null;
  durationMs: number;
}