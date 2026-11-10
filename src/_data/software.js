/* Software and data the lab releases: found, not listed.
   ==========================================================================
   Every public repository on the lab's GitHub account and every software or
   dataset record on Zenodo appears on its own; nothing has to be added by
   hand. The two are joined where a Zenodo release says which repo it came
   from (see repoOf in lib/zenodo.js), so a repo and its archived release are
   one entry, not two.

     GitHub   name, description, last push, language, archived
     Zenodo   title, version, license, release date, DOI, the paper it
              supplements

   software-content.yml is optional prose on top: an entry there, matched by
   its GitHub URL or Zenodo DOI, overrides the name, title and description
   that would otherwise come from the sources, and can name a paper the
   Zenodo record does not. It also lists repos to leave out and repos that are
   course materials rather than research software.

   License comes from Zenodo rather than GitHub on purpose: GitHub's detector
   reports NOASSERTION for repos whose LICENSE it cannot classify, while the
   Zenodo record carries the identifier the author actually chose.

   Stars and forks are deliberately not fetched. A new research repo has none,
   and "0 stars" on the page reads worse than no number at all.

   GitHub is cached to .cache/releases.json and Zenodo to .cache/zenodo.json,
   both committed, so a deploy while either is down still shows what it knew.
*/
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { zenodoRecords, paperKeys } from "../../lib/zenodo.js";

const CACHE = path.join(process.cwd(), ".cache", "releases.json");
const UA = "HUBS-site/1.0 (https://hubs.engr.arizona.edu; mailto:wooyoung@arizona.edu)";

const content = yaml.load(fs.readFileSync(
  path.join(process.cwd(), "src", "_data", "software-content.yml"), "utf8"));
const ORG = content.githubOrg.replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");

