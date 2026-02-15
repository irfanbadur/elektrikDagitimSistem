/**
 * SQL GÜVENLİK FİLTRESİ
 *
 * AI'ın ürettiği SQL'i çalıştırmadan önce kontrol eder.
 * Kural basit: Sadece SELECT. Geri kalan her şey engellenir.
 */

const YASAKLI = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
  'TRUNCATE', 'REPLACE', 'GRANT', 'REVOKE', 'EXEC',
  'ATTACH', 'DETACH', 'PRAGMA', 'VACUUM', 'REINDEX',
];

const HASSAS_SUTUNLAR = ['sifre_hash', 'api_key', 'token'];

function sqlKontrol(sql) {
  if (!sql || typeof sql !== 'string') {
    return { gecerli: false, sebep: 'SQL boş' };
  }

  const temiz = sql.trim().toUpperCase();

  if (!temiz.startsWith('SELECT')) {
    return { gecerli: false, sebep: 'Sadece SELECT sorguları çalıştırılabilir' };
  }

  for (const yasak of YASAKLI) {
    const regex = new RegExp(`\\b${yasak}\\b`, 'i');
    if (regex.test(sql)) {
      return { gecerli: false, sebep: `"${yasak}" ifadesi kullanılamaz` };
    }
  }

  const statementSayisi = sql.split(';').filter(s => s.trim()).length;
  if (statementSayisi > 1) {
    return { gecerli: false, sebep: 'Tek sorguda birden fazla statement çalıştırılamaz' };
  }

  const hassasBulunan = HASSAS_SUTUNLAR.filter(s =>
    sql.toLowerCase().includes(s.toLowerCase())
  );

  return {
    gecerli: true,
    uyarilar: hassasBulunan.length > 0
      ? [`Hassas sütunlar maskelenecek: ${hassasBulunan.join(', ')}`]
      : [],
  };
}

function sonucMaskele(rows) {
  return rows.map(row => {
    const temiz = { ...row };
    for (const sutun of HASSAS_SUTUNLAR) {
      if (temiz[sutun]) temiz[sutun] = '***';
    }
    return temiz;
  });
}

function guvenliCalistir(db, sql) {
  const kontrol = sqlKontrol(sql);
  if (!kontrol.gecerli) {
    return { basarili: false, hata: kontrol.sebep, satirlar: [] };
  }

  try {
    let guvenliSql = sql.trim();
    if (!guvenliSql.toUpperCase().includes('LIMIT')) {
      guvenliSql = guvenliSql.replace(/;?\s*$/, ' LIMIT 100');
    }

    const satirlar = db.prepare(guvenliSql).all();
    return {
      basarili: true,
      satirlar: sonucMaskele(satirlar),
      satirSayisi: satirlar.length,
      uyarilar: kontrol.uyarilar || [],
    };
  } catch (err) {
    return { basarili: false, hata: err.message, satirlar: [] };
  }
}

module.exports = { sqlKontrol, sonucMaskele, guvenliCalistir };
