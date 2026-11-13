#!/usr/bin/env bash
# Run once with an authenticated repository administrator. Never store a token in this repository.
set -euo pipefail
repo='ks250206/physics-problem-simulator'
url='https://ks250206.github.io/physics-problem-simulator/'
command -v gh >/dev/null || { echo 'GitHub CLI (gh) is required.' >&2; exit 1; }
gh auth status
gh repo edit "$repo" \
  --description '大学入試物理を動かす3D実験室 | Interactive 3D physics simulations of Japanese university entrance-exam scenarios.' \
  --homepage "$url" \
  --add-topic physics --add-topic physics-simulation --add-topic education --add-topic threejs \
  --add-topic react --add-topic typescript --add-topic vite-plus --add-topic github-pages
if gh api "repos/$repo/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/$repo/pages" -f build_type=workflow
else
  gh api --method POST "repos/$repo/pages" -f build_type=workflow
fi
gh workflow run pages.yml --repo "$repo"
echo "Pages workflow dispatched. Check: https://github.com/$repo/actions"
