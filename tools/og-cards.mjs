/* Share-preview cards: the image a link to the site shows on LinkedIn, Slack,
   X or in an email.
   ==========================================================================
   One 1200x630 card per page, carrying that page's own headline in the
   site's colors, so a shared link looks like the page it opens. The headline
   and label are read from the built page, which means rewording a headline
   and re-running this keeps the card in step.

   Rendered with headless Chrome from the built site, then committed: the
   cards change only when a headline does, so the deploy does not need a
   browser. Run after a build:

     npm run build && node tools/og-cards.mjs

   It writes src/assets/og/<page>.png and src/_data/ogCards.json, the list
   base.njk checks before pointing a page's og:image at its card.
*/
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const SITE = path.join(ROOT, "_site");
const OUT = path.join(ROOT, "src", "assets", "og");
const TMP = path.join(SITE, "_og");
const CHROME = process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* The site's color and type tokens, taken from the first :root block of
   main.css so the cards stay in step with the site. Only the tokens and the
   accent classes come across; linking the whole stylesheet would let the
   site's .card, .label and layout rules leak into the card. */
const css = fs.readFileSync(path.join(ROOT, "src", "css", "main.css"), "utf8");
const rootBlock = (css.match(/:root\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
const tokens = [...rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
  .map(([, k, v]) => `${k}: ${v.replace(/\s+/g, " ").trim()};`).join(" ");
const accents = [...css.matchAll(/^\.(c-[a-z]+)\s*\{\s*color:\s*(var\(--[\w-]+\))\s*;\s*\}/gm)]
  .map(([, cls, v]) => `.${cls} { color: ${v}; } svg .${cls} { fill: ${v}; }`).join("\n");

// Page key → built file. The key is the page's URL without slashes.
const PAGES = {
  home: "index.html", about: "about/index.html", people: "people/index.html",
  research: "research/index.html", publications: "publications/index.html",
  facility: "facility/index.html", teaching: "teaching/index.html",
  news: "news/index.html", "join-us": "join-us/index.html",
  director: "director/index.html", alumni: "alumni/index.html",
};

// The headline exactly as the page sets it, colored spans and all. The
// homepage carries three and picks one at random; the card takes the first.
function read(file) {
  const html = fs.readFileSync(path.join(SITE, file), "utf8");
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
  const label = (html.match(/<p class="label">([^<]*)<\/p>/) || [])[1] || "";
  return { h1: h1.replace(/\s+/g, " ").trim(), label: label.trim() };
}

/* The triangle from the homepage figure: Human, AI and Building, with a
   channel each way between every pair. Drawn bleeding off the right edge so
   it reads as a mark, not a diagram. */
const triangle = `
<svg class="tri" viewBox="0 0 520 520" aria-hidden="true">
  <g fill="none" stroke-width="2.2" stroke-linecap="round">
    <path d="M110 380 Q 175 250 250 130" stroke="var(--human)" opacity=".55"/>
    <path d="M270 140 Q 205 270 130 392" stroke="var(--ai)" opacity=".35"/>
    <path d="M270 130 Q 345 250 410 380" stroke="var(--ai)" opacity=".55"/>
    <path d="M390 392 Q 315 270 250 140" stroke="var(--bldg)" opacity=".35"/>
    <path d="M405 400 Q 260 450 115 400" stroke="var(--bldg)" opacity=".55"/>
    <path d="M115 412 Q 260 470 405 412" stroke="var(--human)" opacity=".35"/>
  </g>
  <circle cx="260" cy="120" r="34" fill="var(--ground)" stroke="var(--ai)" stroke-width="2.5"/>
  <circle cx="100" cy="396" r="34" fill="var(--ground)" stroke="var(--human)" stroke-width="2.5"/>
  <circle cx="420" cy="396" r="34" fill="var(--ground)" stroke="var(--bldg)" stroke-width="2.5"/>
  <text x="260" y="126" class="node c-ai">AI</text>
  <text x="100" y="402" class="node c-hu">HUMAN</text>
  <text x="420" y="402" class="node c-bl">BLDG</text>
</svg>`;

function card({ h1, label }, key) {
  const portrait = key === "director"
    ? `<img class="portrait" src="../assets/profile/WooyoungJung.webp" alt="">` : triangle;
  return `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
<style>
  :root { ${tokens} }
  ${accents}
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden;
               background: var(--ground); color: var(--ink); font-family: var(--sans); }
  .card { position: relative; width: 1200px; height: 630px;
          padding: 60px 72px 56px; display: grid; grid-template-rows: auto 1fr auto; }
  .top { font-family: var(--mono); font-size: 17px; letter-spacing: .22em; color: var(--ink-2);
         text-transform: uppercase; display: flex; gap: 18px; align-items: baseline; }
  .top b { color: var(--ink); font-family: var(--sans); font-size: 30px; letter-spacing: -.03em;
           text-transform: none; font-weight: 800; }
  .mid { align-self: center; max-width: ${key === "director" ? 640 : 720}px; }
  .label { font-family: var(--mono); font-size: 16px; letter-spacing: .22em; color: var(--ink-3);
           text-transform: uppercase; margin: 0 0 22px; }
  h1 { margin: 0; font-size: ${key === "home" ? 68 : key === "director" ? 64 : 76}px; line-height: 1.04; letter-spacing: -.045em;
       font-weight: 800; color: var(--ink); text-wrap: balance; }
  .foot { font-family: var(--mono); font-size: 16px; letter-spacing: .14em; color: var(--ink-3);
          display: flex; justify-content: space-between; max-width: 720px;
          padding-top: 22px; border-top: 1px solid var(--hairline); }
  .tri { position: absolute; right: -40px; top: 60px; width: 520px; height: 520px; }
  /* The homepage headline is three short sentences, one per party; each gets
     its own line, as it reads on the page. */
  ${key === "home" ? "h1 span { display: block; }" : ""}
  .node { font-family: var(--mono); font-size: 15px; letter-spacing: .14em; text-anchor: middle; font-weight: 600; }
  .portrait { position: absolute; right: 72px; top: 50%; transform: translateY(-50%);
              width: 340px; height: 340px; object-fit: cover; border-radius: 50%;
              border: 2px solid var(--hairline); }
</style></head><body>
<div class="card">
  <div class="top"><b>HUBS</b><span>Human Building Synergy Laboratory</span></div>
  <div class="mid">
    ${label ? `<p class="label">${label}</p>` : ""}
    <h1>${h1}</h1>
  </div>
  <div class="foot"><span>hubs.engr.arizona.edu</span><span>The University of Arizona</span></div>
  ${portrait}
</div></body></html>`;
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const made = [];
for (const [key, file] of Object.entries(PAGES)) {
  if (!fs.existsSync(path.join(SITE, file))) { console.warn(`[og] no ${file}; skipped`); continue; }
  const html = path.join(TMP, `${key}.html`);
  fs.writeFileSync(html, card(read(file), key));
  const png = path.join(OUT, `${key}.png`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--window-size=1200,630",
    "--virtual-time-budget=2000", `--screenshot=${png}`, `file://${html}`], { stdio: "ignore" });
  made.push(key);
  console.log(`[og] ${key}`);
}
fs.rmSync(TMP, { recursive: true, force: true });
fs.writeFileSync(path.join(ROOT, "src", "_data", "ogCards.json"), JSON.stringify(made) + "\n");
