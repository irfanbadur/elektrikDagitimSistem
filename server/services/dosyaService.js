const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const {
  sahaFotoAdi, projeDosyaAdi, dosyaYoluHesapla, dosyaYoluHesaplaV2,
  thumbnailYoluHesapla, uzantidanKategori, slugify
} = require('./dosyaIsimService');
const donguService = require('./donguService');

// Uploads kök dizini — tenant-aware
const { getCurrentTenantSlug } = require('../db/database');
function getUploadsRoot() {
  const slug = getCurrentTenantSlug();
  if (slug) return path.join(__dirname, '../../data/tenants', slug, 'uploads');
  return process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');
}

class DosyaService {

  // ═══════════════════════════════════════════════
  // DOSYA YÜKLEME — Evrensel
  // ═══════════════════════════════════════════════
  async dosyaYukle(buffer, {
    orijinalAdi,
    // v2 alan bazlı parametreler
    alan = null,
    altAlan = null,
    iliskiliKaynakTipi = null,
    iliskiliKaynakId = null,
    personelKodu = null,
    ekipmanKodu = null,
    ihaleNo = null,
    kurumAdi = null,
    ozelAlanlar = null,
    adimAdi = null,
    adimDosyaSayisi = 0,
    // mevcut parametreler
    projeNo = null,
    projeTipi = null,
    projeId = null,
    ekipId = null,
    ekipKodu = null,
    yukleyenId = null,
    veriPaketiId = null,
    baslik = null,
    notlar = null,
    etiketler = [],
    latitude = null,
    longitude = null,
    konumAdi = null,
    konumKaynagi = null,
    kaynak = 'web',
    projeAsamaId = null,
    projeAdimId = null,
  }) {
    const db = getDb();

    // 1. Dosya uzantısı ve kategorisini belirle
    const uzanti = orijinalAdi.split('.').pop().toLowerCase();
    const kategori = uzantidanKategori(orijinalAdi);
    const mimeTipi = this.mimeTipiBelirle(uzanti);

    // 2. Dosya adını oluştur
    let dosyaAdi;
    if (kategori === 'fotograf') {
      dosyaAdi = sahaFotoAdi({
        aciklama: baslik || orijinalAdi.replace(/\.[^.]+$/, ''),
        ekipKodu: ekipKodu,
        uzanti: uzanti === 'heic' ? 'jpg' : uzanti,
      });
    } else {
      dosyaAdi = projeNo
        ? projeDosyaAdi({ projeNo, aciklama: baslik || orijinalAdi.replace(/\.[^.]+$/, ''), uzanti })
        : `${new Date().toISOString().slice(0,10)}_${uuidv4().slice(0,6)}_${orijinalAdi}`;
    }

    // 3. Fiziksel yolu hesapla
    // v2: alan belirtilmişse yeni yol hesaplama, yoksa eski uyumlu yol
    const efektifAlan = alan || 'proje';
    let efektifAltAlan = altAlan || (efektifAlan !== 'proje' ? null : null);

    // Proje dosyaları: IS_TIPI/PROJE_NO (tek dosya) veya IS_TIPI/PROJE_NO/ADIM_ADI (çoklu)
    let adimKlasoru = null;
    if (efektifAlan === 'proje' && projeTipi && projeNo) {
      efektifAltAlan = `${projeTipi.toUpperCase()}/${projeNo}`;

      // Adım bazlı: birden çok dosya varsa adım adı ile alt klasör
      if (adimAdi && adimDosyaSayisi >= 1) {
        adimKlasoru = slugify(adimAdi);
        efektifAltAlan = `${projeTipi.toUpperCase()}/${projeNo}/${adimKlasoru}`;

        // İlk dosyayı da adım klasörüne taşı (eğer proje kökündeyse)
        if (adimDosyaSayisi === 1 && projeAdimId) {
          try {
            const ilkDosya = db.prepare("SELECT id, dosya_yolu, thumbnail_yolu, alt_alan FROM dosyalar WHERE proje_adim_id = ? AND durum = 'aktif' ORDER BY id ASC LIMIT 1").get(projeAdimId);
            if (ilkDosya && ilkDosya.dosya_yolu) {
              const ilkKlasorAdi = path.basename(path.dirname(ilkDosya.dosya_yolu));
              // Sadece adım klasöründe değilse taşı
              if (ilkKlasorAdi !== adimKlasoru) {
                const dosyaBasAdi = path.basename(ilkDosya.dosya_yolu);
                const ustKlasor = path.dirname(ilkDosya.dosya_yolu).replace(/\\/g, '/');
                const yeniYol = `${ustKlasor}/${adimKlasoru}/${dosyaBasAdi}`;
                const eskiTam = path.join(getUploadsRoot(), ilkDosya.dosya_yolu);
                const yeniTam = path.join(getUploadsRoot(), yeniYol);
                fs.mkdirSync(path.dirname(yeniTam), { recursive: true });
                if (fs.existsSync(eskiTam)) {
                  fs.renameSync(eskiTam, yeniTam);
                  const yeniAltAlan = `${projeTipi.toUpperCase()}/${projeNo}/${adimKlasoru}`;
                  db.prepare('UPDATE dosyalar SET dosya_yolu = ?, alt_alan = ? WHERE id = ?').run(yeniYol, yeniAltAlan, ilkDosya.id);
                  // Thumbnail da taşı
                  if (ilkDosya.thumbnail_yolu) {
                    const thumbAdi = path.basename(ilkDosya.thumbnail_yolu);
                    const yeniThumbYol = `${ustKlasor}/${adimKlasoru}/thumb/${thumbAdi}`;
                    const eskiThumbTam = path.join(getUploadsRoot(), ilkDosya.thumbnail_yolu);
                    const yeniThumbTam = path.join(getUploadsRoot(), yeniThumbYol);
                    fs.mkdirSync(path.dirname(yeniThumbTam), { recursive: true });
                    if (fs.existsSync(eskiThumbTam)) {
                      fs.renameSync(eskiThumbTam, yeniThumbTam);
                      db.prepare('UPDATE dosyalar SET thumbnail_yolu = ? WHERE id = ?').run(yeniThumbYol, ilkDosya.id);
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error('İlk dosya taşıma hatası:', e.message);
          }
        }
      }
    }

    const goreceliYol = alan
      ? dosyaYoluHesaplaV2({ alan: efektifAlan, altAlan: efektifAltAlan, dosyaAdi, projeNo, projeTipi, personelKodu, ekipmanKodu, ihaleNo, kurumAdi })
      : dosyaYoluHesapla({ projeNo, kategori, dosyaAdi });

    const tamYol = path.join(getUploadsRoot(), goreceliYol);
    const klasor = path.dirname(tamYol);

    // 4. Klasörü oluştur
    fs.mkdirSync(klasor, { recursive: true });

    // 5. Dosya tipine göre işle
    let dosyaBoyutu = buffer.length;
    let ozelAlanlarObj = ozelAlanlar ? (typeof ozelAlanlar === 'string' ? JSON.parse(ozelAlanlar) : ozelAlanlar) : {};
    let thumbnailYolu = null;
    let islenmisBuf = buffer;

    if (kategori === 'fotograf') {
      // HEIC → JPEG dönüşümü
      if (uzanti === 'heic') {
        islenmisBuf = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
      }

      // Metadata oku
      const imgMeta = await sharp(islenmisBuf).metadata();
      ozelAlanlarObj.genislik = imgMeta.width;
      ozelAlanlarObj.yukseklik = imgMeta.height;

      // EXIF oku
      const exif = await this.exifOku(islenmisBuf);
      if (exif) {
        if (exif.latitude && !latitude) {
          latitude = exif.latitude;
          longitude = exif.longitude;
          konumKaynagi = 'exif';
        }
        if (exif.dateTime) {
          ozelAlanlarObj.cekim_tarihi = exif.dateTime;
        }
        if (exif.camera) {
          ozelAlanlarObj.kamera = exif.camera;
        }
      }

      // Thumbnail oluştur
      const thumbGoreceliYol = thumbnailYoluHesapla(goreceliYol);
      const thumbTamYol = path.join(getUploadsRoot(), thumbGoreceliYol);
      fs.mkdirSync(path.dirname(thumbTamYol), { recursive: true });

      await sharp(islenmisBuf)
        .resize(300, 300, { fit: 'inside' })
        .jpeg({ quality: 75 })
        .toFile(thumbTamYol);

      thumbnailYolu = thumbGoreceliYol;
      dosyaBoyutu = islenmisBuf.length;
    }

    // 6. Dosyayı kaydet
    fs.writeFileSync(tamYol, islenmisBuf);

    // 7. Aktif aşamayı otomatik bağla
    if (!projeAsamaId && projeId) {
      projeAsamaId = donguService.aktifAsamaIdGetir(projeId);
    }

    // 8. Veritabanına kaydet
    const result = db.prepare(`
      INSERT INTO dosyalar (
        dosya_adi, orijinal_adi, dosya_yolu, thumbnail_yolu,
        dosya_boyutu, mime_tipi, kategori,
        alan, alt_alan, iliskili_kaynak_tipi, iliskili_kaynak_id,
        latitude, longitude, konum_adi, konum_kaynagi, altitude,
        proje_id, ekip_id, yukleyen_id, veri_paketi_id,
        baslik, notlar, etiketler, ozel_alanlar,
        kaynak, proje_asama_id, proje_adim_id, durum, olusturma_tarihi
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, 'aktif', datetime('now')
      )
    `).run(
      dosyaAdi, orijinalAdi, goreceliYol, thumbnailYolu,
      dosyaBoyutu, mimeTipi, kategori,
      efektifAlan, efektifAltAlan, iliskiliKaynakTipi, iliskiliKaynakId,
      latitude, longitude, konumAdi, konumKaynagi, null,
      projeId, ekipId, yukleyenId, veriPaketiId,
      baslik, notlar,
      etiketler.length > 0 ? JSON.stringify(etiketler) : null,
      Object.keys(ozelAlanlarObj).length > 0 ? JSON.stringify(ozelAlanlarObj) : null,
      kaynak, projeAsamaId, projeAdimId
    );

    return {
      id: result.lastInsertRowid,
      dosyaAdi,
      dosyaYolu: goreceliYol,
      thumbnailYolu,
      kategori,
      dosyaBoyutu,
      latitude,
      longitude,
    };
  }

  // ═══════════════════════════════════════════════
  // DOSYA SORGULAMA
  // ═══════════════════════════════════════════════

  dosyalariGetir({
    // v2 alan filtreleri
    alan, altAlan,
    iliskiliKaynakTipi, iliskiliKaynakId,
    // mevcut filtreler
    projeId, ekipId, veriPaketiId, kategori, etiket,
    kaynak, durum = 'aktif', limit = 50, offset = 0,
    siralama = 'olusturma_tarihi DESC'
  } = {}) {
    const db = getDb();
    let where = ['d.durum = ?'];
    let params = [durum];

    // v2 alan filtreleri
    if (alan) { where.push('d.alan = ?'); params.push(alan); }
    if (altAlan) {
      if (altAlan.endsWith('*')) {
        where.push('d.alt_alan LIKE ?'); params.push(altAlan.replace('*', '%'));
      } else {
        where.push('d.alt_alan = ?'); params.push(altAlan);
      }
    }
    if (iliskiliKaynakTipi && iliskiliKaynakId) {
      where.push('d.iliskili_kaynak_tipi = ? AND d.iliskili_kaynak_id = ?');
      params.push(iliskiliKaynakTipi, iliskiliKaynakId);
    }

    // mevcut filtreler
    if (projeId) { where.push('d.proje_id = ?'); params.push(projeId); }
    if (ekipId) { where.push('d.ekip_id = ?'); params.push(ekipId); }
    if (veriPaketiId) { where.push('d.veri_paketi_id = ?'); params.push(veriPaketiId); }
    if (kategori) { where.push('d.kategori = ?'); params.push(kategori); }
    if (kaynak) { where.push('d.kaynak = ?'); params.push(kaynak); }
    if (etiket) {
      where.push("d.etiketler LIKE ?");
      params.push(`%"${etiket}"%`);
    }

    const sql = `
      SELECT
        d.*,
        p.proje_no, p.musteri_adi AS proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS yukleyen_adi
      FROM dosyalar d
      LEFT JOIN projeler p ON d.proje_id = p.id
      LEFT JOIN ekipler e ON d.ekip_id = e.id
      LEFT JOIN personel pr ON d.yukleyen_id = pr.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${siralama}
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  }

  dosyaGetir(dosyaId) {
    const db = getDb();
    return db.prepare(`
      SELECT
        d.*,
        p.proje_no, p.musteri_adi AS proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS yukleyen_adi,
        vp.paket_no, vp.paket_tipi
      FROM dosyalar d
      LEFT JOIN projeler p ON d.proje_id = p.id
      LEFT JOIN ekipler e ON d.ekip_id = e.id
      LEFT JOIN personel pr ON d.yukleyen_id = pr.id
      LEFT JOIN veri_paketleri vp ON d.veri_paketi_id = vp.id
      WHERE d.id = ?
    `).get(dosyaId);
  }

  projeIstatistik(projeId) {
    const db = getDb();
    return db.prepare(`
      SELECT
        kategori,
        COUNT(*) as sayi,
        SUM(dosya_boyutu) as toplam_boyut
      FROM dosyalar
      WHERE proje_id = ? AND durum = 'aktif'
      GROUP BY kategori
    `).all(projeId);
  }

  // ═══════════════════════════════════════════════
  // DOSYA GÜNCELLEME
  // ═══════════════════════════════════════════════

  dosyaGuncelle(dosyaId, { baslik, notlar, etiketler, latitude, longitude, konumAdi, projeId, veriPaketiId, alan, altAlan, iliskiliKaynakTipi, iliskiliKaynakId, ozelAlanlar }) {
    const db = getDb();
    const updates = [];
    const params = [];

    if (baslik !== undefined) { updates.push('baslik = ?'); params.push(baslik); }
    if (notlar !== undefined) { updates.push('notlar = ?'); params.push(notlar); }
    if (etiketler !== undefined) { updates.push('etiketler = ?'); params.push(JSON.stringify(etiketler)); }
    if (latitude !== undefined) { updates.push('latitude = ?'); params.push(latitude); }
    if (longitude !== undefined) { updates.push('longitude = ?'); params.push(longitude); }
    if (konumAdi !== undefined) { updates.push('konum_adi = ?'); params.push(konumAdi); }
    if (projeId !== undefined) { updates.push('proje_id = ?'); params.push(projeId); }
    if (veriPaketiId !== undefined) { updates.push('veri_paketi_id = ?'); params.push(veriPaketiId); }
    // v2 alan bazlı alanlar
    if (alan !== undefined) { updates.push('alan = ?'); params.push(alan); }
    if (altAlan !== undefined) { updates.push('alt_alan = ?'); params.push(altAlan); }
    if (iliskiliKaynakTipi !== undefined) { updates.push('iliskili_kaynak_tipi = ?'); params.push(iliskiliKaynakTipi); }
    if (iliskiliKaynakId !== undefined) { updates.push('iliskili_kaynak_id = ?'); params.push(iliskiliKaynakId); }
    if (ozelAlanlar !== undefined) { updates.push('ozel_alanlar = ?'); params.push(typeof ozelAlanlar === 'string' ? ozelAlanlar : JSON.stringify(ozelAlanlar)); }

    if (updates.length === 0) return;

    updates.push("guncelleme_tarihi = datetime('now')");
    params.push(dosyaId);

    db.prepare(`UPDATE dosyalar SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  dosyaSil(dosyaId, fizikselSil = false) {
    const db = getDb();
    if (fizikselSil) {
      const dosya = db.prepare('SELECT dosya_yolu, thumbnail_yolu FROM dosyalar WHERE id = ?').get(dosyaId);
      if (dosya) {
        try { fs.unlinkSync(path.join(getUploadsRoot(), dosya.dosya_yolu)); } catch {}
        if (dosya.thumbnail_yolu) {
          try { fs.unlinkSync(path.join(getUploadsRoot(), dosya.thumbnail_yolu)); } catch {}
        }
      }
      db.prepare('DELETE FROM dosyalar WHERE id = ?').run(dosyaId);
    } else {
      db.prepare("UPDATE dosyalar SET durum = 'silindi', guncelleme_tarihi = datetime('now') WHERE id = ?").run(dosyaId);
    }
  }

  /**
   * Belirli alan + alt_alan prefix'ine uyan tüm dosyaları sil (klasör silme)
   */
  klasorSil(alan, altAlanPrefix, fizikselSil = false) {
    const db = getDb();
    const dosyalar = db.prepare(
      "SELECT id, dosya_yolu, thumbnail_yolu FROM dosyalar WHERE alan = ? AND alt_alan LIKE ? AND durum = 'aktif'"
    ).all(alan, altAlanPrefix + '%');

    if (fizikselSil) {
      for (const d of dosyalar) {
        try { fs.unlinkSync(path.join(getUploadsRoot(), d.dosya_yolu)); } catch {}
        if (d.thumbnail_yolu) {
          try { fs.unlinkSync(path.join(getUploadsRoot(), d.thumbnail_yolu)); } catch {}
        }
      }
      if (dosyalar.length > 0) {
        db.prepare("DELETE FROM dosyalar WHERE alan = ? AND alt_alan LIKE ? AND durum = 'aktif'").run(alan, altAlanPrefix + '%');
      }
      // Boş klasörleri temizle
      try {
        const ornekYol = dosyalar[0]?.dosya_yolu;
        if (ornekYol) {
          const klasor = path.join(getUploadsRoot(), path.dirname(ornekYol));
          if (fs.existsSync(klasor) && fs.readdirSync(klasor).length === 0) {
            fs.rmdirSync(klasor, { recursive: true });
          }
        }
      } catch {}
    } else {
      if (dosyalar.length > 0) {
        db.prepare(
          "UPDATE dosyalar SET durum = 'silindi', guncelleme_tarihi = datetime('now') WHERE alan = ? AND alt_alan LIKE ? AND durum = 'aktif'"
        ).run(alan, altAlanPrefix + '%');
      }
    }
    return dosyalar.length;
  }

  // ═══════════════════════════════════════════════
  // YARDIMCI FONKSİYONLAR
  // ═══════════════════════════════════════════════

  async exifOku(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.exif) return null;

      const exif = exifReader(metadata.exif);
      const result = {};

      // GPS
      if (exif?.gps?.GPSLatitude && exif?.gps?.GPSLongitude) {
        result.latitude = this.dmsToDecimal(exif.gps.GPSLatitude, exif.gps.GPSLatitudeRef);
        result.longitude = this.dmsToDecimal(exif.gps.GPSLongitude, exif.gps.GPSLongitudeRef);
      }

      // Tarih
      if (exif?.exif?.DateTimeOriginal) {
        result.dateTime = exif.exif.DateTimeOriginal.toISOString();
      }

      // Kamera
      if (exif?.image?.Make || exif?.image?.Model) {
        result.camera = [exif.image?.Make, exif.image?.Model].filter(Boolean).join(' ');
      }

      return result;
    } catch {
      return null;
    }
  }

  dmsToDecimal(dms, ref) {
    const degrees = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return (ref === 'S' || ref === 'W') ? -degrees : degrees;
  }

  mimeTipiBelirle(uzanti) {
    const map = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      heic: 'image/heic', webp: 'image/webp', gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      dwg: 'application/acad', dxf: 'application/dxf',
      kml: 'application/vnd.google-earth.kml+xml', kmz: 'application/vnd.google-earth.kmz',
      geojson: 'application/geo+json',
      zip: 'application/zip', rar: 'application/x-rar-compressed',
    };
    return map[uzanti] || 'application/octet-stream';
  }

  dosyaYoluCozumle(goreceliYol) {
    return path.join(getUploadsRoot(), goreceliYol);
  }
}

module.exports = new DosyaService();
