import yaml from "js-yaml";

export default function (eleventyConfig) {
  // Content lives in .yml — far friendlier to hand-edit than JSON.
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/manifest.json");

  eleventyConfig.addWatchTarget("src/css/");
  eleventyConfig.addWatchTarget("src/js/");

  // "2026-07" -> "July 2026"
  eleventyConfig.addFilter("monthYear", (value) => {
    if (!value) return "";
    const [year, month] = String(value).split("-");
    const names = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const name = names[parseInt(month, 10) - 1];
    return name ? `${name} ${year}` : String(value);
  });

  // "2026-07" -> "07/2026", matching how the lab has always written dates.
  eleventyConfig.addFilter("slashDate", (value) => {
    if (!value) return "";
    const [year, month] = String(value).split("-");
    return month ? `${month}/${year}` : String(value);
  });

  eleventyConfig.addFilter("year", (v) => String(v || "").split("-")[0]);

  eleventyConfig.addFilter("byDateDesc", (items) =>
    [...(items || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  );

  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));

  eleventyConfig.addFilter("groupByYear", (items) => {
    const groups = {};
    for (const item of items || []) {
      const y = String(item.date).split("-")[0];
      (groups[y] = groups[y] || []).push(item);
    }
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((y) => ({
        year: y,
        items: groups[y].sort((a, b) => String(b.date).localeCompare(String(a.date))),
      }));
  });

  eleventyConfig.addFilter("rfc822", (value) => {
    const [year, month] = String(value).split("-");
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toUTCString();
  });

  // Serialise a data object into a <script type="application/json"> payload.
  // Escaping "<" keeps a stray "</script>" in the content from ending the tag.
  eleventyConfig.addFilter("jsonScript", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c")
  );

  // The URLs from a `links:` list whose type is one of `types`. Used to build
  // schema.org sameAs, which wants public profiles only — not mailto: or a CV.
  eleventyConfig.addFilter("urlsOfType", (links, types) =>
    (links || []).filter((l) => types.includes(l.type)).map((l) => l.url)
  );

  // Authors are stored "Last, First" because that is what RIS and BibTeX want.
  // Reading order is for humans only, so it is produced at render time.
  eleventyConfig.addFilter("authorDisplay", (name) => {
    const parts = String(name).split(",");
    return parts.length === 2 ? `${parts[1].trim()} ${parts[0].trim()}` : String(name).trim();
  });

  // Publications grouped by year, newest first — the /publications/ index reads
  // like the news page. Publications carry `year`, not a `date`, so groupByYear
  // above cannot be reused.
  eleventyConfig.addFilter("groupPubsByYear", (items) => {
    const groups = {};
    for (const item of items || []) (groups[item.year] = groups[item.year] || []).push(item);
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((y) => ({ year: y, items: groups[y] }));
  });

  // Look a publication up by slug, so a news item can name the papers it is
  // announcing without repeating their titles.
  eleventyConfig.addFilter("pubsBySlug", (pubs, slugs) =>
    (slugs || []).map((s) => (pubs || []).find((p) => p.slug === s)).filter(Boolean)
  );


  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
