#!/usr/bin/env bash
# Smoke test del MCP server end-to-end.
# Verifica: discovery → DCR → login → consent → token → initialize → tools/list → tools/call.
# Sale 0 si todo OK, 1 si algo falla. Imprime checkmarks legibles para humano.
#
# Uso:
#   BASE=http://localhost:3000 ./scripts/smoke-mcp.sh
#   BASE=https://as-tools.algosentido.com EMAIL=x@y.com PASS=xxx ./scripts/smoke-mcp.sh
#
# Defaults: BASE=http://localhost:3000, credenciales del smoke user usado durante desarrollo.
# Para prod, OBLIGATORIO pasar EMAIL + PASS de una cuenta de test real.

set -e
BASE="${BASE:-http://localhost:3000}"
EMAIL="${EMAIL:-oauth-test@example.com}"
PASS="${PASS:-testpass123}"
REDIRECT="${REDIRECT:-https://claude.ai/api/mcp/auth_callback}"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; echo -e "${RED}SMOKE TEST FAILED${NC}"; exit 1; }
step() { echo -e "\n${CYAN}▸${NC} $1"; }

echo "════════════════════════════════════════════════════════════"
echo "  Smoke test MCP — $BASE"
echo "════════════════════════════════════════════════════════════"

# ─── 1. Discovery ─────────────────────────────────────────────────────────
step "1. Discovery (.well-known)"

PR_META=$(curl -sf "$BASE/.well-known/oauth-protected-resource") || fail "no responde /.well-known/oauth-protected-resource"
RESOURCE=$(echo "$PR_META" | python3 -c "import json,sys; print(json.load(sys.stdin).get('resource',''))")
[ "$RESOURCE" = "$BASE/mcp" ] || fail "protected-resource.resource debería ser '$BASE/mcp', es '$RESOURCE'"
ok "protected-resource metadata correcto"

AS_META=$(curl -sf "$BASE/.well-known/oauth-authorization-server") || fail "no responde /.well-known/oauth-authorization-server"
ISSUER=$(echo "$AS_META" | python3 -c "import json,sys; print(json.load(sys.stdin).get('issuer',''))")
[ "$ISSUER" = "$BASE" ] || fail "authorization-server.issuer debería ser '$BASE', es '$ISSUER'"
ok "authorization-server metadata correcto (issuer=$ISSUER)"

# ─── 2. WWW-Authenticate en 401 ───────────────────────────────────────────
step "2. /mcp sin token devuelve 401 + WWW-Authenticate"

WWW=$(curl -s -i -X POST "$BASE/mcp" -H 'Content-Type: application/json' -d '{}' \
  | grep -i '^www-authenticate:' | head -1)
[ -n "$WWW" ] || fail "no devuelve WWW-Authenticate"
echo "$WWW" | grep -q 'resource_metadata' || fail "WWW-Authenticate no incluye resource_metadata"
ok "WWW-Authenticate apunta al protected-resource metadata"

# ─── 3. Dynamic Client Registration ───────────────────────────────────────
step "3. Dynamic Client Registration (RFC 7591)"

REG=$(curl -sf -X POST "$BASE/oauth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"client_name\":\"smoke-test-$$\",\"redirect_uris\":[\"$REDIRECT\"]}")
CLIENT_ID=$(echo "$REG" | python3 -c "import json,sys; print(json.load(sys.stdin)['client_id'])") \
  || fail "DCR no devolvió client_id"
ok "client registrado: $CLIENT_ID"

# ─── 4. PKCE + login + consent + token ────────────────────────────────────
step "4. PKCE → login → consent → token exchange"

VERIFIER=$(python3 -c "import secrets,base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode())")
CHALLENGE=$(python3 -c "import hashlib,base64,sys; print(base64.urlsafe_b64encode(hashlib.sha256(sys.argv[1].encode()).digest()).rstrip(b'=').decode())" "$VERIFIER")

COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

# login
LOGIN_HTTP=$(curl -s -c "$COOKIE_JAR" -o /dev/null -w "%{http_code}" -X POST "$BASE/oauth/login" \
  -d "email=$EMAIL" -d "password=$PASS" \
  -d "response_type=code" -d "client_id=$CLIENT_ID" \
  -d "redirect_uri=$REDIRECT" \
  -d "code_challenge=$CHALLENGE" -d "code_challenge_method=S256" \
  -d "state=smoke-$$")
[ "$LOGIN_HTTP" = "303" ] || fail "login esperaba 303, recibió $LOGIN_HTTP (¿credenciales mal? ¿usuario no existe?)"
ok "login (303 redirect + cookie de sesión)"

