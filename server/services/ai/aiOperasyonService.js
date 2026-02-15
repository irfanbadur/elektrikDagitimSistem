const { getDb } = require('../../db/database');
const aiParseService = require('./aiParseService');
const aksiyonRegistry = require('./aksiyonRegistry');

class AiOperasyonService {

  /**
   * ANA GIRIS NOKTASI — Mesaj + gorselleri isle, aksiyon plani olustur
   * @returns { islemId, anlama, aksiyonlar, uyarilar, sorular }
   */
  async mesajIsle({ metin, gorseller = [], belgeler = [], kullaniciId, projeId, ekipId, veriPaketiId }) {
    const db = getDb();

    // 1. Baglam olustur
    const context = await this._baglamOlustur(kullaniciId, projeId, ekipId);

    // 2. AI parse
    const parseSonuc = await aiParseService.parseEt({ metin, gorseller, belgeler, context });

    // 3. Aksiyonlari dogrula
    const dogrulanmis = [];
    for (const aksiyon of (parseSonuc.aksiyonlar || [])) {
      const tanim = aksiyonRegistry.getir(aksiyon.tip);
      if (!tanim) {
        dogrulanmis.push({ ...aksiyon, gecerli: false, hatalar: [`"${aksiyon.tip}" bilinmeyen aksiyon`] });
        continue;
      }
      const d = tanim.dogrula ? tanim.dogrula(aksiyon.params, context) : { gecerli: true, hatalar: [] };
      dogrulanmis.push({
        ...aksiyon, etiket: tanim.etiket, ikon: tanim.ikon, riskSeviyesi: tanim.riskSeviyesi,
        ozet: tanim.ozet ? tanim.ozet(aksiyon.params) : '', gecerli: d.gecerli, hatalar: d.hatalar || [],
      });
    }

    // 4. DB'ye kaydet
    const result = db.prepare(`
      INSERT INTO ai_islemler (
        girdi_tipi, girdi_metin, veri_paketi_id, parse_sonuc, parse_guven,
        aksiyon_plani, aksiyon_sayisi, durum, kullanici_id, proje_id, ekip_id,
        provider_adi, fallback_kullanildi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'onay_bekliyor', ?, ?, ?, ?, ?)
    `).run(
      gorseller.length > 0 ? 'karma' : 'metin', metin, veriPaketiId || null,
      JSON.stringify(parseSonuc), parseSonuc.anlama?.guven || 0,
      JSON.stringify(dogrulanmis), dogrulanmis.length,
      kullaniciId, projeId || null, ekipId || null,
      parseSonuc._provider || null, parseSonuc._fallback ? 1 : 0
    );

    return {
      islemId: result.lastInsertRowid,
      anlama: parseSonuc.anlama,
      aksiyonlar: dogrulanmis,
      uyarilar: parseSonuc.uyarilar || [],
      sorular: parseSonuc.sorular || [],
    };
  }

  /** ONAYLA — Aksiyonlari uygula */
  async onayla(islemId, kullaniciId, duzeltmeler = null) {
    const db = getDb();
    const islem = db.prepare('SELECT * FROM ai_islemler WHERE id = ?').get(islemId);
    if (!islem) throw new Error('Islem bulunamadi');
    if (islem.durum !== 'onay_bekliyor') throw new Error('Bu islem zaten islenmis');

    let aksiyonlar = JSON.parse(islem.aksiyon_plani);
    if (duzeltmeler) {
      for (const d of duzeltmeler) {
        if (d.sil) aksiyonlar[d.index] = { ...aksiyonlar[d.index], gecerli: false };
        else if (d.params) aksiyonlar[d.index].params = { ...aksiyonlar[d.index].params, ...d.params };
      }
      aksiyonlar = aksiyonlar.filter(a => a.gecerli !== false);
    }

    db.prepare("UPDATE ai_islemler SET durum = 'onaylandi', onay_tarihi = datetime('now') WHERE id = ?").run(islemId);

    const context = { kullaniciId, aiIslemId: islemId, projeId: islem.proje_id, ekipId: islem.ekip_id };
    const sonuclar = [];
    let tumBasarili = true;

    for (const aksiyon of aksiyonlar) {
      const tanim = aksiyonRegistry.getir(aksiyon.tip);
      if (!tanim || !aksiyon.gecerli) {
        sonuclar.push({ tip: aksiyon.tip, basarili: false, mesaj: 'Gecersiz aksiyon' });
        tumBasarili = false;
        continue;
      }
      try {
        const sonuc = await tanim.uygula(aksiyon.params, context);
        sonuclar.push({ tip: aksiyon.tip, ...sonuc });
        if (!sonuc.basarili) tumBasarili = false;
      } catch (err) {
        sonuclar.push({ tip: aksiyon.tip, basarili: false, mesaj: err.message });
        tumBasarili = false;
      }
    }

    const yeniDurum = tumBasarili ? 'uygulandi' : 'kismi_uygulama';
    db.prepare("UPDATE ai_islemler SET durum = ?, uygulama_sonuc = ?, uygulama_tarihi = datetime('now') WHERE id = ?")
      .run(yeniDurum, JSON.stringify(sonuclar), islemId);

    return { islemId, durum: yeniDurum, sonuclar };
  }

