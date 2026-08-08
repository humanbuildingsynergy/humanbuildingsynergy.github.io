/* Software and dataset releases: prose from YAML, live facts from the source.
   ==========================================================================
   software-content.yml holds what only a human can write — the name, what the
   thing is, what it does. Everything that goes stale is fetched instead:

     Zenodo (via DataCite)  version, licence, release date
     GitHub                 when the repo was last pushed, language, archived

   Licence comes from Zenodo rather than GitHub on purpose: GitHub's detector
   reports NOASSERTION for repos whose LICENSE it cannot classify, while the
   Zenodo record carries the SPDX identifier the author actually chose.

   Stars and forks are deliberately not fetched. A new research repo has none,
   and "0 stars" on the page reads worse than no number at all.

   Cached to .cache/releases.json, committed, so builds are cheap and a deploy
   still succeeds when an API is down — it just shows what it knew last time.
*/
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const CACHE = path.join(process.cwd(), ".cache", "releases.json");
const UA = "HUBS-site/1.0 (https://hubs.engr.arizona.edu; mailto:wooyoung@arizona.edu)";

const content = yaml.load(fs.readFileSync(
  path.join(process.cwd(), "src", "_data", "software-content.yml"), "utf8"));

const readCache = () => {
  try { return JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { return {}; }
};

async function getJSON(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", ...extraHeaders },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fromZenodo(doi) {
  const a = (await getJSON(`https://api.datacite.org/dois/${doi}`)).data.attributes;
  const issued = (a.dates || []).find((d) => d.dateType === "Issued");
  const rights = (a.rightsList || [])[0] || {};
  return {
    version: a.version || "",
    licence: (rights.rightsIdentifier || rights.rights || "").toUpperCase(),
    released: issued?.date || String(a.publicationYear || ""),
  };
}

async function fromGitHub(url) {
  const repo = (url || "").replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
  if (!repo || repo.split("/").length !== 2) return {};
  // GitHub allows 60 unauthenticated requests an hour per IP, which a shared CI
  // runner can exhaust. Actions sets GITHUB_TOKEN, which raises it to 5,000.
  const auth = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const d = await getJSON(`https://api.github.com/repos/${repo}`, auth);
  const spdx = (d.license || {}).spdx_id;
  return {
    pushed: (d.pushed_at || "").slice(0, 10),
    language: d.language || "",
    archived: !!d.archived,
    // GitHub answers NOASSERTION when it cannot classify a LICENSE file, which
    // is not a licence name. Keep it only when it is a real SPDX identifier.
    ghLicence: spdx && spdx !== "NOASSERTION" ? spdx.toUpperCase() : "",
  };
}

async function enrich(item, cache) {
  const key = item.zenodo || item.github || item.name;
  let live = cache[key] || {};
  try {
    const [z, g] = await Promise.all([
      item.zenodo ? fromZenodo(item.zenodo) : {},
      item.github ? fromGitHub(item.github) : {},
    ]);
    // Zenodo's licence wins over GitHub's; see the note on NOASSERTION above.
    live = { ...live, ...g, ...z, licence: z.licence || g.ghLicence || "" };
    cache[key] = live;
  } catch (err) {
    console.warn(`[software] ${item.name}: ${err.message} — using cache`);
  }
  // Live values win; the YAML's own version/licence are the last resort.
  return {
    ...item,
    version: live.version || item.version || "",
    licence: live.licence || item.licence || "",
    released: live.released || "",
    pushed: live.pushed || "",
    language: live.language || "",
    archived: live.archived || false,
  };
}

export default async function () {
  const cache = readCache();
  const code = [];
  const datasets = [];
  for (const item of content.code || []) code.push(await enrich(item, cache));
  for (const item of content.datasets || []) datasets.push(await enrich(item, cache));

  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2) + "\n");

  const live = [...code, ...datasets].filter((r) => r.pushed || r.released).length;
  console.log(`[software] ${code.length} releases, ${datasets.length} datasets ` +
    `(${live} with live metadata)`);
  return { ...content, code, datasets };
}
