/**
 * AI SAGLAYICI BASE INTERFACE
 *
 * Tum saglayicilar bu interface'i uygular.
 * Yeni saglayici eklemek = bu interface'i implement eden yeni dosya.
 */
class AiProvider {
  constructor(isim) {
    this.isim = isim;
  }

  /** Saglayici erisilebilir mi */
  async saglikKontrol() {
    throw new Error('saglikKontrol() implement edilmeli');
  }

  /**
   * Metin mesaji gonder
   * @returns {Promise<{ metin: string, tokenKullanim: { girdi, cikti } }>}
   */
  async metinGonder(sistemPromptu, kullaniciMesaji, ayarlar = {}) {
    throw new Error('metinGonder() implement edilmeli');
  }

  /**
   * Metin + gorsel gonder (Vision)
   * @param {Array<{ base64: string, mimeType: string }>} gorseller
   * @returns {Promise<{ metin: string, tokenKullanim: { girdi, cikti } }>}
   */
  async gorselGonder(sistemPromptu, kullaniciMesaji, gorseller, ayarlar = {}) {
    throw new Error('gorselGonder() implement edilmeli');
  }
}

module.exports = AiProvider;
