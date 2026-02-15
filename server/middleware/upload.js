const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_BASE = path.join(__dirname, '../../data/uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createStorage(subDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_BASE, subDir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = uuidv4() + ext;
      cb(null, name);
    },
  });
}

// Doküman yükleme (pdf, doc, xlsx vb.)
const dokumanUpload = multer({
  storage: createStorage('dokumanlar'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.csv', '.rtf', '.odt', '.ods',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya formatı: ' + ext));
    }
  },
});

// CAD / Proje dosyası yükleme
const cadUpload = multer({
  storage: createStorage('proje-dosyalari'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      '.dwg', '.dxf', '.dgn', '.dwf', '.rvt', '.ifc',
      '.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff',
      '.kmz', '.kml', '.shp', '.zip',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya formatı: ' + ext));
    }
  },
});

// Fotoğraf yükleme
const fotoUpload = multer({
  storage: createStorage('fotograflar'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya formatı: ' + ext));
    }
  },
});

module.exports = { dokumanUpload, cadUpload, fotoUpload };
