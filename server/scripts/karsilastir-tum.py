"""Tüm projeler için Excel raw değerleri vs DB naive sum karşılaştırması.
Her proje için Samsun Batı KET/YB1 sayfasından raw mlz_mt YT toplamını çekip
DB'deki naive sum (proje_kesif + dm + dmm) ile karşılaştır."""
import os, sys, sqlite3, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from python_calamine import CalamineWorkbook

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATH = os.path.join(ROOT, 'doc', 'Yatırım Takip_2026 BATI  KETYB 30.04.2026.xlsm')
DB = os.path.join(ROOT, 'data', 'tenants', 'cakmakgrup', 'elektratrack.db')

def safe_float(v):
    try: return float(v) if v not in (None, '', ' ') else 0.0
    except: return 0.0

def normalize(s):
    if not s: return ''
    import re
    u = str(s).upper()
    repl = {'İ':'I','I':'I','Ş':'S','Ç':'C','Ü':'U','Ö':'O','Ğ':'G'}
    for k,v in repl.items(): u = u.replace(k, v)
    u = re.sub(r'[^A-Z0-9 ]', ' ', u)
    return re.sub(r'\s+', ' ', u).strip()

wb = CalamineWorkbook.from_path(PATH)
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row

# DB ad haritası
db_ad_map = {}
for r in con.execute('SELECT id, proje_no, musteri_adi FROM projeler').fetchall():
    nm = normalize(r['musteri_adi'])
    if nm: db_ad_map.setdefault(nm, dict(r))

def db_proje_adla(ad):
    nm = normalize(ad)
    if nm in db_ad_map: return db_ad_map[nm]
    for adn, p in db_ad_map.items():
        if nm in adn or adn in nm: return p
    return None

def db_naive_sum(pid):
    r = con.execute("""SELECT
        COALESCE((SELECT SUM(miktar * birim_fiyat) FROM proje_kesif WHERE proje_id = ?), 0) as mlz,
        COALESCE((SELECT SUM(miktar * birim_fiyat) FROM proje_demontaj WHERE proje_id = ?), 0) as dm,
        COALESCE((SELECT SUM(miktar * birim_fiyat) FROM proje_dmm WHERE proje_id = ?), 0) as dmm,
        COALESCE((SELECT SUM(ilerleme * birim_fiyat) FROM proje_kesif WHERE proje_id = ?), 0) as ilerm
    """, (pid, pid, pid, pid)).fetchone()
    return dict(r)

# Her sayfayı tara: proje sütunlarını bul ve TOPLAM raw değerleri çıkar
def analiz(sheet_name):
    sh = wb.get_sheet_by_name(sheet_name)
    rows = sh.to_python()

    # Alt-toplam satırları (TOPLAM-3, TOPLAM-2, TOPLAM-1, TOPLAM)
    toplam_idx = None
    for i in range(100, len(rows)):
        if rows[i] and len(rows[i]) > 5 and rows[i][5] and str(rows[i][5]).strip().upper() == 'TOPLAM':
            toplam_idx = i
            break
    if not toplam_idx: return []
    mlz_idx = toplam_idx - 3
    dm_idx = toplam_idx - 2
    dmm_idx = toplam_idx - 1

    # Proje sütunlarını bul (R0'da proje adı, R2'de "PYP AKTARIM HARCAMA")
    sonuc = []
    for c in range(29, len(rows[0])):
        v0 = rows[0][c]
        if not v0: continue
        s0 = str(v0).strip()
        if len(s0) < 5: continue
        # Filtre: bu bir proje adı mı?
        import re
        if re.match(r'^(KE[ŞS]|MALZEME|F[İI]LTRE|[İI]HALE|KIRILIM|YEDA[ŞS]|ARTIRIM|TENZIL|MALZ|DOK|YAYIN|REVIZYON|TOPLAM|MNTJ|HARCAMA|KONTROL)', s0, re.I):
            continue
        # YT col = c - 3 (PYP AKTARIM HARCAMA = c, base = c - 4, YT = base + 1 = c - 3)
        yt_col = c - 3
        ic_col = c - 2
        if yt_col < 0: continue
        # Bu proje için R(mlz_idx) C(yt_col) değeri
        mlz_yt = safe_float(rows[mlz_idx][yt_col]) if yt_col < len(rows[mlz_idx]) else 0
        dm_yt = safe_float(rows[dm_idx][yt_col]) if yt_col < len(rows[dm_idx]) else 0
        dmm_yt = safe_float(rows[dmm_idx][yt_col]) if yt_col < len(rows[dmm_idx]) else 0
        mlz_iler = safe_float(rows[mlz_idx][ic_col]) if ic_col < len(rows[mlz_idx]) else 0
        if mlz_yt == 0 and dm_yt == 0 and dmm_yt == 0: continue
        sonuc.append({'ad': s0, 'mlz_yt': mlz_yt, 'dm_yt': dm_yt, 'dmm_yt': dmm_yt, 'mlz_iler': mlz_iler})
    return sonuc

