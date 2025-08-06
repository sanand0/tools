#!/usr/bin/env bash
set -euo pipefail
root=$(dirname "$0")
vendor="$root/vendor"

fetch() {
  local url=$1 dest=$2 dir
  dir=$(dirname "$dest")
  mkdir -p "$dir"
  curl -fsSL "$url" -o "$dest"
}

assets=(
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css" "$vendor/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css"
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/js/bootstrap.bundle.min.js" "$vendor/npm/bootstrap@5.3.6/dist/js/bootstrap.bundle.min.js"
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.css" "$vendor/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.css"
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/fonts/bootstrap-icons.woff2" "$vendor/npm/bootstrap-icons@1.13.1/font/fonts/bootstrap-icons.woff2"
  "https://cdn.jsdelivr.net/npm/bootstrap-alert@1" "$vendor/npm/bootstrap-alert@1"
  "https://cdn.jsdelivr.net/npm/saveform@1.2" "$vendor/npm/saveform@1.2"
  "https://cdn.jsdelivr.net/npm/marked@4.3.0" "$vendor/npm/marked@4.3.0"
  "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm" "$vendor/npm/d3-dsv@3/+esm"
  "https://news.ycombinator.com/" "$vendor/news.ycombinator.com/index.html"
  "https://www.hntoplinks.com/week" "$vendor/www.hntoplinks.com/week/index.html"
)

for ((i=0; i<${#assets[@]}; i+=2)); do
  fetch "${assets[i]}" "${assets[i+1]}"
done

echo "Assets mirrored under $vendor"
