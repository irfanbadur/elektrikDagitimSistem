"""
Yatırım Takip xlsm dosyasındaki 'KET-YB PROJE İLERLEME' sayfasını okuyarak
DB'deki proje listesini günceller:
  - Eksik projeleri INSERT eder
  - Mevcut projelerin metadata alanlarını UPDATE eder

Sayfada 93 proje var. Tip dağılımı: YB 44, KET 39, TRAFOLU YB 10 (TRAFOLU YB → YB).

Kullanım:
  Dry run : python server/scripts/sync-proje-listesi.py --tenant=cakmakgrup
  Apply   : python server/scripts/sync-proje-listesi.py --tenant=cakmakgrup --apply
"""
import os, sys, sqlite3, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from python_calamine import CalamineWorkbook

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TENANT = 'cakmakgrup'
APPLY = '--apply' in sys.argv
for a in sys.argv[1:]:
    if a.startswith('--tenant='): TENANT = a.split('=')[1]
DB_PATH = os.path.join(ROOT, 'data', 'tenants', TENANT, 'elektratrack.db')
XLSM = os.path.join(ROOT, 'doc', 'Yatırım Takip_2026 BATI  KETYB 30.04.2026.xlsm')
SHEET = 'KET-YB PROJE İLERLEME'

print(f'Tenant: {TENANT}')
print(f'DB:     {DB_PATH}')
print(f'Excel:  {XLSM} → {SHEET}')

# Sabitler
BOLGE_SAMSUN_BATI = 6
IS_TIPI_YB  = 1
IS_TIPI_KET = 2

def temizle_proje_no(s):
    """26.BATI.YB.1.037 → 26.YB.1.037; sadece tire vb. atılır"""
    if not s: return None
    s = str(s).strip().replace('.BATI.', '.')
    if s in ('-', '', '_', '–'): return None
    if not re.search(r'\d', s): return None  # rakam yoksa geçersiz
    return s

def normalize_ad(s):
    if not s: return ''
    u = str(s).upper()
    repl = {'İ':'I','I':'I','Ş':'S','Ç':'C','Ü':'U','Ö':'O','Ğ':'G'}
    for k,v in repl.items(): u = u.replace(k, v)
    u = re.sub(r'[^A-Z0-9 ]', ' ', u)
    return re.sub(r'\s+', ' ', u).strip()

def tipten_is_tipi(t):
    """TRAFOLU YB / YB → YB; KET → KET"""
    if not t: return None
    u = str(t).upper()
    if 'YB' in u or 'YAPI' in u or 'BAĞLANTI' in u: return ('YB', IS_TIPI_YB)
    if 'KET' in u: return ('KET', IS_TIPI_KET)
    return None

def safe_str(v):
    if v is None or v == '': return None
    return str(v).strip() or None

def safe_float(v):
    try: return float(v) if v not in (None, '') else None
    except: return None

def safe_int(v):
    try: return int(float(v)) if v not in (None, '') else None
    except: return None

def safe_date(v):
    """Excel'den gelen tarih (str ya da datetime) → 'YYYY-MM-DD' veya None"""
    if v is None or v == '': return None
    s = str(v)[:10]
    if re.match(r'\d{4}-\d{2}-\d{2}', s): return s
    return None

# Excel'i oku — sadece hedef sayfa
print('\nExcel okunuyor (sadece hedef sayfa)...')
wb = CalamineWorkbook.from_path(XLSM)
sh = wb.get_sheet_by_name(SHEET)
rows = sh.to_python()
print(f'  Satır sayısı: {len(rows)}')

