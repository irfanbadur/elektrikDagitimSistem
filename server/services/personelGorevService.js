const { getDb } = require('../db/database');

class PersonelGorevService {
  get db() {
    return getDb();
  }

  // ═══════════════════════════════════════════
  // HİYERARŞİ
  // ═══════════════════════════════════════════

  altPersonel(kullaniciId, derinlik = 10) {
    const sonuc = [];
    const bul = (ustId, seviye) => {
      if (seviye > derinlik) return;
      const altlar = this.db.prepare(`
        SELECT k.id, k.ad_soyad, k.email, k.telefon, k.durum, k.pozisyon_id, k.ust_kullanici_id,
               p.ad as pozisyon_adi, p.seviye as pozisyon_seviye, p.kod as pozisyon_kodu
        FROM kullanicilar k
        LEFT JOIN pozisyonlar p ON k.pozisyon_id = p.id
        WHERE k.ust_kullanici_id = ? AND k.durum = 'aktif'
        ORDER BY p.seviye, k.ad_soyad
      `).all(ustId);

      for (const kisi of altlar) {
        sonuc.push({ ...kisi, hiyerarsi_derinlik: seviye });
        bul(kisi.id, seviye + 1);
      }
    };
    bul(kullaniciId, 1);
    return sonuc;
  }

  ustZincir(kullaniciId) {
    const zincir = [];
    let mevcutId = kullaniciId;
    let guvenlik = 0;

    while (mevcutId && guvenlik < 20) {
      const kisi = this.db.prepare(`
        SELECT k.id, k.ad_soyad, k.pozisyon_id, k.ust_kullanici_id,
               p.ad as pozisyon_adi, p.seviye as pozisyon_seviye
        FROM kullanicilar k
        LEFT JOIN pozisyonlar p ON k.pozisyon_id = p.id
        WHERE k.id = ?
      `).get(mevcutId);

      if (!kisi) break;
      if (kisi.id !== kullaniciId) zincir.push(kisi);
      mevcutId = kisi.ust_kullanici_id;
      guvenlik++;
    }
    return zincir;
  }

  organizasyonAgaci() {
    const tumPersonel = this.db.prepare(`
      SELECT k.id, k.ad_soyad, k.ust_kullanici_id, k.durum, k.email, k.telefon,
             p.ad as pozisyon_adi, p.seviye, p.kod as pozisyon_kodu, p.kategori
      FROM kullanicilar k
      LEFT JOIN pozisyonlar p ON k.pozisyon_id = p.id
      WHERE k.durum = 'aktif'
      ORDER BY p.seviye, k.ad_soyad
    `).all();

    const agac = (ustId) => {
      return tumPersonel
        .filter(k => k.ust_kullanici_id === ustId)
        .map(k => ({
          ...k,
          altlar: agac(k.id)
        }));
    };

    return agac(null);
  }

  kullaniciDetay(id) {
    const kullanici = this.db.prepare(`
      SELECT k.*, r.rol_adi as pozisyon_adi, r.seviye as pozisyon_seviye,
             r.rol_kodu as pozisyon_kodu, r.id as rol_id,
             ust.ad_soyad as ust_kullanici_adi
      FROM kullanicilar k
      LEFT JOIN kullanici_rolleri kr ON kr.kullanici_id = k.id
      LEFT JOIN roller r ON kr.rol_id = r.id
      LEFT JOIN kullanicilar ust ON k.ust_kullanici_id = ust.id
      WHERE k.id = ?
    `).get(id);

    if (!kullanici) return null;

    // sifre_hash'i çıkar
    delete kullanici.sifre_hash;
    return kullanici;
  }

  // ═══════════════════════════════════════════
  // GÖREV ATAMA
  // ═══════════════════════════════════════════

