#!/bin/bash
# Sync Claude memories between git repo and local Claude config
# Usage: .claude/sync-memories.sh [push|pull]
#   push: copy local memories → repo (for committing)
#   pull: copy repo memories → local Claude (for new machine setup)

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
REPO_MEMORY="$REPO_ROOT/.claude/memory"

# Si estamos en un worktree, las memorias de Claude viven indexadas por el path
# del repo principal (Claude las guarda según el filesystem real). Detectamos el
# repo "canónico" via --git-common-dir para que el push/pull funcione desde cualquier worktree.
COMMON_DIR="$(git rev-parse --git-common-dir 2>/dev/null)"
if [ -n "$COMMON_DIR" ]; then
  case "$COMMON_DIR" in
    /*) CANONICAL_ROOT="$(dirname "$COMMON_DIR")" ;;
    *)  CANONICAL_ROOT="$(cd "$REPO_ROOT" && cd "$(dirname "$COMMON_DIR")" && pwd)" ;;
  esac
else
  CANONICAL_ROOT="$REPO_ROOT"
fi

SAFE_PATH=$(echo "$CANONICAL_ROOT" | sed 's|/|-|g')
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
