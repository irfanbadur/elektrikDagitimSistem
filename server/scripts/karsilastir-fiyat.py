"""
DB ile Excel "KET-YB PROJE İLERLEME" sayfasındaki fiyatları karşılaştır.

Beklenti: uygulamadaki RAW fiyat × 1.1 = Excel C17 (KEŞİF TUTARI)
         uygulamadaki RAW ilerleme × 1.1 = Excel C20 (İLERLEME MİKTARI)

Excel R206 = toplam keşif (TOPLAM satırı, R sütunu)
DB toplam × 1.1 ?= R206
"""
import os, sys, sqlite3, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from python_calamine import CalamineWorkbook

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT, 'data', 'tenants', 'cakmakgrup', 'elektratrack.db')
XLSM = os.path.join(ROOT, 'doc', 'Yatırım Takip_2026 BATI  KETYB 30.04.2026.xlsm')

def temizle_pno(s):
    if not s: return None
    s = str(s).strip().replace('.BATI.', '.')
    if s in ('-', '', '_', '–'): return None
    return s

def safe_float(v):
    try: return float(v) if v not in (None, '') else None
    except: return None

# Excel oku
print('Excel okunuyor...')
wb = CalamineWorkbook.from_path(XLSM)
sh = wb.get_sheet_by_name('KET-YB PROJE İLERLEME')
rows = sh.to_python()
print(f'  Satır: {len(rows)}')

# Header
HDR_ROW = 5
print('\n=== Header (R5) ===')
for c in range(15, min(28, len(rows[HDR_ROW]))):
    v = rows[HDR_ROW][c]
    print(f'  C{c}: {repr(v)}')

# Sütun tespiti
def find_col(header_row, target):
    for c, v in enumerate(header_row):
        if v and target.upper() in str(v).upper():
            return c
    return None

KESIF_COL = find_col(rows[HDR_ROW], 'KEŞİF TUTARI')
ILERLEME_COL = find_col(rows[HDR_ROW], 'İLERLEME MİKTARI')
SOZLESME_COL = find_col(rows[HDR_ROW], 'SÖZLEŞME KEŞFİ')
print(f'\nKEŞİF TUTARI (R)  → C{KESIF_COL}')
print(f'İLERLEME MİKTARI (Y) → C{ILERLEME_COL}')
print(f'SÖZLEŞME KEŞFİ → C{SOZLESME_COL}')

# TOPLAM satırını bul
toplam_row_idx = None
for r in range(6, len(rows)):
    row = rows[r]
    if not row: continue
    for c in range(min(30, len(row))):
        v = row[c]
        if v and 'TOPLAM' in str(v).upper():
            toplam_row_idx = r
            break
    if toplam_row_idx: break
print(f'\n=== TOPLAM satırı: R{toplam_row_idx+1} (Python {toplam_row_idx}) ===')
if toplam_row_idx:
    print(f'  Excel KEŞİF TUTARI toplam (R{toplam_row_idx+1}): {rows[toplam_row_idx][KESIF_COL]}')
    print(f'  Excel İLERLEME MİKTARI toplam: {rows[toplam_row_idx][ILERLEME_COL]}')

# Excel projelerini parse et — çakışma yönetimi ile (sync ile aynı mantık)
from collections import defaultdict
xls_projeler = []
for r in range(6, len(rows)):
    row = rows[r]
    if not row or len(row) < 12: continue
    pno = temizle_pno(row[2]); ad = row[11]
    if not ad: continue
    xls_projeler.append({
        'r': r,
        'pno': pno,
        'sira': safe_float(row[0]),
        'ad': str(ad).strip(),
        'sozlesme': safe_float(row[SOZLESME_COL]) if SOZLESME_COL else None,
        'kesif': safe_float(row[KESIF_COL]) if KESIF_COL else None,
        'ilerleme': safe_float(row[ILERLEME_COL]) if ILERLEME_COL else None,
    })

# Çakışma yönetimi
pno_kullanim = defaultdict(int)
for xp in xls_projeler:
    if not xp['pno']: continue
    pno_kullanim[xp['pno']] += 1
    if pno_kullanim[xp['pno']] > 1 and xp.get('sira'):
        xp['pno'] = f'{xp["pno"]}-{int(xp["sira"])}'

print(f'\nExcel proje: {len(xls_projeler)}')

# DB
con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row
db_map = {}
for p in con.execute('SELECT * FROM projeler').fetchall():
    if p['proje_no']: db_map[p['proje_no']] = dict(p)

# Karşılaştırma
def yakin(a, b, tol_pct=0.01, tol_min=50.0):
    """Mutlak fark <  max(50₺, %1) → eşit say"""
    if a is None or b is None: return False
    a, b = float(a), float(b)
    tol = max(tol_min, abs(b) * tol_pct)
    return abs(a - b) < tol

print('\n' + '='*120)
print(f'{"PROJE":<32} {"DB×1.1":>15} {"EXCEL R":>15} {"FARK":>12} {"DB ILR×1.1":>13} {"EXCEL ILR":>13} {"FARK":>12}')
print('='*120)

uyusan_kesif, uyusmayan_kesif = [], []
uyusan_iler, uyusmayan_iler = [], []
sadece_sozlesme = []  # keşfi yok ama sözleşmesi var (filtrelenecek)

