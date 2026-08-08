/* Draft news items for papers that have none, and print them as YAML.
   ==========================================================================
   The announcements on /news/ are hand-written and should stay that way — the
   voice is the point. What can be automated is the *reminder*: this compares
   every paper on the publications list against the DOIs already mentioned in
   news.yml, and emits a stub for anything unannounced.

   It never edits news.yml. The workflow that runs it opens a pull request, so
   nothing reaches the site until the sentence has been rewritten by a human.

   Run locally with:  node tools/draft-news.mjs
*/
import fs from "node:fs";
import publications from "../src/_data/publications.js";

const newsRaw = fs.readFileSync("src/_data/news.yml", "utf8");

// Match on DOI rather than title. Titles get reworded between acceptance and
// publication — two of these already have — but the DOI never changes.
const announced = new Set(
  [...newsRaw.matchAll(/10\.\d{4,9}\/[^\s"'<>)\]]+/g)]
    .map((m) => m[0].replace(/[.,;]+$/, "").toLowerCase())
);

/* Only look at papers published since the newest announcement. Without this
   the tool "finds" every pre-2022 paper — work that predates the lab and was
   never going to be announced here — and buries the one new paper in forty
   irrelevant stubs. Pass --all to override, for a deliberate backfill. */
const newestNews = [...newsRaw.matchAll(/^- date: (\d{4}-\d{2})/gm)]
  .map((m) => m[1]).sort().pop() || "0000-00";
const since = process.argv.includes("--all") ? "0000-00" : newestNews;

const pubs = await publications();
const missing = pubs.filter((p) => {
  if (!p.doi) return false;                       // nothing to link to
  const doi = p.doi.replace("https://doi.org/", "").toLowerCase();
  if (announced.has(doi)) return false;
  return (p.sortDate || `${p.year}-01`).slice(0, 7) >= since;
});

if (!missing.length) {
  console.error(`[draft-news] nothing unannounced since ${since}`);
  process.exit(0);
}

console.error(`[draft-news] ${missing.length} unannounced since ${since} ` +
  `(of ${pubs.length} papers)`);

const lines = [];
for (const p of missing) {
  const first = (p.authors[0] || "").split(",")[0] || "The lab";
  const date = (p.sortDate || `${p.year}-01`).slice(0, 7);
  lines.push(`- date: ${date}`);
  lines.push(`  type: publication`);
  lines.push(`  # DRAFT — rewrite this sentence before merging.`);
  lines.push(`  text: >-`);
  lines.push(`    ${first} et al. published`);
  lines.push(`    <a href="${p.doi}" target="_blank" rel="noopener">${p.title}</a>`);
  lines.push(`    in ${p.venue}.`);
  lines.push("");
}
const block = lines.join("\n");

if (!process.argv.includes("--write")) {
  console.log(block);           // print only; the workflow uses --write
  process.exit(0);
}

/* Insert above the first entry, because news.yml reads newest-first. Anchoring
   on the first "- date:" keeps the header comments where they are. */
const at = newsRaw.search(/^- date:/m);
if (at < 0) {
  console.error("[draft-news] no entries found in news.yml; refusing to write");
  process.exit(1);
}
fs.writeFileSync("src/_data/news.yml",
  newsRaw.slice(0, at) + block + "\n" + newsRaw.slice(at));
console.error(`[draft-news] wrote ${missing.length} stub(s) into news.yml`);
