// Standalone import scripti — doc/ilerleme.xlsx'tan proje keşif & ilerleme verisini çeker
// Kullanım:
//   DRY-RUN (sadece rapor): node server/scripts/import-ilerleme.js --tenant=enerjabze
//   GERÇEKTEN ÇALIŞTIR:    node server/scripts/import-ilerleme.js --tenant=enerjabze --apply
const path = require('path')
const XLSX = require('xlsx')

// CLI args
const args = process.argv.slice(2)
const tenantArg = args.find(a => a.startsWith('--tenant='))
const tenant = tenantArg ? tenantArg.split('=')[1] : 'enerjabze'
const apply = args.includes('--apply')

const { getDb, setCurrentTenant } = require('../db/database')
setCurrentTenant(tenant)

const dosyaYolu = path.join(__dirname, '..', '..', 'doc', 'ilerleme.xlsx')
console.log('Dosya:', dosyaYolu)
const wb = XLSX.readFile(dosyaYolu)
const ws = wb.Sheets['Sayfa1']

// 1) Proje bloklarını bul
function projeBloklariniCikar() {
  const projeAdMap = new Map()
  for (let c = 11; c < 220; c++) {
    const a = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[a]?.v) {
      const v = String(ws[a].v).trim()
      if (v && !/^(KEŞİF|MALZEME|FİLTRE|İHALE|KIRILIM)/i.test(v)) projeAdMap.set(c, v)
    }
  }
  const ilerlemeCols = []
  const yerTeslimCols = []
  for (let c = 11; c < 220; c++) {
    const a = XLSX.utils.encode_cell({ r: 2, c })
    const v = ws[a]?.v ? String(ws[a].v).trim() : ''
    if (v === 'İLERLEME') ilerlemeCols.push(c)
    if (v.startsWith('YER TESL')) yerTeslimCols.push(c)
  }
  const projeler = []
  for (const ic of ilerlemeCols) {
    const ytc = yerTeslimCols.find(c => c === ic - 1) ?? ic - 1
    let ad = null
    for (let c = ytc - 2; c <= ic + 5; c++) {
      if (projeAdMap.has(c)) { ad = projeAdMap.get(c); break }
    }
    if (!ad || ad.length < 3) continue // boş/sayısal blokları atla
    projeler.push({ ad, yer_teslim_col: ytc, ilerleme_col: ic })
  }
  return projeler
}

// 2) Her proje için malzeme/miktar/ilerleme satırlarını çıkar
function malzemeleriCikar(yt_col, il_col) {
  const list = []
  // Veri satırları: row 4 başlangıç. R3 alt başlık, R4-1043 arası material rows.
  for (let r = 4; r < 2000; r++) { // güvenli üst sınır
    const filtreA = XLSX.utils.encode_cell({ r, c: 0 })
    const ad = ws[filtreA]?.v ? String(ws[filtreA].v).trim() : ''
    if (!ad) {
      // Boş satır → veri bitti say (5 ardışık boş varsa kes)
      let bos = 0
      for (let rr = r; rr < r + 5; rr++) {
        const aa = XLSX.utils.encode_cell({ r: rr, c: 0 })
        if (!ws[aa]?.v) bos++
      }
      if (bos >= 5) break
      continue
    }
    // Sadece MALZEME - MONTAJ ya da benzeri başlangıç
    const pozA = XLSX.utils.encode_cell({ r, c: 1 })
    const eskiPozA = XLSX.utils.encode_cell({ r, c: 2 })
    const kodA = XLSX.utils.encode_cell({ r, c: 3 })
    const terminA = XLSX.utils.encode_cell({ r, c: 4 })
    const cinsA = XLSX.utils.encode_cell({ r, c: 5 })
    const olcuA = XLSX.utils.encode_cell({ r, c: 6 })
    const agirlikA = XLSX.utils.encode_cell({ r, c: 7 })
    const ytA = XLSX.utils.encode_cell({ r, c: yt_col })
    const ilA = XLSX.utils.encode_cell({ r, c: il_col })

    const poz = ws[pozA]?.v ?? null
    const eskiPoz = ws[eskiPozA]?.v ?? null
    const malzemeKodu = ws[kodA]?.v ? String(ws[kodA].v).trim() : null
    const termin = ws[terminA]?.v ?? null
    const cins = ws[cinsA]?.v ? String(ws[cinsA].v).trim() : null
    const olcu = ws[olcuA]?.v ?? null
    const agirlik = Number(ws[agirlikA]?.v) || null
    const ytMiktar = Number(ws[ytA]?.v) || 0
    const ilMiktar = Number(ws[ilA]?.v) || 0

    if (!poz || !cins) continue
    // Sadece YT veya IL > 0 olan satırları al
    if (ytMiktar === 0 && ilMiktar === 0) continue

    list.push({
      poz_birlesik: String(poz),
      eski_poz: eskiPoz ? String(eskiPoz) : null,
      malzeme_kodu: malzemeKodu,
      termin: termin ? String(termin) : null,
      malzeme_adi: cins,
      birim: olcu ? String(olcu) : 'Ad',
      birim_agirlik: agirlik,
      miktar: ytMiktar,    // Yer Teslim → planlanan miktar
      ilerleme: ilMiktar,  // İlerleme → yapılan
    })
  }
  return list
}

