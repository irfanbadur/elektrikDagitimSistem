"""
Trafolu YB projelerinin (10 adet) ayrı sayfalarındaki per-kalem keşif/ilerleme verisini
proje_kesif / proje_demontaj / proje_dmm tablolarına aktarır.

Sayfa başına TEK proje var; sütun yapısı:
  C0:  FILTRE (MALZEME-MONTAJ / DEMONTAJ / DM+M)
  C1:  poz_birlesik
  C3:  malzeme_kodu
  C5:  malzeme_cinsi
  C6:  ölcü
  C7:  ağırlık
  C22: YER TESLİMİ / UYGULAMA PROJESİ (miktar — RAW)
  C23: İLERLEME

Sheet adıyla proje musteri_adi/proje_no fuzzy eşleşmesi yapılır.

Kullanım:
  python server/scripts/sync-trafolu-yb.py --tenant=cakmakgrup [--apply]
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

print(f'Tenant: {TENANT}\nDB: {DB_PATH}\nExcel: {XLSM}')

# Sütun indexleri (0-bazlı)
COL_POZ = 1
COL_KOD = 3
COL_AD = 5
COL_OLCU = 6
COL_AGR = 7
COL_MALZ_FIYAT = 8     # Malzeme raw birim fiyatı (₺/birim)
COL_MONTAJ_FIYAT = 9   # Montaj raw birim fiyatı
COL_DM_FIYAT = 10      # Demontaj raw birim fiyatı
COL_DMM_FIYAT = 11     # Demontajdan Montaj raw birim fiyatı
COL_MALZ_ART = 13      # Malzeme artırımlı (+10% yuvarlı)
COL_MONTAJ_ART = 14    # Montaj artırımlı
COL_DM_ART = 15        # Demontaj artırımlı
COL_DMM_ART = 16       # Demontajdan Montaj artırımlı
COL_MIKTAR = 22    # YER TESLİMİ / UYGULAMA PROJESİ — YT yapılan miktar (RAW)
COL_ILERLEME = 23  # İLERLEME — yapılan iş miktarı (RAW)
# Not: C20 (İLK PROJE KEŞFİ) ve C21 (İHALE KEŞFİ) sync edilmez — bunlar tahmini/sözleşme
# değerleri, app'te "yapılmış iş" olarak gösterilemez.

def norm(s):
    if not s: return ''
    u = str(s).upper()
    repl = {'İ':'I','I':'I','Ş':'S','Ç':'C','Ü':'U','Ö':'O','Ğ':'G'}
    for k,v in repl.items(): u = u.replace(k, v)
    u = re.sub(r'[^A-Z0-9 ]', ' ', u)
    return re.sub(r'\s+', ' ', u).strip()

def safe_float(v):
    try: return float(v) if v not in (None, '', ' ') else 0.0
    except: return 0.0

# Bölüm tespiti (C0 değer değişimi)
TIP_TABLO = {'mlz_mt': 'proje_kesif', 'dm': 'proje_demontaj', 'dmm': 'proje_dmm'}

def boumler_bul(rows):
    """[(start_row, end_row, tip), ...]"""
    bolumler = []
    cur, cur_start = None, None
    for r in range(3, len(rows)):
        if not rows[r]: continue
        f0 = str(rows[r][0]).strip().upper() if rows[r][0] else ''
        if f0 == 'MALZEME - MONTAJ': new_t = 'mlz_mt'
        elif f0 == 'DEMONTAJ': new_t = 'dm'
        elif f0 in ('DM+M', 'DMM', 'DEMONTAJDAN MONTAJ'): new_t = 'dmm'
        elif f0 == 'TOPLAM':
            if cur: bolumler.append((cur_start, r, cur))
            return bolumler
        else: continue
        if new_t != cur:
            if cur: bolumler.append((cur_start, r, cur))
            cur, cur_start = new_t, r
    if cur: bolumler.append((cur_start, len(rows), cur))
    return bolumler

def proje_adi_oku(rows):
    """R2 C5'te proje adı bulun"""
    if len(rows) > 2 and len(rows[2]) > COL_AD:
        v = rows[2][COL_AD]
        if v: return str(v).strip()
    return None

