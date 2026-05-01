/**
 * Tüm YB projeleri için Yeni Durum Proje DXF üzerinden otomatik tespit
 * batch-oto-tespit-ket.js'in tıpa tıp aynısı, sadece is_tipi filtresi 'YB'.
 */
const Database = require('better-sqlite3');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
const DB_PATH = path.join(ROOT, 'data/tenants/cakmakgrup/elektratrack.db');
const SERVER_BASE = 'http://localhost:4000';
const APPLY = process.argv.includes('--apply');
const PROJE_ID_ARG = (() => {
  const a = process.argv.find(x => x.startsWith('--proje-id='));
  return a ? parseInt(a.split('=')[1]) : null;
})();

const TIP_TUR_MAP = {
  '9-O': 'Agac Direk', '12-O': 'Agac Direk',
  '8I': 'AG Direk', '10I': 'AG Direk', '10U': 'AG Direk', '12I': 'AG Direk', '12U': 'AG Direk',
  'K1': 'AG Direk', 'K1+2': 'AG Direk', 'K2': 'AG Direk', 'K2+2': 'AG Direk',
  'K3': 'AG Direk', 'K4': 'AG Direk', 'K5': 'AG Direk',
  '10I"': 'Musterek Direk', '12I"': 'Musterek Direk', 'K1"': 'Musterek Direk', 'K2"': 'Musterek Direk',
  'T15': 'Trafo Diregi', 'T25': 'Trafo Diregi', 'T35': 'Trafo Diregi', 'T50': 'Trafo Diregi',
  'D10': 'Buyuk Aralikli Swallow Direk', 'D12': 'Buyuk Aralikli Swallow Direk', 'D14': 'Buyuk Aralikli Swallow Direk',
};
const SEMBOL_DURUM = {
  A: 'Mevcut', R: 'Mevcut', P: 'Mevcut',
  8: 'Yeni', E: 'Yeni', M: 'Yeni',
  T: 'DMM', B: 'DMM', S: 'DMM',
};

function hesaplaOtoMalzemeler(tip, yakinlar) {
  const oto = [];
  const hasPotans = /\(P\)/i.test(tip || '');
  if (hasPotans) oto.push({ adi: 'T-AG-5(L3=150cm)', miktar: 1 });
  if (yakinlar?.armatur) oto.push({ adi: 'ARM. LED KOR. SINIF 1 S15/8/1', miktar: 1 });
  if (yakinlar?.koruma) {
    oto.push({ adi: '2m Galvanizli 65x65x7 Kosebent', miktar: 1 });
    oto.push({ adi: '95 mm2 Galvanizli Celik Iletken ve gomulmesi', miktar: 5 });
  }
  if (yakinlar?.isletme) {
    oto.push({ adi: '2m Galvanizli 65x65x7 Kosebent', miktar: 1 });
    oto.push({ adi: '95 mm2 NAYY kablo ve gomulmesi', miktar: 30 });
  }
  return oto;
}

