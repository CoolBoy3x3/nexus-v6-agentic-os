#!/usr/bin/env bash
# hash-check.sh — Check a file's SHA256 hash against .nexus/03-index/hashes.json
# Usage: ./tools/hash-check.sh <file-path>

set -euo pipefail

FILE_PATH="${1:-}"
HASHES_FILE=".nexus/03-index/hashes.json"

if [[ -z "$FILE_PATH" ]]; then
  echo "Usage: hash-check.sh <file-path>"
  echo "  Computes SHA256 of <file-path> and compares against .nexus/03-index/hashes.json"
  exit 1
fi

if [[ ! -f "$FILE_PATH" ]]; then
  echo "ERROR: File not found: $FILE_PATH"
  exit 1
fi

# Compute SHA256 of the actual file
if command -v sha256sum &>/dev/null; then
  ACTUAL_HASH=$(sha256sum "$FILE_PATH" | awk '{print $1}')
elif command -v shasum &>/dev/null; then
  ACTUAL_HASH=$(shasum -a 256 "$FILE_PATH" | awk '{print $1}')
else
  echo "ERROR: Neither sha256sum nor shasum is available"
  exit 1
fi

echo "File:        $FILE_PATH"
echo "Actual hash: $ACTUAL_HASH"

# If no hashes file, just print the hash
if [[ ! -f "$HASHES_FILE" ]]; then
  echo "INFO: No hashes file found at $HASHES_FILE — nothing to compare against"
  echo "INFO: Actual SHA256: $ACTUAL_HASH"
  exit 0
fi

# Look up the expected hash in hashes.json
# Use node/jq if available, fall back to python
if command -v node &>/dev/null; then
  EXPECTED_HASH=$(node -e "
    const data = JSON.parse(require('fs').readFileSync('$HASHES_FILE', 'utf8'));
    const entry = data['$FILE_PATH'] || data['./$FILE_PATH'];
    if (!entry) { process.stdout.write('NOT_FOUND'); process.exit(0); }
    const hash = typeof entry === 'string' ? entry : (entry.sha256 || entry.hash || '');
    process.stdout.write(hash);
  " 2>/dev/null || echo "NOT_FOUND")
elif command -v python3 &>/dev/null; then
  EXPECTED_HASH=$(python3 -c "
import json, sys
with open('$HASHES_FILE') as f:
    data = json.load(f)
entry = data.get('$FILE_PATH') or data.get('./$FILE_PATH')
if not entry:
    print('NOT_FOUND')
    sys.exit(0)
if isinstance(entry, str):
    print(entry)
else:
    print(entry.get('sha256') or entry.get('hash') or 'NOT_FOUND')
" 2>/dev/null || echo "NOT_FOUND")
elif command -v jq &>/dev/null; then
  EXPECTED_HASH=$(jq -r --arg key "$FILE_PATH" '.[$key] // .[$key | ltrimstr("./")]? // "NOT_FOUND"' "$HASHES_FILE" 2>/dev/null || echo "NOT_FOUND")
else
  echo "INFO: No node/python3/jq available — cannot parse hashes.json"
  echo "INFO: Actual SHA256: $ACTUAL_HASH"
  exit 0
fi

if [[ "$EXPECTED_HASH" == "NOT_FOUND" || -z "$EXPECTED_HASH" ]]; then
  echo "INFO: File not found in hashes.json — it may be a new file"
  echo "INFO: Actual SHA256: $ACTUAL_HASH"
  exit 0
fi

echo "Expected:    $EXPECTED_HASH"
echo ""

if [[ "$ACTUAL_HASH" == "$EXPECTED_HASH" ]]; then
  echo "RESULT: MATCH — file matches the indexed hash"
  exit 0
else
  echo "RESULT: DRIFT — file hash does not match the index"
  echo ""
  echo "The file has been modified since the last 'nexus build-index' run."
  echo "Run 'nexus build-index' to update the hash index, or investigate the drift."
  exit 1
fi
