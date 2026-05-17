#!/usr/bin/env bash
# Recordatorio: si tocaste código del MCP/OAuth en esta sesión, no olvides actualizar docs.
# Se dispara en Stop (al cerrar la sesión). Lee diff vs HEAD del worktree actual.
# No bloquea, solo imprime a stderr para que el aviso aparezca en la conversación.

REPO="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$REPO" ] && exit 0

cd "$REPO" || exit 0

# Archivos cambiados (staged + unstaged + untracked) vs HEAD
CHANGED=$(
  { git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } | sort -u
)

# ¿Tocamos código del MCP/OAuth o esquema relacionado?
TOUCHED_MCP=$(echo "$CHANGED" | grep -E '^(api/mcp/|api/oauth/|api/database/schema\.js|src/components/MCPAdmin\.jsx)' | head -1)
[ -z "$TOUCHED_MCP" ] && exit 0

# ¿Las docs también cambiaron?
TOUCHED_DOCS=$(echo "$CHANGED" | grep -E '^docs/(MCP|CHANGELOG)\.md' | head -1)
[ -n "$TOUCHED_DOCS" ] && exit 0

# MCP cambió, docs no → recordar
cat <<'EOF' >&2

⚠️  RECORDATORIO MCP DOCS
─────────────────────────
Tocaste archivos del MCP/OAuth en esta sesión pero docs/MCP.md y
docs/CHANGELOG.md no están modificados.

Antes de commitear, considera:
  • ¿Cambió la arquitectura, endpoints, o tools?    → actualiza docs/MCP.md
  • ¿Hiciste un cambio user-visible o nueva tool?   → entrada en docs/CHANGELOG.md
  • ¿Agregaste/cambiaste un scope OAuth o env var?  → ambos docs

Receta rápida: docs/MCP.md sección "4. Cómo agregar una tool nueva".
Para apagar este recordatorio temporalmente: comenta el hook en .claude/settings.json.

EOF

exit 0
