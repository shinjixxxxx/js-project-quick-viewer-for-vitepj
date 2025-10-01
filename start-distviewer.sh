#!/usr/bin/env bash
set -euo pipefail

WORKDIR="/dockerd"
NODE="/usr/local/bin/node"   # ← `which node` で確認して絶対パスを書く
LOG="/dockerd/distviewer.log"

# 二重起動防止
if pgrep -f "${WORKDIR}/server.js" >/dev/null 2>&1; then
  exit 0
fi

cd "$WORKDIR"
export NODE_ENV=production

nohup "$NODE" "${WORKDIR}/server.js" >>"$LOG" 2>&1 &
disown
