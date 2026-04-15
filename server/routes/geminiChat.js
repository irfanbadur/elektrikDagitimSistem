const router = require('express').Router();
const { geminiChat } = require('../services/geminiService');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

// AI yetki kontrolü
function aiYetkisi(req, res, next) {
  const db = getDb();
  const kullaniciId = req.kullanici?.id;
  if (!kullaniciId) return res.status(401).json({ success: false, error: 'Giriş gerekli' });
  const yetkili = db.prepare(`
    SELECT 1 FROM kullanici_rolleri kr JOIN roller r ON kr.rol_id = r.id
    WHERE kr.kullanici_id = ? AND r.rol_kodu IN ('sistem_yoneticisi', 'genel_mudur')
  `).get(kullaniciId);
  if (!yetkili) return res.status(403).json({ success: false, error: 'AI asistan yetkiniz yok' });
  next();
}

// DB'den güncel sistem verilerini topla
function sistemVerileriTopla() {
  const db = getDb();
  try {
    const projeSayisi = db.prepare('SELECT COUNT(*) as c FROM projeler').get().c;
    const projeTipleri = db.prepare('SELECT proje_tipi, COUNT(*) as c FROM projeler GROUP BY proje_tipi').all();
    const projeDurumlari = db.prepare('SELECT durum, COUNT(*) as c FROM projeler GROUP BY durum').all();
    const kesifliProje = db.prepare('SELECT COUNT(DISTINCT proje_id) as c FROM proje_kesif').get().c;
    const toplamKesif = db.prepare('SELECT COUNT(*) as c FROM proje_kesif WHERE kapsayici=0').get().c;
    const ekipSayisi = db.prepare('SELECT COUNT(*) as c FROM ekipler WHERE durum=?').get('aktif').c;
    const personelSayisi = db.prepare('SELECT COUNT(*) as c FROM kullanicilar WHERE durum=?').get('aktif').c;
    const depoSayisi = db.prepare('SELECT COUNT(*) as c FROM depolar WHERE aktif=1').get().c;
    const malzemeSayisi = db.prepare('SELECT COUNT(*) as c FROM depo_malzeme_katalogu WHERE is_category=0').get().c;
    const dosyaSayisi = db.prepare("SELECT COUNT(*) as c FROM dosyalar WHERE durum='aktif'").get().c;
    const bolgeler = db.prepare('SELECT bolge_adi FROM bolgeler WHERE bolge_adi IS NOT NULL').all().map(b => b.bolge_adi);

    // Son 10 proje
    const sonProjeler = db.prepare(`
      SELECT p.proje_no, p.musteri_adi, p.proje_tipi, p.durum, p.il, p.ilce,
        (SELECT CASE WHEN SUM(pk.miktar)>0 THEN ROUND(SUM(pk.ilerleme)*100.0/SUM(pk.miktar)) ELSE 0 END FROM proje_kesif pk WHERE pk.proje_id=p.id AND pk.kapsayici=0) as ilerleme_yuzde
      FROM projeler p ORDER BY p.olusturma_tarihi DESC LIMIT 10
    `).all();

    return `
=== SİSTEM VERİLERİ (GÜNCEL) ===
Toplam Proje: ${projeSayisi}
Proje Tipleri: ${projeTipleri.map(t => `${t.proje_tipi}: ${t.c}`).join(', ')}
Proje Durumları: ${projeDurumlari.map(d => `${d.durum}: ${d.c}`).join(', ')}
Keşifli Proje: ${kesifliProje}, Toplam Keşif Kalemi: ${toplamKesif}
Ekip: ${ekipSayisi}, Personel: ${personelSayisi}, Depo: ${depoSayisi}
Malzeme Katalog: ${malzemeSayisi} kalem
Dosya: ${dosyaSayisi}
Bölgeler: ${bolgeler.join(', ')}

Son Projeler:
${sonProjeler.map(p => `- ${p.proje_no} (${p.proje_tipi}) ${p.musteri_adi || ''} [${p.il}/${p.ilce}] durum:${p.durum} ilerleme:%${p.ilerleme_yuzde || 0}`).join('\n')}
`;
  } catch (err) {
    return `Sistem verileri alınamadı: ${err.message}`;
  }
}

