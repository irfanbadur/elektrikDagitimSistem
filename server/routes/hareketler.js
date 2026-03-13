const router = require('express').Router();
const multer = require('multer');
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');
const dosyaService = require('../services/dosyaService');
const bonoParsePrompt = require('../services/ai-engine/prompts/bonoParsePrompt');
const irsaliyeParsePrompt = require('../services/ai-engine/prompts/irsaliyeParsePrompt');
const evrakParsePrompt = require('../services/ai-engine/prompts/evrakParsePrompt');
const config = require('../config');

// ═══════════════════════════════════════════════════
// Yardımcı fonksiyonlar (bonolar.js'den taşındı)
// ═══════════════════════════════════════════════════

function upsertDepoStok(db, depoId, malzemeId, miktarDegisim) {
  const mevcut = db.prepare('SELECT id, miktar FROM depo_stok WHERE depo_id = ? AND malzeme_id = ?').get(depoId, malzemeId);
  if (mevcut) {
    db.prepare('UPDATE depo_stok SET miktar = MAX(0, miktar + ?), guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(miktarDegisim, mevcut.id);
  } else if (miktarDegisim > 0) {
    db.prepare('INSERT INTO depo_stok (depo_id, malzeme_id, miktar) VALUES (?,?,?)').run(depoId, malzemeId, miktarDegisim);
  }
}

// ═══════════════════════════════════════════════════
// AI Parse fonksiyonları (tek görsel + metin tabanlı)
// ═══════════════════════════════════════════════════

async function tekGorselParseEt(buffer, mimeType, prompt, userMessage) {
  const imageBase64 = buffer.toString('base64');
  const provider = config.ai.katman3.provider();
  let result = null;

  if (provider === 'claude') {
    const apiKey = config.ai.katman3.claude.apiKey();
    if (!apiKey) throw new Error('Claude API anahtarı ayarlanmamış.');
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: config.ai.katman3.claude.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        { type: 'text', text: prompt }
      ]}]
    });
    const text = response.content[0].text;
    const cleaned = text.replace(/```json|```/g, '').trim();
    try { result = JSON.parse(cleaned); } catch { result = { raw_text: text, parse_error: true }; }

  } else if (provider === 'gemini') {
    const db = getDb();
    const apiKey = db.prepare("SELECT deger FROM firma_ayarlari WHERE anahtar = 'gemini_api_key'").get()?.deger;
    if (!apiKey) throw new Error('Gemini API anahtarı ayarlanmamış.');
    const modeller = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let response, data;
    for (const model of modeller) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = JSON.stringify({
        system_instruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [
          { text: userMessage },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      });
      let modelBasarili = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        response = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body, signal: AbortSignal.timeout(60000)
        });
        data = await response.json();
        if ((response.status === 429 || response.status === 503) && attempt < 3) {
          const retryMatch = (data.error?.message || '').match(/retry in ([\d.]+)s/i);
          const beklemeSn = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 1 : 15;
          await new Promise(r => setTimeout(r, beklemeSn * 1000));
          continue;
        }
        if (response.ok) { modelBasarili = true; }
        break;
      }
      if (modelBasarili) break;
      if (model !== modeller[modeller.length - 1]) {
        console.log(`Gemini ${model} başarısız (${response.status}), ${modeller[modeller.indexOf(model) + 1]} deneniyor...`);
      }
    }
    if (!response.ok) throw new Error(`Gemini API hata: ${data.error?.message || response.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    try { result = JSON.parse(cleaned); } catch { result = { raw_text: text, parse_error: true }; }

  } else if (provider === 'openai') {
    const apiKey = config.ai.katman3.openai.apiKey();
    if (!apiKey) throw new Error('OpenAI API anahtarı ayarlanmamış.');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.ai.katman3.openai.model,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: prompt }
        ]}],
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    result = JSON.parse(data.choices[0].message.content);
  } else {
    throw new Error('AI provider yapılandırılmamış');
  }
  return result;
}

// Sayfa sonuçlarını kod ile birleştir
function sayfalariKodIleBirlestir(sayfaSonuclari, belgeTipi) {
  if (sayfaSonuclari.length === 0) return null;
  if (sayfaSonuclari.length === 1) return sayfaSonuclari[0];

  const bilgiAnahtarlari = belgeTipi === 'BONO'
    ? ['bono_no', 'bono_tarihi', 'kurum', 'teslim_alan', 'teslim_eden', 'aciklama']
    : ['irsaliye_no', 'irsaliye_tarihi', 'firma', 'sevk_eden', 'teslim_alan', 'aciklama'];

  const bilgi = {};
  for (const key of bilgiAnahtarlari) {
    for (const s of sayfaSonuclari) {
      const val = s[key] || s.belge_bilgi?.[key];
      if (val) { bilgi[key] = val; break; }
    }
    if (!bilgi[key]) bilgi[key] = null;
  }

  let tumKalemler = [];
  for (const s of sayfaSonuclari) tumKalemler.push(...(s.kalemler || []));

  const benzersizKalemler = [];
  for (const k of tumKalemler) {
    const tekrar = benzersizKalemler.find(b => {
      if (k.malzeme_kodu && b.malzeme_kodu && k.malzeme_kodu === b.malzeme_kodu) return true;
      if (k.poz_no && b.poz_no && k.poz_no === b.poz_no) return true;
      if (k.malzeme_adi && b.malzeme_adi &&
          k.malzeme_adi.trim().toLowerCase() === b.malzeme_adi.trim().toLowerCase() &&
          (k.miktar || 0) === (b.miktar || 0)) return true;
      return false;
    });
    if (!tekrar) benzersizKalemler.push({ ...k });
  }
  benzersizKalemler.forEach((k, i) => { k.sira_no = i + 1; });
  return { belge_bilgi: bilgi, kalemler: benzersizKalemler };
}

// Bono-irsaliye çapraz karşılaştırma (kod)
function caprazKarsilastirKod(bonoKalemler, irsaliyeKalemler) {
  const sonuc = [];
  const eslesenIrsaliyeIndexler = new Set();
  function normalizeAd(ad) {
    return (ad || '').trim().toLowerCase().replace(/[^a-z0-9çğıöşüâ]/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  for (const bk of bonoKalemler) {
    let eslesenIdx = -1;
    for (let j = 0; j < irsaliyeKalemler.length; j++) {
      if (eslesenIrsaliyeIndexler.has(j)) continue;
      const ik = irsaliyeKalemler[j];
      if (bk.malzeme_kodu && ik.malzeme_kodu && bk.malzeme_kodu === ik.malzeme_kodu) { eslesenIdx = j; break; }
      if (bk.poz_no && ik.poz_no && bk.poz_no === ik.poz_no) { eslesenIdx = j; break; }
      const ad1 = normalizeAd(bk.malzeme_adi), ad2 = normalizeAd(ik.malzeme_adi);
      if (ad1 && ad2 && (ad1 === ad2 || ad1.includes(ad2) || ad2.includes(ad1))) { eslesenIdx = j; break; }
    }
    const miktarBono = bk.miktar || bk.miktar_bono || 0;
    if (eslesenIdx >= 0) {
      eslesenIrsaliyeIndexler.add(eslesenIdx);
      const ik = irsaliyeKalemler[eslesenIdx];
      const miktarIrsaliye = ik.miktar || ik.miktar_irsaliye || 0;
      sonuc.push({
        sira_no: sonuc.length + 1, malzeme_kodu: bk.malzeme_kodu || ik.malzeme_kodu || null,
        poz_no: bk.poz_no || ik.poz_no || null, malzeme_adi: bk.malzeme_adi || ik.malzeme_adi || '',
        birim: bk.birim || ik.birim || 'Ad', miktar_bono: miktarBono, miktar_irsaliye: miktarIrsaliye,
        kaynak: 'her_ikisi', uyumsuzluk: miktarBono !== miktarIrsaliye,
      });
    } else {
      sonuc.push({
        sira_no: sonuc.length + 1, malzeme_kodu: bk.malzeme_kodu || null, poz_no: bk.poz_no || null,
        malzeme_adi: bk.malzeme_adi || '', birim: bk.birim || 'Ad',
        miktar_bono: miktarBono, miktar_irsaliye: 0, kaynak: 'bono', uyumsuzluk: false,
      });
    }
  }
  for (let j = 0; j < irsaliyeKalemler.length; j++) {
    if (eslesenIrsaliyeIndexler.has(j)) continue;
    const ik = irsaliyeKalemler[j];
    sonuc.push({
      sira_no: sonuc.length + 1, malzeme_kodu: ik.malzeme_kodu || null, poz_no: ik.poz_no || null,
      malzeme_adi: ik.malzeme_adi || '', birim: ik.birim || 'Ad',
      miktar_bono: 0, miktar_irsaliye: ik.miktar || ik.miktar_irsaliye || 0,
      kaynak: 'irsaliye', uyumsuzluk: false,
    });
  }
  return { kalemler: sonuc };
}

// ═══════════════════════════════════════════════════
// GET / - Hareket listesi (filtreli)
// ═══════════════════════════════════════════════════
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { tarih_baslangic, tarih_bitis, hareket_tipi, proje_id, depo_id, durum, kaynak } = req.query;
    let sql = `SELECT h.*,
      p.proje_no, p.musteri_adi as proje_adi,
      kd.depo_adi as kaynak_depo_adi, hd.depo_adi as hedef_depo_adi,
      e.ekip_adi,
      (SELECT COUNT(*) FROM hareket_kalemleri hk WHERE hk.hareket_id = h.id) as kalem_sayisi,
      (SELECT SUM(hk.miktar) FROM hareket_kalemleri hk WHERE hk.hareket_id = h.id) as toplam_miktar,
      (SELECT COUNT(*) FROM hareket_dokumanlari hd2 WHERE hd2.hareket_id = h.id) as dokuman_sayisi
      FROM hareketler h
      LEFT JOIN projeler p ON h.proje_id = p.id
      LEFT JOIN depolar kd ON h.kaynak_depo_id = kd.id
      LEFT JOIN depolar hd ON h.hedef_depo_id = hd.id
      LEFT JOIN ekipler e ON h.ekip_id = e.id
      WHERE 1=1`;
    const params = [];
    if (tarih_baslangic) { sql += ' AND h.tarih >= ?'; params.push(tarih_baslangic); }
    if (tarih_bitis) { sql += ' AND h.tarih <= ?'; params.push(tarih_bitis); }
    if (hareket_tipi) { sql += ' AND h.hareket_tipi = ?'; params.push(hareket_tipi); }
    if (proje_id) { sql += ' AND h.proje_id = ?'; params.push(proje_id); }
    if (depo_id) { sql += ' AND (h.kaynak_depo_id = ? OR h.hedef_depo_id = ?)'; params.push(depo_id, depo_id); }
    if (durum) { sql += ' AND h.durum = ?'; params.push(durum); }
    if (kaynak) { sql += ' AND h.kaynak = ?'; params.push(kaynak); }
    sql += ' ORDER BY h.tarih DESC, h.id DESC LIMIT 200';
    basarili(res, db.prepare(sql).all(...params));
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// ═══════════════════════════════════════════════════
// GET /:id - Hareket detayı (kalemler + dokümanlar + meta)
// ═══════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const hareket = db.prepare(`SELECT h.*,
      p.proje_no, p.musteri_adi as proje_adi,
      kd.depo_adi as kaynak_depo_adi, hd.depo_adi as hedef_depo_adi, e.ekip_adi
      FROM hareketler h
      LEFT JOIN projeler p ON h.proje_id = p.id
      LEFT JOIN depolar kd ON h.kaynak_depo_id = kd.id
      LEFT JOIN depolar hd ON h.hedef_depo_id = hd.id
      LEFT JOIN ekipler e ON h.ekip_id = e.id
      WHERE h.id = ?`).get(req.params.id);
    if (!hareket) return hata(res, 'Hareket bulunamadı', 404);

    hareket.kalemler = db.prepare(`SELECT hk.*, m.malzeme_adi as katalog_adi
      FROM hareket_kalemleri hk
      LEFT JOIN malzemeler m ON hk.malzeme_id = m.id
      WHERE hk.hareket_id = ? ORDER BY hk.sira_no`).all(hareket.id);

    hareket.dokumanlar = db.prepare(`SELECT hd.*, d.dosya_adi, d.dosya_yolu, d.boyut, d.mime_tipi
      FROM hareket_dokumanlari hd
      LEFT JOIN dosyalar d ON hd.dosya_id = d.id
      WHERE hd.hareket_id = ?`).all(hareket.id);

    hareket.meta = db.prepare('SELECT * FROM hareket_meta WHERE hareket_id = ?').all(hareket.id);

    basarili(res, hareket);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// ═══════════════════════════════════════════════════
// POST /parse - Evrak parse (AI analiz) — EvrakGiris'ten çağrılır
// ═══════════════════════════════════════════════════
const parseUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }).fields([
  { name: 'bono_dosyalari', maxCount: 10 },
  { name: 'irsaliye_dosyalari', maxCount: 10 }
]);

router.post('/parse', parseUpload, async (req, res) => {
  try {
    const bonoDosyalar = req.files?.bono_dosyalari || [];
    const irsaliyeDosyalar = req.files?.irsaliye_dosyalari || [];
    if (bonoDosyalar.length === 0 && irsaliyeDosyalar.length === 0) return hata(res, 'En az bir dosya yüklenmeli');

    const hasBono = bonoDosyalar.length > 0;
    const hasIrsaliye = irsaliyeDosyalar.length > 0;
    console.log(`Hareket parse: ${bonoDosyalar.length} bono, ${irsaliyeDosyalar.length} irsaliye`);

    // Her görseli teker teker parse et
    const bonoSonuclar = [];
    for (let i = 0; i < bonoDosyalar.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 2000));
      try {
        const sonuc = await tekGorselParseEt(bonoDosyalar[i].buffer, bonoDosyalar[i].mimetype || 'image/jpeg',
          bonoParsePrompt.buildPrompt(), 'Bu bono belgesini analiz et ve JSON olarak dön.');
        if (!sonuc.parse_error) bonoSonuclar.push(sonuc);
      } catch (err) { console.error(`Bono sayfa ${i + 1} hata:`, err.message); }
    }

    const irsaliyeSonuclar = [];
    for (let i = 0; i < irsaliyeDosyalar.length; i++) {
      if (i > 0 || bonoSonuclar.length > 0) await new Promise(r => setTimeout(r, 2000));
      try {
        const sonuc = await tekGorselParseEt(irsaliyeDosyalar[i].buffer, irsaliyeDosyalar[i].mimetype || 'image/jpeg',
          irsaliyeParsePrompt.buildPrompt(), 'Bu irsaliye/fatura belgesini analiz et ve JSON olarak dön.');
        if (!sonuc.parse_error) irsaliyeSonuclar.push(sonuc);
      } catch (err) { console.error(`İrsaliye sayfa ${i + 1} hata:`, err.message); }
    }

    if (bonoSonuclar.length === 0 && irsaliyeSonuclar.length === 0) {
      return hata(res, 'Hiçbir sayfa okunamadı. Daha net görseller yükleyin.', 400);
    }

    // Çoklu sayfa birleştirme
    let bonoBilgi = null, bonoKalemler = [];
    if (bonoSonuclar.length === 1) {
      const s = bonoSonuclar[0];
      bonoBilgi = { bono_no: s.bono_no || null, bono_tarihi: s.bono_tarihi || null, kurum: s.kurum || null,
        teslim_alan: s.teslim_alan || null, teslim_eden: s.teslim_eden || null, aciklama: s.aciklama || null };
      bonoKalemler = s.kalemler || [];
    } else if (bonoSonuclar.length > 1) {
      const merged = sayfalariKodIleBirlestir(bonoSonuclar, 'BONO');
      if (merged) {
        const bb = merged.belge_bilgi || merged;
        bonoBilgi = { bono_no: bb.bono_no || null, bono_tarihi: bb.bono_tarihi || null, kurum: bb.kurum || null,
          teslim_alan: bb.teslim_alan || null, teslim_eden: bb.teslim_eden || null, aciklama: bb.aciklama || null };
        bonoKalemler = merged.kalemler || [];
      }
    }

    let irsaliyeBilgi = null, irsaliyeKalemler = [];
    if (irsaliyeSonuclar.length === 1) {
      const s = irsaliyeSonuclar[0];
      irsaliyeBilgi = { irsaliye_no: s.irsaliye_no || null, irsaliye_tarihi: s.irsaliye_tarihi || null,
        firma: s.firma || null, sevk_eden: s.sevk_eden || null, teslim_alan: s.teslim_alan || null, aciklama: s.aciklama || null };
      irsaliyeKalemler = s.kalemler || [];
    } else if (irsaliyeSonuclar.length > 1) {
      const merged = sayfalariKodIleBirlestir(irsaliyeSonuclar, 'İRSALİYE');
      if (merged) {
        const ib = merged.belge_bilgi || merged;
        irsaliyeBilgi = { irsaliye_no: ib.irsaliye_no || null, irsaliye_tarihi: ib.irsaliye_tarihi || null,
          firma: ib.firma || null, sevk_eden: ib.sevk_eden || null, teslim_alan: ib.teslim_alan || null, aciklama: ib.aciklama || null };
        irsaliyeKalemler = merged.kalemler || [];
      }
    }

    // Çapraz karşılaştır veya doğrudan formatla
    let kalemler;
    if (hasBono && hasIrsaliye && bonoKalemler.length > 0 && irsaliyeKalemler.length > 0) {
      const capraz = caprazKarsilastirKod(bonoKalemler, irsaliyeKalemler);
      kalemler = capraz.kalemler || [];
    } else {
      const kaynak = hasBono ? 'bono' : 'irsaliye';
      const rawKalemler = hasBono ? bonoKalemler : irsaliyeKalemler;
      kalemler = rawKalemler.map((k, i) => ({
        sira_no: k.sira_no || i + 1, malzeme_kodu: k.malzeme_kodu || null, poz_no: k.poz_no || null,
        malzeme_adi: k.malzeme_adi || '', birim: k.birim || 'Ad',
        miktar_bono: hasBono ? (k.miktar || k.miktar_bono || 0) : 0,
        miktar_irsaliye: hasIrsaliye ? (k.miktar || k.miktar_irsaliye || 0) : 0,
        kaynak, uyumsuzluk: false,
      }));
    }

    basarili(res, {
      bono_bilgi: bonoBilgi || { bono_no: null, bono_tarihi: null, kurum: null, teslim_alan: null, teslim_eden: null, aciklama: null },
      irsaliye_bilgi: irsaliyeBilgi || { irsaliye_no: null, irsaliye_tarihi: null, firma: null, sevk_eden: null, teslim_alan: null, aciklama: null },
      kalemler,
      _meta: { bono_sayfa: bonoDosyalar.length, irsaliye_sayfa: irsaliyeDosyalar.length,
        bono_parse_basarili: bonoSonuclar.length, irsaliye_parse_basarili: irsaliyeSonuclar.length }
    });
  } catch (err) {
    console.error('Hareket parse hatası:', err);
    hata(res, err.message || 'AI analizi sırasında hata oluştu', 500);
  }
});

// ═══════════════════════════════════════════════════
// POST /kaydet - Hareket oluştur + stok güncelle + dosyaları sakla
// ═══════════════════════════════════════════════════
const kaydetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }).fields([
  { name: 'bono_dosyalari', maxCount: 10 },
  { name: 'irsaliye_dosyalari', maxCount: 10 }
]);

router.post('/kaydet', kaydetUpload, async (req, res) => {
  try {
    const db = getDb();
    const hareketData = JSON.parse(req.body.hareket_data || '{}');
    const { hareket_tipi, bono_bilgi, irsaliye_bilgi, kalemler, proje_id, hedef_depo_id, kaynak_depo_id, teslim_alan, teslim_eden, aciklama } = hareketData;

    const tip = hareket_tipi || 'giris';
    const belgeNo = bono_bilgi?.bono_no || irsaliye_bilgi?.irsaliye_no || null;
    const tarih = bono_bilgi?.bono_tarihi || irsaliye_bilgi?.irsaliye_tarihi || new Date().toISOString().split('T')[0];

    if (!kalemler || kalemler.length === 0) return hata(res, 'En az bir kalem gereklidir');

    // Hedef/Kaynak depo: belirtilmemişse Ana Depo
    let hedefDepoId = hedef_depo_id;
    let kaynakDepoId = kaynak_depo_id;
    if (tip === 'giris' && !hedefDepoId) {
      const anaDepo = db.prepare("SELECT id FROM depolar WHERE depo_tipi = 'ana_depo' LIMIT 1").get();
      hedefDepoId = anaDepo?.id || null;
    }
    if (tip === 'cikis' && !kaynakDepoId) {
      const anaDepo = db.prepare("SELECT id FROM depolar WHERE depo_tipi = 'ana_depo' LIMIT 1").get();
      kaynakDepoId = anaDepo?.id || null;
    }

    const transaction = db.transaction(() => {
      // 1) Hareket kaydı
      const result = db.prepare(`
        INSERT INTO hareketler (hareket_tipi, kaynak, durum, proje_id, kaynak_depo_id, hedef_depo_id, ekip_id,
          teslim_alan, teslim_eden, belge_no, aciklama, tarih)
        VALUES (?, ?, 'aktif', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tip,
        (bono_bilgi || irsaliye_bilgi) ? 'evrak' : 'manuel',
        proje_id || null,
        kaynakDepoId || null,
        hedefDepoId || null,
        hareketData.ekip_id || null,
        teslim_alan || bono_bilgi?.teslim_alan || irsaliye_bilgi?.teslim_alan || null,
        teslim_eden || bono_bilgi?.teslim_eden || irsaliye_bilgi?.sevk_eden || null,
        belgeNo,
        aciklama || bono_bilgi?.aciklama || irsaliye_bilgi?.aciklama || null,
        tarih
      );
      const hareketId = result.lastInsertRowid;

      // 2) Meta bilgileri (bono/irsaliye detayları)
      if (bono_bilgi) {
        db.prepare('INSERT INTO hareket_meta (hareket_id, meta_tipi, veri) VALUES (?, ?, ?)').run(
          hareketId, 'bono_bilgi', JSON.stringify(bono_bilgi));
      }
      if (irsaliye_bilgi) {
        db.prepare('INSERT INTO hareket_meta (hareket_id, meta_tipi, veri) VALUES (?, ?, ?)').run(
          hareketId, 'irsaliye_bilgi', JSON.stringify(irsaliye_bilgi));
      }

      // 3) Kalemleri kaydet + stok güncelle
      const kalemStmt = db.prepare(`
        INSERT INTO hareket_kalemleri (hareket_id, sira_no, malzeme_id, malzeme_kodu, poz_no,
          malzeme_adi, malzeme_cinsi, malzeme_tanimi_sap, birim, miktar, miktar_bono, miktar_irsaliye, birim_fiyat, proje_kesif_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < kalemler.length; i++) {
        const k = kalemler[i];
        const miktar = k.miktar || k.miktar_bono || k.miktar_irsaliye || 0;
        if (miktar <= 0) continue;

        // Malzeme ID bul (katalogda eşleşen)
        let malzemeId = null;
        if (k.malzeme_kodu) {
          const m = db.prepare('SELECT id FROM malzemeler WHERE malzeme_kodu = ?').get(k.malzeme_kodu);
          malzemeId = m?.id || null;
        }

        kalemStmt.run(hareketId, k.sira_no || i + 1, malzemeId, k.malzeme_kodu || null, k.poz_no || null,
          k.malzeme_adi || '', k.malzeme_cinsi || null, k.malzeme_tanimi_sap || null,
          k.birim || 'Ad', miktar, k.miktar_bono || 0, k.miktar_irsaliye || 0, k.birim_fiyat || 0,
          k.proje_kesif_id || null);

        // Stok güncelle
        if (malzemeId) {
          if (tip === 'giris' || tip === 'iade') {
            if (hedefDepoId) upsertDepoStok(db, hedefDepoId, malzemeId, miktar);
            db.prepare('UPDATE malzemeler SET stok_miktari = stok_miktari + ? WHERE id = ?').run(miktar, malzemeId);
          } else if (tip === 'cikis' || tip === 'fire') {
            if (kaynakDepoId) upsertDepoStok(db, kaynakDepoId, malzemeId, -miktar);
            db.prepare('UPDATE malzemeler SET stok_miktari = MAX(0, stok_miktari - ?) WHERE id = ?').run(miktar, malzemeId);
          } else if (tip === 'transfer') {
            if (kaynakDepoId) upsertDepoStok(db, kaynakDepoId, malzemeId, -miktar);
            if (hedefDepoId) upsertDepoStok(db, hedefDepoId, malzemeId, miktar);
          }
        }

        // Proje keşif durumunu güncelle
        if (k.proje_kesif_id) {
          db.prepare("UPDATE proje_kesif SET durum = 'alindi', guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?").run(k.proje_kesif_id);
        }
      }

      aktiviteLogla('hareket', 'olusturma', hareketId, `${tip}: ${belgeNo || 'Manuel'} - ${kalemler.length} kalem`);
      return hareketId;
    });

    const hareketId = transaction();

    // 4) Dosyaları Dosya Yönetimi'ne yükle + hareket_dokumanlari bağla
    // Klasör: depo/2026/gelen/Ambar_AnaDepo_2026-03-11/ veya depo/2026/giden/AnaDepo_Taseron1_2026-03-11/
    const bonoDosyalar = req.files?.bono_dosyalari || [];
    const irsaliyeDosyalar = req.files?.irsaliye_dosyalari || [];
    const yon = (tip === 'giris' || tip === 'iade') ? 'gelen' : 'giden';
    const verenAdi = hareketData.veren_adi || hareketData.karsi_taraf_adi || bono_bilgi?.kurum || irsaliye_bilgi?.firma || 'Diger';
    const alanAdi = hareketData.alan_adi || 'AnaDepo';
    const klasorAdi = `${verenAdi}_${alanAdi}_${tarih}`.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_\-]/g, '_').replace(/_+/g, '_');

    for (const f of bonoDosyalar) {
      try {
        const dosya = await dosyaService.dosyaYukle(f.buffer, {
          orijinalAdi: f.originalname, alan: 'depo', altAlan: `${yon}/${klasorAdi}`,
          iliskiliKaynakTipi: 'hareket', iliskiliKaynakId: hareketId,
          baslik: `Bono ${bono_bilgi?.bono_no || ''}`, kaynak: 'web',
        });
        db.prepare('INSERT INTO hareket_dokumanlari (hareket_id, dosya_id, dosya_tipi, orijinal_adi) VALUES (?,?,?,?)').run(
          hareketId, dosya.id, 'bono', f.originalname);
      } catch (err) { console.error('Bono dosya yükleme hatası:', err.message); }
    }
    for (const f of irsaliyeDosyalar) {
      try {
        const dosya = await dosyaService.dosyaYukle(f.buffer, {
          orijinalAdi: f.originalname, alan: 'depo', altAlan: `${yon}/${klasorAdi}`,
          iliskiliKaynakTipi: 'hareket', iliskiliKaynakId: hareketId,
          baslik: `İrsaliye ${irsaliye_bilgi?.irsaliye_no || ''}`, kaynak: 'web',
        });
        db.prepare('INSERT INTO hareket_dokumanlari (hareket_id, dosya_id, dosya_tipi, orijinal_adi) VALUES (?,?,?,?)').run(
          hareketId, dosya.id, 'irsaliye', f.originalname);
      } catch (err) { console.error('İrsaliye dosya yükleme hatası:', err.message); }
    }

    const hareket = db.prepare('SELECT * FROM hareketler WHERE id = ?').get(hareketId);
    basarili(res, hareket, 201);
  } catch (err) {
    console.error('Hareket kaydet hatası:', err);
    hata(res, err.message || 'Kaydetme sırasında hata oluştu', 500);
  }
});

// ═══════════════════════════════════════════════════
// POST /:id/iptal - Hareket iptal et (geri alma)
// ═══════════════════════════════════════════════════
router.post('/:id/iptal', (req, res) => {
  try {
    const db = getDb();
    const { neden } = req.body;
    const orijinal = db.prepare('SELECT * FROM hareketler WHERE id = ?').get(req.params.id);
    if (!orijinal) return hata(res, 'Hareket bulunamadı', 404);
    if (orijinal.durum === 'iptal') return hata(res, 'Bu hareket zaten iptal edilmiş');

    const kalemler = db.prepare('SELECT * FROM hareket_kalemleri WHERE hareket_id = ?').all(orijinal.id);

    const transaction = db.transaction(() => {
      // Orijinali iptal et
      db.prepare("UPDATE hareketler SET durum = 'iptal', iptal_nedeni = ? WHERE id = ?").run(neden || null, orijinal.id);

      // Ters hareket tipi
      const tersTip = { giris: 'cikis', cikis: 'giris', iade: 'cikis', fire: 'giris', transfer: 'transfer' };
      const yeniTip = tersTip[orijinal.hareket_tipi] || 'cikis';

      // Ters yönde kaynak/hedef depo
      const tersKaynak = orijinal.hareket_tipi === 'transfer' ? orijinal.hedef_depo_id : orijinal.hedef_depo_id;
      const tersHedef = orijinal.hareket_tipi === 'transfer' ? orijinal.kaynak_depo_id : orijinal.kaynak_depo_id;

      // Ters hareket oluştur
      const result = db.prepare(`
        INSERT INTO hareketler (hareket_tipi, kaynak, durum, proje_id, kaynak_depo_id, hedef_depo_id,
          teslim_alan, teslim_eden, belge_no, aciklama, tarih, iptal_referans_id)
        VALUES (?, ?, 'aktif', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(yeniTip, orijinal.kaynak, orijinal.proje_id, tersKaynak, tersHedef,
        orijinal.teslim_eden, orijinal.teslim_alan, orijinal.belge_no,
        `İPTAL: ${neden || ''} (Orijinal #${orijinal.id})`,
        new Date().toISOString().split('T')[0], orijinal.id);
      const tersHareketId = result.lastInsertRowid;

      // Kalemleri ters yaz + stok geri al
      for (const k of kalemler) {
        db.prepare(`INSERT INTO hareket_kalemleri (hareket_id, sira_no, malzeme_id, malzeme_kodu, poz_no,
          malzeme_adi, malzeme_cinsi, malzeme_tanimi_sap, birim, miktar, miktar_bono, miktar_irsaliye)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          tersHareketId, k.sira_no, k.malzeme_id, k.malzeme_kodu, k.poz_no,
          k.malzeme_adi, k.malzeme_cinsi, k.malzeme_tanimi_sap, k.birim, k.miktar, k.miktar_bono, k.miktar_irsaliye);

        // Stok geri al
        if (k.malzeme_id) {
          if (orijinal.hareket_tipi === 'giris' || orijinal.hareket_tipi === 'iade') {
            if (orijinal.hedef_depo_id) upsertDepoStok(db, orijinal.hedef_depo_id, k.malzeme_id, -k.miktar);
            db.prepare('UPDATE malzemeler SET stok_miktari = MAX(0, stok_miktari - ?) WHERE id = ?').run(k.miktar, k.malzeme_id);
          } else if (orijinal.hareket_tipi === 'cikis' || orijinal.hareket_tipi === 'fire') {
            if (orijinal.kaynak_depo_id) upsertDepoStok(db, orijinal.kaynak_depo_id, k.malzeme_id, k.miktar);
            db.prepare('UPDATE malzemeler SET stok_miktari = stok_miktari + ? WHERE id = ?').run(k.miktar, k.malzeme_id);
          } else if (orijinal.hareket_tipi === 'transfer') {
            if (orijinal.hedef_depo_id) upsertDepoStok(db, orijinal.hedef_depo_id, k.malzeme_id, -k.miktar);
            if (orijinal.kaynak_depo_id) upsertDepoStok(db, orijinal.kaynak_depo_id, k.malzeme_id, k.miktar);
          }
        }

        // Proje keşif durumunu geri al
        if (k.proje_kesif_id) {
          db.prepare("UPDATE proje_kesif SET durum = 'planli', guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?").run(k.proje_kesif_id);
        }
      }

      aktiviteLogla('hareket', 'iptal', orijinal.id, `İptal: #${orijinal.id} ${orijinal.belge_no || ''}`);
      return tersHareketId;
    });

    const tersHareketId = transaction();
    basarili(res, { iptal_edilen: orijinal.id, ters_hareket: tersHareketId });
  } catch (err) {
    console.error('Hareket iptal hatası:', err);
    hata(res, err.message, 500);
  }
});

module.exports = router;