# DB'de "uygulamada görülen" fiyat artık SADECE proje_kesif'ten hesaplanır.
# Bu yüzden API'nin hesapladığı kesif_toplam_tutar / kesif_ilerleme_tutar'ı çek.
import json, urllib.request
def fetch_api_proje():
    try:
        req = urllib.request.Request('http://localhost:4000/api/projeler', headers={'Cookie': 'tenant=cakmakgrup'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return {p['proje_no']: p for p in json.loads(resp.read().decode('utf-8'))['data']}
    except Exception as e:
        print(f'API erişilemedi ({e}); SQL ile hesaplanacak.')
        return None

api_map = fetch_api_proje() or {}

def db_raw_fiyat(p):
    pno = p.get('proje_no')
    if pno and pno in api_map:
        v = api_map[pno].get('kesif_toplam_tutar')
        if v and float(v) > 0: return float(v)
    return None

def db_raw_ilerleme(p):
    pno = p.get('proje_no')
    if pno and pno in api_map:
        v = api_map[pno].get('kesif_ilerleme_tutar')
        if v and float(v) > 0: return float(v)
    return None

for xp in sorted(xls_projeler, key=lambda x: x.get('sira') or 999):
    db_p = db_map.get(xp['pno']) if xp['pno'] else None
    if not db_p:
        # ad ile fallback
        for dbp in db_map.values():
            if dbp.get('musteri_adi', '').strip().upper() == xp['ad'].upper():
                db_p = dbp; break
    if not db_p:
        # eşleşmeyen proje
        continue

    db_kesif = db_raw_fiyat(db_p)
    db_iler = db_raw_ilerleme(db_p)
    excel_kesif = xp['kesif']
    excel_iler = xp['ilerleme']

    # Sözleşmesi var, keşfi yok → filtrele
    if (excel_kesif is None or excel_kesif == 0) and xp.get('sozlesme', 0):
        sadece_sozlesme.append(xp)
        continue

    db_kesif_x11 = (db_kesif or 0) * 1.1
    db_iler_x11 = (db_iler or 0) * 1.1

    fark_kesif = (db_kesif_x11) - (excel_kesif or 0)
    fark_iler = (db_iler_x11) - (excel_iler or 0)

    kesif_uyuyor = yakin(db_kesif_x11, excel_kesif)
    iler_uyuyor = yakin(db_iler_x11, excel_iler)

    flag_k = '✓' if kesif_uyuyor else '✗'
    flag_i = '✓' if iler_uyuyor else '✗'

    print(f'{xp["ad"][:30]:<32} {db_kesif_x11 or 0:>15,.0f} {excel_kesif or 0:>15,.0f} {flag_k} {fark_kesif:>10,.0f} '
          f'{db_iler_x11 or 0:>11,.0f} {excel_iler or 0:>11,.0f} {flag_i} {fark_iler:>10,.0f}')

    (uyusan_kesif if kesif_uyuyor else uyusmayan_kesif).append((xp, db_p, fark_kesif))
    (uyusan_iler if iler_uyuyor else uyusmayan_iler).append((xp, db_p, fark_iler))

print('='*120)
print(f'\n=== ÖZET ===')
print(f'  Eşleşen keşif:    {len(uyusan_kesif)}')
print(f'  Eşleşmeyen keşif: {len(uyusmayan_kesif)}')
print(f'  Eşleşen ilerleme: {len(uyusan_iler)}')
print(f'  Eşleşmeyen ilerleme: {len(uyusmayan_iler)}')
print(f'  Sadece sözleşmesi olan (filtrelendi): {len(sadece_sozlesme)}')

# Eşleşmeyen keşifler — detay
if uyusmayan_kesif:
    print('\n=== KEŞİF EŞLEŞMEYEN PROJELER ===')
    print(f'{"PROJE":<35} {"DB raw":>15} {"DB×1.1":>15} {"EXCEL R":>15} {"FARK":>12}  KAYNAK')
    for xp, db_p, fark in sorted(uyusmayan_kesif, key=lambda x: -abs(x[2]))[:30]:
        db_raw = db_raw_fiyat(db_p) or 0
        kaynak = 'mlzmt_tutar' if db_p.get('excel_mlzmt_tutar') else 'kesif_toplam_tutar' if not db_p.get('excel_mlzmt_tutar') else '?'
        print(f'{xp["ad"][:33]:<35} {db_raw:>15,.0f} {db_raw*1.1:>15,.0f} {xp["kesif"] or 0:>15,.0f} {fark:>12,.0f}  {kaynak}')

# Toplam karşılaştırma
toplam_db_kesif = sum((db_raw_fiyat(db_map.get(xp['pno'], {})) or 0) for xp in xls_projeler if xp['pno'] and xp['pno'] in db_map)
print(f'\n=== TOPLAM ===')
print(f'  DB toplam (raw):     {toplam_db_kesif:,.2f}')
print(f'  DB toplam × 1.1:     {toplam_db_kesif * 1.1:,.2f}')
if toplam_row_idx:
    excel_toplam = safe_float(rows[toplam_row_idx][KESIF_COL])
    print(f'  Excel R{toplam_row_idx+1} (TOPLAM): {excel_toplam or 0:,.2f}')
    if excel_toplam:
        print(f'  Fark:                {(toplam_db_kesif * 1.1 - excel_toplam):,.2f}')

con.close()
