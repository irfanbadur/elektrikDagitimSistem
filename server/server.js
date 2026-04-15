require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Tenant middleware — subdomain'den tenant tespit
const { tenantMiddleware } = require('./middleware/tenant');
app.use(tenantMiddleware);

// Tenant API — frontend'e tenant bilgisi
app.get('/api/tenant', (req, res) => {
  res.json({ success: true, data: { slug: req.tenantSlug, name: req.tenantInfo?.name, isLanding: req.isLanding || false } });
});

// Admin API — firma yönetimi (bare domain üzerinden)
app.use('/api/admin', require('./routes/admin'));

// Routes
app.use('/api/ayarlar', require('./routes/ayarlar'));
app.use('/api/bolgeler', require('./routes/bolgeler'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ekipler', require('./routes/ekipler'));
app.use('/api/projeler', require('./routes/projeler'));
app.use('/api/malzemeler', require('./routes/malzeme'));
app.use('/api/malzeme-hareketleri', require('./routes/malzemeHareketleri'));
app.use('/api/depolar', require('./routes/depolar'));
app.use('/api/personel', require('./routes/personel'));
app.use('/api/puantaj', require('./routes/puantaj'));
app.use('/api/talepler', require('./routes/talepler'));
app.use('/api/gorevler', require('./routes/gorevler'));
app.use('/api/raporlar', require('./routes/raporlar'));

// Proje detay tab routes (dokumanlar, proje-dosyalari, notlar, fotograflar, kesifler)
app.use('/api/projeler', require('./routes/projeDetay'));

// Evrensel dosya sistemi routes
app.use('/api/dosya', require('./routes/dosya'));
app.use('/api/veri-paketi', require('./routes/veriPaketi'));

// Uploads static serving — tenant-aware
app.use('/uploads', (req, res, next) => {
  const slug = req.tenantSlug;
  if (!slug) return res.status(404).end();
  const base = path.join(__dirname, '../data/tenants', slug, 'uploads');
  express.static(base)(req, res, next);
});

// Saha harita routes
app.use('/api/saha', require('./routes/saha'));

// Medya, veri paketleri, katalog routes
app.use('/api/medya', require('./routes/medya'));
app.use('/api/veri-paketleri', require('./routes/veriPaketleri'));
app.use('/api/katalog', require('./routes/katalog'));
app.use('/api/analiz', require('./routes/analiz'));
app.use('/api/ai', require('./routes/ai'));

// AI Operasyon routes (provider-agnostic AI aksiyonlar)
app.use('/api/ai-op', require('./routes/aiOperasyon'));

// Mesaj parse routes
app.use('/api/mesaj', require('./routes/mesaj'));

// Döngü (proje yaşam döngüsü) routes
app.use('/api/dongu', require('./routes/dongu'));

// İş Tipleri (faz/adım tabanlı yaşam döngüsü) routes
app.use('/api/is-tipleri', require('./routes/isTipleri'));

// Gemini AI Chat
app.use('/api/gemini', require('./routes/geminiChat'));

// Departman routes
app.use('/api/departmanlar', require('./routes/departmanlar'));

// Auth ve RBAC routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/yonetim', require('./routes/rolYonetimi'));

// AI Sohbet routes
app.use('/api/ai-sohbet', require('./routes/aiSohbet'));

// Organizasyon (pozisyon, görev, belge, yetkinlik) routes
app.use('/api/organizasyon', require('./routes/organizasyon'));

// Malzeme Kataloğu routes
app.use('/api/malzeme-katalog', require('./routes/depoKatalog'));

// Proje Keşif, Demontaj ve Bono routes
app.use('/api/proje-kesif', require('./routes/projeKesif'));
app.use('/api/proje-demontaj', require('./routes/projeDemontaj'));
app.use('/api/proje-direkler', require('./routes/projeDirekler'));
app.use('/api/proje-kroki-kesif', require('./routes/projeKrokiKesif'));
app.use('/api/bonolar', require('./routes/bonolar'));
app.use('/api/hareketler', require('./routes/hareketler'));

// Dış Kişiler (3. taraf kurum/firma personelleri)
app.use('/api/dis-kisiler', require('./routes/disKisiler'));

// Yer Teslim Tutanağı AI Parse
app.use('/api/yer-teslim', require('./routes/yerTeslimParse'));

// Enerji Kesinti Planlayıcı
app.use('/api/enerji-kesintileri', require('./routes/enerjiKesintileri'));

// Malzeme Talebi (Keşif → Excel şablon)
app.use('/api/malzeme-talep', require('./routes/malzemeTalep'));

// Error handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// Production: serve React build
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Initialize DB and start server
initDatabase();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`enerjabze sunucu çalışıyor: http://0.0.0.0:${PORT}`);
});
// Ollama görsel analiz uzun sürebilir — timeout'u 5 dakikaya çıkar
server.timeout = 300000;
server.keepAliveTimeout = 300000;
