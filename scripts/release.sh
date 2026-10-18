#!/usr/bin/env bash
# Usage: bun run release <patch|minor|major>
# Bumps package.json, commits, and creates the matching vX.Y.Z tag, then asks before pushing.
# Pushing the tag starts the Dokploy deploy.
set -euo pipefail

bump="${1:-}"
case "$bump" in
  patch | minor | major) ;;
  *) echo "usage: bun run release <patch|minor|major>" >&2; exit 1 ;;
esac

[[ "$(git branch --show-current)" == "main" ]] || { echo "Run this from main." >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo "Working tree has uncommitted changes." >&2; exit 1; }
git fetch -q origin main
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || { echo "main is not in sync with origin/main." >&2; exit 1; }

tag="$(npm version "$bump" -m "chore: release v%s")"
echo "Created $tag"

read -r -p "Push main and $tag now? This starts the deploy. [y/N] " answer
if [[ "$answer" != "y" ]]; then
  echo "Not pushed. Undo with: git tag -d $tag && git reset --hard HEAD~1"
  exit 0
fi
git push origin main "$tag"
