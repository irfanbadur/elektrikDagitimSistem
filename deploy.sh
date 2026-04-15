#!/bin/bash
# Hızlı deploy: local build + sunucuya gönder + restart
# Kullanım: bash deploy.sh

SERVER="root@136.144.201.167"
REMOTE_DIR="/opt/enerjabze"

echo "📦 Build ediliyor..."
cd client && npx vite build || exit 1
cd ..

echo "📤 Dosyalar gönderiliyor..."
# Build çıktısını gönder
scp -r client/dist/* $SERVER:$REMOTE_DIR/client/dist/

# Server kodlarını git ile güncelle
ssh $SERVER "cd $REMOTE_DIR && git pull && pm2 restart enerjabze && echo '✅ DEPLOY TAMAM'"
