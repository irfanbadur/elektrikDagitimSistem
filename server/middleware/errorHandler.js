function errorHandler(err, req, res, next) {
  console.error('Hata:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Sunucu hatası'
  });
}

module.exports = { errorHandler };
