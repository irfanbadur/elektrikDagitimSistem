#!/bin/bash
# Hızlı deploy: local build + sunucuya gönder + restart
# Kullanım: bash deploy.sh

SERVER="root@136.144.201.167"
PORT="23422"
REMOTE_DIR="/opt/enerjabze"

echo "📦 Build ediliyor..."
cd client && npx vite build || exit 1
cd ..

echo "📤 Dosyalar gönderiliyor..."
scp -P $PORT -r client/dist/* $SERVER:$REMOTE_DIR/client/dist/

echo "🔄 Sunucuda git pull + restart..."
ssh -p $PORT $SERVER "cd $REMOTE_DIR && git fetch && git reset --hard origin/main && pm2 restart enerjabze && echo '✅ DEPLOY TAMAM'"
