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
const ARXIV_AUTHOR = "Wooyoung Jung";
const CACHE = path.join(process.cwd(), ".cache", "publications.json");
const ARXIV_CACHE = path.join(process.cwd(), ".cache", "preprints.json");
const UA = "HUBS-site/1.0 (https://hubs.engr.arizona.edu; mailto:wooyoung@arizona.edu)";
const STOP = new Set(["a", "an", "the", "of", "for", "and", "in", "on", "to",
  "with", "from", "into", "at", "as"]);

const overrides = yaml.load(
  fs.readFileSync(path.join(process.cwd(), "src", "_data", "publications-overrides.yml"), "utf8")
) || {};

// Keyed case-insensitively — the YAML writes DOIs however the publisher does.
const FIX = Object.fromEntries(
  Object.entries(overrides.fix || {}).map(([k, v]) => [k.toLowerCase(), v])
);

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
      .map((e) => e["external-id-value"])
  );
  // `extra` is the escape hatch for a paper not yet claimed in ORCID. Prefer
  // claiming it in ORCID and deleting the line.
  //
  // Case is preserved rather than folded: DOIs resolve case-insensitively, but
  // the page now prints them for people to copy, and 10.6106/KJCEM… should not
  // appear as 10.6106/kjcem…. Matching is still case-insensitive throughout.
  const seen = new Set();
  return [...found, ...(overrides.extra || [])].filter((d) => {
    const k = d.toLowerCase();
    return seen.has(k) ? false : seen.add(k);
  });
}

/* Preprints come from arXiv rather than ORCID. arXiv registers its DOIs with
   DataCite, so even a preprint claimed in ORCID would fail the Crossref lookup
   above and be skipped. The arXiv API answers in Atom; the handful of fields
   read here do not need an XML parser. */
const decode = (s) => s.replace(/\s+/g, " ").trim()
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function arxiv() {
  const q = encodeURIComponent(`au:"${ARXIV_AUTHOR}"`);
  const res = await fetch(
    `https://export.arxiv.org/api/query?search_query=${q}&max_results=100&sortBy=submittedDate`,
    { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} arXiv`);
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const tag = (t) => (e.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || "";
    return {
      id: tag("id").split("/abs/")[1].replace(/v\d+$/, ""),
      title: decode(tag("title")),
      authors: [...e.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => decode(m[1])),
      published: tag("published").slice(0, 10),
      // Set by the authors once the paper appears in a journal.
      journalDoi: decode(tag("arxiv:doi")),
    };
  });
}

async function preprints() {
  let cached = [];
  try { cached = JSON.parse(fs.readFileSync(ARXIV_CACHE, "utf8")); } catch {}
  try {
    const fresh = await arxiv();
    if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
      fs.mkdirSync(path.dirname(ARXIV_CACHE), { recursive: true });
      fs.writeFileSync(ARXIV_CACHE, JSON.stringify(fresh, null, 2) + "\n");
    }
    return fresh;
  } catch (err) {
    console.warn(`[publications] arXiv unreachable (${err.message}); using cache`);
    return cached;
  }
}

// arXiv gives "Wooyoung Jung"; the rest of the list is "Jung, Wooyoung".
const lastFirst = (n) => {
  const i = n.lastIndexOf(" ");
  return i < 0 ? n : `${n.slice(i + 1)}, ${n.slice(0, i)}`;
};

function shape(doi, m) {
  const fix = FIX[doi.toLowerCase()] || {};
  const rawTitle = (m.title || ["Untitled"])[0];
  const title = fix.title || rawTitle.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  return {
    /* Displayed with whatever case the source gave. Crossref is no help here:
       it lower-cases every DOI in its API, so 10.6106/KJCEM… comes back as
       10.6106/kjcem…. ORCID preserves case for most but not all. DOIs resolve
       either way; this only affects what a reader copies off the page. */
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
    list = (await dois()).filter((d) => !skip.has(d.toLowerCase()));
  } catch (err) {
    console.warn(`[publications] ORCID unreachable (${err.message}); using cache`);
    list = Object.keys(cache).filter((d) => !skip.has(d.toLowerCase()));
  }

  // Cache keys stay lower-cased so a DOI written two ways is fetched once.
  const key = (d) => d.toLowerCase();
  const missing = list.filter((d) => !cache[key(d)]);
  for (const doi of missing) {
    try {
      const { message } = await getJSON(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      cache[key(doi)] = slim(message);
    } catch (err) {
      console.warn(`[publications] skipping ${doi}: ${err.message}`);
    }
  }
  if (missing.length) writeCache(cache);

  const pubs = list.filter((d) => cache[key(d)]).map((d) => shape(d, cache[key(d)]));

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
  const unique = (p) => {
    let s = p.slug, n = 2;
    while (seen.has(s)) s = `${p.slug}-${n++}`;
    seen.add((p.slug = s));
  };
  pubs.forEach(unique);

  pubs.sort((a, b) => b.year.localeCompare(a.year) || b.sortDate.localeCompare(a.sortDate));

  /* Numbered the way the CV numbers them: oldest is 1, newest is highest. The
     list reads newest-first, so the numbers count down the page. Preprints are
     added after this and numbered on their own, so they never shift the count
     of peer-reviewed work. */
  pubs.forEach((p, i) => { p.n = pubs.length - i; });
  console.log(`[publications] ${pubs.length} works ` +
    `(${pubs.filter((p) => p.kind === "journal").length} journal, ` +
    `${pubs.filter((p) => p.kind === "conference").length} conference)`);

  /* A preprint leaves the list on its own once it is published: when arXiv
     names a journal DOI that is already above, or when the title matches a
     paper that is. The published paper then carries the arXiv link instead,
     so the free copy is still one click away. A stranger who shares the name
     is dropped by putting the arXiv DOI (10.48550/arXiv.…) under `exclude` in
     the overrides file. */
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "");
  // Hand-written papers without a DOI are left out of the DOI index, or an
  // empty journalDoi would match them.
  const byDoi = new Map(pubs.filter((p) => p.doi)
    .map((p) => [p.doi.replace("https://doi.org/", "").toLowerCase(), p]));
  const byTitle = new Map(pubs.map((p) => [norm(p.title), p]));
  const pre = [];
  for (const e of await preprints()) {
    const doi = `10.48550/arXiv.${e.id}`;
    if (skip.has(doi.toLowerCase())) continue;
    const published = byDoi.get(e.journalDoi.toLowerCase()) || byTitle.get(norm(e.title));
    if (published) {
      published.arxiv = e.id;
      continue;
    }
    if (e.journalDoi) console.warn(`[publications] arXiv ${e.id} was published as ` +
      `${e.journalDoi}, which is not on the list; claim it in ORCID`);
    pre.push({
      doi: `https://doi.org/${doi}`,
      slug: slugify(e.title),
      title: e.title,
      authors: e.authors.map(lastFirst),
      venue: "arXiv",
      year: e.published.slice(0, 4),
      volume: "",
      kind: "preprint",
      preprint: true,
      sortDate: e.published,
    });
  }
  pre.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  pre.forEach((p, i) => { p.n = pre.length - i; });
  pre.forEach(unique);
  console.log(`[publications] ${pre.length} preprints`);
  return [...pubs, ...pre];
}