const repoKey = (url) => String(url || "").replace(/^https?:\/\/github\.com\//i, "")
  .replace(/\/+$/, "").toLowerCase();
const listed = (list) => new Set((list || []).map((r) => repoKey(r.includes("/") ? r : `${ORG}/${r}`)));

async function githubRepos() {
  // GitHub allows 60 unauthenticated requests an hour per IP, which a shared CI
  // runner can exhaust. Actions sets GITHUB_TOKEN, which raises it to 5,000.
  const auth = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const res = await fetch(`https://api.github.com/users/${ORG}/repos?per_page=100&type=owner`,
    { headers: { "User-Agent": UA, Accept: "application/json", ...auth } });
  if (!res.ok) throw new Error(`${res.status} GitHub`);
  return (await res.json())
    .filter((r) => !r.fork && !r.private)
    .map((r) => {
      const spdx = r.license?.spdx_id;
      return {
        repo: r.full_name.toLowerCase(),
        name: r.name,
        url: r.html_url,
        description: r.description || "",
        created: (r.created_at || "").slice(0, 10),
        pushed: (r.pushed_at || "").slice(0, 10),
        language: r.language || "",
        archived: !!r.archived,
        // NOASSERTION is GitHub failing to classify a LICENSE file, not a name.
        license: spdx && spdx !== "NOASSERTION" ? spdx.toUpperCase() : "",
      };
    })
    .sort((a, b) => a.repo.localeCompare(b.repo));
}

async function cachedRepos() {
  let cached = [];
  try { cached = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch {}
  if (!Array.isArray(cached)) cached = [];  // the file's older, per-item shape
  try {
    const fresh = await githubRepos();
    if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
      fs.mkdirSync(path.dirname(CACHE), { recursive: true });
      fs.writeFileSync(CACHE, JSON.stringify(fresh, null, 2) + "\n");
    }
    return fresh;
  } catch (err) {
    console.warn(`[software] GitHub unreachable (${err.message}); using cache`);
    return cached;
  }
}

// The opening of a long Zenodo description, cut at a sentence.
function opening(text, max = 320) {
  const parts = String(text).match(/[^.!?]+[.!?]+(?=\s|$)/g) || [String(text)];
  let out = "";
  for (const p of parts) {
    if (out && (out + p).length > max) break;
    out += p;
  }
  return out.trim();
}

// A paper named in the YAML, as the same kind of key Zenodo relations give.
function keyOf(paper) {
  const doi = String(paper?.doi || "").toLowerCase();
  const ax = doi.match(/arxiv\.(\d{4}\.\d{4,5})/);
  return ax ? `arxiv:${ax[1]}` : doi;
}

export default async function () {
  const [repos, records] = await Promise.all([cachedRepos(), zenodoRecords()]);
  const skip = listed(content.exclude);
  skip.add(`${ORG}/${ORG}.github.io`.toLowerCase());  // this website
  const courses = listed(content.courses);

  const entries = [];
  const byRepo = new Map();
  const byDoi = new Map();
  const add = (e) => {
    entries.push(e);
    if (e.repo) byRepo.set(e.repo, e);
    for (const d of e.dois) byDoi.set(d.toLowerCase(), e);
    return e;
  };

  // The hand-written entries first, so the sources fill in around them.
  for (const [group, list] of [["software", content.code], ["data", content.datasets]]) {
    for (const item of list || []) {
      add({
        group, name: item.name, full: item.full || "", description: item.description || "",
        repo: repoKey(item.github), dois: item.zenodo ? [item.zenodo] : [],
        paperKey: keyOf(item.paper), paperVenue: item.paper?.venue || "",
        fallback: { version: item.version || "", license: item.license || "" },
      });
    }
  }

  for (const rec of records) {
    if (!["software", "dataset"].includes(rec.type)) continue;
    const e = (rec.repo && byRepo.get(rec.repo)) || byDoi.get(rec.doi.toLowerCase())
      || byDoi.get(rec.conceptdoi.toLowerCase())
      || add({ group: rec.type === "dataset" ? "data" : "software", repo: rec.repo, dois: [] });
    if (rec.repo && !e.repo) { e.repo = rec.repo; byRepo.set(rec.repo, e); }
    // A title written "Name: what it is" splits into the two.
    const [head, ...rest] = rec.title.split(/:\s+/);
    e.name ||= rest.length && head.length <= 40 ? head : "";
    e.full ||= rest.length && e.name === head ? rest.join(": ") : rec.title;
    e.zenodoDescription = opening(rec.description);
    // Linked by concept DOI, which always resolves to the latest version.
    e.zenodo = rec.conceptdoi;
    e.version = rec.version;
    e.license = rec.license;
    e.released = rec.released;
    e.paperKey ||= paperKeys(rec)[0] || "";
  }

  for (const r of repos) {
    if (skip.has(r.repo)) continue;
    const e = byRepo.get(r.repo) || add({ group: "software", repo: r.repo, dois: [] });
    if (courses.has(r.repo)) e.group = "courses";
    e.github = r.url;
    e.name ||= r.name.replace(/_/g, " ");
    e.repoDescription = r.description;
    e.pushed = r.pushed;
    e.created = r.created;
    e.language = r.language;
    e.archived = r.archived;
    e.license ||= r.license;
  }

  // A GitHub description used as the title often repeats the name first
  // ("BrickTrace: Multi-agent …").
  const untitled = (e, t) => String(t || "").replace(new RegExp(
    `^${(e.name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:—–-]\\s*`, "i"), "");
  // One way of writing versions on the page: "v1.0", whatever the source said.
  const vee = (v) => (v && /^\d/.test(v) ? `v${v}` : v || "");

  const shown = entries
    .filter((e) => !(e.repo && skip.has(e.repo)) && (e.github || e.zenodo))
    .map((e) => ({
      group: e.group,
      name: e.name || e.full,
      full: e.full || untitled(e, e.repoDescription),
      // The YAML's own words, then whichever source has not already been used
      // as the title.
      description: e.description ||
        (e.full ? e.repoDescription || e.zenodoDescription : e.zenodoDescription) || "",
      github: e.github || "",
      zenodo: e.zenodo || "",
      version: vee(e.version || e.fallback?.version),
      license: e.license || e.fallback?.license || "",
      released: e.released || "",
      pushed: e.pushed || "",
      language: e.language || "",
      archived: !!e.archived,
      paperKey: e.paperKey || "",
      paperVenue: e.paperVenue || "",
      sortDate: e.released || e.pushed || e.created || "",
    }))
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate));

  const code = shown.filter((e) => e.group === "software");
  const datasets = shown.filter((e) => e.group === "data");
  const courseware = shown.filter((e) => e.group === "courses");
  console.log(`[software] ${code.length} software, ${datasets.length} datasets, ` +
    `${courseware.length} course materials`);
  return { ...content, code, datasets, courseware };
}
