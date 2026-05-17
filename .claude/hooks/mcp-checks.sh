#!/usr/bin/env bash
# Hook Stop: chequeos de salud antes de cerrar la sesión, enfocados al MCP.
# No bloquea — solo imprime recordatorios a stderr para que se vean en el chat.
#
# Chequea (cuando se tocó código MCP/OAuth/services/schema):
#   1. Docs (docs/MCP.md, docs/CHANGELOG.md) en sync
#   2. Tests: si tocaste código de producción y no creaste/actualizaste .test.js
#   3. Recordar correr npm test + smoke antes del commit

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

# ─── Detección ────────────────────────────────────────────────────────────
# Código de producción que justifica documentar + testear.
PROD_TOUCHED=$(echo "$CHANGED" | grep -E '^(api/mcp/|api/oauth/|api/services/|api/database/schema\.js|src/components/MCPAdmin\.jsx)' | grep -vE '\.test\.js$' | head -5)

# ¿Es solo del MCP/OAuth core (lo que requiere docs MCP.md)?
MCP_CORE_TOUCHED=$(echo "$CHANGED" | grep -E '^(api/mcp/|api/oauth/|api/database/schema\.js|src/components/MCPAdmin\.jsx)' | grep -vE '\.test\.js$' | head -1)

# Si no se tocó nada relevante → silencio
[ -z "$PROD_TOUCHED" ] && exit 0

# ¿Docs en sync?
DOCS_TOUCHED=$(echo "$CHANGED" | grep -E '^docs/(MCP|CHANGELOG)\.md' | head -1)

# ¿Se modificó algún test?
TESTS_TOUCHED=$(echo "$CHANGED" | grep -E '\.test\.js$' | head -1)

NEEDS_DOCS=$([ -n "$MCP_CORE_TOUCHED" ] && [ -z "$DOCS_TOUCHED" ] && echo yes)
NEEDS_TESTS=$([ -z "$TESTS_TOUCHED" ] && echo yes)

# ─── Output ───────────────────────────────────────────────────────────────
cat <<EOF >&2

────────────────────────────────────────────────────────────
🧪 CHEQUEOS PRE-COMMIT (MCP)
────────────────────────────────────────────────────────────

Tocaste código de producción en esta sesión:
EOF

echo "$PROD_TOUCHED" | sed 's/^/  • /' >&2

if [ "$NEEDS_DOCS" = "yes" ]; then
  cat <<'EOF' >&2

⚠️  DOCS DESACTUALIZADAS
  Cambiaste código del MCP/OAuth pero docs/MCP.md y docs/CHANGELOG.md
  no fueron modificados. Antes de commitear:
    • ¿Cambió arquitectura, endpoints o tools?     → actualiza docs/MCP.md
    • ¿Es un cambio user-visible o tool nueva?     → entrada en docs/CHANGELOG.md
EOF
fi

if [ "$NEEDS_TESTS" = "yes" ]; then
  cat <<'EOF' >&2

⚠️  TESTS POSIBLEMENTE FALTANTES
  No se modificó ningún archivo .test.js en esta sesión, pero sí código
  de producción. Considera:
    • ¿La lógica nueva tiene tests que la cubran?
    • Si es un OAuth/cuota/audit cambio → tests en api/oauth/*.test.js
      o api/mcp/audit.test.js (mockear DB con vi.mock como ya está hecho).
    • Si es una tool nueva del MCP → al menos un test del handler.
    • Si tocaste services (transcribeService, etc.) → test del happy path.

  Ver docs/MCP.md sección "Testing" para patrones.
EOF
fi

cat <<'EOF' >&2

✅ ANTES DE COMMITEAR, CORRE:
  npm test                  # unit tests (~1s, debe pasar todo)
  npm run smoke:mcp         # smoke e2e contra localhost (requiere server arriba)

✅ DESPUÉS DEL DEPLOY (Render):
  BASE=https://as-tools.algosentido.com \
    EMAIL=… PASS=… npm run smoke:mcp

────────────────────────────────────────────────────────────

EOF

exit 0
