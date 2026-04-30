"""
Alt kalemlerin birim_fiyat'ını parent'tan türet:
  alt.birim_fiyat = parent.birim_fiyat × alt.birim_agirlik
Üç tabloya da uygulanır: proje_kesif, proje_demontaj, proje_dmm.
"""
import os, sys, sqlite3, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TENANT = 'cakmakgrup'
APPLY = '--apply' in sys.argv
for a in sys.argv[1:]:
    if a.startswith('--tenant='): TENANT = a.split('=')[1]

DB_PATH = os.path.join(ROOT, 'data', 'tenants', TENANT, 'elektratrack.db')
con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row

def fix_table(tablo):
    print(f'\n=== {tablo} ===')
    # Tüm satırları al
    rows = [dict(r) for r in con.execute(f'SELECT id, proje_id, poz_no, malzeme_adi, miktar, birim_fiyat, birim_agirlik FROM {tablo}').fetchall()]
    # Proje bazında grupla
    proje_rows = {}
    for r in rows:
        proje_rows.setdefault(r['proje_id'], []).append(r)

    toplam_guncellenen = 0
    parent_zero = 0
    parents_with_children = set()
    for pid, prows in proje_rows.items():
        # Önce: hangi parent'ların child'ı var, child'ların birim_agirlik'i var
        # Parent-child eşleştirme: poz prefix
        for sub in prows:
            if (sub['birim_fiyat'] or 0) > 0: continue
            if not sub['birim_agirlik'] or sub['birim_agirlik'] <= 0: continue
            sub_poz = sub['poz_no']
            if not sub_poz or '.' not in sub_poz: continue
            parent_poz = sub_poz.rsplit('.', 1)[0]
            parent = next((p for p in prows if p['poz_no'] == parent_poz and (p['birim_fiyat'] or 0) > 0), None)
            if not parent: continue
            # Sub'a fiyat ata
            yeni_fiyat = round(parent['birim_fiyat'] * sub['birim_agirlik'], 4)
            if APPLY:
                con.execute(f'UPDATE {tablo} SET birim_fiyat = ? WHERE id = ?', (yeni_fiyat, sub['id']))
            toplam_guncellenen += 1
            parents_with_children.add((pid, parent['id']))
        # Parent'ın fiyatını sıfırla — çift saymayı engelle (artık çocuklar topluyor)
        for (pid_, parent_id) in [t for t in parents_with_children if t[0] == pid]:
            if APPLY:
                con.execute(f'UPDATE {tablo} SET birim_fiyat = 0 WHERE id = ?', (parent_id,))
            parent_zero += 1
    print(f'  Toplam {toplam_guncellenen} alt kalem hesaplandı, {parent_zero} parent sıfırlandı')
    return toplam_guncellenen

t1 = fix_table('proje_kesif')
t2 = fix_table('proje_demontaj')
t3 = fix_table('proje_dmm')
if APPLY:
    con.commit()
    print(f'\n[APPLY] Toplam {t1+t2+t3} alt kalemin birim_fiyat\'ı güncellendi.')
else:
    print(f'\n[DRY-RUN] {t1+t2+t3} alt kalem güncellenecek. --apply ile uygula.')

# Yeni toplamlar
gtop = con.execute("SELECT ROUND(SUM(miktar*birim_fiyat)) t FROM proje_kesif").fetchone()['t']
print(f'\nproje_kesif yeni toplam: {gtop:,} TL')
con.close()
