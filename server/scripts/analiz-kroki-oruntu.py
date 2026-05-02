# -*- coding: utf-8 -*-
"""
Direk donanım CSV'sini örüntüleri çıkartmak için analiz eder.
- İletken tipine göre konsol seçimi
- Potans direklerinde (P) ne donanım kullanılıyor
- N95 / MAKARA hangi durumlarda çıkıyor
- Topraklama (KORUMA / İŞLETME) örüntüsü
"""
import csv, io, sys, re
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

CSV_YOL = 'doc/hakediş/kroki-analizi/direk-donanim.csv'

with open(CSV_YOL, encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

# Sadece ekipman bilgisi olan direkler
ekipli = [r for r in rows if r['ham_ekipman']]

# === Yardımcı normalize fonksiyonları ===
def il_norm(t):
    """3x70/16+95_AER → '3x70/16+95 AER' formatı"""
    if not t: return ''
    s = t.strip().strip('[]').replace('_', ' ')
    s = re.sub(r'\s+', ' ', s)
    return s.upper()

def il_kesit_kategori(t):
    """İletken tipi sınıflandırması:
    - AER (askılı toplu) — kesite göre
    - Al / Cu — çıplak iletken
    - Diğer (havai açık)"""
    s = il_norm(t)
    if not s: return 'BİLİNMİYOR'
    if 'AER' in s or 'XLPE' in s:
        m = re.search(r'(\d+)\s*X\s*(\d+)/(\d+)(\+(\d+))?', s)
        if m: return f"AER-{m.group(2)}/{m.group(3)}+{m.group(5) or '?'}"
        return f"AER-{s}"
    if '-AL' in s or 'ÇIPLAK' in s:
        m = re.search(r'(\d+)\s*X\s*(\d+)/(\d+)?', s)
        if m: return f"AL-{m.group(2)}/{m.group(3) or '?'}"
        return f"AL-{s}"
    if any(k in s for k in ['SWALLOW','PANSY','ROSE','HORNET','PIGEON']):
        return f"NAMLI-{s}"
    return f"DİĞER-{s}"

def potans_mi(direk_tip):
    if not direk_tip: return False
    return '(P)' in direk_tip.upper() or direk_tip.upper().endswith('P') or 'POTANS' in direk_tip.upper()

# === İletken kategorisine göre konsol dağılımı ===
print("="*78)
print("1) İLETKEN KATEGORİSİNE GÖRE KONSOL SEÇİMİ")
print("="*78)
iletken_konsol = defaultdict(Counter)
for r in ekipli:
    if not r['iletken']: continue
    kat = il_kesit_kategori(r['iletken'])
    konsol = r['konsol'] or '(yok)'
    iletken_konsol[kat][konsol] += 1

for kat in sorted(iletken_konsol):
    toplam = sum(iletken_konsol[kat].values())
    print(f"\n  {kat}  (toplam {toplam} direk)")
    for k, c in iletken_konsol[kat].most_common():
        print(f"     {c:3d}× {k}")

# === Potans direkleri vs normal direkler ===
print("\n" + "="*78)
print("2) POTANS DİREĞİ (P) VS NORMAL DİREK — KONSOL/D-KONSOL/TAG5 KARŞILAŞTIRMASI")
print("="*78)
potans_konsol = Counter()
potans_d = Counter()
potans_n95 = Counter()
potans_mak = Counter()
potans_tag = Counter()
normal_konsol = Counter()
normal_d = Counter()
normal_n95 = Counter()
normal_mak = Counter()
normal_tag = Counter()
for r in ekipli:
    pot = potans_mi(r['direk_tip'])
    grp_konsol = potans_konsol if pot else normal_konsol
    grp_d = potans_d if pot else normal_d
    grp_n95 = potans_n95 if pot else normal_n95
    grp_mak = potans_mak if pot else normal_mak
    grp_tag = potans_tag if pot else normal_tag
    grp_konsol[r['konsol'] or '(yok)'] += 1
    grp_d[r['d_konsol'] or '(yok)'] += 1
    grp_n95[int(r['n95_adet'])] += 1
    grp_mak[int(r['makara_adet'])] += 1
    grp_tag[int(r['tag5'])] += 1

print(f"\nPOTANS direkleri: {sum(potans_konsol.values())}")
print(f"  Konsol top: {potans_konsol.most_common(5)}")
print(f"  D-konsol top: {potans_d.most_common(5)}")
print(f"  N95 dağılım: {dict(potans_n95)}")
print(f"  MAKARA dağılım: {dict(potans_mak)}")
print(f"  TAG-5 dağılım: {dict(potans_tag)}")
print(f"\nNORMAL direkleri: {sum(normal_konsol.values())}")
print(f"  Konsol top: {normal_konsol.most_common(5)}")
print(f"  D-konsol top: {normal_d.most_common(5)}")
print(f"  N95 dağılım: {dict(normal_n95)}")
print(f"  MAKARA dağılım: {dict(normal_mak)}")
print(f"  TAG-5 dağılım: {dict(normal_tag)}")

# === N95 ve MAKARA — hangi iletkenlerde çıkıyor? ===
print("\n" + "="*78)
print("3) N95 VE MAKARA — İLETKEN KATEGORİSİNE GÖRE KULLANIM")
print("="*78)
n95_kat = defaultdict(int); n95_var_kat = defaultdict(int)
mak_kat = defaultdict(int); mak_var_kat = defaultdict(int)
for r in ekipli:
    if not r['iletken']: continue
    kat = il_kesit_kategori(r['iletken'])
    n95 = int(r['n95_adet'])
    mak = int(r['makara_adet'])
    n95_kat[kat] += 1
    mak_kat[kat] += 1
    if n95 > 0: n95_var_kat[kat] += 1
    if mak > 0: mak_var_kat[kat] += 1

print(f"\n{'Kategori':40s} {'Toplam':>8} {'N95 var':>10} {'%':>6} {'MAK var':>10} {'%':>6}")
for kat in sorted(n95_kat):
    t = n95_kat[kat]; n = n95_var_kat[kat]; m = mak_var_kat[kat]
    print(f"{kat:40s} {t:>8d} {n:>10d} {(n/t*100):>5.0f}% {m:>10d} {(m/t*100):>5.0f}%")

# === Tüm topraklama örüntüsü ===
print("\n" + "="*78)
print("4) TOPRAKLAMA ÖRÜNTÜSÜ (KORUMA / İŞLETME)")
print("="*78)
durum_grup = defaultdict(lambda: {'total':0, 'kor':0, 'isl':0})
for r in ekipli:
    d = r['durum'] or 'BİLİNMİYOR'
    durum_grup[d]['total'] += 1
    if int(r['koruma']): durum_grup[d]['kor'] += 1
    if int(r['isletme']): durum_grup[d]['isl'] += 1
print(f"\n{'Durum':12s} {'Toplam':>8} {'KORUMA':>8} {'İŞLETME':>9}")
for d, v in durum_grup.items():
    print(f"{d:12s} {v['total']:>8d} {v['kor']:>8d} {v['isl']:>9d}")

# === Direk tipi karakteri ile konsol/donanım örüntüsü ===
print("\n" + "="*78)
print("5) DİREK TİP HARFLERİ VS DONANIM (örn. E=Eğilmemiş, T=Tepe direği, q/R/...)")
print("="*78)
def tip_harf(tip):
    if not tip: return ''
    ust = tip.strip().upper()
    # ilk harf, eğer (P) ise belirt
    if '(P)' in ust: return ust.split()[0] + '(P)'
    return ust.split()[0] if ust else ''

tip_konsol = defaultdict(Counter)
tip_n95 = defaultdict(int); tip_mak = defaultdict(int); tip_tag = defaultdict(int); tip_count = defaultdict(int)
for r in ekipli:
    h = tip_harf(r['direk_tip'])
    if not h: continue
    tip_count[h] += 1
    tip_konsol[h][r['konsol'] or '(yok)'] += 1
    tip_n95[h] += int(r['n95_adet'] or 0)
    tip_mak[h] += int(r['makara_adet'] or 0)
    tip_tag[h] += int(r['tag5'] or 0)

print(f"\n{'Tip':10s} {'Adet':>5} {'En yaygın konsol':40s} {'N95(top)':>8} {'MAK(top)':>8} {'TAG5':>5}")
for h in sorted(tip_count, key=lambda x: -tip_count[x]):
    en_konsol = tip_konsol[h].most_common(1)[0][0] if tip_konsol[h] else ''
    print(f"{h:10s} {tip_count[h]:>5d} {en_konsol[:38]:40s} {tip_n95[h]:>8d} {tip_mak[h]:>8d} {tip_tag[h]:>5d}")

# === Ham eşitlik analizi: aynı iletken+konsol kombinasyonu kaç kez görüldü ===
print("\n" + "="*78)
print("6) (İLETKEN + KONSOL) ÇİFTİ — DAĞILIM (sık → seyrek)")
print("="*78)
ic_kombo = Counter()
for r in ekipli:
    if not r['iletken']: continue
    ic_kombo[(il_kesit_kategori(r['iletken']), r['konsol'] or '(yok)')] += 1

for (il, k), c in ic_kombo.most_common(40):
    print(f"  {c:3d}× {il:30s} → {k}")
