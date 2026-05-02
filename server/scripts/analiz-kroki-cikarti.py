# -*- coding: utf-8 -*-
"""
Hak Ediş Krokilerinden (DXF) direk-bazlı donanım veri seti çıkartıcı.

Çıktı: doc/hakediş/kroki-analizi/direk-donanim.csv
       her satır: proje, direk_no, direk_tip_kodu, ag_og, mevcut_yeni,
                  iletken, konsol, n95_adet, makara_adet, tag5, koruma, isletme,
                  ham_ekipman_metni, x, y
"""
import os, re, csv, sys, math, json, io
from pathlib import Path
from collections import defaultdict, Counter
import ezdxf

# Windows konsol UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

KROKI_DIR = Path("doc/hakediş/KROKİLER")
CIKARTI_DIR = Path("doc/hakediş/kroki-analizi")
CIKARTI_DIR.mkdir(parents=True, exist_ok=True)

# Direk kodu desenleri (text'e bakarak)
RX_DIREK_NO = re.compile(r'^[A-Z]\d{1,3}$|^[A-Z]\d{1,3}[A-Z]?$')  # A14, A12, E4, B7
RX_DIREK_TIP = re.compile(r'^[A-ZÇĞİÖŞÜ]+-?\d+[A-ZIıİ]?$|^\d+[A-Z]+$')  # G-12I, 12I, 9I
RX_KUVVET = re.compile(r'^\d+\s*/\s*\d+$|^\d+$')  # 11/5
RX_ILETKEN = re.compile(r'(\[?\s*\d+\s*x\s*\d+/\d+(\s*\+\s*\d+)?\s*[_\-]?\s*(AER|XLPE|XHE|YE3X|AL|CU)?\]?)', re.I)
RX_KESIT_PANSY = re.compile(r'\b(SWALLOW|PANSY|ROSE|HORNET|LINNET|ORIOLE|RAVEN|PIGEON|PARTRIDGE)\b', re.I)

# Ekipman desenleri (MTEXT içinde) — AD, ADET, ADT hepsi geçerli
RX_KONSOL = re.compile(r'(\d+)\s*AD\w*\.?\s+(\d+[,\.]?\d*\s*U\s*[-\s]*\s*\d+)', re.I)
RX_DKONSOL = re.compile(r'(\d+)\s*AD\w*\.?\s+(D\s*[-\s]*\s*\d+)', re.I)  # 1 AD D-250
RX_T250 = re.compile(r'(\d+)\s*AD\w*\.?\s+T\s*[-\s]*\s*250', re.I)
RX_N95 = re.compile(r'(\d+)\s*AD\w*\.?\s+N\s*[-\s]*\s*95', re.I)
RX_MAKARA = re.compile(r'(\d+)\s*AD\w*\.?\s+MAKARA', re.I)
# AG traversler — montaj yer alma noktasında
RX_AG_TRV_D = re.compile(r'\bD\s*[-\s]*AG\s*[-\s]*(\d+)', re.I)        # D-AG-3
RX_AG_TRV_T = re.compile(r'\bT\s*[-\s]*AG\s*[-\s]*(\d+)', re.I)        # T-AG-5
RX_MT = re.compile(r'\bMT\s*[-\s]*(\d+)\b', re.I)                      # MT-2
RX_MD = re.compile(r'\bMD\s*[-\s]*(\d+)\b', re.I)                      # MD-2
RX_ALPEK_MONTAJ = re.compile(r'(ALPEK\s*MEVCUT\s*DİREĞE\s*MONTAJ)', re.I)
RX_TAG5 = re.compile(r'\bTAG[-\s]?5\b', re.I)
RX_KORUMA = re.compile(r'\bKORUMA\b', re.I)
RX_ISLETME = re.compile(r'\bİŞLETME\b|\bISLETME\b', re.I)

def mesafe(a, b):
    return math.hypot(a[0]-b[0], a[1]-b[1])

