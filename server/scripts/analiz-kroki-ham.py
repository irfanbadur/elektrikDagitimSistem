# -*- coding: utf-8 -*-
"""DXF'lerden tüm layer'ları + OG iletken text'lerini ve özel sembolleri tarar."""
import os, sys, io, re
from pathlib import Path
from collections import Counter
import ezdxf

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

KROKI_DIR = Path("doc/hakediş/KROKİLER")

layer_say = Counter()
og_text = Counter()
ag_text = Counter()
direk_layer_ornek = {}    # layer → set of texts
hat_layer_ornek = {}
ozel_sembol = Counter()    # 4P+R, 3sw, [...], (...) içeren

RX_TERTIP = re.compile(r'\d+\s*(SW|P|R|A|H|RA|PIG|HW|RV)(\s*\+\s*[\dRP/A]+)?', re.I)

for dxf_yol in sorted(KROKI_DIR.glob('*.dxf')):
    try:
        doc = ezdxf.readfile(str(dxf_yol))
        msp = doc.modelspace()
        for e in msp:
            lay = e.dxf.layer
            layer_say[lay] += 1
            if e.dxftype() in ('TEXT', 'MTEXT'):
                t = e.dxf.text if e.dxftype()=='TEXT' else e.text
                t = t.strip()
                if not t: continue
                if lay.startswith('HAT_OG_'):
                    og_text[t[:80]] += 1
                elif lay.startswith('HAT_AG_'):
                    ag_text[t[:80]] += 1
                if lay.startswith('DIREK_'):
                    direk_layer_ornek.setdefault(lay, set()).add(t[:50])
                if lay.startswith('HAT_'):
                    hat_layer_ornek.setdefault(lay, set()).add(t[:80])
                # Özel sembol arama
                if '(' in t or '[' in t or RX_TERTIP.search(t):
                    if any(x in t.upper() for x in ['SW','PANSY','ROSE','ASTER','LILY','IRIS','POPY','PHLOX','OXLIP','PIGEON','HAWK','RAVEN','PARTRIDGE','3A','3P','4P','3SW']):
                        ozel_sembol[t[:80]] += 1
    except Exception as ex:
        print(f"HATA {dxf_yol.name}: {ex}")

print("=== TÜM LAYER'LAR ===")
for l, c in layer_say.most_common(40):
    print(f"  {c:5d}× {l}")

print("\n=== OG HAT TEXT'LERİ (sık) ===")
for t, c in og_text.most_common(30):
    print(f"  {c:4d}× {t}")

print("\n=== AG HAT TEXT'LERİ (sık) ===")
for t, c in ag_text.most_common(30):
    print(f"  {c:4d}× {t}")

print("\n=== DİREK LAYER ÖRNEKLERİ ===")
for lay in sorted(direk_layer_ornek):
    s = sorted(direk_layer_ornek[lay])[:15]
    print(f"  {lay}: {s}")

print("\n=== AÇIK İLETKEN / TERTİP IÇEREN TEXT'LER ===")
for t, c in ozel_sembol.most_common(40):
    print(f"  {c:3d}× {t}")
