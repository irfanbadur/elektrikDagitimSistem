const { getDb } = require('../../db/database');
const providerManager = require('./providerManager');
const { guvenliCalistir } = require('./sqlGuvenlik');
const DB_SEMA = require('./dbSema');
const aiOperasyonService = require('./aiOperasyonService');
const konumService = require('./konumService');

class AiSohbetService {

  /**
   * MESAJ GÖNDER — Ana giriş noktası
   * Medya desteği: dosyalar + konum
   */
  async mesajGonder({ sohbetId, mesaj, kullaniciId, baglam = {}, dosyalar = [], konum = null }) {
    const db = getDb();

    // Sohbet oturumu
    let sohbet;
    if (sohbetId) {
      sohbet = db.prepare('SELECT * FROM ai_sohbetler WHERE id = ? AND kullanici_id = ?')
        .get(sohbetId, kullaniciId);
      if (!sohbet) throw new Error('Sohbet bulunamadı');
    } else {
      const result = db.prepare(`
        INSERT INTO ai_sohbetler (kullanici_id, baglam_tipi, baglam_id, baglam_meta)
        VALUES (?, ?, ?, ?)
      `).run(kullaniciId, baglam.tip || 'genel', baglam.id || null, JSON.stringify(baglam));
      sohbetId = result.lastInsertRowid;
      sohbet = { id: sohbetId, mesaj_sayisi: 0 };
    }

    // ─── DOSYALARI YÜKLE VE KAYDET ────────────
    let yukluDosyalar = [];
    if (dosyalar.length > 0) {
      const dosyaService = require('../dosyaService');
      for (const dosya of dosyalar) {
        try {
          const kaydedilen = await dosyaService.yukle({
            buffer: dosya.buffer,
            mimeType: dosya.mimeType,
            orijinalAdi: dosya.orijinalAdi,
            yukleyenId: kullaniciId,
            alan: 'sohbet_temp',
          });
          yukluDosyalar.push({ ...kaydedilen, buffer: dosya.buffer, mimeType: dosya.mimeType });
        } catch {
          // Dosya servisi yoksa buffer'ı doğrudan kullan
          yukluDosyalar.push({
            id: null,
            buffer: dosya.buffer,
            mimeType: dosya.mimeType,
            orijinalAdi: dosya.orijinalAdi,
          });
        }
      }
    }

    // ─── KONUM → DİREK EŞLEŞTİRME ───────────
    let direkTahmin = null;
    if (konum?.lat && konum?.lon) {
      direkTahmin = konumService.enYakinDirekBul(
        konum.lat, konum.lon,
        baglam.projeId || null
      );
    }

    // ─── KULLANICI MESAJINI KAYDET (medya dahil) ─
    db.prepare(`
      INSERT INTO ai_mesajlar (sohbet_id, rol, icerik, dosya_ids, konum_lat, konum_lon, konum_dogruluk)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sohbetId, 'kullanici', mesaj,
      yukluDosyalar.length > 0 ? JSON.stringify(yukluDosyalar.map(d => d.id).filter(Boolean)) : null,
      konum?.lat || null, konum?.lon || null, konum?.dogruluk || null
    );

    // Geçmiş mesajları al (son 10)
    const gecmis = db.prepare(`
      SELECT rol, icerik, mesaj_tipi FROM ai_mesajlar
      WHERE sohbet_id = ? ORDER BY id DESC LIMIT 10
    `).all(sohbetId).reverse();

    // ─── MOD TESPİTİ + YANIT (medya bağlamı ile) ─
    const yanit = await this._mesajIsle(mesaj, gecmis, baglam, kullaniciId, {
      dosyalar: yukluDosyalar,
      konum,
      direkTahmin,
    });

    // AI yanıtını kaydet
    db.prepare(`
      INSERT INTO ai_mesajlar (sohbet_id, rol, icerik, mesaj_tipi, meta)
      VALUES (?, 'asistan', ?, ?, ?)
    `).run(sohbetId, yanit.metin, yanit.tip, JSON.stringify(yanit.meta || {}));

    // Sohbet güncelle
    db.prepare(`
      UPDATE ai_sohbetler SET
        mesaj_sayisi = mesaj_sayisi + 2,
        son_mesaj_tarihi = datetime('now'),
        baslik = CASE WHEN mesaj_sayisi = 0 THEN ? ELSE baslik END
      WHERE id = ?
    `).run(mesaj.substring(0, 60) + (mesaj.length > 60 ? '...' : ''), sohbetId);

    return {
      sohbetId,
      yanit: yanit.metin,
      tip: yanit.tip,
      meta: yanit.meta,
      aksiyonPlan: yanit.aksiyonPlan,
    };
  }

  /**
   * MOD TESPİTİ + İŞLEME — Medya bağlamı ile
   */
  async _mesajIsle(mesaj, gecmis, baglam, kullaniciId, medya = {}) {
    const db = getDb();
    const { dosyalar = [], konum, direkTahmin } = medya;

    const sistemPromptu = this._sistemPromptu(baglam, medya);

    // Fotoğraf varsa vision modeli kullan
    const gorselDosyalar = dosyalar.filter(d =>
      d.mimeType?.startsWith('image/')
    );

    let aiYanit;
    const gecmisMesajlar = gecmis.map(m =>
      `${m.rol === 'kullanici' ? 'Kullanıcı' : 'Asistan'}: ${m.icerik}`
    ).join('\n');

    const prompt = `${gecmisMesajlar ? `GEÇMİŞ KONUŞMA:\n${gecmisMesajlar}\n\n` : ''}Kullanıcı: ${mesaj}`;

    if (gorselDosyalar.length > 0) {
      const gorseller = gorselDosyalar.map(d => ({
        base64: d.buffer.toString('base64'),
        mimeType: d.mimeType,
      }));
      aiYanit = await providerManager.gorselGonder(sistemPromptu, prompt, gorseller);
    } else {
      aiYanit = await providerManager.metinGonder(sistemPromptu, prompt);
    }

    // AI yanıtı boşsa
    if (!aiYanit.metin?.trim()) {
      console.warn('[AI Sohbet] AI boş yanıt döndü');
      return { metin: 'AI yanıt üretemedi. Lütfen tekrar deneyin.', tip: 'hata', meta: { provider: aiYanit.provider } };
    }

    // JSON parse et
    let parsed;
    try {
      const jsonMatch = aiYanit.metin.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON bulunamadı');
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // JSON parse edilemezse ham metni döndür
      return { metin: aiYanit.metin, tip: 'sohbet', meta: { provider: aiYanit.provider, direkTahmin } };
    }

    // MOD: SORGU
    if (parsed.mod === 'sorgu' && parsed.sql) {
      const sqlSonuc = guvenliCalistir(db, parsed.sql);

      if (!sqlSonuc.basarili) {
        return {
          metin: `Sorgu hatası: ${sqlSonuc.hata}\n\nSQL: ${parsed.sql}`,
          tip: 'hata',
          meta: { sql: parsed.sql, hata: sqlSonuc.hata },
        };
      }

      // Sonuçları AI'a özetlet
      let ozetMetin;
      try {
        const ozetYanit = await providerManager.metinGonder(
          'Sen ElektraTrack sisteminin AI asistanısın. Kullanıcıya sorgu sonuçlarını doğal, anlaşılır Türkçe ile özetle. Tablo formatı kullanma, akıcı cümleler kur. Sayıları ve önemli bilgileri vurgula. Kesinlikle JSON döndürme, sadece düz metin yaz.',
          `Kullanıcının sorusu: ${mesaj}\n\nSQL: ${parsed.sql}\n\nSonuç (${sqlSonuc.satirSayisi} satır):\n${JSON.stringify(sqlSonuc.satirlar, null, 2)}`
        );
        ozetMetin = ozetYanit.metin;
      } catch (err) {
        console.warn('[AI Sohbet] Özet üretme hatası:', err.message);
        // Özet başarısız olursa ham sonuçları göster
        ozetMetin = `Sorgu sonucu (${sqlSonuc.satirSayisi} satır):\n${JSON.stringify(sqlSonuc.satirlar, null, 2)}`;
      }

      // Özet de boşsa fallback
      if (!ozetMetin?.trim()) {
        ozetMetin = `Sorgu sonucu: ${sqlSonuc.satirSayisi} satır bulundu.`;
        if (sqlSonuc.satirlar?.length > 0) {
          ozetMetin += '\n' + JSON.stringify(sqlSonuc.satirlar[0]);
        }
      }

      return {
        metin: ozetMetin,
        tip: 'sorgu',
        meta: {
          sql: parsed.sql,
          satirSayisi: sqlSonuc.satirSayisi,
          satirlar: sqlSonuc.satirlar,
          provider: aiYanit.provider,
          direkTahmin,
        },
      };
    }

    // MOD: KOMUT
    if (parsed.mod === 'komut') {
      try {
        const plan = await aiOperasyonService.mesajIsle({
          metin: mesaj,
          gorseller: gorselDosyalar.map(d => ({ base64: d.buffer.toString('base64'), mimeType: d.mimeType })),
          kullaniciId,
          projeId: baglam.projeId || null,
          ekipId: baglam.ekipId || null,
        });

        return {
          metin: parsed.yanit || 'Komut algılandı, aksiyon planı hazırlandı.',
          tip: 'komut',
          meta: { provider: aiYanit.provider, direkTahmin },
          aksiyonPlan: plan,
        };
      } catch (err) {
        console.error('[AI Sohbet] Komut hatası:', err.message);
        return { metin: `Komut işlenirken hata: ${err.message}`, tip: 'hata', meta: { hata: err.message } };
      }
    }

    // MOD: SOHBET
    const yanitMetin = parsed.yanit || parsed.metin || parsed.mesaj || aiYanit.metin;
    return {
      metin: yanitMetin || 'Yanıt alınamadı.',
      tip: 'sohbet',
      meta: { provider: aiYanit.provider, direkTahmin },
    };
  }

  /**
   * SİSTEM PROMPTU — Medya bağlamı ile
   */
  _sistemPromptu(baglam, medya = {}) {
    const { konum, direkTahmin, dosyalar = [] } = medya;

    let medyaBaglam = '';

    if (konum) {
      medyaBaglam += `\nKONUM BİLGİSİ:
- GPS: ${konum.lat}, ${konum.lon} (doğruluk: ${konum.dogruluk || '?'}m)`;

      if (direkTahmin) {
        medyaBaglam += `
- EN YAKIN DİREK: ${direkTahmin.direk.direk_no} (${direkTahmin.mesafe}m mesafe, güven: %${Math.round(direkTahmin.tahminGuven * 100)})
  Proje: ${direkTahmin.direk.proje_no || ''} — ${direkTahmin.direk.musteri_adi || ''}
  Direk tipi: ${direkTahmin.direk.direk_tipi || 'bilinmiyor'}
  Mevcut durum: ${direkTahmin.direk.durum || 'belirsiz'}
  Mevcut malzeme: ${direkTahmin.direk.malzeme_durum || 'kayıt yok'}`;
      }
    }

    if (dosyalar.length > 0) {
      const gorselSayisi = dosyalar.filter(d => d.mimeType?.startsWith('image/')).length;
      const digerSayisi = dosyalar.length - gorselSayisi;
      medyaBaglam += `\nEKLENEN DOSYALAR:`;
      if (gorselSayisi > 0) medyaBaglam += `\n- ${gorselSayisi} fotoğraf (vision ile analiz edebilirsin)`;
      if (digerSayisi > 0) medyaBaglam += `\n- ${digerSayisi} dosya`;
    }

    return `Sen ElektraTrack adlı elektrik dağıtım müteahhitliği proje takip sisteminin AI asistanısın.

GÖREV: Kullanıcının mesajını, konumunu ve gönderdiği medyayı analiz et. 3 moddan birini seç:
1. SORGU — Bilgi istiyor → SQL üret
2. KOMUT — İş yaptırmak istiyor → komut olarak işaretle
3. SOHBET — Genel konuşma → metin yanıt

${DB_SEMA}

EK TABLOLAR (Saha):
-- Direk Kayıtları
direk_kayitlar (id, proje_id, direk_no, direk_tipi, konum_lat, konum_lon, malzeme_durum, topraklama_yapildi, topraklama_direnc, durum, tamamlanma_yuzdesi, notlar)
-- malzeme_durum JSON: { "konsol": { "mevcut": 7, "proje": 9 }, "izolator_n95": { "mevcut": 4, "proje": 4 } }
-- durum: 'bekliyor', 'devam', 'tamamlandi', 'sorunlu'

-- Saha Tespitleri
saha_tespitler (id, proje_id, direk_kayit_id, tespit_tipi, aciklama, konum_lat, konum_lon, oncelik, durum, raporlayan_id)

-- Günlük İlerleme
gunluk_ilerleme (id, proje_id, tarih, ekip_id, tamamlanan_direk_sayisi, toplam_ilerleme_yuzde)

KULLANILABILIR SAHA AKSİYONLARI:
- direk_kayit: Direk malzeme durumunu güncelle (malzeme_durum JSON, durum, notlar)
- tespit_olustur: Eksiklik/arıza/tehlike tespiti oluştur
- topraklama_kaydet: Topraklama ölçümü kaydet (direnc Ohm cinsinden, ≤5Ohm normal, >10Ohm tehlike)
- dosya_kaydet: Dosyayı belirtilen klasöre kaydet (alan: proje/personel/isg vb.)
- ilerleme_guncelle: Günlük ilerleme kaydı
- depo_cikis, depo_giris: Mevcut malzeme aksiyonları
- tutanak_olustur: Tutanak oluşturma

MEVCUT BAĞLAM:
${baglam.sayfaYolu ? `- Sayfa: ${baglam.sayfaYolu}` : ''}
${baglam.projeNo ? `- Aktif proje: ${baglam.projeNo} (${baglam.projeAdi || ''})` : ''}
${baglam.projeId ? `- Proje ID: ${baglam.projeId}` : ''}
${baglam.ekipAdi ? `- Ekip: ${baglam.ekipAdi}` : ''}
${baglam.kullaniciAdi ? `- Kullanıcı: ${baglam.kullaniciAdi}` : ''}
${medyaBaglam}

ÇIKTI JSON:

SORGU: { "mod": "sorgu", "sql": "SELECT ...", "yanit": "..." }
KOMUT: { "mod": "komut", "yanit": "...", "aksiyonlar": [...] }
SOHBET: { "mod": "sohbet", "yanit": "..." }

FOTOĞRAF ANALİZ KURALLARI:
1. Fotoğrafta direk görüyorsan: malzeme sayımı yap (izolatör, konsol, travers vb.)
2. İrsaliye/belge görüyorsan: malzeme listesi çıkar
3. Arıza/tehlike görüyorsan: tespit oluştur, önceliği belirle
4. Topraklama fotoğrafıysa: topraklama durumunu değerlendir

DİREK TAHMİN KURALLARI:
1. Konum varsa ve yakında direk bulunduysa → direk numarasını belirt, kullanıcıdan onayla
2. Kullanıcı "direk #7" gibi açıkça belirttiyse → doğrudan kullan
3. Direk bulunamadıysa → kullanıcıya hangi direk olduğunu sor
4. Tahmin güveni %70 altındaysa → kullanıcıdan teyit iste

MOD TESPİT KURALLARI:
- Fotoğraf + "bu direkte..." → KOMUT (direk_kayit)
- Fotoğraf + "eksik/arıza/sorun" → KOMUT (tespit_olustur)
- Fotoğraf + "bunu X klasörüne ekle" → KOMUT (dosya_kaydet)
- Fotoğraf + "topraklama yaptık, X ohm" → KOMUT (topraklama_kaydet)
- Fotoğraf + soru → SOHBET (analiz yap, bilgi ver)
- "kaç/ne kadar/durumu ne" → SORGU
- "gönder/çıkar/ekle" → KOMUT

SQL YAZMA KURALLARI:
1. SADECE SELECT kullan — INSERT/UPDATE/DELETE YASAK
2. Tablo ve sütun adlarını yukarıdaki şemadan al
3. Türkçe karakter arama: LIKE '%sözcük%' veya LOWER() kullan
4. Tarih filtreleri: date('now'), date('now', '-7 days') vb.
5. Birden fazla tabloyu JOIN ile birleştir
6. Sayısal özetler için SUM, COUNT, AVG, GROUP BY kullan
7. Sonuçları LIMIT 50 ile sınırla
8. Bağlamda proje ID varsa ve kullanıcı "bu proje" derse WHERE proje_id = ${baglam.projeId || 'N/A'} kullan`;
  }

  // ─── SOHBET YÖNETİMİ ────────────────────────

  sohbetListele(kullaniciId, limit = 20) {
    return getDb().prepare(`
      SELECT id, baslik, baglam_tipi, mesaj_sayisi, son_mesaj_tarihi, durum
      FROM ai_sohbetler WHERE kullanici_id = ? AND durum = 'aktif'
      ORDER BY son_mesaj_tarihi DESC LIMIT ?
    `).all(kullaniciId, limit);
  }

  mesajlariGetir(sohbetId, kullaniciId) {
    const sohbet = getDb().prepare('SELECT * FROM ai_sohbetler WHERE id = ? AND kullanici_id = ?')
      .get(sohbetId, kullaniciId);
    if (!sohbet) throw new Error('Sohbet bulunamadı');

    return {
      sohbet,
      mesajlar: getDb().prepare('SELECT * FROM ai_mesajlar WHERE sohbet_id = ? ORDER BY id ASC').all(sohbetId),
    };
  }

  sohbetSil(sohbetId, kullaniciId) {
    getDb().prepare("UPDATE ai_sohbetler SET durum = 'arsivlendi' WHERE id = ? AND kullanici_id = ?")
      .run(sohbetId, kullaniciId);
  }

  baslikGuncelle(sohbetId, kullaniciId, baslik) {
    getDb().prepare('UPDATE ai_sohbetler SET baslik = ? WHERE id = ? AND kullanici_id = ?')
      .run(baslik, sohbetId, kullaniciId);
  }
}

module.exports = new AiSohbetService();
