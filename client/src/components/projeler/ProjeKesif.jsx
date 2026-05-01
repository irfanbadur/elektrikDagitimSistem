// Proje-Keşif sekmesi: Hak Ediş sekmesi ile aynı direk-bazlı UI'yi kullanır.
// Fark: Yeni Durum Proje DXF'inden tarar, /api/proje-kesif-metraj endpoint'ine yazar.
import ProjeHakEdis, { KESIF_KONFIGI } from './ProjeHakEdis'

export default function ProjeKesif({ projeId, onSpriteGuncelle, seciliDirekBilgi, onSeciliDirekTemizle }) {
  return (
    <ProjeHakEdis
      projeId={projeId}
      konfig={KESIF_KONFIGI}
      onSpriteGuncelle={onSpriteGuncelle}
      seciliDirekBilgi={seciliDirekBilgi}
      onSeciliDirekTemizle={onSeciliDirekTemizle}
    />
  )
}