# Trafolu YB sayfaları (KET-YB PROJE İLERLEME'de "TRAFOLU YB" tipi olanlar)
TRAFOLU_SAYFALAR = [
    '1323667 Kapasite Artışı',
    '1341440 Kapasite Artışı',
    '1353900 Kapasite Artışı',
    '1355172 Kapasite Artışı',
    '1358190 Kapasite Artışı',
    '1360488 Kapasite Artışı',
    '1360857-1361457- 1363141 Kapasi',
    'Fatih Mahallesi Tr-35 Şehir İlv',
    'İshaklı Mahallesi  Camii Yanı Ş',
    'KARLI MAHALLESİ KÖY İLAVE TRAF',
]

print('\nExcel açılıyor...')
wb = CalamineWorkbook.from_path(XLSM)
all_sheets = wb.sheet_names

# DB
con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row
db_projeler = [dict(p) for p in con.execute('SELECT id, proje_no, musteri_adi, proje_tipi FROM projeler').fetchall()]
db_ad_map = {}
for p in db_projeler:
    n = norm(p.get('musteri_adi') or '')
    if n: db_ad_map[n] = p

def db_proje_bul(xls_ad):
    if not xls_ad: return None
    n = norm(xls_ad)
    # Tam eşleşme
    if n in db_ad_map: return db_ad_map[n]
    # İçerme
    for adn, p in db_ad_map.items():
        if n in adn or adn in n:
            return p
    return None

def proje_no_ipucu(sheet_adi):
    """Sayfa adından proje numarasıyla eşleştirme için ipucu çıkar:
    örn 'Fatih Mahallesi Tr-35' → 'FATIH MAHALLESI'
    örn '1323667 Kapasite Artışı' → '1323667'
    """
    n = norm(sheet_adi)
    m = re.match(r'^(\d{6,})', n)
    if m: return m.group(1)
    return n[:30]

def db_proje_ipucu_ile_bul(ipucu):
    if not ipucu: return None
    for adn, p in db_ad_map.items():
        if ipucu in adn or (ipucu.isdigit() and ipucu in (p.get('musteri_adi') or '')):
            return p
    return None

# Katalog fiyatları
katalog = con.execute('''SELECT poz_birlesik, malzeme_kodu, malzeme_birim_fiyat, montaj_birim_fiyat,
    demontaj_birim_fiyat, demontajdan_montaj_fiyat FROM depo_malzeme_katalogu''').fetchall()
fiyat_poz, fiyat_kod = {}, {}
for k in katalog:
    f = (k['malzeme_birim_fiyat'] or 0) + (k['montaj_birim_fiyat'] or 0) + (k['demontaj_birim_fiyat'] or 0) + (k['demontajdan_montaj_fiyat'] or 0)
    if k['poz_birlesik'] and f > 0: fiyat_poz[k['poz_birlesik']] = f
    if k['malzeme_kodu'] and f > 0 and k['malzeme_kodu'] not in fiyat_kod: fiyat_kod[k['malzeme_kodu']] = f

def fiyat_bul(poz, kod):
    if poz in fiyat_poz: return fiyat_poz[poz]
    if kod and kod in fiyat_kod: return fiyat_kod[kod]
    return 0

# Her sayfayı işle
toplam_proje = 0
toplam_satir = {'mlz_mt': 0, 'dm': 0, 'dmm': 0}
print('\n=== EŞLEŞTİRMELER ===')

