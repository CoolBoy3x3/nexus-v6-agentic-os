#!/usr/bin/env bash
# rollback.sh — Roll back to a Nexus checkpoint
# Usage:
#   ./tools/rollback.sh                    # List available checkpoints
#   ./tools/rollback.sh <checkpoint-id>    # Roll back to a specific checkpoint

set -euo pipefail

CHECKPOINT_ID="${1:-}"
CHECKPOINTS_REFS_DIR=".nexus/06-checkpoints/refs"
CHECKPOINTS_SNAPSHOTS_DIR=".nexus/06-checkpoints/snapshots"
GIT_REFS_PREFIX="refs/nexus/checkpoints"

# Verify we are in a Nexus project
if [[ ! -d ".nexus" ]]; then
  echo "ERROR: .nexus/ directory not found. Are you in a Nexus project root?"
  exit 1
fi

# Verify we are in a git repo
if ! git rev-parse --git-dir &>/dev/null 2>&1; then
  echo "ERROR: Not inside a git repository. Rollback requires git."
  exit 1
fi

list_checkpoints() {
  echo "Available Nexus Checkpoints"
  echo "==========================="
  echo ""

  local found=0

  # List from refs JSON files
  if [[ -d "$CHECKPOINTS_REFS_DIR" ]]; then
    for ref_file in "$CHECKPOINTS_REFS_DIR"/*.json; do
      if [[ -f "$ref_file" ]]; then
        found=1
        local ckpt_id git_ref created_at task_id
        if command -v node &>/dev/null; then
          ckpt_id=$(node -e "const d=JSON.parse(require('fs').readFileSync('$ref_file','utf8')); process.stdout.write(d.id||'unknown')")
          git_ref=$(node -e "const d=JSON.parse(require('fs').readFileSync('$ref_file','utf8')); process.stdout.write(d.gitRef||'unknown')")
          created_at=$(node -e "const d=JSON.parse(require('fs').readFileSync('$ref_file','utf8')); process.stdout.write(d.createdAt||'unknown')")
          task_id=$(node -e "const d=JSON.parse(require('fs').readFileSync('$ref_file','utf8')); process.stdout.write(d.taskId||'none')")
        else
          ckpt_id=$(basename "$ref_file" .json)
          git_ref="(parse node to see ref)"
          created_at="(parse node to see date)"
          task_id="(parse node to see task)"
        fi
        echo "  ID:      $ckpt_id"
        echo "  Task:    $task_id"
        echo "  Created: $created_at"
        echo "  Git ref: $git_ref"
        echo ""
      fi
    done
  fi

  # Also list from git refs
  local git_checkpoints
  git_checkpoints=$(git for-each-ref --format="%(refname:short) %(creatordate:iso)" "$GIT_REFS_PREFIX/" 2>/dev/null || true)
  if [[ -n "$git_checkpoints" ]]; then
    echo "Git checkpoint refs:"
    echo "$git_checkpoints" | while read -r refname date; do
      echo "  $refname  ($date)"
    done
    echo ""
  fi

  if [[ $found -eq 0 ]] && [[ -z "$git_checkpoints" ]]; then
    echo "No checkpoints found."
    echo ""
    echo "Checkpoints are created automatically before each task execution."
    echo "Run 'nexus execute' to create checkpoints."
  fi
}

do_rollback() {
  local ckpt_id="$1"
  local ref_file="$CHECKPOINTS_REFS_DIR/${ckpt_id}.json"
  local git_ref=""

  echo "Nexus Rollback"
  echo "=============="
  echo "Checkpoint: $ckpt_id"
  echo ""

  # Find the git ref for this checkpoint
  if [[ -f "$ref_file" ]]; then
    if command -v node &>/dev/null; then
      git_ref=$(node -e "const d=JSON.parse(require('fs').readFileSync('$ref_file','utf8')); process.stdout.write(d.gitRef||'')")
    fi
  fi

  # Try the git refs namespace directly
  local full_git_ref="${GIT_REFS_PREFIX}/${ckpt_id}"
  if git rev-parse "$full_git_ref" &>/dev/null 2>&1; then
    git_ref="$full_git_ref"
  fi

  if [[ -z "$git_ref" ]]; then
    # Try treating checkpoint ID as a git ref directly
    if git rev-parse "$ckpt_id" &>/dev/null 2>&1; then
      git_ref="$ckpt_id"
    else
      echo "ERROR: Could not find git ref for checkpoint '$ckpt_id'"
      echo ""
      echo "Available checkpoints:"
      list_checkpoints
      exit 1
    fi
  fi

  local commit_sha
  commit_sha=$(git rev-parse "$git_ref" 2>/dev/null || echo "")

  if [[ -z "$commit_sha" ]]; then
    echo "ERROR: Git ref '$git_ref' does not resolve to a commit"
    exit 1
  fi

  echo "Git ref:    $git_ref"
  echo "Commit:     $commit_sha"
  echo ""

  # Show what will change
  echo "Changes that will be reverted:"
  git diff --stat HEAD "$commit_sha" 2>/dev/null | head -20 || true
  echo ""

  # Confirm
  echo "WARNING: This will run 'git reset --hard $commit_sha'"
  echo "All uncommitted changes will be lost."
  echo ""
  read -rp "Type 'yes' to confirm rollback: " confirm
  if [[ "$confirm" != "yes" ]]; then
    echo "Rollback cancelled."
    exit 0
  fi

  echo ""
  echo "Rolling back..."
  git reset --hard "$commit_sha"

  echo ""
  echo "Rollback complete."
  echo ""
  echo "The repository is now at: $commit_sha"
  echo ""
  echo "If a .nexus/ snapshot is available for this checkpoint, restore it with:"
  local snapshot_path="$CHECKPOINTS_SNAPSHOTS_DIR/snapshot-*.tar.gz"
  echo "  ls $snapshot_path"
  echo "  tar -xzf <snapshot-path> -C ."
  echo ""
  echo "Run 'nexus doctor' to verify the workspace state."
}

# Main logic
if [[ -z "$CHECKPOINT_ID" ]]; then
  list_checkpoints
else
  do_rollback "$CHECKPOINT_ID"
fi
