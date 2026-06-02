#!/bin/bash
# Tam deploy: kod + DB + uploads + frontend dist → sunucu.
# Önce: bash setup-ssh-key.sh çalıştırılmış olmalı (şifresiz erişim için).

set -e

SERVER_IP="136.144.201.167"
SERVER_PORT="23422"
SERVER_USER="root"
REMOTE_DIR="/opt/enerjabze"
TENANT="data/tenants/cakmakgrup"

SSH="ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP"
SCP="scp -P $SERVER_PORT"

TS=$(date +%Y%m%d-%H%M%S)
PROJE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJE_DIR"

echo "════════════════════════════════════════════════════════"
echo "🚀 ENERJABZE TAM DEPLOY — $TS"
echo "════════════════════════════════════════════════════════"

# ── 1) Yerel client build ─────────────────────────────────
echo ""
echo "📦 [1/9] Yerel frontend build..."
(cd client && npx vite build) || { echo "❌ Build hata"; exit 1; }

# ── 2) Yerel DB checkpoint ────────────────────────────────
echo ""
echo "💾 [2/9] Yerel DB WAL checkpoint..."
(cd server && node -e "
const D=require('better-sqlite3');
const db=new D('../$TENANT/elektratrack.db');
const r=db.pragma('wal_checkpoint(TRUNCATE)');
console.log('checkpoint:', JSON.stringify(r));
db.close();
")

DB_SIZE=$(stat -c%s "$TENANT/elektratrack.db" 2>/dev/null || stat -f%z "$TENANT/elektratrack.db")
UPL_SIZE=$(du -sh "$TENANT/uploads" | cut -f1)
echo "    DB: $DB_SIZE bayt | uploads: $UPL_SIZE"

# ── 3) Sunucuda pm2 stop + yedek al ───────────────────────
echo ""
echo "⏸️  [3/9] Sunucuda pm2 stop + yedek alma..."
$SSH "
  set -e
  pm2 stop enerjabze 2>/dev/null || true
  mkdir -p $REMOTE_DIR/$TENANT
  if [ -f $REMOTE_DIR/$TENANT/elektratrack.db ]; then
    cp $REMOTE_DIR/$TENANT/elektratrack.db $REMOTE_DIR/$TENANT/elektratrack.db.bak-$TS
    echo '   ✓ DB yedek: elektratrack.db.bak-$TS'
  fi
  if [ -d $REMOTE_DIR/$TENANT/uploads ]; then
    mv $REMOTE_DIR/$TENANT/uploads $REMOTE_DIR/$TENANT/uploads.bak-$TS
    echo '   ✓ uploads yedek: uploads.bak-$TS'
  fi
"

# ── 4) DB transfer ────────────────────────────────────────
echo ""
echo "📤 [4/9] DB transfer..."
$SCP "$TENANT/elektratrack.db" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/$TENANT/elektratrack.db"

# ── 5) Uploads transfer (tar + gzip boru hattı) ──────────
echo ""
echo "📤 [5/9] Uploads transfer ($UPL_SIZE) — sıkıştırarak gönderiliyor..."
echo "    (Boyuta bağlı: 5–60 dk arası sürebilir, sabırlı olun)"
tar -cf - -C "$TENANT" uploads | gzip -1 | \
  $SSH "cd $REMOTE_DIR/$TENANT && gunzip | tar -xf -"

# ── 6) Sunucuda git pull (server kod) ─────────────────────
echo ""
echo "🔄 [6/9] Sunucuda git pull..."
$SSH "cd $REMOTE_DIR && git fetch && git reset --hard origin/main && git log -1 --oneline"

# ── 7) npm install (yeni paket varsa) ─────────────────────
echo ""
echo "📦 [7/9] Sunucuda npm install (server)..."
$SSH "cd $REMOTE_DIR/server && npm install --omit=dev 2>&1 | tail -3"

# ── 8) Frontend dist transfer ─────────────────────────────
echo ""
echo "📤 [8/9] Frontend dist transfer..."
$SCP -r client/dist/* "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/client/dist/"

# ── 9) pm2 restart ────────────────────────────────────────
echo ""
echo "▶️  [9/9] PM2 restart..."
$SSH "pm2 restart enerjabze && pm2 list | head -15"

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ TAM DEPLOY TAMAM — $(date +%H:%M:%S)"
echo "🌐 http://enerjabze.com.tr"
echo "📦 Sunucudaki yedek: elektratrack.db.bak-$TS, uploads.bak-$TS"
echo "════════════════════════════════════════════════════════"
