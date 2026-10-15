import type { ComponentType } from "react";
import {
  SiSpotify,
  SiApplemusic,
  SiDeezer,
  SiTidal,
  SiYoutubemusic,
  SiSoundcloud,
  SiBandcamp,
  SiAudiomack,
  SiInstagram,
  SiX,
  SiFacebook,
  SiTiktok,
  SiYoutube,
  SiBluesky,
  SiWikipedia,
  SiWikidata,
  SiDiscogs,
  SiGenius,
  SiLastdotfm,
} from "@icons-pack/react-simple-icons";

export type PlatformIcon = ComponentType<{ className?: string }>;

// One entry per platform name in src/lib/musicbrainz.ts PLATFORMS.
const BY_PLATFORM: Record<string, PlatformIcon> = {
  Spotify: SiSpotify,
  "Apple Music": SiApplemusic,
  Deezer: SiDeezer,
  Tidal: SiTidal,
  "YouTube Music": SiYoutubemusic,
  SoundCloud: SiSoundcloud,
  Bandcamp: SiBandcamp,
  Audiomack: SiAudiomack,
  Instagram: SiInstagram,
  "X / Twitter": SiX,
  Facebook: SiFacebook,
  TikTok: SiTiktok,
  YouTube: SiYoutube,
  Bluesky: SiBluesky,
  Wikipedia: SiWikipedia,
  Wikidata: SiWikidata,
  Discogs: SiDiscogs,
  Genius: SiGenius,
  "Last.fm": SiLastdotfm,
};

export function platformIcon(platform: string): PlatformIcon | undefined {
  return BY_PLATFORM[platform];
}