async function dxfElemanlariGetir(dosyaId, denemeler = 3) {
  let lastErr;
  for (let i = 0; i < denemeler; i++) {
    try {
      const r = await fetch(`${SERVER_BASE}/api/dosya/${dosyaId}/dxf-elemanlar`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return j?.data?.elemanlar || [];
    } catch (e) {
      lastErr = e;
      if (i < denemeler - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

async function main() {
  const db = new Database(DB_PATH);
  let where = "WHERE it.kod = 'YB'";
  if (PROJE_ID_ARG) where += ` AND p.id = ${PROJE_ID_ARG}`;
  const projeler = db.prepare(`
    SELECT p.id, p.proje_no, p.musteri_adi,
           (SELECT d.id FROM dosyalar d
            JOIN proje_adimlari pa ON d.proje_adim_id = pa.id
            WHERE pa.proje_id = p.id AND pa.adim_kodu = 'yeni_durum_proje'
              AND d.durum = 'aktif' AND LOWER(d.dosya_adi) LIKE '%.dxf'
            ORDER BY d.olusturma_tarihi DESC LIMIT 1) AS dxf_id
    FROM projeler p
    JOIN is_tipleri it ON p.is_tipi_id = it.id
    ${where}
    ORDER BY p.proje_no
  `).all();
  const hedefler = projeler.filter(p => p.dxf_id);
  console.log(`YB proje: ${projeler.length} | Yeni Durum DXF olan: ${hedefler.length}`);

  if (!APPLY) {
    console.log('\n[DRY-RUN] DXF\'i olan projeler:');
    for (const p of hedefler) console.log(`  ${p.proje_no.padEnd(20)} ${p.musteri_adi}`);
    console.log(`\nDXF'i olmayan: ${projeler.length - hedefler.length} proje\n--apply ile çalıştırın.`);
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO proje_kesif_metraj (
      proje_id, sira, nokta1, nokta2, nokta_durum,
      direk_tur, direk_tip, ara_mesafe,
      ag_iletken_durum, ag_iletken, og_iletken, kaynak, notlar
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'kroki', ?)
  `);
  const silProjeStmt = db.prepare(`DELETE FROM proje_kesif_metraj WHERE proje_id = ?`);

  let toplamProje = 0, toplamSatir = 0;
  for (const p of hedefler) {
    try {
      const elemanlar = await dxfElemanlariGetir(p.dxf_id);
      if (!elemanlar.length) { console.log(`  ⚠ ${p.proje_no}: DXF parse boş`); continue; }
      const anaDirekler = elemanlar.filter(d => d.numara && d.sembol && SEMBOL_DURUM[d.sembol]);
      if (!anaDirekler.length) { console.log(`  ⚠ ${p.proje_no}: ana direk bulunamadı`); continue; }
      silProjeStmt.run(p.id);
      const tx = db.transaction(() => {
        let sira = 0;
        for (const d of anaDirekler) {
          sira++;
          const yakinlar = { armatur: false, koruma: false, isletme: false };
          for (const el of elemanlar) {
            if (el.numara !== d.numara || el === d) continue;
            if (el.sembol === 'C') yakinlar.armatur = true;
            if (el.sembol === '4') yakinlar.koruma = true;
            if (el.sembol === '5') yakinlar.isletme = true;
          }
          const rawTip = d.tip || '';
          const cleanTip = rawTip.replace(/^G-/i, '').replace(/\(P\)/gi, '').trim();
          const turFromTip = TIP_TUR_MAP[cleanTip] || (rawTip.startsWith('G-') ? 'AG Direk' : '');
          const komsu = d.komsular?.[0];
          const otoMalz = hesaplaOtoMalzemeler(rawTip, yakinlar);
          const otoNotlar = otoMalz.map(m => `${m.miktar}||${m.adi}|0`).join('\n');
          const iletkenText = komsu?.iletken || '';
          const temizIletken = iletkenText.replace(/[()[\]]/g, '').trim();
          const agIletken = /AER|ROSE|PANSY|ASTER/i.test(temizIletken) ? temizIletken.replace(/_/g, ' ') : null;
          const ogIletken = /SW|SWALLOW|RAVEN|PIGEON|HAWK/i.test(temizIletken) ? temizIletken.replace(/_/g, ' ') : null;
          const iletkenNot = iletkenText ? `Iletken: ${temizIletken.replace(/_/g, ' ')}` : '';
          const direkDurum = SEMBOL_DURUM[d.sembol] || komsu?.hatDurum || 'Yeni';
          const notlar = [otoNotlar, iletkenNot].filter(Boolean).join('\n');
          insertStmt.run(
            p.id, sira, d.numara, komsu?.numara || null, direkDurum,
            turFromTip || null, cleanTip || rawTip || null,
            komsu?.mesafe || 0, komsu?.hatDurum || null, agIletken, ogIletken,
            notlar || null
          );
        }
      });
      tx();
      console.log(`  ✓ ${p.proje_no.padEnd(20)} ${p.musteri_adi.slice(0,35).padEnd(35)} → ${anaDirekler.length} direk`);
      toplamProje++;
      toplamSatir += anaDirekler.length;
    } catch (err) {
      console.error(`  ✗ ${p.proje_no}: ${err.message}`);
    }
  }
  console.log(`\nÖzet: ${toplamProje} proje, ${toplamSatir} satır eklendi.`);
}

main().catch(e => { console.error(e); process.exit(1); });
