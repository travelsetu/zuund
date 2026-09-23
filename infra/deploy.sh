#!/usr/bin/env bash
# Zero-downtime deploy of zuund on the VPS. Run as root from /srv/zuund after
# the checkout is at the commit to deploy (the GitHub workflow does the fetch).
#
#   api / web   pm2 cluster rolling reload: new instance up and ready before the
#               old one stops, so the port is never unheld.
#   admin       built to a release dir, published by an atomic symlink swap.
#   postgres    docker container; `up -d` is a no-op when nothing changed.
#   migrations  `prisma migrate deploy` applies pending ones only. Because both
#               API versions answer during the rolling reload, a migration must
#               suit both: add and backfill now, drop or rename in a later deploy.
set -euo pipefail

ROOT=/srv/zuund
ADMIN_ROOT=/srv/zuund-admin
APP_ROOT=/srv/zuund-app
HOSTS=(zuund.com www.zuund.com admin.zuund.com app.zuund.com api.zuund.com)

cd "$ROOT"
sha=$(git rev-parse --short HEAD)
echo "==> deploying $sha: $(git log -1 --pretty=%s)"

[ -f .env ] || { echo "!! $ROOT/.env is missing; copy .env.example and fill it in"; exit 1; }
node scripts/link-env.mjs
# Uploaded files live outside the checkout so a deploy never touches them.
mkdir -p /srv/zuund-uploads

echo "==> postgres"
docker compose --env-file .env -f docker-compose.yml -p zuund up -d --wait

echo "==> install"
pnpm install --frozen-lockfile

echo "==> migrate"
pnpm --filter @zuund/backend prisma:deploy
# Idempotent: creates the admin from ADMIN_* only if that email does not exist.
pnpm --filter @zuund/backend prisma:seed

echo "==> geoip"
# IP → city database for GET /api/geo; skipped until MAXMIND_* keys are in .env.
# Lives outside the checkout (set GEOIP_DB_PATH=/srv/zuund-geoip/GeoLite2-City.mmdb).
node scripts/geoip-update.mjs || echo "    geoip update failed; keeping the previous database"

echo "==> build"
pnpm build

echo "==> publish admin dashboard"
release="$ADMIN_ROOT/releases/$sha"
mkdir -p "$release"
rsync -a --delete apps/admin-dashboard/dist/ "$release/"
chmod -R a+rX "$ADMIN_ROOT"
ln -sfnT "$release" "$ADMIN_ROOT/current"
# Keep the last five releases for rollback.
ls -1dt "$ADMIN_ROOT"/releases/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf
echo "    admin -> $release"

echo "==> publish web app (app.zuund.com)"
# The Expo app exported for browsers; same release/symlink scheme as the admin.
app_release="$APP_ROOT/releases/$sha"
pnpm --filter @zuund/mobile build:web
mkdir -p "$app_release"
rsync -a --delete apps/mobile/dist-web/ "$app_release/"
chmod -R a+rX "$APP_ROOT"
ln -sfnT "$app_release" "$APP_ROOT/current"
ls -1dt "$APP_ROOT"/releases/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf
echo "    app -> $app_release"

echo "==> nginx + tls"
# Each site has two files in infra/nginx: <site>.conf (TLS, the real one) and
# <site>.http.conf (plain HTTP bootstrap). A site gets the TLS file as soon as
# every hostname it serves has a certificate, and the bootstrap file until
# then. certbot is only ever asked for certificate files (certonly, webroot);
# it never rewrites nginx config. Rewriting it — the `certbot --nginx` way —
# means copying a plain-HTTP file over the live one and reloading, and for the
# second or two until certbot puts the TLS lines back every HTTPS handshake
# for that host fails. That is downtime, and it happened on every deploy.
SITES=("zuund:zuund.com www.zuund.com" "admin.zuund:admin.zuund.com" "app.zuund:app.zuund.com" "api.zuund:api.zuund.com")

has_cert() { [ -f "/etc/letsencrypt/live/$1/fullchain.pem" ]; }

render_nginx() {
  local changed=0 site hosts h src dst
  for entry in "${SITES[@]}"; do
    site=${entry%%:*}; hosts=${entry#*:}
    src="infra/nginx/$site.conf"
    for h in $hosts; do has_cert "$h" || src="infra/nginx/$site.http.conf"; done
    dst="/etc/nginx/sites-available/$site"
    if ! cmp -s "$src" "$dst"; then
      cp "$src" "$dst"; changed=1
      echo "    $site <- $(basename "$src")"
    fi
    [ -L "/etc/nginx/sites-enabled/$site" ] || { ln -sf "$dst" "/etc/nginx/sites-enabled/$site"; changed=1; }
  done
  # Reload only when something changed: a reload is graceful, but there is no
  # point asking for one on every deploy.
  if [ "$changed" = 1 ]; then nginx -t && systemctl reload nginx; else echo "    nginx unchanged"; fi
}

# Asks the zone's own nameservers, not the box's resolver. Let's Encrypt looks
# the name up authoritatively, so that is the answer that matters — and the
# host's upstream resolver was seen holding a stale "no such name" for ten
# minutes after a record was added, which would have skipped issuance.
resolve_authoritative() {
  local host="$1" zone ns
  zone=${host#*.}; [[ "$zone" == *.* ]] || zone="$host"
  ns=$(dig +short NS "$zone" | head -1)
  if [ -n "$ns" ]; then dig +short A "$host" "@$ns" | tail -1; else dig +short A "$host" | tail -1; fi
}

issue_missing_certs() {
  local my_ip resolved host
  my_ip=$(curl -s --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
  for host in "${HOSTS[@]}"; do
    has_cert "$host" && continue
    resolved=$(resolve_authoritative "$host")
    if [ "$resolved" != "$my_ip" ]; then
      echo "    $host: no certificate; DNS -> '${resolved:-none}' (not $my_ip). Served over http until it points here."
      continue
    fi
    # The bootstrap config for this host is live (render_nginx ran first), so
    # the challenge file is reachable at /.well-known/acme-challenge/.
    if certbot certonly --webroot -w /var/www/html -d "$host" -n --agree-tos \
         --register-unsafely-without-email --keep-until-expiring \
         --deploy-hook 'systemctl reload nginx' >/dev/null 2>&1; then
      echo "    $host: certificate issued"
    else
      echo "    $host: certificate issue FAILED (see /var/log/letsencrypt/letsencrypt.log)"
    fi
  done
}

render_nginx          # bootstrap configs for anything still without a certificate
issue_missing_certs   # may add certificates
render_nginx          # promote those sites to their TLS config

echo "==> pm2"
# startOrReload: first deploy starts, later ones roll instances in place.
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save --force
pm2 list

echo "==> health"
ok=0
check() {
  local host="$1" path="$2" code=""
  for _ in $(seq 1 12); do
    code=$(curl -sL -o /dev/null -w '%{http_code}' \
      --resolve "$host:80:127.0.0.1" --resolve "$host:443:127.0.0.1" \
      --max-time 15 "http://$host$path" || true)
    [ "$code" = "200" ] && break
    sleep 5
  done
  printf '    %-32s %s\n' "$host$path" "$code"
  [ "$code" = "200" ] || ok=1
}
check api.zuund.com /api/health
check zuund.com /
check admin.zuund.com /
check app.zuund.com /
[ $ok -eq 0 ] && echo "==> DONE: $sha is live" || { echo "!! a check failed"; exit 1; }
