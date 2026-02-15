const jwt = require('jsonwebtoken');
const yetkilendirmeService = require('../services/yetkilendirmeService');

const JWT_SECRET = process.env.JWT_SECRET || 'elektratrack-gizli-anahtar-degistir';

/**
 * JWT token kontrolü
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Yetkilendirme gerekli' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.kullanici = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Geçersiz veya süresi dolmuş token' });
  }
}

/**
 * İzin kontrolü middleware'i
 * Kullanım: izinGerekli('projeler', 'yazma')
 */
function izinGerekli(modul, aksiyon) {
  return (req, res, next) => {
    const { izinVar, kapsam } = yetkilendirmeService.izinKontrol(
      req.kullanici.id, modul, aksiyon
    );

    if (!izinVar) {
      return res.status(403).json({
        success: false,
        error: 'Bu işlem için yetkiniz yok',
        gerekli_izin: `${modul}:${aksiyon}`
      });
    }

    req.izinKapsami = kapsam;
    next();
  };
}

/**
 * Veri kapsam filtresi oluştur
 * Route handler'da WHERE koşullarına eklenir
 */
function kapsamFiltresi(req, ekipSutunu = null, olusturanSutunu = null) {
  const kapsam = req.izinKapsami;
  const kullanici = req.kullanici;

  switch (kapsam) {
    case 'tum':
      return { where: '1=1', params: [] };

    case 'kendi_santiye':
      if (ekipSutunu) {
        return {
          where: `${ekipSutunu} IN (SELECT id FROM ekipler WHERE varsayilan_bolge_id IN (SELECT varsayilan_bolge_id FROM ekipler WHERE id = (SELECT ekip_id FROM kullanicilar WHERE id = ?)))`,
          params: [kullanici.id]
        };
      }
      return { where: '1=1', params: [] };

    case 'kendi_ekip':
      if (ekipSutunu && kullanici.ekip_id) {
        return { where: `${ekipSutunu} = ?`, params: [kullanici.ekip_id] };
      }
      return { where: '1=0', params: [] };

    case 'kendi':
      if (olusturanSutunu) {
        return { where: `${olusturanSutunu} = ?`, params: [kullanici.id] };
      }
      return { where: '1=0', params: [] };

    default:
      return { where: '1=0', params: [] };
  }
}

module.exports = { authMiddleware, izinGerekli, kapsamFiltresi, JWT_SECRET };
