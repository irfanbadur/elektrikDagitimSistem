"""Çift sayımı engelle: çocuğu fiyatlı olan parent'ları sıfırla"""
import os, sys, sqlite3, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TENANT = 'cakmakgrup'
APPLY = '--apply' in sys.argv
for a in sys.argv[1:]:
    if a.startswith('--tenant='): TENANT = a.split('=')[1]
DB = os.path.join(ROOT, 'data', 'tenants', TENANT, 'elektratrack.db')
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row

def fix(tablo):
    rows = [dict(r) for r in con.execute(f'SELECT id, proje_id, poz_no, malzeme_adi, miktar, birim_fiyat, birim_agirlik FROM {tablo}').fetchall()]
    by_proj = {}
    for r in rows: by_proj.setdefault(r['proje_id'], []).append(r)
    sifirlanan = 0
    for pid, prows in by_proj.items():
        # Her satır için: çocuğu olup olmadığına bak (poz_no prefix bazlı)
        poz_set = {r['poz_no']: r for r in prows if r['poz_no']}
        for r in prows:
            if not r['poz_no']: continue
            if (r['birim_fiyat'] or 0) == 0: continue
            # Bu satırın çocuğu var mı? poz_no'ya '.' eklenmiş başkaları
            cocuklar = [c for c in prows if c['poz_no'] and c['poz_no'].startswith(r['poz_no'] + '.') and (c['birim_fiyat'] or 0) > 0]
            if cocuklar:
                # Parent'ın fiyatı var ve fiyatlı çocukları var → parent'ı sıfırla
                if APPLY:
                    con.execute(f'UPDATE {tablo} SET birim_fiyat = 0 WHERE id = ?', (r['id'],))
                sifirlanan += 1
                if sifirlanan <= 5:
                    print(f'  {tablo}: parent {r["poz_no"]} ({(r["malzeme_adi"] or "")[:30]}) sıfırlandı (fiyatı={r["birim_fiyat"]}, {len(cocuklar)} çocuk)')
    print(f'  {tablo}: {sifirlanan} parent sıfırlandı')
    return sifirlanan

t1 = fix('proje_kesif')
t2 = fix('proje_demontaj')
t3 = fix('proje_dmm')
if APPLY:
    con.commit()
    print(f'\n[APPLY] Toplam {t1+t2+t3} parent sıfırlandı.')
else:
    print(f'\n[DRY-RUN] {t1+t2+t3} parent sıfırlanacak. --apply ekle.')

g = con.execute("SELECT ROUND(SUM(miktar*birim_fiyat)) t FROM proje_kesif").fetchone()
print(f'\nproje_kesif yeni toplam: {g["t"]:,} TL')
p = con.execute("SELECT id FROM projeler WHERE musteri_adi LIKE '%Dereköy%'").fetchone()
if p:
    d = con.execute("SELECT ROUND(SUM(miktar*birim_fiyat),2) t FROM proje_kesif WHERE proje_id = ?", (p['id'],)).fetchone()
    print(f'Dereköy: {d["t"]} TL (Excel R102: 203,008.37)')
con.close()
