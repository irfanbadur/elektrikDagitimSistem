"""
Hak Ediş Krokileri (DXF) keşif aracı — bir dosyayı detaylı inceler.
TEXT, MTEXT, INSERT (block reference) entitelerini sayar ve örnek listeler.
"""
import sys, ezdxf
from collections import Counter

if len(sys.argv) < 2:
    print("Kullanım: python analiz-kroki-kesif.py <dxf-dosya>")
    sys.exit(1)

dxf_yol = sys.argv[1]
doc = ezdxf.readfile(dxf_yol)
msp = doc.modelspace()

ent_sayim = Counter()
text_ornek = []
block_sayim = Counter()
layer_sayim = Counter()
linetype_sayim = Counter()

for e in msp:
    ent_sayim[e.dxftype()] += 1
    layer_sayim[e.dxf.layer] += 1
    if hasattr(e.dxf, 'linetype'):
        linetype_sayim[e.dxf.linetype] += 1
    if e.dxftype() == 'TEXT':
        text_ornek.append(('TEXT', e.dxf.text, (e.dxf.insert.x, e.dxf.insert.y), e.dxf.layer))
    elif e.dxftype() == 'MTEXT':
        text_ornek.append(('MTEXT', e.text, (e.dxf.insert.x, e.dxf.insert.y), e.dxf.layer))
    elif e.dxftype() == 'INSERT':
        block_sayim[e.dxf.name] += 1

print(f"\n=== {dxf_yol} ===")
print(f"\nEntity türleri:")
for t, c in ent_sayim.most_common():
    print(f"  {t}: {c}")

print(f"\nLayer'lar (en yaygın 20):")
for l, c in layer_sayim.most_common(20):
    print(f"  {l}: {c}")

print(f"\nLinetype'lar:")
for l, c in linetype_sayim.most_common(15):
    print(f"  {l}: {c}")

print(f"\nBlock referansları (en yaygın 30):")
for b, c in block_sayim.most_common(30):
    print(f"  {b}: {c}")

print(f"\nİlk 60 TEXT/MTEXT örneği:")
for tip, t, pos, lay in text_ornek[:60]:
    txt = t.replace('\n', ' | ')[:120]
    print(f"  [{lay:25s}] ({pos[0]:.0f},{pos[1]:.0f}) {tip}: {txt}")
