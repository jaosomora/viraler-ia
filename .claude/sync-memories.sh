#!/bin/bash
# Sync Claude memories between git repo and local Claude config
# Usage: .claude/sync-memories.sh [push|pull]
#   push: copy local memories → repo (for committing)
#   pull: copy repo memories → local Claude (for new machine setup)

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
REPO_MEMORY="$REPO_ROOT/.claude/memory"

# Build the Claude project path from repo root
SAFE_PATH=$(echo "$REPO_ROOT" | sed 's|/|-|g')
LOCAL_MEMORY="$HOME/.claude/projects/$SAFE_PATH/memory"

if [ "$1" = "push" ]; then
  if [ -d "$LOCAL_MEMORY" ]; then
    mkdir -p "$REPO_MEMORY"
    cp "$LOCAL_MEMORY"/*.md "$REPO_MEMORY/" 2>/dev/null
    echo "Memories pushed: $LOCAL_MEMORY → $REPO_MEMORY"
  else
    echo "No local memories found at $LOCAL_MEMORY"
  fi
elif [ "$1" = "pull" ]; then
  if [ -d "$REPO_MEMORY" ]; then
    mkdir -p "$LOCAL_MEMORY"
    cp "$REPO_MEMORY"/*.md "$LOCAL_MEMORY/" 2>/dev/null
    echo "Memories pulled: $REPO_MEMORY → $LOCAL_MEMORY"
  else
    echo "No repo memories found at $REPO_MEMORY"
  fi
else
  echo "Usage: $0 [push|pull]"
  echo "  push - local Claude memories → git repo"
  echo "  pull - git repo → local Claude memories"
fi
