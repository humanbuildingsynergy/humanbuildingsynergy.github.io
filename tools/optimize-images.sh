#!/usr/bin/env bash
# Convert the legacy asset library to right-sized WebP.
# Re-run any time new source images are dropped into the old repo.
set -euo pipefail

SRC="${1:?usage: optimize-images.sh <old-repo-assets-dir> <dest-assets-dir>}"
DEST="${2:?usage: optimize-images.sh <old-repo-assets-dir> <dest-assets-dir>}"

# Max width and quality per asset category.
width_for() {
  case "$1" in
    background)   echo 1920 ;;
    research)     echo 1000 ;;
    profile)      echo 700  ;;
    logo)         echo 600  ;;
    *)            echo 1200 ;;
  esac
}
quality_for() {
  case "$1" in
    background)   echo 78 ;;
    profile)      echo 86 ;;
    logo)         echo 92 ;;
    *)            echo 82 ;;
  esac
}

total_before=0
total_after=0

# cwebp ignores the EXIF orientation flag, so a photo shot in portrait comes out
# rotated. Read the tag and rotate the pixels before encoding.
exif_rotation() {
  python3 - "$1" <<'PY' 2>/dev/null || echo 0
import struct, sys
d = open(sys.argv[1], 'rb').read(200000)
i = d.find(b'\xff\xe1')
if i < 0 or d[i+4:i+10] != b'Exif\x00\x00':
    print(0); raise SystemExit
tiff = i + 10
bo = '<' if d[tiff:tiff+2] == b'II' else '>'
off = struct.unpack(bo + 'I', d[tiff+4:tiff+8])[0]
p = tiff + off
n = struct.unpack(bo + 'H', d[p:p+2])[0]
o = 1
for k in range(n):
    e = p + 2 + k * 12
    tag = struct.unpack(bo + 'H', d[e:e+2])[0]
    if tag == 0x0112:
        o = struct.unpack(bo + 'H', d[e+8:e+10])[0]
        break
print({1: 0, 3: 180, 6: 90, 8: 270}.get(o, 0))
PY
}

for category in background research profile logo; do
  mkdir -p "$DEST/$category"
  max_w=$(width_for "$category")
  q=$(quality_for "$category")

  # -maxdepth 1 skips _Archive/ subfolders. Raw (.CR2) and .tiff are excluded:
  # they are camera originals, not web assets.
  while IFS= read -r -d '' file; do
    base=$(basename "$file")
    stem="${base%.*}"
    out="$DEST/$category/$stem.webp"

    before=$(stat -f%z "$file")

    # Animated GIFs need gif2webp; cwebp cannot read them.
    if [ "${base##*.}" = "gif" ] || [ "${base##*.}" = "GIF" ]; then
      gif2webp -quiet -q "$q" "$file" -o "$out"
    else
      rot=$(exif_rotation "$file")
      work="$file"
      rotated_tmp=""

      if [ "$rot" != "0" ]; then
        rotated_tmp=$(mktemp -t hubsrot).jpg
        sips -r "$rot" "$file" --out "$rotated_tmp" >/dev/null 2>&1
        work="$rotated_tmp"
        echo "    (rotated ${rot}° per EXIF: $base)"
      fi

      src_w=$(sips -g pixelWidth "$work" 2>/dev/null | awk '/pixelWidth/{print $2}')
      [ -z "$src_w" ] && { echo "  skip (unreadable): $base"; rm -f "$rotated_tmp"; continue; }

      resize_args=()
      [ "$src_w" -gt "$max_w" ] && resize_args=(-resize "$max_w" 0)

      # cwebp rejects CMYK JPEGs; re-encode those to sRGB PNG via sips first.
      if ! cwebp -quiet -q "$q" ${resize_args[@]+"${resize_args[@]}"} "$work" -o "$out" 2>/dev/null; then
        tmp=$(mktemp -t hubsimg).png
        sips -s format png -m /System/Library/ColorSync/Profiles/sRGB\ Profile.icc \
             "$work" --out "$tmp" >/dev/null 2>&1
        cwebp -quiet -q "$q" ${resize_args[@]+"${resize_args[@]}"} "$tmp" -o "$out"
        rm -f "$tmp"
        echo "    (recovered from CMYK: $base)"
      fi
      rm -f "$rotated_tmp"
    fi

    after=$(stat -f%z "$out")
    total_before=$((total_before + before))
    total_after=$((total_after + after))
    printf "  %-46s %6sKB -> %5sKB\n" "$category/$stem.webp" "$((before/1024))" "$((after/1024))"
  done < <(find "$SRC/$category" -maxdepth 1 -type f \
             \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" \) -print0)
done

# Favicon stays as-is; .ico has no WebP equivalent.
cp "$SRC/hubs_logo.ico" "$DEST/hubs_logo.ico"

echo
echo "TOTAL: $((total_before/1024/1024))MB -> $((total_after/1024))KB"
