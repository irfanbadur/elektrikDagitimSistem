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
app.use('/api/personel', require('./routes/personel'));
app.use('/api/puantaj', require('./routes/puantaj'));
app.use('/api/talepler', require('./routes/talepler'));
app.use('/api/gorevler', require('./routes/gorevler'));
app.use('/api/raporlar', require('./routes/raporlar'));

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
