const { tenantStorage, TENANTS } = require('../db/database');

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'localhost';

function isBareHost(host) {
  return host === BASE_DOMAIN || host === 'localhost' || host === '127.0.0.1'
    || host === `www.${BASE_DOMAIN}`;
}

function tenantMiddleware(req, res, next) {
  const host = req.hostname;

  // Bare domain (enerjabze.tr) → admin API ve landing page bypass
  if (isBareHost(host)) {
    if (req.path.startsWith('/api/admin')) {
      return next(); // Admin API — tenant context gerekmez
    }
    if (req.path.startsWith('/api/tenant')) {
      return res.json({ success: true, data: { slug: null, name: 'enerjabze', isLanding: true } });
    }
    // Diğer API çağrıları — DEFAULT_TENANT varsa onu kullan
    const defaultSlug = process.env.DEFAULT_TENANT;
    if (defaultSlug && req.path.startsWith('/api') && TENANTS[defaultSlug]?.active) {
      req.tenantSlug = defaultSlug;
      req.tenantInfo = TENANTS[defaultSlug];
      return tenantStorage.run({ tenantSlug: defaultSlug }, () => next());
    }
    // Landing page → static dosyalar next() ile devam
    req.isLanding = true;
    return next();
  }

  // Subdomain çıkar: "cakmakgrup.enerjabze.tr" → "cakmakgrup"
  const subdomain = host.split('.')[0];
  const slug = subdomain && TENANTS[subdomain]?.active ? subdomain : null;

  if (!slug) {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, error: 'Geçersiz organizasyon' });
    }
    return res.status(404).send('Organizasyon bulunamadı');
  }

  req.tenantSlug = slug;
  req.tenantInfo = TENANTS[slug];
  tenantStorage.run({ tenantSlug: slug }, () => next());
}

module.exports = { tenantMiddleware };
