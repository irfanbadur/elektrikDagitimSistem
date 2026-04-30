"""
doc/ilerleme YB.xlsx — YB projeleri için ilerleme/keşif senkronizasyon scripti.
Kullanım:
  Dry run: python server/scripts/import-ilerleme-yb.py --tenant=cakmakgrup
  Apply:   python server/scripts/import-ilerleme-yb.py --tenant=cakmakgrup --apply
"""
import os, sys, sqlite3, re
from python_calamine import CalamineWorkbook

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TENANT = 'cakmakgrup'
APPLY = '--apply' in sys.argv
for a in sys.argv[1:]:
    if a.startswith('--tenant='):
        TENANT = a.split('=')[1]

XLSX_PATH = os.path.join(ROOT, 'doc', 'ilerleme YB.xlsx')
DB_PATH = os.path.join(ROOT, 'data', 'tenants', TENANT, 'elektratrack.db')
print('XLSX:', XLSX_PATH)
print('DB :', DB_PATH)

def norm(s):
    if not s: return ''
    s = str(s).upper()
    repl = {'İ':'I','I':'I','Ş':'S','Ç':'C','Ü':'U','Ö':'O','Ğ':'G'}
    for k,v in repl.items(): s = s.replace(k, v)
    s = re.sub(r'[^A-Z0-9 ]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# 1) XLSX'i oku — calamine (Rust-based, çok hızlı)
print('Excel açılıyor...')
wb = CalamineWorkbook.from_path(XLSX_PATH)
ws_name = wb.sheet_names[0]
sheet = wb.get_sheet_by_name(ws_name)
# Tüm satırları liste olarak al (calamine streaming hızlı)
rows = sheet.to_python()
print(f'{len(rows)} satır okundu')

def cell(r, c):
    if r >= len(rows): return None
    row = rows[r]
    if c >= len(row): return None
    v = row[c]
    return v if v not in (None, '') else None

# R0 (proje adları) ve R2 (alt başlıklar) — 0-indexed
proje_ad_map = {}
ilerleme_cols = []
yer_teslim_cols = []

# rows[0] ve rows[2] üzerinde tara
for c in range(min(280, len(rows[0]) if rows else 0)):
    v0 = cell(0, c)
    v2 = cell(2, c)
    s0 = str(v0).strip() if v0 else ''
    s2 = str(v2).strip() if v2 else ''
    if s0 and not re.match(r'^(KE[ŞS]|MALZEME|F[İI]LTRE|[İI]HALE|KIRILIM)', s0, re.I):
        proje_ad_map[c] = s0
    if s2 == 'İLERLEME':
        ilerleme_cols.append(c)
    if s2.startswith('YER TESL'):
        yer_teslim_cols.append(c)

print(f'{len(proje_ad_map)} proje adayı, {len(ilerleme_cols)} ilerleme kolonu')

# Proje + kolon eşleştirme
projeler = []
for ic in ilerleme_cols:
    ytc = next((c for c in yer_teslim_cols if c == ic - 1), ic - 1)
    ad = None
    for c in range(ytc - 2, ic + 6):
        if c in proje_ad_map:
            ad = proje_ad_map[c]
            break
    if not ad or len(ad) < 3:
        continue
    projeler.append({'ad': ad, 'yt_col': ytc, 'il_col': ic})

print(f'{len(projeler)} proje bloğu eşleşti')

# 2) Her proje için malzeme/miktar çıkar
def malzemeleri_cikar(yt_col, il_col):
    items = []
    bos = 0
    # Veri satırları row 4'ten (0-indexed) itibaren
    for r in range(4, min(len(rows), 2000)):
        filtre = cell(r, 0)
        if not filtre:
            bos += 1
            if bos > 6: break
            continue
        bos = 0
        poz = cell(r, 1)
        eski_poz = cell(r, 2)
        kod = cell(r, 3)
        cins = cell(r, 5)
        olcu = cell(r, 6)
        agirlik = cell(r, 7)
        yt = cell(r, yt_col)
        il = cell(r, il_col)
        if not poz or not cins:
            continue
        try: yt = float(yt) if yt else 0
        except: yt = 0
        try: il = float(il) if il else 0
        except: il = 0
        if yt == 0 and il == 0:
            continue
        try: agirlik_n = float(agirlik) if agirlik else None
        except: agirlik_n = None
        items.append({
            'poz': str(poz),
            'eski_poz': str(eski_poz) if eski_poz else None,
            'malzeme_kodu': str(kod).strip() if kod else None,
            'malzeme_adi': str(cins).strip(),
            'birim': str(olcu) if olcu else 'Ad',
            'birim_agirlik': agirlik_n,
            'miktar': yt,
            'ilerleme': il,
        })
    return items

# 3) DB ile eşleştir
con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row
db_projeler = con.execute('SELECT id, proje_no, musteri_adi, proje_tipi FROM projeler').fetchall()
print(f'\nDB\'de {len(db_projeler)} proje var')
db_ad_haritasi = {}
for p in db_projeler:
    adn = norm(p['musteri_adi'] or p['proje_no'])
    if adn:
        db_ad_haritasi[adn] = dict(p)

mevcut, yeni = [], []
for xp in projeler:
    xpn = norm(xp['ad'])
    match = None
    for adn, dbp in db_ad_haritasi.items():
        if xpn in adn or adn in xpn:
            match = dbp
            break
    items = malzemeleri_cikar(xp['yt_col'], xp['il_col'])
    if match:
        mevcut.append({'xls': xp['ad'], 'db': match, 'items': items})
    else:
        yeni.append({'xls': xp['ad'], 'items': items})

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

print(f'\n=== MEVCUT ({len(mevcut)}) ===')
for r in mevcut:
    print(f'  [OK] {r["xls"][:40]:40s} -> {r["db"]["proje_no"]:25s} ({len(r["items"])} malzeme)')
print(f'\n=== YENI ({len(yeni)}) ===')
for r in yeni:
    print(f'  [+] {r["xls"][:40]:40s} ({len(r["items"])} malzeme)')

toplam_malzeme = sum(len(r['items']) for r in mevcut + yeni)
print(f'\nToplam {toplam_malzeme} malzeme satırı')

if not APPLY:
    print('\n[DRY-RUN] --apply ile gerçekten çalıştır')
    sys.exit(0)

# 4) Apply: katalog fiyatlarını yükle
print('\n[APPLY] Senkronizasyon başlıyor...')
katalog = con.execute('''SELECT poz_birlesik, malzeme_kodu, malzeme_birim_fiyat,
    montaj_birim_fiyat, demontaj_birim_fiyat, demontajdan_montaj_fiyat
    FROM depo_malzeme_katalogu''').fetchall()
fiyat_poz, fiyat_kod = {}, {}
for k in katalog:
    f = (k['malzeme_birim_fiyat'] or 0) + (k['montaj_birim_fiyat'] or 0) + (k['demontaj_birim_fiyat'] or 0) + (k['demontajdan_montaj_fiyat'] or 0)
    if k['poz_birlesik'] and f > 0:
        fiyat_poz[k['poz_birlesik']] = f
    if k['malzeme_kodu'] and f > 0 and k['malzeme_kodu'] not in fiyat_kod:
        fiyat_kod[k['malzeme_kodu']] = f

def fiyat_bul(m):
    if m['poz'] in fiyat_poz: return fiyat_poz[m['poz']]
    if m['malzeme_kodu'] and m['malzeme_kodu'] in fiyat_kod: return fiyat_kod[m['malzeme_kodu']]
    return 0

t_update, t_insert, p_count = 0, 0, 0
for r in mevcut:
    proje_id = r['db']['id']
    for m in r['items']:
        fiyat = fiyat_bul(m)
        cur = con.execute('SELECT id, birim_fiyat FROM proje_kesif WHERE proje_id = ? AND poz_no = ? LIMIT 1',
            (proje_id, m['poz'])).fetchone()
        if cur:
            yf = cur['birim_fiyat'] if (cur['birim_fiyat'] or 0) > 0 else fiyat
            con.execute('''UPDATE proje_kesif SET malzeme_adi = ?, malzeme_kodu = COALESCE(?, malzeme_kodu),
                birim = ?, miktar = ?, ilerleme = ?, birim_agirlik = COALESCE(?, birim_agirlik),
                birim_fiyat = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?''',
                (m['malzeme_adi'], m['malzeme_kodu'], m['birim'], m['miktar'], m['ilerleme'],
                 m['birim_agirlik'], yf, cur['id']))
            t_update += 1
        else:
            con.execute('''INSERT INTO proje_kesif (proje_id, poz_no, malzeme_kodu, malzeme_adi,
                birim, miktar, ilerleme, birim_agirlik, birim_fiyat, durum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planli')''',
                (proje_id, m['poz'], m['malzeme_kodu'], m['malzeme_adi'], m['birim'],
                 m['miktar'], m['ilerleme'], m['birim_agirlik'], fiyat))
            t_insert += 1
    p_count += 1

con.commit()
con.close()
print(f'[APPLY] Tamamlandı: {p_count} proje | {t_update} güncellendi | {t_insert} eklendi')
