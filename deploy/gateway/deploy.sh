#!/usr/bin/env bash
# One-click deploy for the cpx-gateway reference server (Caddy auto-HTTPS + gateway).
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required. Install Docker, then re-run: https://docs.docker.com/engine/install/" >&2
  exit 1
}
docker compose version >/dev/null 2>&1 || {
  echo "Docker Compose v2 is required (the 'docker compose' subcommand)." >&2
  exit 1
}

if [ ! -f .env ]; then
  cp .env.example .env
  read -rp "Public domain (its DNS A/AAAA record must already point at this VPS), e.g. gw.example.com: " DOMAIN
  [ -n "$DOMAIN" ] || { echo "A domain is required." >&2; exit 1; }
  sed -i.bak "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env && rm -f .env.bak
  echo "Wrote .env (DOMAIN=${DOMAIN})."
fi

# sed prints nothing (and exits 0) when a key is absent, so `set -e` does not abort on a .env
# that sets only one of DOMAIN / DOMAINS (docker compose accepts either).
DOMAIN=$(sed -n 's/^DOMAIN=//p' .env | tail -n 1 | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')
DOMAINS=$(sed -n 's/^DOMAINS=//p' .env | tail -n 1)
DOMAINS=${DOMAINS:-$DOMAIN}
# Caddy takes {$DOMAINS} verbatim as site addresses and rejects "a,b" without a space:
# normalize any comma list to "a, b".
DOMAINS=$(printf '%s' "$DOMAINS" | sed -E 's/[[:space:]]*,[[:space:]]*/, /g; s/^[[:space:]]+|[[:space:]]+$//g')
DOMAIN=${DOMAIN:-${DOMAINS%%,*}}
[ -n "$DOMAIN" ] || { echo "DOMAIN or DOMAINS must be set in .env" >&2; exit 1; }
export DOMAINS

echo "Building and starting containers..."
docker compose up -d --build

cat <<EOF

✅ Deployed. DOMAIN=${DOMAIN} (Caddy serves: ${DOMAINS})

Next steps:
  1) Wait ~30s for Caddy to obtain the TLS certificate, then verify discovery:
       curl https://${DOMAIN}/.well-known/cpx-gateway

  2) Add an account (you'll be prompted for a password):
       docker compose exec gateway cpx-admin add-user <name> '<hidden-subscription-url>' --limit 3

  3) Generate the .cpx plugin file for your users (run from the repository root):
       node scripts/plugin/gen-cpx.mjs https://${DOMAIN}/oauth/authorize "Your Airport" https://${DOMAIN} your-airport.cpx

  4) Distribute your-airport.cpx. Users import it in Clash Party, log in via the
     system browser with the account you created, and the subscription loads automatically.

Manage:  docker compose exec gateway cpx-admin list-users | list-devices <name> | revoke-device <id>
Logs:    docker compose logs -f gateway
Update:  git pull && ./deploy.sh        (account data persists in the gateway_data volume)
EOF
