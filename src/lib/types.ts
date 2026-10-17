export interface Artist {
  id: string;
  name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  "life-span"?: { begin?: string; end?: string; ended?: boolean };
  relations?: { type: string; url?: { resource: string } }[];
}
