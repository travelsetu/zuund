#!/usr/bin/env bash
# Zero-downtime deploy of jhoond on the VPS. Run as root from /srv/jhoond after
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

ROOT=/srv/jhoond
ADMIN_ROOT=/srv/jhoond-admin
HOSTS=(zuund.com www.zuund.com admin.zuund.com api.zuund.com)

cd "$ROOT"
sha=$(git rev-parse --short HEAD)
echo "==> deploying $sha: $(git log -1 --pretty=%s)"

[ -f .env ] || { echo "!! $ROOT/.env is missing; copy .env.example and fill it in"; exit 1; }
node scripts/link-env.mjs

echo "==> postgres"
docker compose --env-file .env -f docker-compose.yml -p jhoond up -d --wait

echo "==> install"
pnpm install --frozen-lockfile

echo "==> migrate"
pnpm --filter @jhoond/backend prisma:deploy
# Idempotent: creates the admin from ADMIN_* only if that email does not exist.
pnpm --filter @jhoond/backend prisma:seed

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

echo "==> nginx"
for f in zuund admin.zuund api.zuund; do
  cp "infra/nginx/$f.conf" "/etc/nginx/sites-available/$f"
  ln -sf "/etc/nginx/sites-available/$f" "/etc/nginx/sites-enabled/$f"
done
nginx -t && systemctl reload nginx

echo "==> tls"
# The nginx files in git are plain HTTP. For every host that already has a
# certificate, ask certbot to write its TLS lines back into the fresh copy.
# For a host that has none yet, issue one as soon as its DNS points here.
my_ip=$(curl -s --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
for host in "${HOSTS[@]}"; do
  if [ -d "/etc/letsencrypt/live/$host" ] || certbot certificates 2>/dev/null | grep -q "Domains:.*\b$host\b"; then
    certbot --nginx --reinstall -d "$host" --redirect -n >/dev/null 2>&1 \
      && echo "    $host: tls reinstalled" \
      || echo "    $host: tls reinstall FAILED"
  else
    resolved=$(dig +short A "$host" | tail -1)
    if [ "$resolved" = "$my_ip" ]; then
      certbot --nginx -d "$host" --redirect -n --agree-tos --keep-until-expiring \
        --register-unsafely-without-email >/dev/null 2>&1 \
        && echo "    $host: certificate issued" \
        || echo "    $host: certificate issue FAILED (see /var/log/letsencrypt)"
    else
      echo "    $host: no certificate and DNS -> '${resolved:-none}' (not $my_ip); served over http until it points here"
    fi
  fi
done
nginx -t && systemctl reload nginx

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
[ $ok -eq 0 ] && echo "==> DONE: $sha is live" || { echo "!! a check failed"; exit 1; }
