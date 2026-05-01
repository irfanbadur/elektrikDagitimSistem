"""
Excel-truth senkronizasyonu — DB'yi Excel'e BİREBİR uydurur.
Her proje için: önce mevcut proje_kesif satırlarını siler, sonra Excel'deki kalemleri ekler.
Excel'de olmayan stale kayıtlar temizlenir.

Kullanım:
  Dry run: python server/scripts/sync-excel-truth.py --tenant=cakmakgrup
  Apply  : python server/scripts/sync-excel-truth.py --tenant=cakmakgrup --apply
"""
import os, sys, sqlite3, re, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from python_calamine import CalamineWorkbook

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TENANT = 'cakmakgrup'
APPLY = '--apply' in sys.argv
for a in sys.argv[1:]:
    if a.startswith('--tenant='): TENANT = a.split('=')[1]

DB_PATH = os.path.join(ROOT, 'data', 'tenants', TENANT, 'elektratrack.db')
print(f'Tenant: {TENANT} | DB: {DB_PATH}')

def norm(s):
    if not s: return ''
    s = str(s).upper()
    repl = {'İ':'I','I':'I','Ş':'S','Ç':'C','Ü':'U','Ö':'O','Ğ':'G'}
    for k,v in repl.items(): s = s.replace(k, v)
    s = re.sub(r'[^A-Z0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def parse_xlsx(path, sheet_name=None):
    """Returns list of {ad, mlz_mt: [...], dm: [...], dmm: [...], excel_yt_toplam: float}
    Bölüm tespiti: FILTRE kolonu (col 0) 'MALZEME - MONTAJ' / 'DEMONTAJ' / 'DM+M' (DMM) değerlerine göre
    excel_yt_toplam: TOPLAM satırından okunan proje YT toplam tutarı (Excel'in kendi hesabı)
    sheet_name: None ise ilk sayfa, aksi halde belirtilen sayfa
    """
    print(f'Açılıyor: {os.path.basename(path)} (sheet={sheet_name or "ilk"})')
    wb = CalamineWorkbook.from_path(path)
    sheet = wb.get_sheet_by_name(sheet_name if sheet_name else wb.sheet_names[0])
    rows = sheet.to_python()
    proje_ad_map, ilerleme_cols, yt_cols = {}, [], []
    # Geniş tarama: 280 sütundan fazla projeler de var (YB1'de 84 İLERLEME var, 700+ sütuna kadar)
    width = max(len(r) for r in rows[:5]) if rows else 0
    for c in range(min(2400, width)):
        v0 = rows[0][c] if c < len(rows[0]) else None
        v2 = rows[2][c] if len(rows) > 2 and c < len(rows[2]) else None
        s0 = str(v0).strip() if v0 else ''
        s2 = str(v2).strip() if v2 else ''
        if s0 and not re.match(r'^(KE[ŞS]|MALZEME|F[İI]LTRE|[İI]HALE|KIRILIM|YEDA[ŞS]|ARTIRIM|TENZIL|MALZ|DOK|YAYIN|REVIZYON|TOPLAM|MNTJ|HARCAMA|KONTROL)', s0, re.I):
            proje_ad_map[c] = s0
        if s2 == 'İLERLEME': ilerleme_cols.append(c)
        if s2.startswith('YER TESL'): yt_cols.append(c)

    # Bölüm aralıklarını tespit et: hangi satır aralığı mlz_mt / dm / dmm
    bolumler = []  # [(start, end, type)]
    cur_type, cur_start = None, None
    for r in range(3, len(rows)):
        row = rows[r]
        if not row or len(row) == 0: continue
        f0 = str(row[0]).strip().upper() if row[0] else ''
        if f0 == 'MALZEME - MONTAJ':
            new_type = 'mlz_mt'
        elif f0 == 'DEMONTAJ':
            new_type = 'dm'
        elif f0 in ('DM+M', 'DMM', 'DEMONTAJDAN MONTAJ', 'DEMONTAJDAN-MONTAJ'):
            new_type = 'dmm'
        elif f0 == 'TOPLAM':
            # TOPLAM satırına geldik — son bölümü kapat ve dur
            if cur_type:
                bolumler.append((cur_start, r, cur_type))
                cur_type = None
            break
        else:
            continue  # alt satır veya başka, bölüm değişmiyor
        # Yeni bölüm başlangıcı veya devam
        if new_type != cur_type:
            if cur_type:
                bolumler.append((cur_start, r, cur_type))
            cur_type = new_type
            cur_start = r
    if cur_type:
        bolumler.append((cur_start, len(rows), cur_type))
    print(f'  Bölümler: {bolumler}')

    # Alt-toplam satırlarını bul: önce ilk "TOPLAM" satırını altan tara, sonra ondan
    # ÖNCEKI 3 satır sırasıyla DMM, DM, MLZ+MT raw alt-toplamlarıdır.
    # (Excel'de 1.1x'li ARTIRIMLI bloku TOPLAM'dan SONRA gelir; o yüzden ilk TOPLAM raw'dur.)
    altsubtotal = {}
    toplam_idx = None
    for i in range(len(rows) - 1, -1, -1):
        r = rows[i]
        if not r or len(r) <= 5 or not r[5]: continue
        s = str(r[5]).strip().upper()
        if s == 'TOPLAM':
            toplam_idx = i  # son TOPLAM (artırımlı bloğun toplamı veya raw'ın toplamı — kontrol et)
    # En sondaki TOPLAM artırımlı blok'un da olabilir; raw TOPLAM'ı bulmak için
    # YUKARIDAN AŞAĞIYA ilk TOPLAM'ı bul (raw blok daha önce gelir).
    for i in range(len(rows)):
        r = rows[i]
        if not r or len(r) <= 5 or not r[5]: continue
        s = str(r[5]).strip().upper()
        if s == 'TOPLAM' and i > 100:  # üstteki TOPLAM olabilirler değil; ilk büyük olanı al
            toplam_idx = i
            break
    if toplam_idx:
        altsubtotal['toplam'] = toplam_idx
        # toplam_idx'den önce 3 etiket: DMM (toplam-1), DM (toplam-2), MLZ+MT (toplam-3)
        for offset, key in [(-3, 'mlz_mt'), (-2, 'dm'), (-1, 'dmm')]:
            ridx = toplam_idx + offset
            if ridx < 0: continue
            r = rows[ridx]
            if not r or len(r) <= 5: continue
            s = str(r[5]).strip().upper() if r[5] else ''
            # Beklenen etiket kontrolü (yumuşak — boşsa da kabul et)
            if (key == 'mlz_mt' and ('MALZEME' in s and 'MONTAJ' in s)) \
               or (key == 'dm' and 'DEMONTAJ' in s and 'DEMONTAJDAN' not in s) \
               or (key == 'dmm' and ('DEMONTAJDAN' in s or 'DM+M' in s)) \
               or s == '':
                altsubtotal[key] = ridx
    toplam_row_idx = altsubtotal.get('toplam')
    print(f'  Alt-toplam satırları: {altsubtotal}')

    projeler = []
    for ic in ilerleme_cols:
        ytc = next((c for c in yt_cols if c == ic - 1), ic - 1)
        # Proje adı tipik olarak ic+2 sütunundaki "PYP AKTARIM HARCAMA" kolon başlığı R0'da
        # önce ic+2 kontrolü, sonra geniş tarama
        ad = None
        for delta in [2, 1, 3, 0, -1, 4, 5, -2, -3]:
            c = ic + delta
            if c in proje_ad_map:
                ad = proje_ad_map[c]
                break
        if not ad or len(ad) < 3: continue
        # Excel alt-toplam satırlarından her bölümün YT/İlerleme tutarlarını çek
        def safe_float(v):
            try: return float(v) if v else 0
            except: return 0
        def cell_at(ridx, cidx):
            if ridx is None or ridx >= len(rows): return 0
            row = rows[ridx]
            return safe_float(row[cidx]) if cidx < len(row) else 0
        excel_mlzmt_yt = cell_at(altsubtotal.get('mlz_mt'), ytc)
        excel_mlzmt_il = cell_at(altsubtotal.get('mlz_mt'), ic)
        excel_dm_yt = cell_at(altsubtotal.get('dm'), ytc)
        excel_dm_il = cell_at(altsubtotal.get('dm'), ic)
        excel_dmm_yt = cell_at(altsubtotal.get('dmm'), ytc)
        excel_dmm_il = cell_at(altsubtotal.get('dmm'), ic)
        excel_yt_toplam = cell_at(toplam_row_idx, ytc)
        secim = {'mlz_mt': [], 'dm': [], 'dmm': []}
        for (s, e, tip) in bolumler:
            for r in range(s, e):
                row = rows[r]
                if not row: continue
                # Header satırı atla (row[5] = "Malzeme veya İşin Cinsi")
                cins0 = str(row[5]).strip() if len(row) > 5 and row[5] else ''
                if cins0 == 'Malzeme veya İşin Cinsi': continue
                f0 = str(row[0]).strip().upper() if row[0] else ''
                # Bölüm başlık satırı (sadece kategori yazısı) atla — poz boşsa atla
                poz = row[1] if len(row) > 1 else None
                if not poz: continue
                kod = row[3] if len(row) > 3 else None
                cins = row[5] if len(row) > 5 else None
                olcu = row[6] if len(row) > 6 else None
                agirlik = row[7] if len(row) > 7 else None
                # Excel'in kendi birim fiyatları (section'a göre)
                #   C8: Malzeme, C9: Montaj, C10: Demontaj, C11: Demontajdan Montaj  (RAW = ihale)
                #   C13: Malzeme, C14: Montaj, C15: Demontaj, C16: Demontajdan Montaj (ARTIRIMLI = +%10 yuvarlı)
                if tip == 'mlz_mt':
                    excel_fiyat = (safe_float(row[8] if len(row) > 8 else 0)
                                  + safe_float(row[9] if len(row) > 9 else 0))
                    excel_fiyat_artirimli = (safe_float(row[13] if len(row) > 13 else 0)
                                            + safe_float(row[14] if len(row) > 14 else 0))
                elif tip == 'dm':
                    excel_fiyat = safe_float(row[10] if len(row) > 10 else 0)
                    excel_fiyat_artirimli = safe_float(row[15] if len(row) > 15 else 0)
                else:
                    excel_fiyat = safe_float(row[11] if len(row) > 11 else 0)
                    excel_fiyat_artirimli = safe_float(row[16] if len(row) > 16 else 0)
                yt = row[ytc] if len(row) > ytc else None
                il = row[ic] if len(row) > ic else None
                if not cins: continue
                try: yt = float(yt) if yt else 0
                except: yt = 0
                try: il = float(il) if il else 0
                except: il = 0
                try: ag = float(agirlik) if agirlik else None
                except: ag = None
                secim[tip].append({
                    'poz': str(poz),
                    'malzeme_kodu': str(kod).strip() if kod else None,
                    'malzeme_adi': str(cins).strip(),
                    'birim': str(olcu) if olcu else 'Ad',
                    'miktar': yt,
                    'ilerleme': il,
                    'birim_agirlik': ag,
                    'excel_fiyat': excel_fiyat,
                    'excel_fiyat_artirimli': excel_fiyat_artirimli,
                })
        # Tüm bölümler boşsa atla
        if not (secim['mlz_mt'] or secim['dm'] or secim['dmm']): continue
        projeler.append({
            'ad': ad,
            'excel_yt_toplam': excel_yt_toplam,
            'excel_mlzmt_yt': excel_mlzmt_yt, 'excel_mlzmt_il': excel_mlzmt_il,
            'excel_dm_yt': excel_dm_yt, 'excel_dm_il': excel_dm_il,
            'excel_dmm_yt': excel_dmm_yt, 'excel_dmm_il': excel_dmm_il,
            **secim,
        })
    return projeler

# Her iki dosyayı oku
KET_ONLY = '--ket-only' in sys.argv
YB_ONLY = '--yb-only' in sys.argv

# Yatırım Takip xlsm tek dosya — hem KET hem YB için
# 'Samsun Batı Ket' / 'Samsun Batı YB1' sayfaları aynı şemada per-kalem detay içerir
_YT_PATH = os.path.join(ROOT, 'doc', 'Yatırım Takip_2026 BATI  KETYB 30.04.2026.xlsm')
_KET_FALLBACK_PATHS = [
    os.path.join(ROOT, 'doc', 'ilerleme KET.xlsx'),
    os.path.join(ROOT, 'doc', 'ilerleme.xlsx'),
]
ket_path = _YT_PATH if os.path.exists(_YT_PATH) else next((p for p in _KET_FALLBACK_PATHS if os.path.exists(p)), _KET_FALLBACK_PATHS[0])
ket_sheet = 'Samsun Batı Ket' if ket_path == _YT_PATH else None

if YB_ONLY:
    ket = []
else:
    ket = parse_xlsx(ket_path, sheet_name=ket_sheet) if ket_sheet else parse_xlsx(ket_path)

if KET_ONLY:
    yb = []
elif os.path.exists(_YT_PATH):
    yb = parse_xlsx(_YT_PATH, sheet_name='Samsun Batı YB1')
else:
    yb = parse_xlsx(os.path.join(ROOT, 'doc', 'ilerleme YB.xlsx'))
print(f'\nKET: {len(ket)} proje, YB: {len(yb)} proje')

# DB
con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row

# Migration — eksik kolonlar ve yeni tablo
def has_col(table, col):
    return col in [r[1] for r in con.execute(f"PRAGMA table_info({table})").fetchall()]
for col, typ in [('ilerleme', 'REAL DEFAULT 0'), ('birim_fiyat', 'REAL DEFAULT 0'),
                  ('birim_agirlik', 'REAL DEFAULT 0'), ('kapsayici', 'INTEGER DEFAULT 0')]:
    if not has_col('proje_demontaj', col):
        con.execute(f'ALTER TABLE proje_demontaj ADD COLUMN {col} {typ}')
        print(f'  + proje_demontaj.{col} eklendi')
con.execute('''CREATE TABLE IF NOT EXISTS proje_dmm (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    malzeme_kodu TEXT, poz_no TEXT,
    malzeme_adi TEXT NOT NULL, birim TEXT DEFAULT 'Ad',
    miktar REAL DEFAULT 0, ilerleme REAL DEFAULT 0,
    birim_fiyat REAL DEFAULT 0, birim_agirlik REAL DEFAULT 0,
    kapsayici INTEGER DEFAULT 0, durum TEXT DEFAULT 'planli', notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proje_id) REFERENCES projeler(id) ON DELETE CASCADE)''')
con.execute('CREATE INDEX IF NOT EXISTS idx_proje_dmm_proje ON proje_dmm(proje_id)')

db_projeler = con.execute('SELECT id, proje_no, musteri_adi, proje_tipi FROM projeler').fetchall()
db_ad_haritasi = {}
for p in db_projeler:
    adn = norm(p['musteri_adi'] or p['proje_no'])
    if adn: db_ad_haritasi[adn] = dict(p)
print(f'DB: {len(db_projeler)} proje')

# Katalog fiyatları
katalog = con.execute('''SELECT poz_birlesik, malzeme_kodu, malzeme_birim_fiyat, montaj_birim_fiyat,
    demontaj_birim_fiyat, demontajdan_montaj_fiyat FROM depo_malzeme_katalogu''').fetchall()
fiyat_poz, fiyat_kod = {}, {}
for k in katalog:
    f = (k['malzeme_birim_fiyat'] or 0) + (k['montaj_birim_fiyat'] or 0) + (k['demontaj_birim_fiyat'] or 0) + (k['demontajdan_montaj_fiyat'] or 0)
    if k['poz_birlesik'] and f > 0: fiyat_poz[k['poz_birlesik']] = f
    if k['malzeme_kodu'] and f > 0 and k['malzeme_kodu'] not in fiyat_kod: fiyat_kod[k['malzeme_kodu']] = f

def fiyat_bul(m):
    if m['poz'] in fiyat_poz: return fiyat_poz[m['poz']]
    if m['malzeme_kodu'] and m['malzeme_kodu'] in fiyat_kod: return fiyat_kod[m['malzeme_kodu']]
    return 0

def db_proje_bul(xls_ad):
    xpn = norm(xls_ad)
    for adn, dbp in db_ad_haritasi.items():
        if xpn in adn or adn in xpn: return dbp
    return None

all_xls = ket + yb
TIP_TABLO = {'mlz_mt': 'proje_kesif', 'dm': 'proje_demontaj', 'dmm': 'proje_dmm'}

print(f'\n=== KARŞILAŞTIRMA ({len(all_xls)} proje × 3 bölüm) ===')
print(f'{"Proje":<30} {"MLZ_MT":>10} {"DM":>10} {"DMM":>10} {"XLS Toplam":>14}')
print('-' * 80)
unmatch = 0
gtoplam = 0
for xp in all_xls:
    match = db_proje_bul(xp['ad'])
    if not match: unmatch += 1; continue
    proj_top = sum(m['miktar'] * fiyat_bul(m) for tip in ('mlz_mt','dm','dmm') for m in xp[tip])
    gtoplam += proj_top
    print(f'{xp["ad"][:30]:<30} {len(xp["mlz_mt"]):>10} {len(xp["dm"]):>10} {len(xp["dmm"]):>10} {round(proj_top):>14,}')

print('-' * 80)
print(f'{"GRAND XLS":<30} {sum(len(xp["mlz_mt"]) for xp in all_xls if db_proje_bul(xp["ad"])):>10} '
      f'{sum(len(xp["dm"]) for xp in all_xls if db_proje_bul(xp["ad"])):>10} '
      f'{sum(len(xp["dmm"]) for xp in all_xls if db_proje_bul(xp["ad"])):>10} {round(gtoplam):>14,}')
print(f'\nEşleşmeyen: {unmatch}')

if not APPLY:
    print('\n[DRY-RUN] Hiçbir şey değişmedi. --apply ile uygula.')
    sys.exit(0)

# === APPLY: 3 bölümü 3 farklı tabloya senkronize et ===
print('\n[APPLY] Senkronizasyon başlıyor...')

def sync_section(con, tablo, pid, items):
    """items'ı tablo'ya senkronize et (UPDATE/INSERT, Excel'de olmayanları sil)"""
    silindi, eklendi = 0, 0
    xls_pozlar = set(m['poz'] for m in items)
    db_rows = [dict(r) for r in con.execute(f'SELECT id, poz_no, birim_fiyat FROM {tablo} WHERE proje_id = ?', (pid,)).fetchall()]
    for r in db_rows:
        if r['poz_no'] not in xls_pozlar:
            con.execute(f'DELETE FROM {tablo} WHERE id = ?', (r['id'],))
            silindi += 1
    for m in items:
        # SADECE Excel sayfasının kendi section birim fiyatını kullan.
        fiyat = m.get('excel_fiyat') or 0
        fiyat_art = m.get('excel_fiyat_artirimli') or 0
        cur = con.execute(f'SELECT id, birim_fiyat FROM {tablo} WHERE proje_id = ? AND poz_no = ? LIMIT 1', (pid, m['poz'])).fetchone()
        if cur:
            con.execute(f'''UPDATE {tablo} SET malzeme_adi = ?, malzeme_kodu = COALESCE(?, malzeme_kodu),
                birim = ?, miktar = ?, ilerleme = ?, birim_agirlik = COALESCE(?, birim_agirlik),
                birim_fiyat = ?, artirimli_birim_fiyat = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?''',
                (m['malzeme_adi'], m['malzeme_kodu'], m['birim'], m['miktar'], m['ilerleme'],
                 m['birim_agirlik'], fiyat, fiyat_art, cur['id']))
        elif m['miktar'] > 0 or m['ilerleme'] > 0:
            con.execute(f'''INSERT INTO {tablo} (proje_id, poz_no, malzeme_kodu, malzeme_adi,
                birim, miktar, ilerleme, birim_agirlik, birim_fiyat, artirimli_birim_fiyat, durum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planli')''',
                (pid, m['poz'], m['malzeme_kodu'], m['malzeme_adi'], m['birim'],
                 m['miktar'], m['ilerleme'], m['birim_agirlik'], fiyat, fiyat_art))
            eklendi += 1
    return silindi, eklendi

toplam = {'mlz_mt': [0,0], 'dm': [0,0], 'dmm': [0,0]}
proje_tutar_guncellendi = 0
for xp in all_xls:
    match = db_proje_bul(xp['ad'])
    if not match: continue
    pid = match['id']
    for tip in ('mlz_mt', 'dm', 'dmm'):
        s, e = sync_section(con, TIP_TABLO[tip], pid, xp[tip])
        toplam[tip][0] += s
        toplam[tip][1] += e
    # Excel alt-toplamlarını proje seviyesinde sakla
    if xp.get('excel_yt_toplam', 0) > 0 or xp.get('excel_mlzmt_yt', 0) > 0:
        # Migration garantisi
        try:
            for col in ['excel_mlzmt_tutar', 'excel_mlzmt_ilerleme', 'excel_dm_tutar',
                        'excel_dm_ilerleme', 'excel_dmm_tutar', 'excel_dmm_ilerleme']:
                con.execute(f'SELECT {col} FROM projeler LIMIT 1')
        except:
            for col in ['excel_mlzmt_tutar', 'excel_mlzmt_ilerleme', 'excel_dm_tutar',
                        'excel_dm_ilerleme', 'excel_dmm_tutar', 'excel_dmm_ilerleme']:
                try: con.execute(f'ALTER TABLE projeler ADD COLUMN {col} REAL DEFAULT 0')
                except: pass
        con.execute('''UPDATE projeler SET
            kesif_tutari = ?,
            excel_mlzmt_tutar = ?, excel_mlzmt_ilerleme = ?,
            excel_dm_tutar = ?, excel_dm_ilerleme = ?,
            excel_dmm_tutar = ?, excel_dmm_ilerleme = ?
            WHERE id = ?''',
            (round(xp.get('excel_yt_toplam', 0), 2),
             round(xp.get('excel_mlzmt_yt', 0), 2), round(xp.get('excel_mlzmt_il', 0), 2),
             round(xp.get('excel_dm_yt', 0), 2), round(xp.get('excel_dm_il', 0), 2),
             round(xp.get('excel_dmm_yt', 0), 2), round(xp.get('excel_dmm_il', 0), 2),
             pid))
        proje_tutar_guncellendi += 1

con.commit()
con.close()
print(f'[APPLY] Tamamlandı:')
print(f'  proje_kesif (Mlz+Mt) : {toplam["mlz_mt"][0]} silindi, {toplam["mlz_mt"][1]} eklendi')
print(f'  proje_demontaj (DM)  : {toplam["dm"][0]} silindi, {toplam["dm"][1]} eklendi')
print(f'  proje_dmm (DM+M)     : {toplam["dmm"][0]} silindi, {toplam["dmm"][1]} eklendi')
print(f'  projeler.kesif_tutari: {proje_tutar_guncellendi} proje güncellendi')