  gorevAta({ kullaniciId, gorevTanimId, projeId, baslangicTarihi, atamaNotu, atayanId, ozelAciklama }) {
    const gorevTanimi = this.db.prepare(
      'SELECT * FROM gorev_tanimlari WHERE id = ?'
    ).get(gorevTanimId);

    if (!gorevTanimi) throw new Error('Görev tanımı bulunamadı');

    const kullanici = this.db.prepare(`
      SELECT k.*, p.kod as pozisyon_kodu, p.seviye as pozisyon_seviye
      FROM kullanicilar k
      LEFT JOIN pozisyonlar p ON k.pozisyon_id = p.id
      WHERE k.id = ?
    `).get(kullaniciId);

    if (!kullanici) throw new Error('Kullanıcı bulunamadı');

    // VALİDASYON 1: Proje bazlı görev ise proje_id zorunlu
    if (gorevTanimi.zorunlu_proje && !projeId) {
      throw new Error(`"${gorevTanimi.ad}" görevi proje bazlıdır, proje seçilmeli`);
    }

    // VALİDASYON 2: Pozisyon uygunluğu
    if (gorevTanimi.gerekli_pozisyonlar) {
      const uygunPozisyonlar = JSON.parse(gorevTanimi.gerekli_pozisyonlar);
      if (kullanici.pozisyon_kodu && !uygunPozisyonlar.includes(kullanici.pozisyon_kodu)) {
        throw new Error(
          `"${kullanici.ad_soyad}" (${kullanici.pozisyon_kodu}) bu göreve atanamaz. Uygun pozisyonlar: ${uygunPozisyonlar.join(', ')}`
        );
      }
    }

    // VALİDASYON 3: Hiyerarşi seviyesi
    if (gorevTanimi.min_seviye && kullanici.pozisyon_seviye && kullanici.pozisyon_seviye > gorevTanimi.min_seviye + 1) {
      throw new Error(
        `Bu görev minimum seviye ${gorevTanimi.min_seviye} gerektirir, ${kullanici.ad_soyad} seviye ${kullanici.pozisyon_seviye}`
      );
    }

    // VALİDASYON 4: Gerekli belgeler
    if (gorevTanimi.gerekli_belgeler && gorevTanimi.gerekli_belgeler !== 'null') {
      const gerekliBelgeler = JSON.parse(gorevTanimi.gerekli_belgeler);
      const mevcutBelgeler = this.db.prepare(`
        SELECT belge_tipi FROM kullanici_belgeler
        WHERE kullanici_id = ? AND aktif = 1
          AND (bitis_tarihi IS NULL OR bitis_tarihi > date('now'))
      `).all(kullaniciId).map(b => b.belge_tipi);

      const eksikler = gerekliBelgeler.filter(b => !mevcutBelgeler.includes(b));
      if (eksikler.length > 0) {
        throw new Error(`Eksik belgeler: ${eksikler.join(', ')}. Bu belge(ler) olmadan "${gorevTanimi.ad}" görevi atanamaz.`);
      }
    }

    // VALİDASYON 5: Aynı projede aynı görevden max sayı kontrolü
    if (gorevTanimi.max_ayni_anda > 0 && projeId) {
      const mevcutSayi = this.db.prepare(`
        SELECT COUNT(*) as sayi FROM kullanici_gorevler
        WHERE gorev_tanim_id = ? AND proje_id = ? AND aktif = 1
      `).get(gorevTanimId, projeId).sayi;

      if (mevcutSayi >= gorevTanimi.max_ayni_anda) {
        throw new Error(`Bu projede zaten ${mevcutSayi} "${gorevTanimi.ad}" atanmış. Maksimum: ${gorevTanimi.max_ayni_anda}`);
      }
    }

    // VALİDASYON 6: Aynı görev zaten atanmış mı?
    const mevcutGorev = this.db.prepare(`
      SELECT id FROM kullanici_gorevler
      WHERE kullanici_id = ? AND gorev_tanim_id = ? AND proje_id IS ?
        AND aktif = 1
    `).get(kullaniciId, gorevTanimId, projeId || null);

    if (mevcutGorev) {
      throw new Error(`"${kullanici.ad_soyad}" zaten bu görevde aktif`);
    }

    const sonuc = this.db.prepare(`
      INSERT INTO kullanici_gorevler
        (kullanici_id, gorev_tanim_id, proje_id, baslangic_tarihi, atayan_id, atama_notu, ozel_aciklama)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(kullaniciId, gorevTanimId, projeId || null, baslangicTarihi, atayanId, atamaNotu, ozelAciklama);

    return { id: sonuc.lastInsertRowid, basarili: true };
  }

  gorevSonlandir(gorevId, bitisTarihi) {
    this.db.prepare(`
      UPDATE kullanici_gorevler
      SET aktif = 0, bitis_tarihi = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(bitisTarihi || new Date().toISOString().split('T')[0], gorevId);
  }

  kisininGorevleri(kullaniciId) {
    return this.db.prepare(`
      SELECT kg.*, gt.kod as gorev_kodu, gt.ad as gorev_adi,
             gt.kategori, gt.sorumluluklar,
             p.proje_no, p.proje_tipi
      FROM kullanici_gorevler kg
      JOIN gorev_tanimlari gt ON kg.gorev_tanim_id = gt.id
      LEFT JOIN projeler p ON kg.proje_id = p.id
      WHERE kg.kullanici_id = ? AND kg.aktif = 1
      ORDER BY gt.kategori, gt.ad
    `).all(kullaniciId);
  }

  projeninGorevleri(projeId) {
    return this.db.prepare(`
      SELECT kg.*, gt.kod as gorev_kodu, gt.ad as gorev_adi,
             k.ad_soyad, poz.ad as pozisyon_adi
      FROM kullanici_gorevler kg
      JOIN gorev_tanimlari gt ON kg.gorev_tanim_id = gt.id
      JOIN kullanicilar k ON kg.kullanici_id = k.id
      LEFT JOIN pozisyonlar poz ON k.pozisyon_id = poz.id
      WHERE kg.proje_id = ? AND kg.aktif = 1
      ORDER BY gt.ad
    `).all(projeId);
  }

  gorevdekiKisiler(gorevKodu, projeId = null) {
    let sql = `
      SELECT k.id, k.ad_soyad, k.telefon, poz.ad as pozisyon_adi,
             kg.proje_id, p.proje_no
      FROM kullanici_gorevler kg
      JOIN gorev_tanimlari gt ON kg.gorev_tanim_id = gt.id
      JOIN kullanicilar k ON kg.kullanici_id = k.id
      LEFT JOIN pozisyonlar poz ON k.pozisyon_id = poz.id
      LEFT JOIN projeler p ON kg.proje_id = p.id
      WHERE gt.kod = ? AND kg.aktif = 1
    `;
    const params = [gorevKodu];

    if (projeId) {
      sql += ' AND kg.proje_id = ?';
      params.push(projeId);
    }

    return this.db.prepare(sql).all(...params);
  }

  projeZorunluGorevKontrol(projeId) {
    const zorunluGorevler = ['santiye_sefi', 'proje_sorumlusu'];
    const eksikler = [];

    for (const kod of zorunluGorevler) {
      const atanmis = this.db.prepare(`
        SELECT COUNT(*) as sayi FROM kullanici_gorevler kg
        JOIN gorev_tanimlari gt ON kg.gorev_tanim_id = gt.id
        WHERE gt.kod = ? AND kg.proje_id = ? AND kg.aktif = 1
      `).get(kod, projeId).sayi;

      if (atanmis === 0) {
        const gorev = this.db.prepare(
          'SELECT ad FROM gorev_tanimlari WHERE kod = ?'
        ).get(kod);
        if (gorev) eksikler.push(gorev.ad);
      }
    }

    return { tamam: eksikler.length === 0, eksikGorevler: eksikler };
  }

  // ═══════════════════════════════════════════
  // BELGE YÖNETİMİ
  // ═══════════════════════════════════════════

  belgeEkle({ kullaniciId, belgeTuruId, belgeTipi, belgeNo, verenKurum, baslangicTarihi, bitisTarihi, notlar }) {
    const sonuc = this.db.prepare(`
      INSERT INTO kullanici_belgeler
        (kullanici_id, belge_turu_id, belge_tipi, belge_no, veren_kurum, baslangic_tarihi, bitis_tarihi, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(kullaniciId, belgeTuruId, belgeTipi, belgeNo, verenKurum, baslangicTarihi, bitisTarihi, notlar);

    return { id: sonuc.lastInsertRowid };
  }

  belgeGuncelle(id, data) {
    const alanlar = [];
    const degerler = [];

    for (const [anahtar, deger] of Object.entries(data)) {
      if (['belge_no', 'veren_kurum', 'baslangic_tarihi', 'bitis_tarihi', 'durum', 'notlar'].includes(anahtar)) {
        alanlar.push(`${anahtar} = ?`);
        degerler.push(deger);
      }
    }

    if (alanlar.length === 0) return;

    alanlar.push('guncelleme_tarihi = CURRENT_TIMESTAMP');
    degerler.push(id);

    this.db.prepare(`UPDATE kullanici_belgeler SET ${alanlar.join(', ')} WHERE id = ?`).run(...degerler);
  }

  belgeSil(id) {
    this.db.prepare('UPDATE kullanici_belgeler SET aktif = 0, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }

  suresiDolacakBelgeler(gunSayisi = 30) {
    const hedefTarih = new Date();
    hedefTarih.setDate(hedefTarih.getDate() + gunSayisi);

    return this.db.prepare(`
      SELECT kb.*, k.ad_soyad, k.telefon,
             bt.ad as belge_adi, bt.kategori,
             CAST(julianday(kb.bitis_tarihi) - julianday('now') AS INTEGER) as kalan_gun
      FROM kullanici_belgeler kb
      JOIN kullanicilar k ON kb.kullanici_id = k.id
      JOIN belge_turleri bt ON kb.belge_turu_id = bt.id
      WHERE kb.aktif = 1
        AND kb.bitis_tarihi IS NOT NULL
        AND kb.bitis_tarihi <= ?
        AND kb.bitis_tarihi >= date('now')
      ORDER BY kb.bitis_tarihi ASC
    `).all(hedefTarih.toISOString().split('T')[0]);
  }

  suresiDolmusBelgeler() {
    return this.db.prepare(`
      SELECT kb.*, k.ad_soyad, k.telefon,
             bt.ad as belge_adi, bt.kategori,
             CAST(julianday('now') - julianday(kb.bitis_tarihi) AS INTEGER) as gecen_gun
      FROM kullanici_belgeler kb
      JOIN kullanicilar k ON kb.kullanici_id = k.id
      JOIN belge_turleri bt ON kb.belge_turu_id = bt.id
      WHERE kb.aktif = 1
        AND kb.bitis_tarihi IS NOT NULL
        AND kb.bitis_tarihi < date('now')
      ORDER BY kb.bitis_tarihi ASC
    `).all();
  }

  eksikZorunluBelgeler() {
    return this.db.prepare(`
      SELECT k.id, k.ad_soyad, bt.kod as belge_kodu, bt.ad as belge_adi
      FROM kullanicilar k
      CROSS JOIN belge_turleri bt
      WHERE bt.zorunlu = 1
        AND k.durum = 'aktif'
        AND NOT EXISTS (
          SELECT 1 FROM kullanici_belgeler kb
          WHERE kb.kullanici_id = k.id
            AND kb.belge_tipi = bt.kod
            AND kb.aktif = 1
            AND (kb.bitis_tarihi IS NULL OR kb.bitis_tarihi >= date('now'))
        )
      ORDER BY k.ad_soyad, bt.ad
    `).all();
  }

  kisiBelgeOzeti(kullaniciId) {
    return this.db.prepare(`
      SELECT kb.*, bt.ad as belge_adi, bt.kategori, bt.yenileme_suresi_ay,
             CASE
               WHEN kb.bitis_tarihi IS NULL THEN 'suresiz'
               WHEN kb.bitis_tarihi < date('now') THEN 'suresi_dolmus'
               WHEN kb.bitis_tarihi < date('now', '+30 days') THEN 'yakinda_dolacak'
               ELSE 'gecerli'
             END as belge_durum
      FROM kullanici_belgeler kb
      JOIN belge_turleri bt ON kb.belge_turu_id = bt.id
      WHERE kb.kullanici_id = ? AND kb.aktif = 1
      ORDER BY bt.kategori, bt.ad
    `).all(kullaniciId);
  }

  // ═══════════════════════════════════════════
  // YETKİNLİK
  // ═══════════════════════════════════════════

  yetkinlikEkleGuncelle({ kullaniciId, yetkinlikId, seviye, notlar, degerlendirenId }) {
    const mevcut = this.db.prepare(
      'SELECT id FROM kullanici_yetkinlikler WHERE kullanici_id = ? AND yetkinlik_id = ?'
    ).get(kullaniciId, yetkinlikId);

    if (mevcut) {
      this.db.prepare(`
        UPDATE kullanici_yetkinlikler
        SET seviye = ?, notlar = ?, degerlendiren_id = ?, degerlendirme_tarihi = date('now')
        WHERE id = ?
      `).run(seviye, notlar, degerlendirenId, mevcut.id);
      return { id: mevcut.id, guncellendi: true };
    }

    const sonuc = this.db.prepare(`
      INSERT INTO kullanici_yetkinlikler (kullanici_id, yetkinlik_id, seviye, notlar, degerlendiren_id, degerlendirme_tarihi)
      VALUES (?, ?, ?, ?, ?, date('now'))
    `).run(kullaniciId, yetkinlikId, seviye, notlar, degerlendirenId);

    return { id: sonuc.lastInsertRowid, guncellendi: false };
  }

  kisiYetkinlikleri(kullaniciId) {
    return this.db.prepare(`
      SELECT ky.*, yt.kod as yetkinlik_kodu, yt.ad as yetkinlik_adi, yt.kategori,
             d.ad_soyad as degerlendiren_adi
      FROM kullanici_yetkinlikler ky
      JOIN yetkinlik_tanimlari yt ON ky.yetkinlik_id = yt.id
      LEFT JOIN kullanicilar d ON ky.degerlendiren_id = d.id
      WHERE ky.kullanici_id = ?
      ORDER BY yt.kategori, yt.ad
    `).all(kullaniciId);
  }

  yetkinligeGoreAra(kod, minSeviye) {
    const seviyeSiralama = { baslangic: 1, orta: 2, ileri: 3, uzman: 4 };
    const minSeviyeNum = seviyeSiralama[minSeviye] || 1;

    const tum = this.db.prepare(`
      SELECT ky.*, yt.kod as yetkinlik_kodu, yt.ad as yetkinlik_adi,
             k.ad_soyad, k.telefon, poz.ad as pozisyon_adi
      FROM kullanici_yetkinlikler ky
      JOIN yetkinlik_tanimlari yt ON ky.yetkinlik_id = yt.id
      JOIN kullanicilar k ON ky.kullanici_id = k.id
      LEFT JOIN pozisyonlar poz ON k.pozisyon_id = poz.id
      WHERE yt.kod = ? AND k.durum = 'aktif'
      ORDER BY ky.seviye DESC
    `).all(kod);

    return tum.filter(r => (seviyeSiralama[r.seviye] || 0) >= minSeviyeNum);
  }

  // ═══════════════════════════════════════════
  // YARDIMCI
  // ═══════════════════════════════════════════

  pozisyonlar() {
    return this.db.prepare('SELECT * FROM pozisyonlar WHERE aktif = 1 ORDER BY seviye, ad').all();
  }

  pozisyonEkle({ kod, ad, seviye, kategori, aciklama, varsayilanSistemRolu }) {
    const sonuc = this.db.prepare(`
      INSERT INTO pozisyonlar (kod, ad, seviye, kategori, aciklama, varsayilan_sistem_rolu)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(kod, ad, seviye, kategori, aciklama, varsayilanSistemRolu);
    return { id: sonuc.lastInsertRowid };
  }

  gorevTanimlari() {
    return this.db.prepare('SELECT * FROM gorev_tanimlari WHERE aktif = 1 ORDER BY kategori, ad').all();
  }

  belgeTurleri() {
    return this.db.prepare('SELECT * FROM belge_turleri WHERE aktif = 1 ORDER BY kategori, ad').all();
  }

  yetkinlikTanimlari() {
    return this.db.prepare('SELECT * FROM yetkinlik_tanimlari WHERE aktif = 1 ORDER BY kategori, ad').all();
  }

  personelListesi() {
    return this.db.prepare(`
      SELECT k.id, k.kullanici_adi, k.ad_soyad, k.email, k.telefon, k.durum,
             k.ust_kullanici_id, k.ise_giris_tarihi,
             r.rol_adi as pozisyon_adi, r.seviye as pozisyon_seviye, r.rol_kodu as pozisyon_kodu,
             ust.ad_soyad as ust_kullanici_adi
      FROM kullanicilar k
      LEFT JOIN kullanici_rolleri kr ON kr.kullanici_id = k.id
      LEFT JOIN roller r ON kr.rol_id = r.id
      LEFT JOIN kullanicilar ust ON k.ust_kullanici_id = ust.id
      WHERE k.durum = 'aktif'
      GROUP BY k.id
      ORDER BY r.seviye DESC, k.ad_soyad
    `).all();
  }

  // ═══════════════════════════════════════════
  // İŞ GÖREVLERİ MATRİSİ
  // ═══════════════════════════════════════════

  tumIsGorevleri() {
    // Tüm kullanıcıları ve atanmış iş görevlerini getir
    const kullanicilar = this.db.prepare(`
      SELECT k.id, k.ad_soyad, k.durum,
             r.rol_adi as pozisyon_adi
      FROM kullanicilar k
      LEFT JOIN kullanici_rolleri kr ON kr.kullanici_id = k.id
      LEFT JOIN roller r ON kr.rol_id = r.id
      WHERE k.durum = 'aktif'
      GROUP BY k.id
      ORDER BY k.ad_soyad
    `).all();

    const gorevler = this.db.prepare(`
      SELECT kig.*, k.ad_soyad
      FROM kullanici_is_gorevleri kig
      JOIN kullanicilar k ON kig.kullanici_id = k.id
    `).all();

    // Görevleri kullanıcı bazında grupla
    const gorevMap = {};
    for (const g of gorevler) {
      if (!gorevMap[g.kullanici_id]) gorevMap[g.kullanici_id] = [];
      gorevMap[g.kullanici_id].push(g);
    }

    return kullanicilar.map(k => ({
      ...k,
      gorevler: gorevMap[k.id] || []
    }));
  }

  isGorevAta({ kullaniciId, isTipi, gorevTipi, gecici, notlar, atayanId }) {
    // UPSERT: aynı kullanıcı+iş tipi varsa güncelle, yoksa ekle
    const mevcut = this.db.prepare(
      'SELECT id FROM kullanici_is_gorevleri WHERE kullanici_id = ? AND is_tipi = ?'
    ).get(kullaniciId, isTipi);

    if (mevcut) {
      this.db.prepare(`
        UPDATE kullanici_is_gorevleri
        SET gorev_tipi = ?, gecici = ?, notlar = ?, atayan_id = ?
        WHERE id = ?
      `).run(gorevTipi, gecici ? 1 : 0, notlar, atayanId, mevcut.id);
      return { id: mevcut.id, guncellendi: true };
    }

    const sonuc = this.db.prepare(`
      INSERT INTO kullanici_is_gorevleri (kullanici_id, is_tipi, gorev_tipi, gecici, notlar, atayan_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(kullaniciId, isTipi, gorevTipi, gecici ? 1 : 0, notlar, atayanId);

    return { id: sonuc.lastInsertRowid, guncellendi: false };
  }

  isGorevSil(id) {
    this.db.prepare('DELETE FROM kullanici_is_gorevleri WHERE id = ?').run(id);
  }

  kullaniciGuncelle(id, data) {
    const izinliAlanlar = [
      'ust_kullanici_id', 'tc_kimlik', 'dogum_tarihi',
      'ise_giris_tarihi', 'kan_grubu', 'acil_kisi', 'acil_telefon', 'adres', 'notlar',
      'ad_soyad', 'email', 'telefon'
    ];

    const alanlar = [];
    const degerler = [];

    for (const [anahtar, deger] of Object.entries(data)) {
      if (izinliAlanlar.includes(anahtar)) {
        alanlar.push(`${anahtar} = ?`);
        degerler.push(deger === '' ? null : deger);
      }
    }

    if (alanlar.length > 0) {
      alanlar.push('guncelleme_tarihi = CURRENT_TIMESTAMP');
      degerler.push(id);
      this.db.prepare(`UPDATE kullanicilar SET ${alanlar.join(', ')} WHERE id = ?`).run(...degerler);
    }

    // pozisyon_id aslında rol_id — kullanici_rolleri tablosunu güncelle
    if (data.pozisyon_id !== undefined) {
      const rolId = data.pozisyon_id === '' ? null : data.pozisyon_id;
      this.db.prepare('DELETE FROM kullanici_rolleri WHERE kullanici_id = ?').run(id);
      if (rolId) {
        this.db.prepare('INSERT OR IGNORE INTO kullanici_rolleri (kullanici_id, rol_id) VALUES (?, ?)').run(id, rolId);
      }
    }
  }
}

module.exports = new PersonelGorevService();
