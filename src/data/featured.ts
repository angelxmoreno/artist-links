// Featured artists shown on the homepage (and used as the sitemap seed).
// NOTE: placeholder list, the site owner will replace it with their own picks.
// Every mbid was checked against the live MusicBrainz API; keep each name in
// sync with the MusicBrainz artist name for that mbid.

export interface FeaturedArtist {
  mbid: string;
  name: string;
  blurb: string;
  /** Wikimedia Commons file name (Wikidata P18 for the artist). Optional: falls back to an initial. */
  image?: string;
}

/** Resize-on-the-fly thumbnail URL for a Commons file name. */
export const commonsThumb = (file: string, width: number): string =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

export const FEATURED: FeaturedArtist[] = [
  {
    mbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
    name: "Radiohead",
    image: "RadioheadO2211125 composite.jpg",
    blurb: "Art rock from Oxfordshire",
  },
  {
    mbid: "056e4f3e-d505-4dad-8ec1-d04f521cbb56",
    name: "Daft Punk",
    image: "Daft Punk in 2013.jpg",
    blurb: "French house pioneers",
  },
  {
    mbid: "381086ea-f511-4aba-bdf9-71c753dc5077",
    name: "Kendrick Lamar",
    image: "Pulitzer2018-portraits-kendrick-lamar.jpg",
    blurb: "Compton storyteller, rap",
  },
  {
    mbid: "859d0860-d480-4efd-970c-c05d5f1776b8",
    name: "Beyoncé",
    image:
      "Beyoncé - Tottenham Hotspur Stadium - 1st June 2023 (10 of 118) (52946364598) (best crop).jpg",
    blurb: "Pop and R&B powerhouse",
  },
  {
    mbid: "87c5dedd-371d-4a53-9f7f-80522fb7f3cb",
    name: "Björk",
    image: "Björk by Hello, I am Bruce at Nature Awareness Nattura concert Reykjavik 2008.jpg",
    blurb: "Icelandic avant-pop visionary",
  },
  {
    mbid: "561d854a-6a28-4aa7-8c99-323e6ce46c2a",
    name: "Miles Davis",
    image: "Miles Davis by Palumbo cropped.jpg",
    blurb: "Jazz trumpeter, constant reinventor",
  },
  {
    mbid: "89aa5ecb-59ad-46f5-b3eb-2d424e941f19",
    name: "Bad Bunny",
    image: "Bad Bunny 2019 by Glenn Francis (cropped).jpg",
    blurb: "Latin trap and reggaeton",
  },
  {
    mbid: "6514cffa-fbe0-4965-ad88-e998ead8a82a",
    name: "Fela Kuti",
    image: "Fela Kuti record.jpg",
    blurb: "Afrobeat's founding voice",
  },
  {
    mbid: "2944824d-4c26-476f-a981-be849081942f",
    name: "Nina Simone",
    image: "Nina Simone 1965 - restoration1.jpg",
    blurb: "Jazz, soul and protest song",
  },
  {
    mbid: "20244d07-534f-4eff-b4d4-930878889970",
    name: "Taylor Swift",
    image: "Taylor Swift at the 2023 MTV Video Music Awards (3).png",
    blurb: "Pop songwriter, stadium scale",
  },
];