for sheet_name in TRAFOLU_SAYFALAR:
    if sheet_name not in all_sheets:
        # Tam eşleşme yoksa fuzzy bul
        match = next((s for s in all_sheets if s.startswith(sheet_name[:15])), None)
        if not match:
            print(f'  ✗ Sayfa yok: {sheet_name}')
            continue
        sheet_name = match

    sh = wb.get_sheet_by_name(sheet_name)
    rows = sh.to_python()

    # Proje adını ve eşleşmeyi bul
    pad = proje_adi_oku(rows)
    db_p = db_proje_bul(pad)
    if not db_p:
        # ipucu ile dene
        db_p = db_proje_ipucu_ile_bul(proje_no_ipucu(sheet_name))
    if not db_p:
        print(f'  ✗ Eşleşmedi: sayfa="{sheet_name[:30]}" proje_adi="{pad}"')
        continue

    # Bölümleri çıkar
    bolumler = boumler_bul(rows)

    # Her bölümden veri çek
    bolum_data = {'mlz_mt': [], 'dm': [], 'dmm': []}
    for (s, e, tip) in bolumler:
        for r in range(s, e):
            row = rows[r]
            if not row or len(row) < 25: continue
            poz = row[COL_POZ]
            ad = row[COL_AD]
            if not poz or not ad: continue
            mt = safe_float(row[COL_MIKTAR]) if COL_MIKTAR < len(row) else 0
            il = safe_float(row[COL_ILERLEME]) if COL_ILERLEME < len(row) else 0
            if mt == 0 and il == 0: continue
            # Excel'in kendi birim fiyatları (raw + artırımlı, section'a göre)
            if tip == 'mlz_mt':
                excel_fiyat = safe_float(row[COL_MALZ_FIYAT]) + safe_float(row[COL_MONTAJ_FIYAT])
                excel_fiyat_art = safe_float(row[COL_MALZ_ART]) + safe_float(row[COL_MONTAJ_ART])
            elif tip == 'dm':
                excel_fiyat = safe_float(row[COL_DM_FIYAT])
                excel_fiyat_art = safe_float(row[COL_DM_ART])
            else:
                excel_fiyat = safe_float(row[COL_DMM_FIYAT])
                excel_fiyat_art = safe_float(row[COL_DMM_ART])
            bolum_data[tip].append({
                'poz': str(poz).strip(),
                'kod': str(row[COL_KOD]).strip() if row[COL_KOD] else None,
                'ad': str(ad).strip(),
                'birim': str(row[COL_OLCU]) if row[COL_OLCU] else 'Ad',
                'agirlik': safe_float(row[COL_AGR]) or None,
                'miktar': mt,
                'ilerleme': il,
                'excel_fiyat': excel_fiyat,
                'excel_fiyat_art': excel_fiyat_art,
            })

    print(f'  ✓ {sheet_name[:35]:<37} → {db_p["proje_no"]:<22} {db_p["musteri_adi"][:30]}')
    print(f'      mlz_mt:{len(bolum_data["mlz_mt"]):>3} | dm:{len(bolum_data["dm"]):>3} | dmm:{len(bolum_data["dmm"]):>3}')

    if not APPLY: continue

    # APPLY: 3 tabloyu senkronize et (mevcut + ekle, eksikleri sil)
    pid = db_p['id']
    for tip, items in bolum_data.items():
        tablo = TIP_TABLO[tip]
        xls_pozlar = set(m['poz'] for m in items)
        # Excel'de olmayanları sil (sadece bu sayfanın projesi için)
        db_pozlar = [r['poz_no'] for r in con.execute(f'SELECT poz_no FROM {tablo} WHERE proje_id = ?', (pid,)).fetchall() if r['poz_no']]
        for dp in db_pozlar:
            if dp not in xls_pozlar:
                con.execute(f'DELETE FROM {tablo} WHERE proje_id = ? AND poz_no = ?', (pid, dp))
        for m in items:
            fiyat = m.get('excel_fiyat') or 0
            fiyat_art = m.get('excel_fiyat_art') or 0
            cur = con.execute(f'SELECT id FROM {tablo} WHERE proje_id = ? AND poz_no = ? LIMIT 1', (pid, m['poz'])).fetchone()
            kapsayici = 1 if (m['agirlik'] is None and (m['birim'] or '').strip().lower() == 'kg') else 0
            if cur:
                con.execute(f'''UPDATE {tablo} SET malzeme_adi = ?, malzeme_kodu = COALESCE(?, malzeme_kodu),
                    birim = ?, miktar = ?, ilerleme = ?, birim_agirlik = COALESCE(?, birim_agirlik),
                    birim_fiyat = ?, artirimli_birim_fiyat = ?, kapsayici = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?''',
                    (m['ad'], m['kod'], m['birim'], m['miktar'], m['ilerleme'], m['agirlik'], fiyat, fiyat_art, kapsayici, cur['id']))
            else:
                con.execute(f'''INSERT INTO {tablo} (proje_id, poz_no, malzeme_kodu, malzeme_adi,
                    birim, miktar, ilerleme, birim_agirlik, birim_fiyat, artirimli_birim_fiyat, kapsayici, durum)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planli')''',
                    (pid, m['poz'], m['kod'], m['ad'], m['birim'], m['miktar'], m['ilerleme'], m['agirlik'], fiyat, fiyat_art, kapsayici))
            toplam_satir[tip] += 1
    toplam_proje += 1

if APPLY:
    con.commit()
    print(f'\n[APPLY] Tamamlandı:')
    print(f'  İşlenen proje: {toplam_proje}')
    print(f'  Yazılan satır: mlz_mt={toplam_satir["mlz_mt"]} | dm={toplam_satir["dm"]} | dmm={toplam_satir["dmm"]}')
else:
    print('\n[DRY-RUN] --apply ile uygulayın.')

con.close()
