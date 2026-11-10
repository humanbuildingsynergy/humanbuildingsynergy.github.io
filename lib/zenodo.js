/* The lab's Zenodo records, read once per build and shared by
   src/_data/publications.js (which paper a release belongs to) and
   src/_data/software.js (the Software and Data list).
   ==========================================================================
   Searched by name and by ORCID, since older records carry only one of the
   two. Zenodo returns the latest version of each record. Only the fields the
   site reads are kept, and the result is cached to .cache/zenodo.json, which
   is committed, so a deploy while Zenodo is down still shows what it knew.

   Lives outside src/_data on purpose: anything in there becomes a data key.
*/
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(process.cwd(), ".cache", "zenodo.json");
const UA = "HUBS-site/1.0 (https://hubs.engr.arizona.edu; mailto:wooyoung@arizona.edu)";
const QUERIES = [`creators.name:"Jung, Wooyoung"`, `creators.orcid:0000-0003-2746-4983`];

// Zenodo writes licenses its own way ("apache2.0", "mit-license"); the page
// shows SPDX-style identifiers ("APACHE-2.0", "CC-BY-NC-4.0").
const spdx = (id) => String(id || "").toUpperCase().replace(/-LICEN[SC]E$/, "")
  .replace(/^([A-Z-]*?[A-Z])-?(\d.*)$/, "$1-$2");

const strip = (html) => String(html || "").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

/* The GitHub repo a release came from, if it says. Three places carry it:
   the code-repository field, a related identifier pointing at the repo, or
   the archive name the GitHub integration gives ("org/repo-v1.0.0.zip"). */
function repoOf(r) {
  const m = r.metadata;
  const urls = [m.custom?.["code:codeRepository"],
    ...(m.related_identifiers || []).map((x) => x.identifier)];
  for (const u of urls) {
    const hit = String(u || "").match(/github\.com\/([^/\s]+\/[^/\s#?]+)/i);
    if (hit) return hit[1].replace(/\.git$/, "").toLowerCase();
  }
  for (const f of r.files || []) {
    const hit = String(f.key || "").match(/^([^/]+)\/(.+?)-v?\d[\w.]*\.(zip|tar\.gz)$/i);
    if (hit) return `${hit[1]}/${hit[2]}`.toLowerCase();
  }
  return "";
}

function slim(r) {
  const m = r.metadata;
  return {
    doi: r.doi,
    conceptdoi: r.conceptdoi || r.doi,
    // A version in the title ("… (v0.1.1)") is shown beside it already.
    title: strip(m.title).replace(/\s*\(?v?\d+(\.\d+)+\)?\s*$/i, ""),
    description: strip(m.description),
    type: m.resource_type?.type || "",
    version: m.version || "",
    license: spdx(m.license?.id),
    released: m.publication_date || "",
    repo: repoOf(r),
    related: (m.related_identifiers || []).map((x) => ({
      relation: x.relation, identifier: x.identifier })),
  };
}

async function search() {
  const found = new Map();
  for (const q of QUERIES) {
    // Unauthenticated searches are capped at 25 a page.
    for (let page = 1; page <= 8; page++) {
      const res = await fetch(`https://zenodo.org/api/records?size=25&page=${page}` +
        `&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} Zenodo`);
      const d = await res.json();
      for (const r of d.hits.hits) found.set(r.conceptdoi || r.doi, slim(r));
      if (page * 25 >= d.hits.total) break;
    }
  }
  // Sorted so the cache only changes when the records do.
  return [...found.values()].sort((a, b) => a.conceptdoi.localeCompare(b.conceptdoi));
}

let once;
export function zenodoRecords() {
  return (once ||= (async () => {
    let cached = [];
    try { cached = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch {}
    try {
      const fresh = await search();
      if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
        fs.mkdirSync(path.dirname(CACHE), { recursive: true });
        fs.writeFileSync(CACHE, JSON.stringify(fresh, null, 2) + "\n");
      }
      return fresh;
    } catch (err) {
      console.warn(`[zenodo] unreachable (${err.message}); using cache`);
      return cached;
    }
  })());
}

/* The papers a release names as the work it supplements, as lookup keys:
   "arxiv:2610.09119" for an arXiv paper, the bare DOI for anything else. */
export function paperKeys(rec) {
  const keys = [];
  for (const rel of rec.related) {
    if (!/^(issupplementto|isdocumentedby|isdescribedby)$/i.test(rel.relation)) continue;
    const id = String(rel.identifier).toLowerCase();
    const ax = id.includes("arxiv") && id.match(/(\d{4}\.\d{4,5})/);
    const key = ax ? `arxiv:${ax[1]}` : id.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    if (ax || key.startsWith("10.")) keys.push(key);  // not a GitHub tree
  }
  return keys;
}