def dxf_topla(yol):
    doc = ezdxf.readfile(str(yol))
    msp = doc.modelspace()
    direk_text = []   # (layer, text, (x,y))
    iletken_text = []
    ekip_text = []    # MTEXT lines
    for e in msp:
        lay = e.dxf.layer
        if e.dxftype() == 'TEXT':
            t = e.dxf.text.strip()
            if not t: continue
            pos = (e.dxf.insert.x, e.dxf.insert.y)
            if lay.startswith('DIREK_'):
                direk_text.append((lay, t, pos))
            elif lay.startswith('HAT_'):
                iletken_text.append((lay, t, pos))
            else:
                # Bazı projelerde direk numarası `0` layerinde de olabilir; sonra düşeriz
                pass
        elif e.dxftype() == 'MTEXT':
            t = e.text
            if not t.strip(): continue
            pos = (e.dxf.insert.x, e.dxf.insert.y)
            if lay.startswith('DIREK_'):
                direk_text.append((lay, t, pos))
            elif lay.startswith('HAT_'):
                iletken_text.append((lay, t, pos))
            else:
                ekip_text.append((lay, t, pos))
    return direk_text, iletken_text, ekip_text

def direk_grupla(direk_text, esik=8.0):
    """Birbirine yakın direk text'lerini tek bir direğe topla."""
    # Önce direk numarası olan (RX_DIREK_NO) text'leri merkez al
    merkezler = []  # [(pos, layer, no_text)]
    for lay, t, pos in direk_text:
        clean = t.strip()
        if RX_DIREK_NO.match(clean):
            merkezler.append({
                'pos': pos, 'layer': lay, 'no': clean,
                'tip': None, 'kuvvet': None
            })
    # Ek text'leri en yakın merkeze ata
    for lay, t, pos in direk_text:
        clean = t.strip()
        if RX_DIREK_NO.match(clean):
            continue
        # En yakın merkez
        if not merkezler: continue
        en_yakin = min(merkezler, key=lambda m: mesafe(m['pos'], pos))
        if mesafe(en_yakin['pos'], pos) > esik:
            continue
        if RX_KUVVET.match(clean):
            en_yakin['kuvvet'] = clean
        else:
            # tip kodu (G-12I, P, A, vb.) — eğer henüz yoksa veya daha uzun ise yaz
            if not en_yakin['tip'] or len(clean) > len(en_yakin['tip']):
                en_yakin['tip'] = clean
    return merkezler

def en_yakin_iletken(pos, iletken_text, max_d=80.0):
    """Sadece RX_ILETKEN deseniyle eşleşen text'leri kullan (mesafe yazılarını ele)."""
    if not iletken_text: return None
    best = None; bd = max_d
    for lay, t, p in iletken_text:
        clean = t.strip().strip('[]')
        if not RX_ILETKEN.search(clean):
            continue
        d = mesafe(pos, p)
        if d < bd:
            bd = d; best = (lay, clean)
    return best

def en_yakin_ekipman(pos, ekip_text, max_d=20.0):
    if not ekip_text: return None
    best = None; bd = max_d
    for lay, t, p in ekip_text:
        d = mesafe(pos, p)
        if d < bd:
            bd = d; best = t
    return best

def parse_ekipman(metin):
    """MTEXT içindeki \P ile ayrılmış ekipman satırlarından yapılandırılmış data."""
    if not metin: return {}
    # ezdxf bazı sürümlerde \P'yi \n olarak vermez; manuel split
    norm = metin.replace('\\P', '\n').replace('\\p', '\n')
    out = {
        'konsol_list': [],   # [(adet, tip)]
        'd_konsol_list': [],
        't250_adet': 0,
        'n95_adet': 0,
        'makara_adet': 0,
        'tag5': False,
        'koruma': False,
        'isletme': False,
        'ag_traversler': [],   # ['D-AG-3', 'T-AG-5']
        'mt_md': [],           # ['MT-2', 'MD-2']
        'alpek_montaj': False,
        'ham': norm.strip()
    }
    for m in RX_KONSOL.finditer(norm):
        out['konsol_list'].append((int(m.group(1)), m.group(2).upper().replace(' ', '').replace(',', '.')))
    for m in RX_DKONSOL.finditer(norm):
        out['d_konsol_list'].append((int(m.group(1)), m.group(2).upper().replace(' ', '')))
    for m in RX_T250.finditer(norm):
        out['t250_adet'] += int(m.group(1))
    m = RX_N95.search(norm)
    if m: out['n95_adet'] = int(m.group(1))
    m = RX_MAKARA.search(norm)
    if m: out['makara_adet'] = int(m.group(1))
    if RX_TAG5.search(norm): out['tag5'] = True
    if RX_KORUMA.search(norm): out['koruma'] = True
    if RX_ISLETME.search(norm): out['isletme'] = True
    for m in RX_AG_TRV_D.finditer(norm):
        out['ag_traversler'].append(f"D-AG-{m.group(1)}")
    for m in RX_AG_TRV_T.finditer(norm):
        out['ag_traversler'].append(f"T-AG-{m.group(1)}")
    for m in RX_MT.finditer(norm):
        out['mt_md'].append(f"MT-{m.group(1)}")
    for m in RX_MD.finditer(norm):
        out['mt_md'].append(f"MD-{m.group(1)}")
    if RX_ALPEK_MONTAJ.search(norm):
        out['alpek_montaj'] = True
    return out

