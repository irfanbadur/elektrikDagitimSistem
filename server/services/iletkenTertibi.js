// İletken tertibi parser/expander
//
// AG açık hat tertipleri:
//   1xR..5xR     → N× Rose
//   1xP          → 1× Pansy
//   4P+R         → 4× Pansy + 1× Rose
//   3A+R/P       → 3× Aster + 1× (Rose veya Pansy — sokak fazı seçilebilir)
//
// AG kablo (AER):
//   3x70/16+95 AER, 3x16/16+25 AER vb. — childBul'da AER özel arama yapılıyor.
//
// OG hat tertipleri (her zaman 3× faz, tek iletken cinsi):
//   3xSW         → 3× SWALLOW
//   1/0          → 3× 1/0 AWG (default 3 çarpan, OG kuralı)
//   3x0          → 3× 1/0 AWG (3x0 alternatif yazım)
//   3x266        → 3× 266 MCM
//   3x477        → 3× 477 MCM
//
// Müşterek hat (tek text):
//   "3xSW + 4P+R", "3xSW+4P+R" → OG token + AG token

const ACIK_HAT_HARF = { P: 'PANSY', A: 'ASTER', R: 'ROSE' };

// Katalog cins LIKE pattern'i (depo_malzeme_katalogu.malzeme_cinsi'e karşı)
// Örn. "PANSY       AWG       1 (118.32 Kg/Km) "
function acikHatCinsLike(harf) {
  const ad = ACIK_HAT_HARF[harf];
  return ad ? `${ad}%` : null;
}

// OG iletken cins LIKE pattern'i — kullanıcı listesi:
//   3xSW → SWALLOW
//   1/0, 3x0 → 1/0 AWG
//   3x266 → 266 MCM (HEN gibi tipik isim olabilir)
//   3x477 → 477 MCM
function ogCinsLike(token) {
  const t = token.toUpperCase().replace(/\s+/g, '');
  if (/^\d*X?SW(ALLOW)?$/.test(t)) return 'SWALLOW%';
  if (t === '1/0' || t === '3X0') return '%1/0%';
  if (t === '3X266' || t === '266') return '%266%';
  if (t === '3X477' || t === '477') return '%477%';
  return null;
}

// Açık hat tertibi parse — ana iletken çarpanı + opsiyonel sokak iletkeni
//
// Dönüş: { tip:'ag-acik', ana:{harf,carpan}, sokak:{harf}|null, sokakSecenekleri?:['R','P'] }
//
// Örnekler:
//   "4xR"       → { ana:{harf:'R',carpan:4} }
//   "1xP"       → { ana:{harf:'P',carpan:1} }
//   "4P+R"      → { ana:{harf:'P',carpan:4}, sokak:{harf:'R'} }
//   "3A+R/P"    → { ana:{harf:'A',carpan:3}, sokak:{harf:'R'}, sokakSecenekleri:['R','P'] }
function acikHatParse(text) {
  if (!text) return null;
  const t = text.trim().toUpperCase().replace(/\s+/g, '');

  // 1) NxL  (N=1..9, L=R|P|A)  — sadece tek cins
  let m = t.match(/^(\d+)X([PAR])$/);
  if (m) return { tip: 'ag-acik', ana: { harf: m[2], carpan: Number(m[1]) }, sokak: null };

  // 2) NL+R/P  (sokak fazı R veya P seçilebilir)
  m = t.match(/^(\d+)([PA])\+R\/P$/);
  if (m) return {
    tip: 'ag-acik',
    ana: { harf: m[2], carpan: Number(m[1]) },
    sokak: { harf: 'R' },
    sokakSecenekleri: ['R', 'P'],
  };

  // 3) NL+R  (4P+R, 3A+R)
  m = t.match(/^(\d+)([PA])\+([PR])$/);
  if (m) return {
    tip: 'ag-acik',
    ana: { harf: m[2], carpan: Number(m[1]) },
    sokak: { harf: m[3] },
  };

  return null;
}