# R6 ve sonrası proje satırları
xls_projeler = []
for r_idx in range(6, len(rows)):
    row = rows[r_idx]
    if not row or len(row) < 12: continue
    pno = temizle_proje_no(safe_str(row[2]))
    tur_str = safe_str(row[7])
    pad = safe_str(row[11])
    if not pad:  # ne pno ne ad varsa atla
        continue
    tip_t = tipten_is_tipi(tur_str)
    if not tip_t: continue  # tip belirsizse atla
    tip_kod, is_tipi_id = tip_t
    xls_projeler.append({
        'pno': pno, 'tip': tip_kod, 'is_tipi_id': is_tipi_id,
        'sira':       safe_int(row[0]),
        'yil':        safe_int(row[1]),
        'pyp':        safe_str(row[2]),  # orijinal (BATI'lı)
        'ihale_no':   safe_str(row[3]),
        'ihale_adi':  safe_str(row[4]),
        'bolge_str':  safe_str(row[5]),
        'yuklenici':  safe_str(row[6]),
        'tur':        tur_str,
        'basvuru_no': safe_str(row[8]),
        'il':         safe_str(row[9]),
        'ilce':       safe_str(row[10]),
        'musteri_adi': pad,
        'cbs_id':     safe_str(row[12]),
        'cbs_durum':  safe_str(row[13]),
        'is_durumu':  safe_str(row[14]),
        'demontaj_teslim_durumu': safe_str(row[15]),
        'sozlesme_kesfi':  safe_float(row[16]),
        'kesif_tutari':    safe_float(row[17]),
        'hakedis_miktari': safe_float(row[18]),
        'hakedis_yuzdesi': safe_float(row[19]),
        'ilerleme_miktari':safe_float(row[20]),
        'ilerleme_yuzdesi':safe_float(row[21]),
        'proje_onay_durumu': safe_str(row[22]),
        'is_grubu':   safe_str(row[23]),
        'teslim_tarihi':           safe_date(row[24]),
        'baslama_tarihi':          safe_date(row[25]),
        'bitis_tarihi':            safe_date(row[26]),
        'proje_baslangic_tarihi':  safe_date(row[27]),
        'enerjilenme_tarihi':      safe_date(row[28]),
        'aciklamalar': safe_str(row[29] if len(row) > 29 else None),
    })
print(f'  Geçerli proje: {len(xls_projeler)}  (YB: {sum(1 for p in xls_projeler if p["tip"]=="YB")}, KET: {sum(1 for p in xls_projeler if p["tip"]=="KET")})')

# Çakışan proje_no'ları ayırt et: aynı temizle'lı pno'ya sahip ikinci ve sonrası "-{sira}" suffix alır
# (Excel'de 26.YB.1.025 hem HARUN KAMBUR (sira 14) hem Fahri ÇOLAK (sira 32) için kullanılıyor)
from collections import defaultdict
pno_kullanim = defaultdict(int)
for xp in xls_projeler:
    if not xp['pno']: continue
    pno_kullanim[xp['pno']] += 1
    if pno_kullanim[xp['pno']] > 1 and xp.get('sira'):
        eski = xp['pno']
        xp['pno'] = f'{xp["pno"]}-{int(xp["sira"])}'
        print(f'  ⚠ Çakışma: {eski} (sira={int(xp["sira"])} {xp["musteri_adi"][:30]}) → {xp["pno"]}')

# DB'deki projeler
con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row
db_projeler = [dict(p) for p in con.execute('SELECT * FROM projeler').fetchall()]
db_proj_map = {p['proje_no']: p for p in db_projeler}
db_ad_map = {}
for p in db_projeler:
    n = normalize_ad(p['musteri_adi']) if p.get('musteri_adi') else ''
    if n: db_ad_map.setdefault(n, p)
print(f'  DB proje: {len(db_proj_map)}')

# Karşılaştır: önce proje_no eşleşmesi, sonra musteri_adi normalize eşleşmesi
def db_proje_eslestir(xp):
    if xp['pno'] and xp['pno'] in db_proj_map: return db_proj_map[xp['pno']]
    if xp['musteri_adi']:
        nm = normalize_ad(xp['musteri_adi'])
        if nm and nm in db_ad_map: return db_ad_map[nm]
    return None