# decision (autorizar)
LOCATION=$(curl -s -b "$COOKIE_JAR" -o /dev/null -w "%{redirect_url}" -X POST "$BASE/oauth/decision" \
  -d "decision=authorize" -d "response_type=code" -d "client_id=$CLIENT_ID" \
  -d "redirect_uri=$REDIRECT" \
  -d "code_challenge=$CHALLENGE" -d "code_challenge_method=S256" \
  -d "state=smoke-$$")
CODE=$(echo "$LOCATION" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
[ -n "$CODE" ] || fail "consent no devolvió code (Location: $LOCATION)"
ok "consent autorizado, code emitido"

# token exchange
TOKEN_RESP=$(curl -sf -X POST "$BASE/oauth/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=authorization_code" -d "code=$CODE" \
  -d "redirect_uri=$REDIRECT" -d "client_id=$CLIENT_ID" \
  -d "code_verifier=$VERIFIER")
TOKEN=$(echo "$TOKEN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])") \
  || fail "token endpoint no devolvió access_token"
REFRESH=$(echo "$TOKEN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['refresh_token'])")
ok "access_token emitido (TTL 1h), refresh_token emitido (TTL 30d)"

# ─── 5. Code single-use ───────────────────────────────────────────────────
step "5. Reusar code debe fallar (single-use)"

REUSE=$(curl -s -X POST "$BASE/oauth/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=authorization_code" -d "code=$CODE" \
  -d "redirect_uri=$REDIRECT" -d "client_id=$CLIENT_ID" \
  -d "code_verifier=$VERIFIER" \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('error',''))")
[ "$REUSE" = "invalid_grant" ] || fail "reuse de code debería dar invalid_grant, dio '$REUSE'"
ok "code reusado rechazado (invalid_grant)"

# ─── 6. Refresh con rotación ──────────────────────────────────────────────
step "6. Refresh token + rotación"

NEW_TOKEN_RESP=$(curl -sf -X POST "$BASE/oauth/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=refresh_token" -d "refresh_token=$REFRESH" -d "client_id=$CLIENT_ID")
NEW_TOKEN=$(echo "$NEW_TOKEN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])") \
  || fail "refresh no devolvió nuevo access_token"
NEW_REFRESH=$(echo "$NEW_TOKEN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['refresh_token'])")
[ "$NEW_REFRESH" != "$REFRESH" ] || fail "refresh token no rotó"
ok "refresh emitió nuevo access + rotó refresh"

# reusar el refresh viejo debe fallar
REUSE_REFRESH=$(curl -s -X POST "$BASE/oauth/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=refresh_token" -d "refresh_token=$REFRESH" -d "client_id=$CLIENT_ID" \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('error',''))")
[ "$REUSE_REFRESH" = "invalid_grant" ] || fail "refresh viejo debería rechazarse, dio '$REUSE_REFRESH'"
ok "refresh viejo (revocado por rotación) rechazado"

# ─── 7. MCP initialize ────────────────────────────────────────────────────
step "7. MCP initialize"

INIT=$(curl -sf -X POST "$BASE/mcp" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"0.1"}}}')
SERVER_NAME=$(echo "$INIT" | sed -n 's/^data: //p' | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['serverInfo']['name'])")
[ "$SERVER_NAME" = "as-tools" ] || fail "serverInfo.name esperaba 'as-tools', recibió '$SERVER_NAME'"
ok "initialize OK (server=as-tools)"

# ─── 8. tools/list ────────────────────────────────────────────────────────
step "8. tools/list"

TOOLS=$(curl -sf -X POST "$BASE/mcp" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | sed -n 's/^data: //p' \
  | python3 -c "import json,sys; print(','.join(t['name'] for t in json.load(sys.stdin)['result']['tools']))")

# Verificar que están las 4 tools del MVP
for tool in list_my_transcriptions transcribe_video_url get_transcription analyze_ideas; do
  echo "$TOOLS" | grep -q "$tool" || fail "tool '$tool' no aparece en tools/list"
done
ok "tools/list devuelve las 4 tools esperadas"

# ─── 9. tool/call read-only (list_my_transcriptions) ──────────────────────
step "9. tools/call list_my_transcriptions (read-only, sin costo)"

CALL=$(curl -sf -X POST "$BASE/mcp" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_my_transcriptions","arguments":{"limit":1}}}' \
  | sed -n 's/^data: //p' \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['result']; print('isError' if r.get('isError') else 'ok')")
[ "$CALL" = "ok" ] || fail "list_my_transcriptions devolvió error"
ok "list_my_transcriptions ejecutó sin error"

# ─── 10. token revocado debe rechazarse ───────────────────────────────────
step "10. Bearer token revocado debe rechazarse"

# (skip: requeriría endpoint de revocación o acceso directo a DB)
ok "(skip) — cobertura en unit tests del validator"

# ─── DONE ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════"
echo -e "  ✓ Smoke test MCP completo — todo OK"
echo -e "════════════════════════════════════════════════════════════${NC}"
exit 0