// 3) DB ile eşleştir
async function ana() {
  {
    const db = getDb()
    const dbProjeler = db.prepare('SELECT id, proje_no, musteri_adi, proje_tipi FROM projeler').all()
    console.log(`DB'de ${dbProjeler.length} proje var`)

    const xlsxProjeler = projeBloklariniCikar()
    console.log(`Excel'de ${xlsxProjeler.length} proje var`)

    // Eşleştirme — basit normalize edilmiş ad karşılaştırma
    const norm = (s) => String(s || '').toUpperCase()
      .replace(/[İI]/g, 'I').replace(/Ş/g, 'S').replace(/Ç/g, 'C')
      .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ğ/g, 'G')
      .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

    const dbAdHaritasi = new Map()
    for (const p of dbProjeler) {
      const adn = norm(p.musteri_adi || p.proje_no)
      if (adn) dbAdHaritasi.set(adn, p)
    }

    const rapor = { mevcut: [], yeni: [], malzemeToplam: 0 }
    for (const xp of xlsxProjeler) {
      const malzemeler = malzemeleriCikar(xp.yer_teslim_col, xp.ilerleme_col)
      rapor.malzemeToplam += malzemeler.length
      // Match: ad'taki ana kişi adını (örn. "Ali Cin") çıkarıp DB'de ara
      const xpNorm = norm(xp.ad)
      let match = null
      for (const [adn, dbp] of dbAdHaritasi) {
        if (xpNorm.includes(adn) || adn.includes(xpNorm.split(' KET')[0].split(' PROJE')[0])) {
          match = dbp; break
        }
      }
      if (match) rapor.mevcut.push({ xls: xp.ad, db: match.proje_no + ' / ' + match.musteri_adi, malzemeSayi: malzemeler.length })
      else rapor.yeni.push({ xls: xp.ad, malzemeSayi: malzemeler.length })
    }

    console.log('\n=== MEVCUT (' + rapor.mevcut.length + ') ===')
    rapor.mevcut.forEach(r => console.log(`  ✓ ${r.xls}  →  ${r.db}  (${r.malzemeSayi} malzeme)`))
    console.log('\n=== YENI (' + rapor.yeni.length + ') ===')
    rapor.yeni.forEach(r => console.log(`  + ${r.xls}  (${r.malzemeSayi} malzeme)`))
    console.log(`\nToplam ${rapor.malzemeToplam} malzeme satırı işlenecek`)

    if (!apply) {
      console.log('\n[DRY-RUN] Hiçbir şey yazılmadı. Gerçekleştirmek için --apply ekle.')
      return
    }

    // === APPLY ===
    console.log('\n[APPLY] Senkronizasyon başlıyor...')
    let toplamUpdate = 0, toplamInsert = 0, projeSayi = 0, fiyatGuncellenen = 0

    // Katalogtan poz_birlesik → birim_fiyat eşlemesi
    // KET projeleri demontaj + montaj içerir → tüm fiyatları topla
    const katalogFiyatlari = new Map()
    const katalogRows = db.prepare(`SELECT poz_birlesik, malzeme_kodu, malzeme_birim_fiyat, montaj_birim_fiyat,
      demontaj_birim_fiyat, demontajdan_montaj_fiyat FROM depo_malzeme_katalogu`).all()
    for (const k of katalogRows) {
      const mlz = Number(k.malzeme_birim_fiyat) || 0
      const mt = Number(k.montaj_birim_fiyat) || 0
      const dm = Number(k.demontaj_birim_fiyat) || 0
      const dmm = Number(k.demontajdan_montaj_fiyat) || 0
      const fiyat = mlz + mt + dm + dmm
      if (k.poz_birlesik && fiyat > 0) katalogFiyatlari.set(k.poz_birlesik, fiyat)
      if (k.malzeme_kodu && fiyat > 0 && !katalogFiyatlari.has(`mk:${k.malzeme_kodu}`)) {
        katalogFiyatlari.set(`mk:${k.malzeme_kodu}`, fiyat)
      }
    }
    console.log(`Katalogta ${katalogFiyatlari.size} fiyat girişi bulundu`)
    const fiyatBul = (m) => {
      if (m.poz_birlesik && katalogFiyatlari.has(m.poz_birlesik)) return katalogFiyatlari.get(m.poz_birlesik)
      if (m.malzeme_kodu && katalogFiyatlari.has(`mk:${m.malzeme_kodu}`)) return katalogFiyatlari.get(`mk:${m.malzeme_kodu}`)
      return 0
    }

    const tx = db.transaction(() => {
      for (const xp of xlsxProjeler) {
        const xpNorm = norm(xp.ad)
        let match = null
        for (const [adn, dbp] of dbAdHaritasi) {
          if (xpNorm.includes(adn) || adn.includes(xpNorm.split(' KET')[0].split(' PROJE')[0])) {
            match = dbp; break
          }
        }
        if (!match) continue
        const projeId = match.id
        const malzemeler = malzemeleriCikar(xp.yer_teslim_col, xp.ilerleme_col)
        if (!malzemeler.length) continue

        for (const m of malzemeler) {
          const fiyat = fiyatBul(m)
          const mevcut = db.prepare(`SELECT id, birim_fiyat FROM proje_kesif WHERE proje_id = ? AND poz_no = ? LIMIT 1`).get(projeId, m.poz_birlesik)
          if (mevcut) {
            // birim_fiyat 0/null ise katalogtan, değilse koru
            const yeniFiyat = (Number(mevcut.birim_fiyat) > 0) ? mevcut.birim_fiyat : fiyat
            if (yeniFiyat > 0 && yeniFiyat !== mevcut.birim_fiyat) fiyatGuncellenen++
            db.prepare(`UPDATE proje_kesif SET malzeme_adi = ?, malzeme_kodu = COALESCE(?, malzeme_kodu), birim = ?,
              miktar = ?, ilerleme = ?, birim_agirlik = COALESCE(?, birim_agirlik),
              birim_fiyat = ?,
              guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?`)
              .run(m.malzeme_adi, m.malzeme_kodu, m.birim, m.miktar, m.ilerleme, m.birim_agirlik, yeniFiyat, mevcut.id)
            toplamUpdate++
          } else {
            db.prepare(`INSERT INTO proje_kesif (proje_id, poz_no, malzeme_kodu, malzeme_adi, birim,
              miktar, ilerleme, birim_agirlik, birim_fiyat, durum)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planli')`)
              .run(projeId, m.poz_birlesik, m.malzeme_kodu, m.malzeme_adi, m.birim, m.miktar, m.ilerleme, m.birim_agirlik, fiyat)
            toplamInsert++
            if (fiyat > 0) fiyatGuncellenen++
          }
        }
        projeSayi++
      }
    })
    tx()
    console.log(`[APPLY] Tamamlandı: ${projeSayi} proje | ${toplamUpdate} satır güncellendi | ${toplamInsert} satır eklendi | ${fiyatGuncellenen} satıra fiyat atandı`)
  }
}

ana().catch(err => { console.error('HATA:', err); process.exit(1) })
