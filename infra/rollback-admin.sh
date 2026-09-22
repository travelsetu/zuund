#!/usr/bin/env bash
# Point admin.zuund.com at the previous release. No rebuild, atomic.
# For the API/web, roll back by reverting the commit and pushing (or
# `git checkout <sha> && bash infra/deploy.sh` on the server).
set -euo pipefail
ADMIN_ROOT=/srv/zuund-admin
current=$(readlink -f "$ADMIN_ROOT/current")
prev=$(ls -1dt "$ADMIN_ROOT"/releases/*/ | sed 's:/$::' | grep -vx "$current" | head -1)
[ -n "$prev" ] || { echo "no previous release"; exit 1; }
ln -sfnT "$prev" "$ADMIN_ROOT/current"
echo "admin rolled back: $current -> $prev"
