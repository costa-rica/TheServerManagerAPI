#!/usr/bin/env bash
set -euo pipefail

CSV="/home/nick/nick-systemctl.csv"
DEST="/etc/sudoers.d/nick-systemctl"
TMP="$(mktemp)"

tail -n +2 "$CSV" | tr -d '\r' | \
while IFS=, read -r user runas tag cmd action unit || [[ -n "$user" ]]; do
  echo "$user $runas $tag $cmd $action $unit"
done > "$TMP"

sudo visudo -cf "$TMP"
sudo install -m 440 "$TMP" "$DEST"
rm -f "$TMP"