print('Analiz: Samsun Batı Ket')
ket = analiz('Samsun Batı Ket')
print('Analiz: Samsun Batı YB1')
yb = analiz('Samsun Batı YB1')

# Trafolu sheets
TRAFOLU = ['Fatih Mahallesi Tr-35 Şehir İlv', 'İshaklı Mahallesi  Camii Yanı Ş', 'KARLI MAHALLESİ KÖY İLAVE TRAF',
           '1323667 Kapasite Artışı', '1341440 Kapasite Artışı', '1353900 Kapasite Artışı',
           '1355172 Kapasite Artışı', '1358190 Kapasite Artışı', '1360488 Kapasite Artışı',
           '1360857-1361457- 1363141 Kapasi']

def trafolu_analiz(sheet_name):
    sh = wb.get_sheet_by_name(sheet_name)
    rows = sh.to_python()
    # Single project — proje adı R2 C5'te
    pad = str(rows[2][5]).strip() if len(rows) > 2 and rows[2][5] else ''
    # Alt-toplam: R5266 (Python 5265) TOPLAM
    mlz_yt = safe_float(rows[5262][22]) if len(rows) > 5262 else 0
    dm_yt = safe_float(rows[5263][22]) if len(rows) > 5263 else 0
    dmm_yt = safe_float(rows[5264][22]) if len(rows) > 5264 else 0
    mlz_iler = safe_float(rows[5262][23]) if len(rows) > 5262 else 0
    return {'ad': pad, 'mlz_yt': mlz_yt, 'dm_yt': dm_yt, 'dmm_yt': dmm_yt, 'mlz_iler': mlz_iler}

trafolu = [trafolu_analiz(s) for s in TRAFOLU]

# Birleştir, eşleştir, karşılaştır
print(f'\nKET: {len(ket)} | YB: {len(yb)} | Trafolu: {len(trafolu)}')
print('\n' + '='*120)
print(f'{"Proje":<35} {"DB raw":>12} {"Excel raw":>12} {"Fark":>10} {"%":>5}')
print('='*120)

def tutar_kontrol(ad, mlz_yt, dm_yt, dmm_yt, mlz_iler):
    p = db_proje_adla(ad)
    if not p: return None
    db = db_naive_sum(p['id'])
    db_total = db['mlz'] + db['dm'] + db['dmm']
    excel_total = mlz_yt + dm_yt + dmm_yt
    fark = excel_total - db_total
    pct = (fark / excel_total * 100) if excel_total else 0
    return {'ad': ad[:35], 'db': db_total, 'excel': excel_total, 'fark': fark, 'pct': pct,
            'db_iler': db['ilerm'], 'excel_iler': mlz_iler}

sonuclar = []
for tip, liste in [('KET', ket), ('YB', yb), ('TRAFOLU', trafolu)]:
    for x in liste:
        r = tutar_kontrol(x['ad'], x.get('mlz_yt', 0), x.get('dm_yt', 0), x.get('dmm_yt', 0), x.get('mlz_iler', 0))
        if r: sonuclar.append((tip, r))

# Hata büyüklüğüne göre sırala
sonuclar.sort(key=lambda x: -abs(x[1]['fark']))

# Yuvarlamadan büyük (>10₺) farkı olanlar
buyuk = [(t,r) for t,r in sonuclar if abs(r['fark']) > 10]
yuvarlama = [(t,r) for t,r in sonuclar if abs(r['fark']) <= 10]

print(f'\n=== ÖNEMLİ FARK (>10 ₺): {len(buyuk)} proje ===')
for tip, r in buyuk[:40]:
    print(f'{tip:<8} {r["ad"]:<35} {r["db"]:>12,.0f} {r["excel"]:>12,.0f} {r["fark"]:>10,.0f} {r["pct"]:>5.1f}%')

print(f'\n=== Yuvarlama (<10₺) detay - ilk 30 ===')
for tip, r in yuvarlama[:30]:
    print(f'{tip:<8} {r["ad"]:<35} {r["db"]:>14,.4f} {r["excel"]:>14,.4f} {r["fark"]:>10,.4f}')

print(f'\nToplam fark (yuvarlama): {sum(r["fark"] for _,r in yuvarlama):.4f} ₺')
print(f'Toplam fark (>10₺): {sum(r["fark"] for _,r in buyuk):,.2f} ₺')
