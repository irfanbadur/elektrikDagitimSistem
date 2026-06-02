#!/bin/bash
# Tek seferlik: yerel SSH public key'i sunucudaki authorized_keys'e ekler.
# Sonra deploy-full.sh şifresiz çalışır.

SERVER_IP="136.144.201.167"
SERVER_PORT="23422"
SERVER_USER="root"

if [ ! -f ~/.ssh/id_rsa.pub ]; then
  echo "~/.ssh/id_rsa.pub yok — yeni anahtar üretiliyor..."
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N "" || { echo "Anahtar üretilemedi"; exit 1; }
fi

PUB=$(cat ~/.ssh/id_rsa.pub)

echo "Sunucuya public key ekleniyor — şifre sorulacak: 7B0RNOv9zL3t"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && grep -qF '$PUB' ~/.ssh/authorized_keys 2>/dev/null || echo '$PUB' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'OK: anahtar eklendi'"

echo ""
echo "✅ Test: şifresiz bağlantı..."
if ssh -p $SERVER_PORT -o BatchMode=yes -o PreferredAuthentications=publickey -o ConnectTimeout=10 \
       $SERVER_USER@$SERVER_IP 'echo "Bağlantı OK - $(hostname)"'; then
  echo ""
  echo "🎉 SSH key kurulumu tamam. Şimdi: bash deploy-full.sh"
else
  echo "❌ Key auth çalışmıyor — manuel kontrol et."
fi