// Belirli bir proje hakkında detaylı veri
function projeDetayiTopla(projeNo) {
  const db = getDb();
  try {
    const proje = db.prepare('SELECT * FROM projeler WHERE proje_no LIKE ? OR musteri_adi LIKE ? LIMIT 1').get(`%${projeNo}%`, `%${projeNo}%`);
    if (!proje) return null;

    const kesifler = db.prepare('SELECT malzeme_adi, birim, miktar, ilerleme, birim_fiyat, kapsayici, birim_agirlik FROM proje_kesif WHERE proje_id=? ORDER BY excel_satir').all(proje.id);
    const dosyalar = db.prepare("SELECT orijinal_adi, kategori, dosya_boyutu FROM dosyalar WHERE proje_id=? AND durum='aktif'").all(proje.id);
    const adimlar = db.prepare('SELECT faz_adi, adim_adi, durum FROM proje_adimlari WHERE proje_id=? ORDER BY sira_global').all(proje.id);

    const toplamMiktar = kesifler.filter(k => !k.kapsayici).reduce((t, k) => t + (k.miktar || 0), 0);
    const toplamIlerleme = kesifler.filter(k => !k.kapsayici).reduce((t, k) => t + (k.ilerleme || 0), 0);
    const toplamTutar = kesifler.reduce((t, k) => t + (k.miktar || 0) * (k.birim_fiyat || 0), 0);

    return `
=== PROJE DETAYI: ${proje.proje_no} ===
Ad: ${proje.musteri_adi || '-'}
Tip: ${proje.proje_tipi}, Durum: ${proje.durum}
İl/İlçe: ${proje.il}/${proje.ilce}, Mahalle: ${proje.mahalle || '-'}
Yüklenici: ${proje.yuklenici || '-'}, İhale: ${proje.ihale_no || '-'}
Yer Teslim: ${proje.teslim_tarihi || '-'}, Başlangıç: ${proje.baslama_tarihi || '-'}

Keşif: ${kesifler.length} kalem (${kesifler.filter(k => k.kapsayici).length} kapsayıcı)
İlerleme: %${toplamMiktar > 0 ? Math.round(toplamIlerleme / toplamMiktar * 100) : 0}
Toplam Tutar: ${toplamTutar.toLocaleString('tr-TR')} TL

Malzemeler:
${kesifler.filter(k => !k.kapsayici).map(k => `- ${k.malzeme_adi}: ${k.miktar} ${k.birim} (ilerleme: ${k.ilerleme || 0}, fiyat: ${k.birim_fiyat || 0})`).join('\n')}

Dosyalar: ${dosyalar.length} adet
${dosyalar.map(d => `- ${d.orijinal_adi} (${d.kategori})`).join('\n')}

Yaşam Döngüsü:
${adimlar.map(a => `- ${a.faz_adi} > ${a.adim_adi}: ${a.durum}`).join('\n')}
`;
  } catch { return null; }
}

// POST /api/gemini/chat — AI sohbet (tam erişimli)
router.post('/chat', authMiddleware, aiYetkisi, async (req, res) => {
  try {
    const { mesajlar, sistemPrompt } = req.body;
    if (!mesajlar || !Array.isArray(mesajlar) || mesajlar.length === 0) {
      return res.status(400).json({ success: false, error: 'mesajlar gerekli' });
    }

    // Son mesajda proje adı/numarası geçiyorsa detay çek
    const sonMesaj = mesajlar[mesajlar.length - 1]?.content || '';
    let ekVeri = sistemVerileriTopla();

    // Proje numarası veya adı arama
    const projeMatch = sonMesaj.match(/(\d{2}\.BATI\.[A-Z]+\.\d+\.\d+[-\d]*|KET-BEKLEYEN-\d+)/i);
    if (projeMatch) {
      const detay = projeDetayiTopla(projeMatch[1]);
      if (detay) ekVeri += detay;
    } else {
      // Proje adı ile arama dene
      const db = getDb();
      const kelimeler = sonMesaj.split(/\s+/).filter(w => w.length > 3);
      for (const kelime of kelimeler) {
        const proje = db.prepare('SELECT proje_no FROM projeler WHERE musteri_adi LIKE ? LIMIT 1').get(`%${kelime}%`);
        if (proje) {
          const detay = projeDetayiTopla(proje.proje_no);
          if (detay) { ekVeri += detay; break; }
        }
      }
    }

    const zenginPrompt = `${sistemPrompt || ''}

Sen enerjabze elektrik dağıtım yönetim sisteminin AI asistanısın. Türkçe yanıt ver.
Kullanıcı sistem yöneticisi — tüm verilere erişimi var.
Aşağıda sistemin güncel verileri var, bunları kullanarak yanıt ver.
Dosya silme, proje analizi, keşif değerlendirmesi gibi işlemlerde yardımcı ol.

${ekVeri}`;

    const yanit = await geminiChat(mesajlar, zenginPrompt);
    res.json({ success: true, data: { yanit } });
  } catch (err) {
    console.error('AI chat hatası:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/gemini/yetki
router.get('/yetki', authMiddleware, (req, res) => {
  const db = getDb();
  const yetkili = db.prepare(`
    SELECT 1 FROM kullanici_rolleri kr JOIN roller r ON kr.rol_id = r.id
    WHERE kr.kullanici_id = ? AND r.rol_kodu IN ('sistem_yoneticisi', 'genel_mudur')
  `).get(req.kullanici?.id);
  res.json({ success: true, data: { yetkili: !!yetkili } });
});

module.exports = router;