// OG hat tertibi parse — sabit 3× çarpan
//
// Dönüş: { tip:'og', cins, carpan:3, raw }
function ogParse(text) {
  if (!text) return null;
  const t = text.trim().toUpperCase().replace(/\s+/g, '');

  if (/^\d*X?(SW|SWALLOW)$/.test(t)) return { tip: 'og', cins: 'SWALLOW', carpan: 3, raw: text };
  if (/^(1\/0|3X0)$/.test(t))        return { tip: 'og', cins: '1/0',     carpan: 3, raw: text };
  if (/^(3X)?266$/.test(t))          return { tip: 'og', cins: '266',     carpan: 3, raw: text };
  if (/^(3X)?477$/.test(t))          return { tip: 'og', cins: '477',     carpan: 3, raw: text };

  // PIGEON, RAVEN, HAWK, PARTRIDGE — eski OG isim formatı
  if (/^(\d+X)?(PIGEON|RAVEN|HAWK|PARTRIDGE)$/.test(t)) {
    const adm = t.match(/(PIGEON|RAVEN|HAWK|PARTRIDGE)/);
    return { tip: 'og', cins: adm[1], carpan: 3, raw: text };
  }

  return null;
}

// AER kablo parse — "3x70/16+95 AER" formatı (kablo, çarpansız tek malzeme)
function aerParse(text) {
  if (!text) return null;
  const t = text.trim().toUpperCase().replace(/_/g, ' ');
  const m = t.match(/^(\d+)\s*X\s*(\d+)(?:\s*\/\s*(\d+))?(?:\s*\+\s*(\d+))?\s*AER$/);
  if (!m) return null;
  return {
    tip: 'ag-kablo-aer',
    raw: text,
    adet: Number(m[1]),
    faz: Number(m[2]),
    notr: m[3] ? Number(m[3]) : null,
    sokak: m[4] ? Number(m[4]) : null,
  };
}

// Tek bir tertibi tanı — sırayla AG açık hat, OG, AER dene
function tertibiParseTekil(text) {
  if (!text) return null;
  return acikHatParse(text) || ogParse(text) || aerParse(text);
}

// Müşterek hat olabilecek text'i parse — boşluklu + ile bölünür ama 4P+R içindeki + bozulmaz.
// Strateji: önce OG token'ı bul, kalan kısmı AG token olarak yorumla.
//
// Dönüş: { ag, og, raw } — biri null olabilir
function tertibiParse(text) {
  if (!text) return null;
  const raw = String(text).trim();

  // Tekil dene (en yaygın)
  const tekil = tertibiParseTekil(raw);
  if (tekil) {
    return tekil.tip === 'og'
      ? { ag: null, og: tekil, raw }
      : { ag: tekil, og: null, raw };
  }

  // Müşterek: önce ' + ' veya '+' ile böl ama sadece OG+AG yapısı için
  // OG token örnekleri: 3xSW, 1/0, 3x266, 3x477
  // Önce başta OG token arayalım
  const ogMatch = raw.match(/^\s*(\d*x?(?:SW|SWALLOW|266|477|1\/0|PIGEON|RAVEN|HAWK|PARTRIDGE)|3x0)\s*(?:\+\s*(.+))?$/i);
  if (ogMatch) {
    const og = ogParse(ogMatch[1]);
    const agText = ogMatch[2];
    const ag = agText ? tertibiParseTekil(agText) : null;
    return { ag, og, raw };
  }

  // Tersi: önce AG sonra OG (nadir ama olabilir)
  const agOnceMatch = raw.match(/^(.+?)\s*\+\s*(\d*x?(?:SW|SWALLOW|266|477|1\/0))\s*$/i);
  if (agOnceMatch) {
    const ag = tertibiParseTekil(agOnceMatch[1]);
    const og = ogParse(agOnceMatch[2]);
    if (og && ag) return { ag, og, raw };
  }

  // Hiçbiri tutmadıysa raw'ı tip olarak döndür (bilinmeyen format)
  return { ag: null, og: null, raw };
}

// Açık hat tertibini malzeme satırlarına genişlet
// 23m "4P+R" → [{cins:'PANSY%', kgPerKm, mesafe:92, kg:10.89}, {cins:'ROSE%', mesafe:23, kg:1.36}]
//
// kg/km değerleri katalogtan childBul ile bulunan satırın `malzeme_cinsi` parantez içinden okunur
// (örn. "PANSY       AWG       1 (118.32 Kg/Km) "). Eğer agirlik kolonu doluysa o kullanılır.
function kgKmParse(cins) {
  if (!cins) return null;
  const m = String(cins).match(/\(\s*([\d.,]+)\s*Kg\/Km\s*\)/i);
  if (!m) return null;
  return Number(m[1].replace(',', '.')) || null;
}

