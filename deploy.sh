#!/usr/bin/env bash
# Build the site and publish it to the gh-pages branch (GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")"

REPO_URL=$(git remote get-url origin)
REPO_NAME=$(basename -s .git "$REPO_URL")

VITE_BASE="/$REPO_NAME/" npm run build
touch dist/.nojekyll

cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -qm "Deploy site"
git push -f "$REPO_URL" gh-pages
rm -rf .git
echo "Published. Site: https://<user>.github.io/$REPO_NAME/"
