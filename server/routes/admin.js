const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { loadTenants, saveTenants, setCurrentTenant, initDatabase, TENANTS } = require('../db/database');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'enerjabze2026';

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Geçersiz şifre' });
  }
  // Basit token — production'da JWT kullanılmalı
  const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
  res.json({ success: true, data: { token } });
});

// Basit auth check
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Yetkilendirme gerekli' });
  }
  const token = auth.replace('Bearer ', '');
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    if (!decoded.startsWith('admin:')) throw new Error();
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Geçersiz token' });
  }
}

// GET /api/admin/tenants — Firma listesi
router.get('/tenants', adminAuth, (req, res) => {
  const tenants = loadTenants();
  const list = Object.entries(tenants).map(([slug, info]) => ({ slug, ...info }));
  res.json({ success: true, data: list });
});

// POST /api/admin/tenants — Yeni firma oluştur
router.post('/tenants', adminAuth, (req, res) => {
  const { slug, name } = req.body;
  if (!slug || !name) return res.status(400).json({ success: false, error: 'slug ve name zorunlu' });

  // Slug validasyonu
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanSlug.length < 3) return res.status(400).json({ success: false, error: 'Slug en az 3 karakter olmalı' });

  const tenants = loadTenants();
  if (tenants[cleanSlug]) return res.status(409).json({ success: false, error: 'Bu slug zaten kullanımda' });

  // Tenant oluştur
  tenants[cleanSlug] = { name, active: true, logo: null, createdAt: new Date().toISOString().split('T')[0] };
  saveTenants(tenants);

  // TENANTS cache'ini güncelle
  Object.assign(TENANTS, tenants);

  // DB ve uploads klasörü oluştur
  const tenantDir = path.join(__dirname, '../../data/tenants', cleanSlug);
  const uploadsDir = path.join(tenantDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  // DB'yi başlat (schema + migrations + seed)
  try {
    setCurrentTenant(cleanSlug);
    // initDatabase tek tenant için çalıştır
    const Database = require('better-sqlite3');
    const dbPath = path.join(tenantDir, 'elektratrack.db');
    // getDb() zaten doğru DB'yi açacak, initDatabase tüm tenant'ları dolaşıyor
    // Sadece bu tenant için _initSingleDb çağıralım
    const { getDb } = require('../db/database');
    const db = getDb(); // DB dosyasını oluşturur
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const seedPath = path.join(__dirname, '../db/seed.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    // Seed verisi
    const count = db.prepare('SELECT COUNT(*) as c FROM personel').get();
    if (count.c === 0) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      db.exec(seed);
    }
  } catch (err) {
    console.error('Tenant DB init hatası:', err.message);
  }

  res.json({ success: true, data: { slug: cleanSlug, name, url: `${cleanSlug}.${process.env.BASE_DOMAIN || 'enerjabze.tr'}` } });
});

// PUT /api/admin/tenants/:slug — Firma güncelle
router.put('/tenants/:slug', adminAuth, (req, res) => {
  const tenants = loadTenants();
  if (!tenants[req.params.slug]) return res.status(404).json({ success: false, error: 'Tenant bulunamadı' });

  const { name, active, logo } = req.body;
  if (name !== undefined) tenants[req.params.slug].name = name;
  if (active !== undefined) tenants[req.params.slug].active = active;
  if (logo !== undefined) tenants[req.params.slug].logo = logo;
  saveTenants(tenants);
  Object.assign(TENANTS, tenants);

  res.json({ success: true, data: { slug: req.params.slug, ...tenants[req.params.slug] } });
});

// DELETE /api/admin/tenants/:slug — Firma sil (soft)
router.delete('/tenants/:slug', adminAuth, (req, res) => {
  const tenants = loadTenants();
  if (!tenants[req.params.slug]) return res.status(404).json({ success: false, error: 'Tenant bulunamadı' });

  tenants[req.params.slug].active = false;
  saveTenants(tenants);
  Object.assign(TENANTS, tenants);

  res.json({ success: true });
});

module.exports = router;