mevcut, yeni = [], []
for xp in xls_projeler:
    m = db_proje_eslestir(xp)
    if m: mevcut.append((xp, m))
    else:
        # Eklenebilmesi için en azından proje_no veya tek bir ad gerekli
        if not xp['pno'] and not xp['musteri_adi']: continue
        yeni.append(xp)

print(f'\n=== KARŞILAŞTIRMA ===')
print(f'  Mevcut (UPDATE):   {len(mevcut)}')
print(f'  Yeni (INSERT):     {len(yeni)}')
print(f'  DB toplam (önce):  {len(db_proj_map)}')
print(f'  DB toplam (sonra): {len(db_proj_map) + len(yeni)}')

if yeni:
    print('\n=== EKLENECEK YENİ PROJELER ===')
    for p in yeni:
        pno = p["pno"] or "(no num)"
        print(f'  {pno:<22} {p["tip"]:<5} {(p["musteri_adi"] or "")[:50]}  (ilerleme: {p["ilerleme_miktari"] or 0:.0f})')

if not APPLY:
    print('\n[DRY-RUN] --apply ile uygulayın.')
    sys.exit(0)

# === APPLY ===
UPDATE_ALANLAR = [
    'musteri_adi','bolge_id','il','ilce','yil','pyp','ihale_no','ihale_adi','yuklenici','tur',
    'basvuru_no','cbs_id','cbs_durum','is_durumu','demontaj_teslim_durumu',
    'sozlesme_kesfi','kesif_tutari','hakedis_miktari','hakedis_yuzdesi',
    'ilerleme_miktari','ilerleme_yuzdesi','proje_onay_durumu','is_grubu',
    'teslim_tarihi','baslama_tarihi','bitis_tarihi','proje_baslangic_tarihi','enerjilenme_tarihi',
    'excel_sira',
]

def proje_data_haz(xp):
    # 'sira' alanı zaten xp içinde var; UPDATE alanına 'excel_sira' adıyla map'le
    d = {**xp, 'bolge_id': BOLGE_SAMSUN_BATI, 'excel_sira': xp.get('sira')}
    return {k: d.get(k) for k in UPDATE_ALANLAR}

print('\n[APPLY] Senkronizasyon başlıyor...')

# Excel'den gelen finansal/durum alanları: Excel boşsa DB'de de NULL olur (truth=Excel)
# Diğer alanlarda ise None gelirse mevcut DB değeri korunur.
EXCEL_TRUTH_ALANLARI = {
    'sozlesme_kesfi', 'kesif_tutari', 'hakedis_miktari', 'hakedis_yuzdesi',
    'ilerleme_miktari', 'ilerleme_yuzdesi',
    'is_durumu', 'cbs_durum', 'demontaj_teslim_durumu', 'proje_onay_durumu',
    'teslim_tarihi', 'baslama_tarihi', 'bitis_tarihi', 'proje_baslangic_tarihi', 'enerjilenme_tarihi',
}

# 1) Mevcut projeleri güncelle
guncellenen = 0
for xp, db_p in mevcut:
    data = proje_data_haz(xp)
    set_clauses = []
    params = []
    for k, v in data.items():
        if v is None and k not in EXCEL_TRUTH_ALANLARI: continue
        # Excel-truth alanlarda None → NULL yaz (Excel kaynağı boşsa DB de boş olsun)
        set_clauses.append(f'{k} = ?')
        params.append(v)
    if not set_clauses: continue
    set_clauses.append("guncelleme_tarihi = datetime('now')")
    params.append(db_p['id'])
    con.execute(f'UPDATE projeler SET {", ".join(set_clauses)} WHERE id = ?', params)
    guncellenen += 1

# 2) Yeni projeleri ekle (proje_no boşsa otomatik oluştur)
INSERT_ALANLAR = ['proje_no', 'proje_tipi', 'is_tipi_id'] + UPDATE_ALANLAR + ['durum', 'oncelik', 'tamamlanma_yuzdesi']

