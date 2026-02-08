const { getDb } = require('../db/database');

function aktiviteLogla(modul, islem, kayit_id, detay, kullanici = 'koordinator') {
  const db = getDb();
  db.prepare(
    'INSERT INTO aktivite_log (modul, islem, kayit_id, detay, kullanici) VALUES (?, ?, ?, ?, ?)'
  ).run(modul, islem, kayit_id, typeof detay === 'string' ? detay : JSON.stringify(detay), kullanici);
}

function basarili(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function hata(res, mesaj, status = 400) {
  return res.status(status).json({ success: false, error: mesaj });
}

module.exports = { aktiviteLogla, basarili, hata };
