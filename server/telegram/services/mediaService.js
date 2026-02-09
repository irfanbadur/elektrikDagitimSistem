const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/database');
const config = require('../config');

class MediaService {
  async processPhoto(bot, msg) {
    const photoSize = msg.photo[msg.photo.length - 1];
    const fileId = photoSize.file_id;

    const filePath = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${config.getBotToken()}/${filePath.file_path}`;
    const fileBuffer = await this.downloadFile(fileUrl);

    const now = new Date();
    const dateDir = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
    const photosDir = path.join(config.media.basePath, config.media.photosDir, dateDir);
    const thumbsDir = path.join(config.media.basePath, config.media.thumbnailsDir, dateDir);
    fs.mkdirSync(photosDir, { recursive: true });
    fs.mkdirSync(thumbsDir, { recursive: true });

    const fileName = `${uuidv4()}.jpg`;
    const fullPath = path.join(photosDir, fileName);
    const thumbPath = path.join(thumbsDir, fileName);

    fs.writeFileSync(fullPath, fileBuffer);

    await sharp(fileBuffer)
      .resize(config.media.thumbnailWidth, config.media.thumbnailHeight, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);

    const exifData = await this.extractExif(fileBuffer);
    const metadata = await sharp(fileBuffer).metadata();

    return {
      fileName,
      fullPath,
      thumbPath,
      fileSize: fileBuffer.length,
      width: metadata.width,
      height: metadata.height,
      exif: exifData,
      caption: msg.caption || null
    };
  }

  async extractExif(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.exif) return { gps: null, dateTime: null };

      const exif = exifReader(metadata.exif);
      let gps = null;
      let dateTime = null;

      if (exif?.GPSInfo?.GPSLatitude && exif?.GPSInfo?.GPSLongitude) {
        const lat = this.convertDMStoDD(
          exif.GPSInfo.GPSLatitude,
          exif.GPSInfo.GPSLatitudeRef
        );
        const lng = this.convertDMStoDD(
          exif.GPSInfo.GPSLongitude,
          exif.GPSInfo.GPSLongitudeRef
        );
        const alt = exif.GPSInfo.GPSAltitude || null;
        gps = { latitude: lat, longitude: lng, altitude: alt };
      }

      if (exif?.Photo?.DateTimeOriginal) {
        dateTime = exif.Photo.DateTimeOriginal;
      } else if (exif?.Image?.DateTime) {
        dateTime = exif.Image.DateTime;
      }

      return { gps, dateTime };
    } catch (err) {
      console.error('EXIF okuma hatasi:', err.message);
      return { gps: null, dateTime: null };
    }
  }

  convertDMStoDD(dms, ref) {
    const dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return (ref === 'S' || ref === 'W') ? -dd : dd;
  }

  saveMediaRecord({
    fileName, fullPath, thumbPath, fileSize, width, height,
    latitude, longitude, konumKaynagi, altitude,
    cekimTarihi, personelId, telegramId, projeId, ekipId,
    veriPaketiId, aciklama, etiketler
  }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO medya (
        dosya_adi, dosya_yolu, thumbnail_yolu, dosya_tipi, mime_tipi,
        dosya_boyutu, genislik, yukseklik,
        latitude, longitude, konum_kaynagi, altitude,
        cekim_tarihi, yukleyen_personel_id, yukleyen_telegram_id,
        proje_id, ekip_id, veri_paketi_id, aciklama, etiketler
      ) VALUES (?, ?, ?, 'photo', 'image/jpeg',
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?)
    `).run(
      fileName, fullPath, thumbPath,
      fileSize, width, height,
      latitude, longitude, konumKaynagi, altitude,
      cekimTarihi, personelId, telegramId,
      projeId, ekipId, veriPaketiId, aciklama,
      etiketler ? JSON.stringify(etiketler) : null
    );
    return result.lastInsertRowid;
  }

  async downloadFile(url) {
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
  }
}

module.exports = new MediaService();
