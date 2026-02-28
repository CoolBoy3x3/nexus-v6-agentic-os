#!/usr/bin/env bash
# snapshot.sh — Create a timestamped snapshot of the .nexus/ directory
# Usage: ./tools/snapshot.sh [--label <label>]

set -euo pipefail

NEXUS_DIR=".nexus"
SNAPSHOTS_DIR=".nexus/06-checkpoints/snapshots"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
LABEL="${2:-}"

if [[ ! -d "$NEXUS_DIR" ]]; then
  echo "ERROR: .nexus/ directory not found. Are you in a Nexus project root?"
  exit 1
fi

# Create snapshots directory if it doesn't exist
mkdir -p "$SNAPSHOTS_DIR"

# Build snapshot filename
if [[ -n "$LABEL" ]]; then
  SNAPSHOT_FILENAME="snapshot-${TIMESTAMP}-${LABEL}.tar.gz"
else
  SNAPSHOT_FILENAME="snapshot-${TIMESTAMP}.tar.gz"
fi

SNAPSHOT_PATH="${SNAPSHOTS_DIR}/${SNAPSHOT_FILENAME}"

echo "Creating snapshot of .nexus/ state..."
echo "Timestamp:  $TIMESTAMP"
echo "Output:     $SNAPSHOT_PATH"

# Capture current git ref (if in a git repo)
GIT_REF="none"
if git rev-parse --git-dir &>/dev/null 2>&1; then
  GIT_REF=$(git rev-parse HEAD 2>/dev/null || echo "none")
fi

# Write a manifest file inside the snapshot
MANIFEST_FILE=$(mktemp)
cat > "$MANIFEST_FILE" << MANIFEST
{
  "snapshotId": "snapshot-${TIMESTAMP}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "gitRef": "${GIT_REF}",
  "label": "${LABEL:-}",
  "createdBy": "tools/snapshot.sh",
  "nexusDir": "${NEXUS_DIR}"
}
MANIFEST

# Create the tar archive
# Exclude the snapshots directory itself to avoid recursive inclusion
tar -czf "$SNAPSHOT_PATH" \
  --exclude=".nexus/06-checkpoints/snapshots" \
  --exclude=".nexus/07-artifacts/videos" \
  -C "$(dirname "$NEXUS_DIR")" \
  "$(basename "$NEXUS_DIR")" \
  2>/dev/null || {
    # Fallback without --exclude if not supported
    tar -czf "$SNAPSHOT_PATH" \
      -C "$(dirname "$NEXUS_DIR")" \
      "$(basename "$NEXUS_DIR")"
  }

# Check if snapshot was created
if [[ ! -f "$SNAPSHOT_PATH" ]]; then
  echo "ERROR: Snapshot creation failed"
  rm -f "$MANIFEST_FILE"
  exit 1
fi

SNAPSHOT_SIZE=$(du -sh "$SNAPSHOT_PATH" | awk '{print $1}')

# Write a separate manifest JSON alongside the snapshot
MANIFEST_DEST="${SNAPSHOTS_DIR}/snapshot-${TIMESTAMP}.manifest.json"
cp "$MANIFEST_FILE" "$MANIFEST_DEST"
rm -f "$MANIFEST_FILE"

echo ""
echo "Snapshot created successfully:"
echo "  Path:  $SNAPSHOT_PATH"
echo "  Size:  $SNAPSHOT_SIZE"
echo "  Ref:   $GIT_REF"
echo ""
echo "To restore this snapshot:"
echo "  tar -xzf $SNAPSHOT_PATH -C ."
echo ""

# Output just the path on the last line (for programmatic use)
echo "$SNAPSHOT_PATH"