def layer_yorumla(lay):
    """DIREK_AG_MEVCUT → ('AG','MEVCUT'); HAT_AG_HAVAI_YENI → ('AG','HAVAI','YENI')"""
    parca = lay.split('_')
    return parca

def proje_isle(dxf_yol, kayitlar):
    proje = dxf_yol.stem
    direk_text, iletken_text, ekip_text = dxf_topla(dxf_yol)
    direkler = direk_grupla(direk_text)

    for d in direkler:
        lay_p = layer_yorumla(d['layer'])
        ag_og = lay_p[1] if len(lay_p) > 1 else ''       # AG / OG
        durum = lay_p[2] if len(lay_p) > 2 else ''        # MEVCUT / YENI

        iletken = en_yakin_iletken(d['pos'], iletken_text)
        iletken_str = iletken[1] if iletken else ''
        iletken_lay = iletken[0] if iletken else ''

        ekip_metin = en_yakin_ekipman(d['pos'], ekip_text)
        ek = parse_ekipman(ekip_metin)

        # Konsol özeti string
        konsol_str = ' + '.join(f"{a} {t}" for a, t in ek.get('konsol_list', []))
        d_konsol_str = ' + '.join(f"{a} {t}" for a, t in ek.get('d_konsol_list', []))
        ag_trv_str = ', '.join(ek.get('ag_traversler', []))
        mt_md_str = ', '.join(ek.get('mt_md', []))

        kayitlar.append({
            'proje': proje,
            'direk_no': d['no'],
            'direk_tip': d.get('tip', '') or '',
            'kuvvet': d.get('kuvvet', '') or '',
            'ag_og': ag_og,
            'durum': durum,
            'iletken': iletken_str,
            'iletken_layer': iletken_lay,
            'konsol': konsol_str,
            'd_konsol': d_konsol_str,
            'ag_travers': ag_trv_str,    # D-AG-3, T-AG-5
            'mt_md': mt_md_str,           # MT-2, MD-2
            't250_adet': ek.get('t250_adet', 0),
            'n95_adet': ek.get('n95_adet', 0),
            'makara_adet': ek.get('makara_adet', 0),
            'tag5': 1 if ek.get('tag5') else 0,
            'koruma': 1 if ek.get('koruma') else 0,
            'isletme': 1 if ek.get('isletme') else 0,
            'alpek_montaj': 1 if ek.get('alpek_montaj') else 0,
            'ham_ekipman': (ek.get('ham') or '').replace('\n', ' | '),
            'x': round(d['pos'][0], 2),
            'y': round(d['pos'][1], 2),
        })

def main():
    kayitlar = []
    dxf_dosyalar = sorted(KROKI_DIR.glob('*.dxf'))
    print(f"Bulunan DXF: {len(dxf_dosyalar)}")
    for dxf in dxf_dosyalar:
        try:
            print(f"  → {dxf.name}")
            proje_isle(dxf, kayitlar)
        except Exception as e:
            print(f"  ✗ HATA {dxf.name}: {e}")

    csv_yol = CIKARTI_DIR / 'direk-donanim.csv'
    sutunlar = ['proje','direk_no','direk_tip','kuvvet','ag_og','durum',
                'iletken','iletken_layer','konsol','d_konsol','ag_travers','mt_md',
                't250_adet','n95_adet','makara_adet','tag5','koruma','isletme',
                'alpek_montaj','ham_ekipman','x','y']
    with open(csv_yol, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=sutunlar)
        w.writeheader()
        w.writerows(kayitlar)
    print(f"\n✓ {len(kayitlar)} direk kaydı yazıldı → {csv_yol}")

if __name__ == '__main__':
    main()
