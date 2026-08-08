/* The publication list, built at deploy time from Dr. Jung's ORCID record.
   ==========================================================================
   Nothing here is hand-maintained. Claim a paper in ORCID and the next build
   picks it up — that is the whole point, so please do not paste papers into a
   YAML file instead.

   ORCID gives the list of works; Crossref fills in title, authors, venue and
   year for each DOI. Corrections and exclusions live in
   src/_data/publications-overrides.yml, which is the only file you should
   need to touch.

   Results are cached to .cache/publications.json, which IS committed. Two
   reasons: builds do not re-fetch metadata that cannot have changed, and if
   ORCID or Crossref is unreachable the deploy still produces the list it had
   yesterday instead of an empty page.
*/
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const ORCID = "0000-0003-2746-4983";
const CACHE = path.join(process.cwd(), ".cache", "publications.json");
const UA = "HUBS-site/1.0 (https://hubs.engr.arizona.edu; mailto:wooyoung@arizona.edu)";
const STOP = new Set(["a", "an", "the", "of", "for", "and", "in", "on", "to",
  "with", "from", "into", "at", "as"]);

const overrides = yaml.load(
  fs.readFileSync(path.join(process.cwd(), "src", "_data", "publications-overrides.yml"), "utf8")
) || {};

const readCache = () => {
  try { return JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { return {}; }
};

const writeCache = (data) => {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(data, null, 2) + "\n");
};

/* Crossref records carry full reference lists and funder trees — megabytes of
   material this site never reads. Only the handful of fields `shape` uses are
   cached, which keeps the committed file small enough to not think about. */
function slim(m) {
  return {
    title: m.title, volume: m.volume, type: m.type,
    "container-title": m["container-title"],
    issued: m.issued, created: m.created,
    author: (m.author || []).map((a) => ({ family: a.family, given: a.given })),
  };
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function slugify(title) {
  const words = String(title).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/);
  return words.filter((w) => w && !STOP.has(w)).slice(0, 7).join("-");
}

async function dois() {
  const data = await getJSON(`https://pub.orcid.org/v3.0/${ORCID}/works`);
  const found = (data.group || []).flatMap((g) =>
    (g["external-ids"]?.["external-id"] || [])
      .filter((e) => e["external-id-type"] === "doi")
      .map((e) => e["external-id-value"].toLowerCase())
  );
  // `extra` is the escape hatch for a paper not yet claimed in ORCID. Prefer
  // claiming it in ORCID and deleting the line.
  return [...new Set([...found, ...(overrides.extra || []).map((d) => d.toLowerCase())])];
}

function shape(doi, m) {
  const fix = (overrides.fix || {})[doi] || {};
  const rawTitle = (m.title || ["Untitled"])[0];
  const title = fix.title || rawTitle.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  return {
    doi: `https://doi.org/${doi}`,
    slug: fix.slug || slugify(title),
    title,
    authors: (m.author || []).map((a) => [a.family, a.given].filter(Boolean).join(", ")),
    venue: (fix.venue || (m["container-title"] || [""])[0] || "").replace(/&amp;/g, "&"),
    year: String(m.issued?.["date-parts"]?.[0]?.[0] ?? ""),
    volume: m.volume || "",
    kind: fix.kind || (m.type === "proceedings-article" ? "conference" : "journal"),
    /* Order by when the DOI was registered, not by `issued`. Elsevier assigns
       an issue months ahead — one 2026 paper is slotted into an October issue
       while a paper that appeared later online carries an August one — so
       `issued` sorts recent papers into the wrong order. `created` is when the
       work actually became citable. `year` still comes from `issued`, because
       that is the year a reader will cite. */
    sortDate: (m.created?.["date-time"] || m.issued?.["date-parts"]?.[0]?.join("-") || ""),
  };
}

export default async function () {
  const cache = readCache();
  const skip = new Set((overrides.exclude || []).map((d) => d.toLowerCase()));

  let list;
  try {
    list = (await dois()).filter((d) => !skip.has(d));
  } catch (err) {
    console.warn(`[publications] ORCID unreachable (${err.message}); using cache`);
    list = Object.keys(cache).filter((d) => !skip.has(d));
  }

  const missing = list.filter((d) => !cache[d]);
  for (const doi of missing) {
    try {
      const { message } = await getJSON(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      cache[doi] = slim(message);
    } catch (err) {
      console.warn(`[publications] skipping ${doi}: ${err.message}`);
    }
  }
  if (missing.length) writeCache(cache);

  const pubs = list.filter((d) => cache[d]).map((d) => shape(d, cache[d]));

  /* Hand-written entries, for work Crossref cannot supply — older conference
     proceedings that were never given a DOI, and the occasional paper whose
     DOI is registered with DataCite instead. Set `doi` if one exists; without
     it the entry renders unlinked and its citation file omits the DOI line. */
  for (const m of overrides.manual || []) {
    pubs.push({
      doi: m.doi || "",
      slug: m.slug || slugify(m.title),
      title: m.title,
      authors: m.authors || [],
      venue: m.venue || "",
      year: String(m.year),
      volume: "",
      kind: m.kind || "conference",
      sortDate: m.date || `${m.year}-01`,
    });
  }

  // Slugs are URLs, so they have to be unique even when two papers open with
  // the same seven words — the two PECS reviews do.
  const seen = new Set();
  for (const p of pubs) {
    let s = p.slug, n = 2;
    while (seen.has(s)) s = `${p.slug}-${n++}`;
    seen.add((p.slug = s));
  }

  pubs.sort((a, b) => b.year.localeCompare(a.year) || b.sortDate.localeCompare(a.sortDate));

  /* Numbered the way the CV numbers them: oldest is 1, newest is highest. The
     list reads newest-first, so the numbers count down the page. */
  pubs.forEach((p, i) => { p.n = pubs.length - i; });
  console.log(`[publications] ${pubs.length} works ` +
    `(${pubs.filter((p) => p.kind === "journal").length} journal, ` +
    `${pubs.filter((p) => p.kind === "conference").length} conference)`);
  return pubs;
}