  /** REDDET */
  reddet(islemId, kullaniciId, sebep = null) {
    getDb().prepare("UPDATE ai_islemler SET durum = 'reddedildi', hata_mesaji = ?, onay_tarihi = datetime('now') WHERE id = ? AND durum = 'onay_bekliyor'")
      .run(sebep, islemId);
  }

  /** GERI AL */
  async geriAl(islemId, kullaniciId) {
    const db = getDb();
    const islem = db.prepare('SELECT * FROM ai_islemler WHERE id = ?').get(islemId);
    if (!islem || !['uygulandi', 'kismi_uygulama'].includes(islem.durum)) throw new Error('Geri alinamaz');

    for (const sonuc of JSON.parse(islem.uygulama_sonuc || '[]').reverse()) {
      if (!sonuc.basarili) continue;
      const tanim = aksiyonRegistry.getir(sonuc.tip);
      if (tanim?.geriAl) await tanim.geriAl(sonuc.sonuc, { kullaniciId, aiIslemId: islemId });
    }
    db.prepare("UPDATE ai_islemler SET durum = 'geri_alindi' WHERE id = ?").run(islemId);
    return { basarili: true };
  }

  /** Baglam olustur */
  async _baglamOlustur(kullaniciId, projeId, ekipId) {
    const db = getDb();
    const k = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(kullaniciId);
    const roller = db.prepare(
      'SELECT r.rol_adi FROM roller r JOIN kullanici_rolleri kr ON r.id = kr.rol_id WHERE kr.kullanici_id = ?'
    ).all(kullaniciId);
    // projeler tablosunda proje_adi yok, musteri_adi var
    const proje = projeId ? db.prepare('SELECT proje_no, musteri_adi FROM projeler WHERE id = ?').get(projeId) : null;
    const ekip = ekipId ? db.prepare('SELECT ekip_adi, ekip_kodu FROM ekipler WHERE id = ?').get(ekipId) : null;

    // Depodaki malzemeleri AI'ya bildir
    const malzemeler = db.prepare(
      'SELECT malzeme_kodu, malzeme_adi, stok_miktari, birim FROM malzemeler WHERE stok_miktari > 0 ORDER BY kategori, malzeme_kodu'
    ).all();
    const malzemeListesi = malzemeler.map(m => `  ${m.malzeme_kodu} | ${m.malzeme_adi} | stok: ${m.stok_miktari} ${m.birim}`).join('\n');

    return {
      kullaniciId, kullaniciAdi: k?.ad_soyad || 'bilinmiyor',
      rol: roller.map(r => r.rol_adi).join(', ') || 'bilinmiyor',
      projeNo: proje?.proje_no, projeAdi: proje?.musteri_adi,
      ekipAdi: ekip?.ekip_adi, ekipKodu: ekip?.ekip_kodu,
      aksiyonTipleri: aksiyonRegistry.tumunu().map(a => `- ${a.tip}: ${a.aciklama} (${a.ikon} ${a.etiket})`).join('\n'),
      malzemeListesi,
    };
  }
}

module.exports = new AiOperasyonService();
