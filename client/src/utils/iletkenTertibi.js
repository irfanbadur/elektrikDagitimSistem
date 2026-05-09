// İletken tertibi parser/expander (frontend kopyası)
// Backend versiyonu: server/services/iletkenTertibi.js
//
// AG açık hat: 1xR..5xR, 1xP, 4P+R, 3A+R/P
// OG (sabit 3× faz): 3xSW, 1/0, 3x0, 3x266, 3x477
// Müşterek hat: tek text içinde "3xSW + 4P+R"

export const ACIK_HAT_HARF = { P: 'PANSY', A: 'ASTER', R: 'ROSE' }
// kg/km değerleri (katalogla tutarlı)
export const KG_PER_KM = { PANSY: 118.32, ASTER: 187.68, ROSE: 59.15 }

export function acikHatParse(text) {
  if (!text) return null
  const t = String(text).trim().toUpperCase().replace(/\s+/g, '')
  let m = t.match(/^(\d+)X([PAR])$/)
  if (m) return { tip: 'ag-acik', ana: { harf: m[2], carpan: Number(m[1]) }, sokak: null }
  m = t.match(/^(\d+)([PA])\+R\/P$/)
  if (m) return {
    tip: 'ag-acik',
    ana: { harf: m[2], carpan: Number(m[1]) },
    sokak: { harf: 'R' },
    sokakSecenekleri: ['R', 'P'],
  }
  m = t.match(/^(\d+)([PA])\+([PR])$/)
  if (m) return {
    tip: 'ag-acik',
    ana: { harf: m[2], carpan: Number(m[1]) },
    sokak: { harf: m[3] },
  }
  return null
}

export function ogParse(text) {
  if (!text) return null
  const t = String(text).trim().toUpperCase().replace(/\s+/g, '')
  if (/^\d*X?(SW|SWALLOW)$/.test(t)) return { tip: 'og', cins: 'SWALLOW', carpan: 3, raw: text }
  if (/^(1\/0|3X0)$/.test(t))        return { tip: 'og', cins: '1/0',     carpan: 3, raw: text }
  if (/^(3X)?266$/.test(t))          return { tip: 'og', cins: '266',     carpan: 3, raw: text }
  if (/^(3X)?477$/.test(t))          return { tip: 'og', cins: '477',     carpan: 3, raw: text }
  const m = t.match(/^(\d+X)?(PIGEON|RAVEN|HAWK|PARTRIDGE)$/)
  if (m) return { tip: 'og', cins: m[2], carpan: 3, raw: text }
  return null
}

export function aerParse(text) {
  if (!text) return null
  const t = String(text).trim().toUpperCase().replace(/_/g, ' ')
  const m = t.match(/^(\d+)\s*X\s*(\d+)(?:\s*\/\s*(\d+))?(?:\s*\+\s*(\d+))?\s*AER$/)
  if (!m) return null
  return { tip: 'ag-kablo-aer', raw: text }
}

export function tertibiParseTekil(text) {
  if (!text) return null
  return acikHatParse(text) || ogParse(text) || aerParse(text)
}

// AG açık hat → expanded list
// 23m "4P+R" → [{ harf:'P', cins:'PANSY', mesafe:92 }, { harf:'R', cins:'ROSE', mesafe:23 }]
export function acikHatExpand(tertibi, mesafe) {
  if (!tertibi || tertibi.tip !== 'ag-acik' || !mesafe || mesafe <= 0) return []
  const out = []
  const ana = tertibi.ana
  const sokak = tertibi.sokak
  if (ana) {
    out.push({
      harf: ana.harf,
      cins: ACIK_HAT_HARF[ana.harf],
      mesafe: ana.carpan * mesafe,
      kg: ana.carpan * mesafe * (KG_PER_KM[ACIK_HAT_HARF[ana.harf]] || 0) / 1000,
      sokak: false,
      carpan: ana.carpan,
    })
  }
  if (sokak) {
    out.push({
      harf: sokak.harf,
      cins: ACIK_HAT_HARF[sokak.harf],
      mesafe,
      kg: mesafe * (KG_PER_KM[ACIK_HAT_HARF[sokak.harf]] || 0) / 1000,
      sokak: true,
      carpan: 1,
    })
  }
  return out
}

// OG → 3× mesafe (faz başına bir iletken)
export function ogExpand(tertibi, mesafe) {
  if (!tertibi || tertibi.tip !== 'og' || !mesafe || mesafe <= 0) return []
  return [{
    cins: tertibi.cins,
    mesafe: tertibi.carpan * mesafe,
    sokak: false,
    carpan: tertibi.carpan,
  }]
}
