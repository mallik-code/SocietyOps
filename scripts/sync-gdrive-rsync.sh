#!/usr/bin/env bash
# Syncs the SocietyOps project to Google Drive using rsync.
#
# Prerequisites:
#   - Google Drive for Desktop installed and signed in
#   - rsync available (Git Bash or WSL)
#
# Run from Git Bash or WSL:
#   bash scripts/sync-gdrive-rsync.sh
#
# The GDRIVE_PATH below assumes Google Drive for Desktop mounts at G:\My Drive.
# Adjust if your drive letter is different (check in File Explorer).

set -euo pipefail

SRC="/c/projects/SocietyOps"
GDRIVE_PATH="/g/My Drive/SocietyOps"   # <-- adjust drive letter if needed

EXCLUDES=(
  "node_modules/"
  ".git/"
  "dist/"
  "tmp/"
  ".cache/"
  "*.tsbuildinfo"
  ".expo/"
  ".expo-shared/"
  "coverage/"
)

# Build --exclude flags
EXCLUDE_FLAGS=()
for pattern in "${EXCLUDES[@]}"; do
  EXCLUDE_FLAGS+=(--exclude "$pattern")
done

echo "Syncing $SRC -> $GDRIVE_PATH"
echo "Excluded: ${EXCLUDES[*]}"
echo ""

rsync -av --progress --delete \
  "${EXCLUDE_FLAGS[@]}" \
  "$SRC/" \
  "$GDRIVE_PATH/"

echo ""
echo "Sync complete."
