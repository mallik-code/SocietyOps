#!/usr/bin/env bash
# Syncs the SocietyOps project to Google Drive using rclone.
#
# Prerequisites:
#   1. Install rclone: https://rclone.org/install/
#   2. Configure a Google Drive remote named "gdrive":
#        rclone config
#        -> New remote -> name it "gdrive" -> Google Drive -> follow OAuth prompts
#
# Run from Git Bash, WSL, or PowerShell:
#   bash scripts/sync-gdrive-rclone.sh
#
# The FOLDER_ID below points to your existing SocietyOps folder in Google Drive.

set -euo pipefail

SRC="/c/projects/SocietyOps"
REMOTE="gdrive"
FOLDER_ID="12GTnBLa-2QcFE1w-BtVfKFpgpk7k2okh"   # SocietyOps folder in Google Drive

EXCLUDES=(
  "node_modules/**"
  ".git/**"
  "dist/**"
  "tmp/**"
  ".cache/**"
  "*.tsbuildinfo"
  ".expo/**"
  ".expo-shared/**"
  "coverage/**"
)

# Build --exclude flags
EXCLUDE_FLAGS=()
for pattern in "${EXCLUDES[@]}"; do
  EXCLUDE_FLAGS+=(--exclude "$pattern")
done

echo "Syncing $SRC -> $REMOTE (folder ID: $FOLDER_ID)"
echo "Excluded: ${EXCLUDES[*]}"
echo ""

rclone sync "$SRC/" "${REMOTE}:" \
  --drive-root-folder-id "$FOLDER_ID" \
  "${EXCLUDE_FLAGS[@]}" \
  --progress \
  --transfers 8 \
  --checkers 16

echo ""
echo "Sync complete."
