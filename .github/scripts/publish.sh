#!/usr/bin/env bash
#
# Publishes the static site to the gh-pages branch.
#
#   publish.sh            -> site root (production)
#   publish.sh pr-12      -> a preview subdirectory
#
# GitHub Pages serves one site per repo, so previews live in subdirectories of
# the same branch. Every asset path in the site is relative, so a copy under
# pr-12/ works unmodified.
#
# Publishing to the root deliberately preserves pr-* directories, and
# publishing a preview touches only its own directory, so the two never clobber
# each other.
set -euo pipefail

DEST="${1:-}"

# Only these are served. Everything else in the repo (workflows, scripts,
# node_modules, docs) stays out of the published site.
CONTENT=(index.html assets data)

if [ -n "$DEST" ]; then
  case "$DEST" in
    pr-[0-9]*) ;;
    *) echo "refusing to publish to '$DEST': previews must be named pr-<number>" >&2; exit 1 ;;
  esac
fi

for path in "${CONTENT[@]}"; do
  if [ ! -e "$path" ]; then
    echo "expected site content '$path' is missing" >&2
    exit 1
  fi
done

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# Capture this before switching branches, and tolerate running outside Actions.
SOURCE_SHA="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
SOURCE_SHA="${SOURCE_SHA:0:7}"

# Stage outside the worktree: switching to gh-pages replaces everything here.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
for path in "${CONTENT[@]}"; do
  cp -R "$path" "$STAGE/"
done

git fetch origin gh-pages --depth=1 2>/dev/null || true

if git rev-parse --verify origin/gh-pages >/dev/null 2>&1; then
  # --force because the job may have run `npm install` first: an untracked
  # package-lock.json colliding with a tracked one on gh-pages aborts a plain
  # checkout, which failed the publish rather than the build that caused it.
  git checkout -f -B gh-pages origin/gh-pages
else
  echo "gh-pages does not exist yet, creating it"
  git checkout --orphan gh-pages
  git reset --hard
fi

# Everything published is copied from $STAGE below, so anything else still in
# the worktree is build residue -- node_modules, a lockfile, test screenshots --
# and `git add -A` at the end would commit it. A preview publish only replaces
# its own directory, so without this a stray node_modules/ lands at the root of
# the served site and stays there.
#
# .github is spared because this script lives in it. A production publish
# removes it anyway a few lines down, and survives doing so only because an
# unlinked file stays readable while bash still holds it open -- no reason to
# lean on that in the preview path too.
git clean -ffdxq -e .github

if [ -z "$DEST" ]; then
  # Production: replace the root, but never the previews.
  find . -maxdepth 1 -mindepth 1 \
    ! -name .git \
    ! -name 'pr-*' \
    -exec rm -rf {} +
  cp -R "$STAGE"/. .
else
  rm -rf "${DEST:?}"
  mkdir -p "$DEST"
  cp -R "$STAGE"/. "$DEST/"
fi

# Without this, Pages runs Jekyll and drops directories beginning with an
# underscore.
touch .nojekyll

git add -A
if git diff --cached --quiet; then
  echo "no change to publish"
  exit 0
fi

git commit -q -m "Publish ${DEST:-site} from $SOURCE_SHA"

# Main and preview publishes share this branch, so a concurrent push can land
# between our fetch and our push.
for attempt in 1 2 3 4 5; do
  if git push origin gh-pages; then
    echo "published ${DEST:-site}"
    exit 0
  fi
  echo "push rejected (attempt $attempt), rebasing on the latest gh-pages"
  git pull --rebase origin gh-pages || true
  sleep $((attempt * 3))
done

echo "could not push to gh-pages after 5 attempts" >&2
exit 1
