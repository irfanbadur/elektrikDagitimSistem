const { getDb } = require('../../db/database');
const providerManager = require('./providerManager');
const { guvenliCalistir } = require('./sqlGuvenlik');
const DB_SEMA = require('./dbSema');
const aiOperasyonService = require('./aiOperasyonService');

class AiSohbetService {

  /**
   * MESAJ GÖNDER — Ana giriş noktası
   */
  async mesajGonder({ sohbetId, mesaj, kullaniciId, baglam = {} }) {
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

    // Kullanıcı mesajını kaydet
    db.prepare('INSERT INTO ai_mesajlar (sohbet_id, rol, icerik) VALUES (?, ?, ?)')
      .run(sohbetId, 'kullanici', mesaj);

    // Geçmiş mesajları al (son 10)
    const gecmis = db.prepare(`
      SELECT rol, icerik, mesaj_tipi FROM ai_mesajlar
      WHERE sohbet_id = ? ORDER BY id DESC LIMIT 10
    `).all(sohbetId).reverse();

    // Mod tespiti + yanıt
    const yanit = await this._mesajIsle(mesaj, gecmis, baglam, kullaniciId);

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
   * MOD TESPİTİ + İŞLEME
   */
  async _mesajIsle(mesaj, gecmis, baglam, kullaniciId) {
    const db = getDb();

    const sistemPromptu = this._sistemPromptu(baglam);
    const gecmisMesajlar = gecmis.map(m =>
      `${m.rol === 'kullanici' ? 'Kullanıcı' : 'Asistan'}: ${m.icerik}`
    ).join('\n');

    const prompt = `${gecmisMesajlar ? `GEÇMİŞ KONUŞMA:\n${gecmisMesajlar}\n\n` : ''}Kullanıcı: ${mesaj}`;

    const aiYanit = await providerManager.metinGonder(sistemPromptu, prompt);

    // JSON parse et
    let parsed;
    try {
      const jsonMatch = aiYanit.metin.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return { metin: aiYanit.metin, tip: 'sohbet', meta: { provider: aiYanit.provider } };
    }

    // MOD: SORGU
    if (parsed.mod === 'sorgu' && parsed.sql) {
      const sqlSonuc = guvenliCalistir(db, parsed.sql);

      if (!sqlSonuc.basarili) {
        return {
          metin: `Sorguyu çalıştırırken hata oluştu: ${sqlSonuc.hata}`,
          tip: 'hata',
          meta: { sql: parsed.sql, hata: sqlSonuc.hata },
        };
      }

      // Sonuçları AI'a gönder, insanca özetletir
      const ozetYanit = await providerManager.metinGonder(
        'Sen ElektraTrack sisteminin AI asistanısın. Kullanıcıya sorgu sonuçlarını doğal, anlaşılır Türkçe ile özetle. Tablo formatı kullanma, akıcı cümleler kur. Sayıları ve önemli bilgileri vurgula.',
        `Kullanıcının sorusu: ${mesaj}\n\nSQL: ${parsed.sql}\n\nSonuç (${sqlSonuc.satirSayisi} satır):\n${JSON.stringify(sqlSonuc.satirlar, null, 2)}`
      );

      return {
        metin: ozetYanit.metin,
        tip: 'sorgu',
        meta: {
          sql: parsed.sql,
          satirSayisi: sqlSonuc.satirSayisi,
          satirlar: sqlSonuc.satirlar,
          provider: aiYanit.provider,
        },
      };
    }

    // MOD: KOMUT
    if (parsed.mod === 'komut') {
      try {
        const plan = await aiOperasyonService.mesajIsle({
          metin: mesaj, gorseller: [], kullaniciId,
          projeId: baglam.projeId || null, ekipId: baglam.ekipId || null,
        });

        return {
          metin: parsed.yanit || 'Komut algılandı, aksiyon planı hazırlandı.',
          tip: 'komut',
          meta: { provider: aiYanit.provider },
          aksiyonPlan: plan,
        };
      } catch (err) {
        return { metin: `Komut işlenirken hata: ${err.message}`, tip: 'hata', meta: { hata: err.message } };
      }
    }

    // MOD: SOHBET
    return {
      metin: parsed.yanit || aiYanit.metin,
      tip: 'sohbet',
      meta: { provider: aiYanit.provider },
    };
  }

  /**
   * SİSTEM PROMPTU
   */
  _sistemPromptu(baglam) {
    return `Sen ElektraTrack adlı elektrik dağıtım müteahhitliği proje takip sisteminin AI asistanısın.

GÖREV: Kullanıcının mesajını analiz et ve 3 moddan birini seç:
1. SORGU — Kullanıcı bilgi istiyor → SQL üret
2. KOMUT — Kullanıcı iş yaptırmak istiyor → komut olarak işaretle
3. SOHBET — Genel konuşma, selamlama, yardım → metin yanıt

${DB_SEMA}

MEVCUT BAĞLAM:
${baglam.sayfaYolu ? `- Sayfa: ${baglam.sayfaYolu}` : ''}
${baglam.projeNo ? `- Aktif proje: ${baglam.projeNo} (${baglam.projeAdi || ''})` : ''}
${baglam.projeId ? `- Proje ID: ${baglam.projeId}` : ''}
${baglam.ekipAdi ? `- Ekip: ${baglam.ekipAdi}` : ''}
${baglam.kullaniciAdi ? `- Kullanıcı: ${baglam.kullaniciAdi}` : ''}

ÇIKTI — KESİNLİKLE bu JSON formatında yanıtla:

SORGU modunda:
{
  "mod": "sorgu",
  "sql": "SELECT ... FROM ... WHERE ...",
  "yanit": "Şu bilgiyi arıyorum..."
}

KOMUT modunda:
{
  "mod": "komut",
  "yanit": "Bu işlemi yapacağım..."
}

SOHBET modunda:
{
  "mod": "sohbet",
  "yanit": "Doğal yanıt metni..."
}

SQL YAZMA KURALLARI:
1. SADECE SELECT kullan — INSERT/UPDATE/DELETE YASAK
2. Tablo ve sütun adlarını yukarıdaki şemadan al
3. Türkçe karakter arama: LIKE '%sözcük%' veya LOWER() kullan
4. Tarih filtreleri: date('now'), date('now', '-7 days') vb.
5. Birden fazla tabloyu JOIN ile birleştir
6. Sayısal özetler için SUM, COUNT, AVG, GROUP BY kullan
7. Sonuçları LIMIT 50 ile sınırla
8. Bağlamda proje ID varsa ve kullanıcı "bu proje" derse WHERE proje_id = ${baglam.projeId || 'N/A'} kullan

MOD TESPİT KURALLARI:
- "kaç", "ne kadar", "listele", "göster", "durumu ne", "nerede", "kim" → SORGU
- "ekle", "çıkar", "gönder", "oluştur", "sil", "güncelle", "transfer et" → KOMUT
- "merhaba", "teşekkürler", "nasıl kullanırım", "yardım" → SOHBET
- Belirsizse → SORGU olarak değerlendir (güvenli taraf)`;
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
