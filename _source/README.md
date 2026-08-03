# Source material

Original documents and photographs the site content was written from. **Nothing
in this folder is published** — it sits outside `src/`, so Eleventy never sees it.

| Folder | What it is |
| --- | --- |
| `facility/` | The CE 116 lab description PDF and the original camera JPEGs |
| `teaching/` | Course syllabi |
| `_superseded/` | Data files replaced during the rebuild, kept in case the prose is wanted back |

Photographs are converted into `src/assets/` by `tools/optimize-images.sh`, which
applies EXIF rotation and produces WebP. Keep the originals here — the published
versions are resized and can't be re-cropped.
