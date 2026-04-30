"""
xlsx içindeki sheet1.xml'den belirli hücrelerin formüllerini ve cached değerlerini çıkar.
Stream parsing — büyük dosyada bile bellek aşımı olmaz.
"""
import zipfile, os, sys, io, re
from xml.etree.ElementTree import iterparse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = 'c:/Users/LENOVO/Desktop/elektratrackt/elektrikDagitimSistem'
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def col_to_idx(col_letters):
    """A->0, B->1, AA->26"""
    n = 0
    for c in col_letters:
        n = n * 26 + (ord(c) - ord('A') + 1)
    return n - 1

def parse_cell_ref(ref):
    """A1 → (0, 0), AB10 → (col_idx, 9)"""
    m = re.match(r'([A-Z]+)(\d+)', ref)
    if not m: return None
    return col_to_idx(m.group(1)), int(m.group(2)) - 1

def extract(xlsx_path, target_rows, target_cols):
    """Hedef satır/kolon aralığında hücre formül + cached value yazdır"""
    rows_set = set(target_rows)
    cols_set = set(target_cols)
    print(f'Hedef: rows={target_rows[0]}..{target_rows[-1]}, cols={target_cols[0]}..{target_cols[-1]}')
    with zipfile.ZipFile(xlsx_path, 'r') as z:
        with z.open('xl/worksheets/sheet1.xml') as f:
            sayim = 0
            cur_row = None
            for event, elem in iterparse(f, events=('start', 'end')):
                tag = elem.tag.replace(NS, '')
                if event == 'start' and tag == 'row':
                    r = int(elem.attrib.get('r', 0))
                    cur_row = r - 1  # 0-indexed
                    # Hedef row'da değilsek bile devam, hücrelere bakacağız
                if event == 'end' and tag == 'c':
                    ref = elem.attrib.get('r', '')
                    parsed = parse_cell_ref(ref)
                    if parsed:
                        col, row = parsed
                        if row in rows_set and col in cols_set:
                            t = elem.attrib.get('t', '')
                            f_elem = elem.find(NS + 'f')
                            v_elem = elem.find(NS + 'v')
                            formul = f_elem.text if f_elem is not None else None
                            value = v_elem.text if v_elem is not None else None
                            if formul or value:
                                print(f'  {ref} (R{row} C{col}) t={t}: f={formul} v={value}')
                                sayim += 1
                                if sayim > 50: return
                    elem.clear()
                elif event == 'end' and tag == 'row':
                    elem.clear()
                    # Optimizasyon: hedef row aralığını geçtikse dur
                    if cur_row is not None and cur_row > target_rows[-1]:
                        return

# KET dosyasında TOPLAM satırlarındaki formulleri incele
# R101-R109 arası alt-toplam satırları
print('=== KET TOPLAM satırları (R101-R109) ===')
extract(os.path.join(ROOT, 'doc', 'ilerleme.xlsx'),
        target_rows=list(range(101, 110)),
        target_cols=list(range(0, 30)))
