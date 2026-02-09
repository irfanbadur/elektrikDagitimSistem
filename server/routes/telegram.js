const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/telegram/kullanicilar
router.get('/kullanicilar', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT tk.*, p.ad_soyad, p.gorev, e.ekip_adi
    FROM telegram_kullanicilar tk
    LEFT JOIN personel p ON tk.personel_id = p.id
    LEFT JOIN ekipler e ON p.ekip_id = e.id
    ORDER BY tk.kayit_tarihi DESC
  `).all();
  res.json({ success: true, data });
});

// POST /api/telegram/kullanicilar
router.post('/kullanicilar', (req, res) => {
  const db = getDb();
  const { telegram_id, personel_id } = req.body;
  if (!telegram_id || !personel_id) {
    return res.status(400).json({ success: false, error: 'telegram_id ve personel_id gerekli' });
  }
  db.prepare(`
    INSERT INTO telegram_kullanicilar (telegram_id, personel_id)
    VALUES (?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET personel_id = excluded.personel_id
  `).run(String(telegram_id), personel_id);
  res.json({ success: true });
});

// DELETE /api/telegram/kullanicilar/:id
router.delete('/kullanicilar/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM telegram_kullanicilar WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/telegram/mesaj-log
router.get('/mesaj-log', (req, res) => {
  const db = getDb();
  const { tarih, durum, limit = 100, offset = 0 } = req.query;
  let sql = 'SELECT * FROM telegram_mesaj_log WHERE 1=1';
  const params = [];
  if (tarih) { sql += ' AND date(tarih) = ?'; params.push(tarih); }
  if (durum) { sql += ' AND islem_durumu = ?'; params.push(durum); }
  sql += ' ORDER BY tarih DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const data = db.prepare(sql).all(...params);
  res.json({ success: true, data });
});

// GET /api/telegram/istatistik
router.get('/istatistik', (req, res) => {
  const db = getDb();
  const toplam_kullanici = db.prepare('SELECT COUNT(*) as c FROM telegram_kullanicilar WHERE aktif = 1').get().c;
  const bugun_mesaj = db.prepare("SELECT COUNT(*) as c FROM telegram_mesaj_log WHERE date(tarih) = date('now')").get().c;
  const toplam_mesaj = db.prepare('SELECT COUNT(*) as c FROM telegram_mesaj_log').get().c;
  const son_mesaj = db.prepare('SELECT MAX(tarih) as t FROM telegram_mesaj_log').get().t;
  const mesaj_tipleri = db.prepare(`
    SELECT mesaj_tipi, COUNT(*) as sayi FROM telegram_mesaj_log
    WHERE date(tarih) >= date('now', '-7 days')
    GROUP BY mesaj_tipi
  `).all();
  res.json({ success: true, data: { toplam_kullanici, bugun_mesaj, toplam_mesaj, son_mesaj, mesaj_tipleri } });
});

// GET /api/telegram/durum
router.get('/durum', (req, res) => {
  const { getBot } = require('../telegram/bot');
  const bot = getBot();
  const db = getDb();
  const son_mesaj = db.prepare('SELECT MAX(tarih) as t FROM telegram_mesaj_log').get().t;
  res.json({
    success: true,
    data: {
      bot_aktif: !!bot,
      son_mesaj,
      kullanici_sayisi: db.prepare('SELECT COUNT(*) as c FROM telegram_kullanicilar WHERE aktif = 1').get().c
    }
  });
});

// POST /api/telegram/bot/restart - Botu yeniden baslat
router.post('/bot/restart', async (req, res) => {
  try {
    const { stopBot, startBot } = require('../telegram/bot');
    stopBot();
    setTimeout(() => {
      startBot();
    }, 1000);
    res.json({ success: true, message: 'Bot yeniden baslatiliyor...' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/telegram/ayarlar
router.post('/ayarlar', (req, res) => {
  const db = getDb();
  const ayarlar = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO firma_ayarlari (anahtar, deger, aciklama) VALUES (?, ?, ?)');
  for (const [key, value] of Object.entries(ayarlar)) {
    if (key.startsWith('telegram_') || key.startsWith('ai_') || key.startsWith('ollama_') || key.startsWith('cloud_') || key.startsWith('claude_') || key.startsWith('openai_') || key.startsWith('koordinator_') || key.startsWith('foto_')) {
      const existing = db.prepare('SELECT aciklama FROM firma_ayarlari WHERE anahtar = ?').get(key);
      stmt.run(key, String(value), existing?.aciklama || key);
    }
  }
  res.json({ success: true });
});

module.exports = router;