def yeni_proje_no_uret(tip):
    """Otomatik proje no: KET-BEKLEYEN-N veya YB-BEKLEYEN-N formatında"""
    pre = f'{tip}-BEKLEYEN-'
    var = con.execute("SELECT proje_no FROM projeler WHERE proje_no LIKE ? ORDER BY proje_no DESC LIMIT 1", (pre + '%',)).fetchone()
    if var:
        try: nxt = int(re.search(r'(\d+)$', var['proje_no']).group(1)) + 1
        except: nxt = 100
    else:
        nxt = 100
    return f'{pre}{nxt:03d}'

yeni_idler = []
for xp in yeni:
    data = proje_data_haz(xp)
    pno = xp['pno'] or yeni_proje_no_uret(xp['tip'])
    data['proje_no'] = pno
    data['proje_tipi'] = xp['tip']
    data['is_tipi_id'] = xp['is_tipi_id']
    data['durum'] = 'baslama'
    data['oncelik'] = 'normal'
    data['tamamlanma_yuzdesi'] = int((xp.get('ilerleme_yuzdesi') or 0) * 100) if xp.get('ilerleme_yuzdesi') else 0
    cols, placeholders, params = [], [], []
    for k in INSERT_ALANLAR:
        if data.get(k) is not None:
            cols.append(k); placeholders.append('?'); params.append(data[k])
    sql = f'INSERT INTO projeler ({", ".join(cols)}) VALUES ({", ".join(placeholders)})'
    cur = con.execute(sql, params)
    yeni_idler.append((cur.lastrowid, xp['is_tipi_id']))

con.commit()

# 3) Yeni projeler için proje_adimlari oluştur (fazService.projeAdimAta mantığı)
# Python'dan basit replikasyonu — is_tipi'nin fazlarını alıp adımları kopyala
def adimlar_olustur(proje_id, is_tipi_id):
    fazlar = con.execute(
        '''SELECT id, sira, faz_adi, faz_kodu, ikon, renk, sorumlu_rol_id, sorumlu_kullanici_id
           FROM is_tipi_fazlari WHERE is_tipi_id = ? ORDER BY sira''', (is_tipi_id,)
    ).fetchall()
    ins = con.cursor()
    sira_global = 0
    for faz in fazlar:
        adimlar = con.execute(
            '''SELECT id, sira, adim_adi, adim_kodu, tahmini_gun, komponent_tipi
               FROM faz_adimlari WHERE faz_id = ? ORDER BY sira''', (faz['id'],)
        ).fetchall()
        for adim in adimlar:
            sira_global += 1
            ins.execute('''INSERT INTO proje_adimlari (
                proje_id, faz_tanim_id, adim_tanim_id,
                sira_global, faz_sira, adim_sira,
                faz_adi, faz_kodu, adim_adi, adim_kodu,
                renk, ikon, tahmini_gun, durum, sorumlu_rol_id, komponent_tipi
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bekliyor', ?, ?)''',
                (proje_id, faz['id'], adim['id'],
                 sira_global, faz['sira'], adim['sira'],
                 faz['faz_adi'], faz['faz_kodu'], adim['adim_adi'], adim['adim_kodu'],
                 faz['renk'], faz['ikon'], adim['tahmini_gun'],
                 faz['sorumlu_rol_id'], adim['komponent_tipi'] or 'dosya_yukleme'))

for proje_id, is_tipi_id in yeni_idler:
    adimlar_olustur(proje_id, is_tipi_id)

con.commit()
con.close()

print(f'\n[APPLY] Tamamlandı:')
print(f'  Güncellenen proje:    {guncellenen}')
print(f'  Eklenen yeni proje:   {len(yeni)}')
print(f'  Eklenen proje_adimlari: {len(yeni_idler)} proje için faz/adımlar oluşturuldu')