// Tek tertibi → genişletilmiş kalemler listesi
// Dönüş: [{ harf, cins, mesafe, kgPerKm, kg, sokak:bool }]
function acikHatExpand(tertibi, mesafe) {
  if (!tertibi || tertibi.tip !== 'ag-acik') return [];
  const ana = tertibi.ana;
  const sokak = tertibi.sokak;
  const out = [];
  if (ana && mesafe > 0) {
    out.push({
      harf: ana.harf,
      cins: ACIK_HAT_HARF[ana.harf],
      mesafe: ana.carpan * mesafe,
      sokak: false,
      carpan: ana.carpan,
    });
  }
  if (sokak && mesafe > 0) {
    out.push({
      harf: sokak.harf,
      cins: ACIK_HAT_HARF[sokak.harf],
      mesafe,
      sokak: true,
      carpan: 1,
    });
  }
  return out;
}

// OG → genişletilmiş tek kalem (3× mesafe)
function ogExpand(tertibi, mesafe) {
  if (!tertibi || tertibi.tip !== 'og' || !mesafe || mesafe <= 0) return [];
  return [{
    cins: tertibi.cins,
    mesafe: tertibi.carpan * mesafe,
    sokak: false,
    carpan: tertibi.carpan,
  }];
}

// Müşterek hat text'ini AG ve OG metinlerine ayır.
//
// Dış parantez (durum belirleyici) korunur ve iç ayırmadan sonra her iki tarafa uygulanır:
//   "[3xSW + 4P+R]"  → agText:"[4P+R]",  ogText:"[3xSW]"   (her ikisi DMM)
//   "(3xSW + 4P+R)"  → agText:"(4P+R)",  ogText:"(3xSW)"
//   "[3xSW] + (4P+R)" → agText:"(4P+R)", ogText:"[3xSW]"   (durumlar farklı)
//
// Dönüş: { agText:string|null, ogText:string|null }
function tertibiTextleriAyir(text) {
  if (!text) return { agText: null, ogText: null };
  const raw = String(text).trim();

  // Dış parantez kontrolü: tüm text "(...)", "[...]" kalıbında ise içi al, durumu sakla.
  let disDurum = '';
  let ic = raw;
  const disPar = raw.match(/^\((.*)\)$/) || raw.match(/^\[(.*)\]$/);
  if (disPar && !/[\(\)\[\]]/.test(disPar[1])) {
    disDurum = raw[0] === '[' ? '[]' : '()';
    ic = disPar[1].trim();
  }

  // OG token regex (kendi parantezi olabilir)
  const ogTokenRe = /(\[?\(?\s*\d*x?(?:SW|SWALLOW|266|477|1\/0|PIGEON|RAVEN|HAWK|PARTRIDGE)\s*\]?\)?|\[?\(?\s*3x0\s*\]?\)?)/i;
  const ogMatch = ic.match(ogTokenRe);

  // Dış parantezi geri uygula
  const sarmala = (s) => {
    if (!s) return s;
    if (disDurum === '[]') return `[${s}]`;
    if (disDurum === '()') return `(${s})`;
    return s;
  };

  if (ogMatch) {
    const ogText = ogMatch[0].trim();
    const kalan = ic.replace(ogMatch[0], '').replace(/^\s*\+\s*|\s*\+\s*$/g, '').trim();
    const agText = kalan.length > 0 ? kalan : null;
    return { agText: sarmala(agText), ogText: sarmala(ogText) };
  }

  // OG yoksa — tüm text AG sayılır (açık hat veya kablo)
  return { agText: sarmala(ic), ogText: null };
}

module.exports = {
  ACIK_HAT_HARF,
  acikHatCinsLike,
  ogCinsLike,
  acikHatParse,
  ogParse,
  aerParse,
  tertibiParse,
  tertibiParseTekil,
  tertibiTextleriAyir,
  acikHatExpand,
  ogExpand,
  kgKmParse,
};
