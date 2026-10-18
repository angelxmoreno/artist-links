# Fonts

Self-hosted so visitors do not make requests to Google. Declared with `@font-face` in `src/styles.css`.

- DM Sans (variable, weight 400-600): Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts).
- Instrument Serif (regular 400): Copyright 2022 The Instrument Serif Project Authors (https://github.com/Instrument/instrument-serif).

Both are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org), which allows self-hosting and redistribution.

Files are the woff2 builds served by Google Fonts (v17 / v5), split by `unicode-range`:
`*-latin.woff2` covers Western European text (Bjork, Beyonce, etc.), `*-latin-ext.woff2` is only downloaded when a page contains characters outside it (e.g. Polish, Czech, Turkish artist names).
Italic is not used by the app, so it is not included.

To update, fetch `https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..600&family=Instrument+Serif&display=swap` with a modern browser User-Agent and download the `latin` and `latin-ext` woff2 URLs.
