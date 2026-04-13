const { tenantStorage, TENANTS } = require('../db/database');

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'localhost';

function tenantMiddleware(req, res, next) {
  const host = req.hostname; // "cakmakgrup.enerjabze.tr" veya "cakmakgrup.localhost"

  let slug = null;

  if (host === BASE_DOMAIN || host === 'localhost' || host === '127.0.0.1') {
    // Bare domain → varsayılan tenant
    slug = process.env.DEFAULT_TENANT || null;
  } else {
    // Subdomain çıkar: "cakmakgrup.enerjabze.tr" → "cakmakgrup"
    const parts = host.split('.');
    if (parts.length > 1) {
      slug = parts[0];
    }
  }

  if (!slug || !TENANTS[slug] || !TENANTS[slug].active) {
    // API istekleri için JSON hata, diğerleri için basit mesaj
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, error: 'Geçersiz organizasyon' });
    }
    return res.status(404).send('Organizasyon bulunamadı');
  }

  req.tenantSlug = slug;
  req.tenantInfo = TENANTS[slug];

  // AsyncLocalStorage ile tenant context'i oluştur
  tenantStorage.run({ tenantSlug: slug }, () => next());
}

module.exports = { tenantMiddleware };
