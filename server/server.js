require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

// Uploads static serving (eski yapı: data/uploads)
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));
// Uploads static serving (yeni yapı: uploads/)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

// Yer Teslim Tutanağı AI Parse
app.use('/api/yer-teslim', require('./routes/yerTeslimParse'));

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ElektraTrack sunucu çalışıyor: http://0.0.0.0:${PORT}`);
});
