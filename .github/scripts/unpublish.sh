#!/usr/bin/env bash
#
# Removes a preview directory from gh-pages once its PR is closed.
#
#   unpublish.sh pr-12
set -euo pipefail

DEST="${1:?usage: unpublish.sh pr-<number>}"

case "$DEST" in
  pr-[0-9]*) ;;
  *) echo "refusing to delete '$DEST': only pr-<number> directories are previews" >&2; exit 1 ;;
esac

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git fetch origin gh-pages --depth=1 2>/dev/null || true
if ! git rev-parse --verify origin/gh-pages >/dev/null 2>&1; then
  echo "gh-pages does not exist, nothing to remove"
  exit 0
fi

git checkout -B gh-pages origin/gh-pages

if [ ! -d "$DEST" ]; then
  echo "no preview at $DEST, nothing to remove"
  exit 0
fi

rm -rf "${DEST:?}"
git add -A
if git diff --cached --quiet; then
  echo "nothing to remove"
  exit 0
fi

git commit -q -m "Remove preview $DEST"

for attempt in 1 2 3 4 5; do
  if git push origin gh-pages; then
    echo "removed $DEST"
    exit 0
  fi
  git pull --rebase origin gh-pages || true
  sleep $((attempt * 3))
done

echo "could not push to gh-pages after 5 attempts" >&2
exit 1
