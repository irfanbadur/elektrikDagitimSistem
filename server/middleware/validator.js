function zorunluAlanlar(...alanlar) {
  return (req, res, next) => {
    const eksikler = alanlar.filter(alan => {
      const deger = req.body[alan];
      return deger === undefined || deger === null || deger === '';
    });
    if (eksikler.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Zorunlu alanlar eksik: ${eksikler.join(', ')}`
      });
    }
    next();
  };
}

module.exports = { zorunluAlanlar };
