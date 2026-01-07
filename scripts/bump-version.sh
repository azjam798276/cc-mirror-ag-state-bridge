#!/bin/bash
set -e

# Usage: ./scripts/bump-version.sh <major|minor|patch>

VERSION_TYPE=$1

if [[ -z "$VERSION_TYPE" ]]; then
  echo "Usage: $0 <major|minor|patch>"
  exit 1
fi

# Ensure working directory is clean
if [[ -n $(git status --porcelain) ]]; then
  echo "Error: Working directory is not clean. Commit or stash changes first."
  exit 1
fi

# Bump version in package.json and commit
npm version $VERSION_TYPE -m "chore(release): %s"

# Extract new version
NEW_VERSION=$(node -p "require('./package.json').version")

echo "Bumped version to v$NEW_VERSION"
echo "Run 'git push --follow-tags' to trigger release."
