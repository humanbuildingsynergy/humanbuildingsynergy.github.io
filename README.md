# HUBS website — 2026 rebuild

The new Human Building Synergy Laboratory site, framed around
**Human–AI–Building Interaction**. Built with [Eleventy](https://www.11ty.dev/).

The current live site is still the old HTML at the repo root. Nothing here goes
live until you change **Settings → Pages → Source** to "GitHub Actions".

## Working on it locally

```bash
cd renew_2026
npm install     # once
npm start       # http://localhost:8080, live-reloads as you edit
npm run build   # production build into _site/
```

## Where the content lives

**You should almost never need to touch HTML.** Everything is in `src/_data/*.yml`.

| File | What it controls |
| --- | --- |
| `exchange.yml` | **Fig. 1 on the homepage** — the whole human/AI/building conversation, including both branches |
| `site.yml` | Lab name, the title-card phrase, the headline, contact details, navigation |
| `edges.yml` | The three edges of the triangle |
| `scales.yml` | The five research scales and their copy |
| `news.yml` | Every news item. Homepage, `/news/` and the RSS feed all read this one list |
| `people.yml` | Director + current members |
| `alumni.yml` | Former members |
| `projects.yml` | Funded projects |
| `publications.yml` | Conference PDFs in `src/assets/publications/` |
| `director.yml` | CV content for the Director page |
| `courses.yml` | Teaching |
| `sponsors.yml` | Sponsor and partner logos |
| `research.yml` | Software list (and legacy theme copy) |
| `redirects.yml` | Old `.html` URLs → new locations. **Don't delete these** — they keep old Google results and external links working |

### Editing the exchange

`src/_data/exchange.yml` is the file. Each step:

```yaml
- from: ai          # human | ai | bldg — which lifeline it sits in
  to: human         # who it's addressed to (draws the arrow)
  kind: msg         # msg | think | tele | act | choice
  text: >-
    What gets said.
  state: { co2: "1140" }   # optional — updates the Building state panel
```

`kind` decides the visual treatment:

- `msg` — a message between parties (outline box + arrow)
- `think` — the AI reasoning to itself (dashed, no arrow)
- `tele` — the building reporting sensor data upward (dotted, mono)
- `act` — the building physically doing something (**solid block** — committed)
- `choice` — the visitor picks the human's reply, branching the exchange

Steps tagged `branch: accept` or `branch: override` only appear on that path.

### Adding a news item

Add a block at the top of `src/_data/news.yml`:

```yaml
- date: 2026-09
  type: publication
  text: >-
    A new journal article, titled
    <a href="https://doi.org/..." target="_blank" rel="noopener">Some Title</a>,
    is accepted and published by Journal Name!
```

`type` is one of: `publication`, `grant`, `conference`, `seminar`, `service`,
`people`, `outreach`, `milestone`.

### YAML gotcha

If a value contains a colon followed by a space, quote it:

```yaml
role: "Co-PI (PI: Dr. Someone)"   # quotes required
role: PI                          # fine without
```

## Design system

Three parties, three colours, used everywhere — the title card, the headline,
the lifelines, the arrows, the section labels:

| | Colour | Meaning |
| --- | --- | --- |
| Human | amber | the occupant |
| AI | cyan | the reasoning agent |
| Building | violet | the physical systems |

Form encodes commitment: **outline** = reversible talk, **dotted** = telemetry,
**solid** = a physical act that actually happened.

No Bootstrap, no jQuery, no Font Awesome, no webfonts. Icons are inline SVG in
`src/_includes/icons.njk`; styles are hand-written in `src/css/main.css`.

## Images

Source images are optimised once into WebP and committed. To re-run after adding
new source images:

```bash
./tools/optimize-images.sh <source-assets-dir> src/assets
```

Requires `cwebp` and `gif2webp` (`brew install webp`).

## Licensing

Two licenses, matching how the lab already releases work on Zenodo:

| | License |
| --- | --- |
| **Code** — `src/css`, `src/js`, templates, `eleventy.config.js`, `tools/` | MIT |
| **Content** — `src/_data/**`, lab photographs, page prose | CC BY-NC 4.0 |

**Not licensed for reuse:** portraits in `src/assets/profile/` (the people
depicted retain their rights), and HUBS / University of Arizona marks.

See [LICENSE](LICENSE) for the full text. Material produced in the course of
UA employment may also fall under University IP policy.

## Going live

1. Push this folder to `main`.
2. Watch the run under the **Actions** tab — it builds but does not serve yet.
3. When you're happy: **Settings → Pages → Source → GitHub Actions**.
4. Move `src/CNAME` verification: the file already contains `hubs.engr.arizona.edu`,
   so the custom domain carries over.
5. Submit `https://hubs.engr.arizona.edu/sitemap.xml` in Google Search Console to
   speed up re-indexing.
6. Once verified, the old `.html` files at the repo root can be deleted.
