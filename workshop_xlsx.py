"""Portable XLSX export for the local application (Python standard library only).

The supplied matrix determines the minimum 16-operation x 10-person layout. We
write a clean OOXML package rather than resaving its WPS-specific cell images,
so no sample names, pictures, formulas or unrelated data can leak into exports.
"""
from __future__ import annotations

import io
import math
import re
import struct
import unicodedata
import zipfile
import zlib
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
from rating_rules import rating_rules
from work_item_i18n import work_item_bilingual_name, work_item_name_id
from direct_assessments import assessment_mode, skill_category, item_metadata
from business_time import business_time

S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
D = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
XML = 'http://www.w3.org/XML/1998/namespace'
WIDTHS = [17.9326923, 21.2019231, 7.2692308, 44.625] + [11.6346154] * 10
LEVELS = [
    ('尚未掌握', 'Sama sekali tidak bisa', '不了解该作业的基本步骤，且没有任何实践尝试'),
    ('需全程指导', 'Selesai dengan bimbingan orang lain', '了解该作业的工作目标和基本步骤，有少量的实践，但必须在他人的监督和指导下完成'),
    ('需部分指导', 'Selesai dengan dipandu orang lain', '已较为熟悉该作业的工作目标和基本步骤，有过一定量的实践尝试，但需要他人辅导关键步骤、把关关键质量、提示关键要点等'),
    ('可独立完成', 'Bisa menyelesaikan sendiri', '熟悉该作业的工作目标和基本步骤，有大量的实践尝试，能熟练独立完成作业'),
    ('可指导他人', 'Bisa mengajar orang lain', '有极其丰富的实践经验，在该作业中属于经验权威，能有效辅导他人或带领他人完成工作'),
]
_RULES = rating_rules()
DIMENSION_LABELS = {d['key']:d['label_zh'] for d in _RULES['dimensions']}
SCORE_BANDS = {
    band['level']: (f'低于{band["max_percent"]:g}分' if band['level']==0 else
                   f'{band["min_percent"]:g}至{band["max_percent"]:g}分' if band['level']==4 else
                   f'{band["min_percent"]:g}至不足{band["max_percent"]:g}分')
    for band in _RULES['levels']
}
ASSESSMENT_LABELS = {
    'unassessed':'未考核', 'theory_pending':'理论待出分',
    'category_pending':'待设置考核类别',
    'pending_practical':'待实操', 'completed':'已完成',
    'pending_direct':'待直接评分',
}
CATEGORY_LABELS = {category['key']:category['label_zh'] for category in _RULES.get('assessment_categories', _RULES.get('categories', []))}


def category_label(key):
    return CATEGORY_LABELS.get(key, {'leader':'类别 A','operator':'类别 B'}.get(key,''))


def weight_percent(value):
    return round(value*100, 8) if isinstance(value,(int,float)) and not isinstance(value,bool) else None


def sub(parent, tag, attrs=None, text=None, ns=S):
    node = ET.SubElement(parent, '{%s}%s' % (ns, tag), attrs or {})
    if text is not None:
        node.text = str(text)
    return node


def xml(root):
    data=ET.tostring(root, encoding='utf-8', xml_declaration=True)
    # OPC's content-type reader requires the package namespace to be default.
    # Replace only the root namespace's generated prefix, without mutating the
    # ElementTree global registry (HTTP exports can run concurrently).
    match=re.search(rb'<([A-Za-z0-9_]+):[A-Za-z]',data)
    if match:
        prefix=match.group(1)
        data=data.replace(b'xmlns:'+prefix+b'=',b'xmlns=',1)
        data=data.replace(b'<'+prefix+b':',b'<').replace(b'</'+prefix+b':',b'</')
    return data


def clean_text(value):
    # XML 1.0 forbids controls even when an otherwise valid JSON string has them.
    return ''.join(c for c in str(value) if c in '\t\n\r' or 0x20 <= ord(c) <= 0xD7FF or 0xE000 <= ord(c) <= 0xFFFD or 0x10000 <= ord(c) <= 0x10FFFF)[:32767]


def employee_number(employee):
    """Return the supplied NIK as text, excluding old internal SELF identifiers."""
    value = employee.get('employee_no')
    number = clean_text(value) if value is not None else ''
    if not number.strip() or number.lstrip().upper().startswith('SELF-'):
        return ''
    return number


def employee_header(employee):
    """Show only the employee's name in the moon matrix header."""
    return clean_text(employee.get('name') or '')


def has_skill_categories(items):
    return any(assessment_mode(item) == 'direct' or skill_category(item) != 'operation'
               or item.get('matrix_classification') == 'knowledge'
               or item.get('work_category_id') or item.get('work_category_name') for item in items)


def matrix_classification(item):
    """Honor a source workbook's category before falling back for manual items."""
    value = item.get('matrix_classification')
    if value in ('position_skills', 'knowledge'): return value
    return 'knowledge' if skill_category(item) == 'data' else 'position_skills'


def matrix_category_groups(items):
    """Consecutive category blocks; the template's blank minimum stays blank."""
    groups = {'A': [], 'B': []}
    for column in groups:
        for offset, item in enumerate(items):
            category = skill_category(item)
            if column == 'A':
                label = ('应知应会\nHarus tahu dan bisa' if matrix_classification(item) == 'knowledge'
                         else '本岗位技能\nKeterampilan pekerjaan')
            else:
                metadata = item_metadata(item)
                label = metadata['work_category_label'] + '\n' + metadata['work_category_label_id']
            number = offset + 3
            if groups[column] and groups[column][-1][2] == label:
                start, _, text = groups[column][-1]
                groups[column][-1] = (start, number, text)
            else:
                groups[column].append((number, number, label))
        if len(items) < 16:
            groups[column].append((len(items) + 3, 18, ''))
    return groups


def fit_category_heights(heights, groups, column_pixels, font_points):
    """Increase only a short block's first row when its category needs room."""
    for column, blocks in groups.items():
        for start, end, label in blocks:
            if not label: continue
            required = wrapped_text_height(label, column_pixels[column], font_points, 0)
            available = sum(heights[start-3:end-2])
            if required > available:
                heights[start-3] = min(409, heights[start-3] + required - available)


def assessment_label(assessment, item=None):
    direct = (assessment_mode(item) == 'direct' if item is not None
              else assessment.get('assessment_mode') == 'direct' or assessment.get('source') == 'direct')
    status = assessment.get('assessment_status')
    if direct and assessment.get('level') is None: status = 'pending_direct'
    return ASSESSMENT_LABELS.get(status, '未考核')


def wrapped_text_height(value, column_pixels, font_points, minimum=40):
    """Conservatively fit wrapped text without shrinking a template's font."""
    available = max(1, column_pixels - 10)
    lines = 0
    for paragraph in clean_text(value).split('\n'):
        used = 0
        lines += 1
        for char in paragraph:
            units = 0 if unicodedata.combining(char) else 2 if unicodedata.east_asian_width(char) in ('W', 'F') else 1
            width = units * font_points * 2 / 3
            if used and used + width > available:
                lines += 1
                used = 0
            used += width
    return max(minimum, min(409, lines * font_points * 1.35 + 10))


def col_name(index):
    result = ''
    while index:
        index, rem = divmod(index - 1, 26)
        result = chr(65 + rem) + result
    return result


def shift_row_reference(reference, offset):
    """Move only row coordinates in a cell or rectangular OOXML reference."""
    return re.sub(r'(\$?[A-Z]+\$?)(\d+)',
                  lambda match: match[1] + str(int(match[2]) + offset), reference)


def export_matrix_entries(entries):
    """Apply crane-only export scope without changing saved matrix evidence.

    The two legacy crane operations remain visible in the source matrix.  Only
    their rows in non-crane exports are omitted, including the evidence register.
    """
    crane_items = {'行车抓渣', '行车加料'}
    result = []
    for entry in entries:
        matrix = entry['matrix']
        if str(entry['position'].get('name') or '').strip() == '行车工':
            result.append(entry)
            continue
        items = [item for item in matrix['items']
                 if str(item.get('name') or '').split('\n', 1)[0].strip() not in crane_items]
        if len(items) == len(matrix['items']):
            result.append(entry)
            continue
        retained = {item['id'] for item in items}
        rows = [{**person, 'cells': [cell for cell in person['cells']
                                   if cell['work_item_id'] in retained]}
                for person in matrix['rows']]
        result.append({**entry, 'matrix': {**matrix, 'items': items, 'rows': rows}})
    return result


def stack_matrix_grids(blocks):
    """Stack complete staff blocks on one sheet, preserving merges and rows.

    Each block is (worksheet, last meaningful row). The returned offsets also
    move drawings; the blank separator is outside every category merge.
    """
    root = blocks[0][0]
    data = root.find(f'{{{S}}}sheetData')
    merges = root.find(f'{{{S}}}mergeCells')
    offsets = [0]
    last = blocks[0][1]
    if len(blocks) == 1:
        return root, offsets, last
    for node in list(data):
        if int(node.get('r')) > last: data.remove(node)
    for block, end in blocks[1:]:
        offset = last + 1
        offsets.append(offset)
        for original in block.find(f'{{{S}}}sheetData'):
            if int(original.get('r')) > end: continue
            copied = ET.fromstring(ET.tostring(original))
            copied.set('r', str(int(copied.get('r')) + offset))
            for entry in copied:
                if entry.get('r'): entry.set('r', shift_row_reference(entry.get('r'), offset))
            data.append(copied)
        for original in block.find(f'{{{S}}}mergeCells'):
            sub(merges, 'mergeCell', {'ref': shift_row_reference(original.get('ref'), offset)})
        last = offset + end
    merges.set('count', str(len(merges)))
    return root, offsets, last


def cell(row, col, value=None, style=0):
    node = sub(row, 'c', {'r': col_name(col) + row.attrib['r'], 's': str(style)})
    if value is None:
        return node
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        sub(node, 'v', text=value)
    else:
        # Explicit inline strings prevent spreadsheet formula/URL injection.
        node.set('t', 'inlineStr')
        sub(sub(node, 'is'), 't', {f'{{{XML}}}space': 'preserve'}, clean_text(value))
    return node


def row(sheet_data, number, height=40):
    return sub(sheet_data, 'row', {'r': str(number), 'ht': str(height), 'customHeight': '1'})


def styles_xml():
    root = ET.Element(f'{{{S}}}styleSheet')
    fmts = sub(root, 'numFmts', {'count': '2'})
    sub(fmts, 'numFmt', {'numFmtId': '164', 'formatCode': ';;;'})
    sub(fmts, 'numFmt', {'numFmtId': '165', 'formatCode': 'yyyy-mm-dd hh:mm'})
    fonts = sub(root, 'fonts', {'count': '5'})
    for size, bold, color in [(12, False, 'FF111111'), (24, True, 'FF111111'), (16, False, 'FF111111'), (11, False, 'FF666666'), (14, True, 'FF111111')]:
        f = sub(fonts, 'font'); sub(f, 'name', {'val': 'SimSun'}); sub(f, 'sz', {'val': str(size)}); sub(f, 'color', {'rgb': color})
        if bold: sub(f, 'b')
    fills = sub(root, 'fills', {'count': '3'})
    sub(sub(fills, 'fill'), 'patternFill', {'patternType': 'none'})
    sub(sub(fills, 'fill'), 'patternFill', {'patternType': 'gray125'})
    p = sub(sub(fills, 'fill'), 'patternFill', {'patternType': 'solid'}); sub(p, 'fgColor', {'rgb': 'FF6FD3EC'}); sub(p, 'bgColor', {'indexed': '64'})
    borders = sub(root, 'borders', {'count': '2'})
    for bordered in (False, True):
        b = sub(borders, 'border')
        for side in ('left', 'right', 'top', 'bottom'):
            node = sub(b, side, {'style': 'thin'} if bordered else {})
            if bordered: sub(node, 'color', {'rgb': 'FF333333'})
        sub(b, 'diagonal')
    sub(sub(root, 'cellStyleXfs', {'count': '1'}), 'xf', {'numFmtId': '0', 'fontId': '0', 'fillId': '0', 'borderId': '0'})
    xfs = sub(root, 'cellXfs', {'count': '10'})
    # 0 normal,1 title,2 header,3 body centered,4 body left,5 hidden moon
    # 6 pending,7 note,8 detail header,9 Excel date.
    for font, fill, border, num, align in [(0,0,0,0,'left'),(1,2,1,0,'center'),(2,0,1,0,'center'),(0,0,1,0,'center'),(0,0,1,0,'left'),(0,0,1,164,'center'),(3,0,1,0,'center'),(3,0,0,0,'left'),(4,2,1,0,'center'),(0,0,1,165,'left')]:
        xf = sub(xfs, 'xf', {'numFmtId': str(num), 'fontId': str(font), 'fillId': str(fill), 'borderId': str(border), 'xfId': '0', 'applyAlignment': '1', 'applyNumberFormat': '1'})
        sub(xf, 'alignment', {'horizontal': align, 'vertical': 'center', 'wrapText': '1'})
    sub(sub(root, 'cellStyles', {'count': '1'}), 'cellStyle', {'name': 'Normal', 'xfId': '0', 'builtinId': '0'})
    return xml(root)


def png_moon(level, size=96):
    """Five self-contained, antialiased black quarter-disc icons. No font needed."""
    raw = bytearray()
    r = size * .43
    for y in range(size):
        raw.append(0)
        for x in range(size):
            coverage = 0
            for sy in (.125, .375, .625, .875):
                for sx in (.125, .375, .625, .875):
                    dx, dy = x + sx - size / 2, y + sy - size / 2
                    dist = math.hypot(dx, dy)
                    angle = (math.atan2(dx, -dy) + 2 * math.pi) % (2 * math.pi)
                    if dist <= r and (dist >= r - 2.7 or (level and angle < level * math.pi / 2)):
                        coverage += 1
            raw.extend((0, 0, 0, round(coverage / 16 * 255)))
    def chunk(kind, content):
        return struct.pack('>I', len(content)) + kind + content + struct.pack('>I', zlib.crc32(kind + content) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB',size,size,8,6,0,0,0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


def sheet_base(widths, freeze=False):
    root = ET.Element(f'{{{S}}}worksheet')
    sub(root, 'sheetPr')
    views = sub(root, 'sheetViews'); view = sub(views, 'sheetView', {'workbookViewId': '0', 'showGridLines': '0'})
    if freeze: sub(view, 'pane', {'xSplit': '4', 'ySplit': '2', 'topLeftCell': 'E3', 'activePane': 'bottomRight', 'state': 'frozen'})
    sub(root, 'sheetFormatPr', {'defaultRowHeight': '20'})
    cols = sub(root, 'cols')
    for i, width in enumerate(widths, 1): sub(cols, 'col', {'min': str(i), 'max': str(i), 'width': str(width), 'customWidth': '1'})
    return root, sub(root, 'sheetData')


def picture_drawing(pictures):
    root = ET.Element(f'{{{D}}}wsDr')
    rels = ET.Element(f'{{{P}}}Relationships')
    for level in range(5): sub(rels, 'Relationship', {'Id': f'rId{level+1}', 'Type': R+'/image', 'Target': f'../media/moon{level}.png'}, ns=P)
    for index, (column, row_index, level, width, height) in enumerate(pictures, 1):
        size = min(30, width - 6, height - 6)
        anchor = sub(root, 'oneCellAnchor', ns=D)
        frm = sub(anchor, 'from', ns=D)
        for tag, val in [('col', column - 1), ('colOff', int((width-size)/2*9525)), ('row', row_index - 1), ('rowOff', int((height-size)/2*9525))]: sub(frm, tag, text=val, ns=D)
        sub(anchor, 'ext', {'cx': str(int(size*9525)), 'cy': str(int(size*9525))}, ns=D)
        pic = sub(anchor, 'pic', ns=D); nv = sub(pic, 'nvPicPr', ns=D)
        sub(nv, 'cNvPr', {'id': str(index), 'name': f'能力等级{level}_{index}', 'descr': f'{level}：{LEVELS[level][0]}'}, ns=D)
        sub(sub(nv, 'cNvPicPr', ns=D), 'picLocks', {'noChangeAspect': '1'}, ns=A)
        fill = sub(pic, 'blipFill', ns=D); sub(fill, 'blip', {f'{{{R}}}embed': f'rId{level+1}'}, ns=A); sub(sub(fill, 'stretch', ns=A), 'fillRect', ns=A)
        sp = sub(pic, 'spPr', ns=D)
        transform=sub(sp,'xfrm',ns=A); sub(transform,'off',{'x':'0','y':'0'},ns=A); sub(transform,'ext',{'cx':str(int(size*9525)),'cy':str(int(size*9525))},ns=A)
        geom = sub(sp, 'prstGeom', {'prst': 'rect'}, ns=A); sub(geom, 'avLst', ns=A)
        sub(anchor, 'clientData', ns=D)
    return xml(root), xml(rels)


def matrix_page(workshop, position, items, people, item_offset, page, total, stamp):
    root, data = sheet_base(WIDTHS, True); pictures = []
    heading=f'{workshop["name"]} {position["name"]}能力矩阵'
    title = heading+f'\nMATRIKS KOMPETENSI  {page}/{total}'
    heading_units=sum(1 if ord(ch)<128 else 2 for ch in heading)
    title_height=max(65,min(409, (math.ceil(heading_units/100)+1)*29))
    r = row(data, 1, title_height)
    for c in range(1,15): cell(r,c,title if c==1 else None,1)
    headers = ['能力分类\nKlasifikasi kemampuan','本岗位作业\nJenis pekerjaan','作业项目 / 姓名\nProyek tugas / Nama','']
    headers += [employee_header(p['employee']) for p in people]
    # The fixed template columns use 16pt SimSun headers. Estimate character
    # wrapping at that size instead of clipping names in a 70pt row.
    # Count each wrapped line separately: CJK characters cannot use a leftover
    # half-character at the edge. Keep the template widths and font unchanged.
    header_height = 70
    for column, text in enumerate(headers[4:], 4):
        available = WIDTHS[column] * 7 + 5 - 10  # pixels, allowing cell padding
        lines = 0
        for paragraph in clean_text(text).split('\n'):
            lines += 1
            used = 0
            for char in paragraph:
                units = 0 if unicodedata.combining(char) else 2 if unicodedata.east_asian_width(char) in ('W','F') else 1
                width = units * 16 * 2 / 3  # half/full-width glyphs at 96 dpi
                if used and used + width > available:
                    lines += 1
                    used = 0
                used += width
        header_height = max(header_height, min(409, lines * 22 + 12))
    r = row(data,2,header_height)
    for c in range(1,15): cell(r,c,headers[c-1] if c <= len(headers) else '',2)
    categorized = has_skill_categories(items)
    groups = matrix_category_groups(items) if categorized else None
    category_starts = {column:{start:label for start,_,label in blocks} for column,blocks in (groups or {}).items()}
    item_rows = max(16, len(items))
    legend_row = item_rows + 3
    note_row = legend_row + 1
    heights = [wrapped_text_height(work_item_bilingual_name(items[offset]), WIDTHS[3] * 7 + 5, 12)
               if offset < len(items) else 40 for offset in range(item_rows)]
    if categorized:
        fit_category_heights(heights, groups, {'A': WIDTHS[0]*7+5, 'B': WIDTHS[1]*7+5}, 12)
    for offset in range(item_rows):
        item = items[offset] if offset < len(items) else None
        item_name = work_item_bilingual_name(item) if item else ''
        height = heights[offset]
        r = row(data,3+offset,height)
        # Keep the source capability axis in A and the chosen work category
        # in B. Legacy operation-only exports retain the template's blank B.
        classification = category_starts['A'].get(offset+3) if categorized else '本岗位技能\nKeterampilan pekerjaan' if offset==0 else None
        category = category_starts['B'].get(offset+3) if categorized else ''
        values = [classification, category, item_offset+offset+1 if item else '', item_name]
        for c,v in enumerate(values,1): cell(r,c,v,4 if c==4 else 3)
        for c in range(5,15):
            person = people[c-5] if c-5 < len(people) else None
            if not item or not person: cell(r,c,None,3); continue
            assessment = next((v for v in person['cells'] if v['work_item_id']==item['id']),{})
            level = assessment.get('level')
            if level is None: cell(r,c,assessment_label(assessment,item),6)
            else:
                cell(r,c,level,5); pictures.append((c,3+offset,level,WIDTHS[c-1]*7+5,height*4/3))
    r=row(data,legend_row,48)
    legend = {1:0,3:1,5:2,9:3,12:4}
    labels = {2:0,4:1,6:2,10:3,13:4}
    for c in range(1,15):
        if c in legend:
            level=legend[c]; cell(r,c,level,5); pictures.append((c,legend_row,level,WIDTHS[c-1]*7+5,64))
        elif c in labels:
            level=labels[c]; cell(r,c,LEVELS[level][0]+'\n'+LEVELS[level][1],3)
        else: cell(r,c,None,3)
    note=f'导出时间：{stamp}    理论考试完成并出分、已设置考核类别且覆盖该作业项目即可评实操，不设最低理论分。实操按1至5分评分。\n理论与实操权重以当前评分配置为准。实操按评分×20折算。完成实操后生成月亮图，重考需重新评实操。未考核、待设置考核类别、待实操与0级分别记录。'
    if categorized: note+='\n点检、数据等直接评分技能：1至5分直接对应五档月亮，不参加考试，不折算百分比，不加权。未评分显示待直接评分。'
    r=row(data,note_row,90 if categorized else 66); cell(r,1,note,7)
    merge_refs=['A1:N1','C2:D2',f'F{legend_row}:H{legend_row}',f'J{legend_row}:K{legend_row}',f'M{legend_row}:N{legend_row}',f'A{note_row}:N{note_row}']
    if categorized:
        merge_refs += [f'{column}{start}:{column}{end}' for column,blocks in groups.items() for start,end,_ in blocks if end>start]
    else: merge_refs.insert(2,f'A3:A{item_rows+2}')
    merges=sub(root,'mergeCells',{'count':str(len(merge_refs))})
    for ref in merge_refs: sub(merges,'mergeCell',{'ref':ref})
    sub(root,'printOptions',{'horizontalCentered':'1'})
    sub(root,'pageMargins',{'left':'.275','right':'.275','top':'.197','bottom':'.197','header':'.1','footer':'.1'})
    sub(root,'pageSetup',{'paperSize':'8','orientation':'landscape','fitToWidth':'1','fitToHeight':'0' if item_rows>16 else '1'})
    root.find(f'{{{S}}}sheetPr').append(ET.Element(f'{{{S}}}pageSetUpPr',{'fitToPage':'1'}))
    footer=sub(root,'headerFooter'); sub(footer,'oddFooter',text='&C第 &P 页 / 共 &N 页')
    sub(root,'drawing',{f'{{{R}}}id':'rId1'})
    return root,pictures


def unique_name(raw, used):
    raw=re.sub(r'[\\/*?:\[\]\x00-\x1f]', '_', raw).strip(" '") or '能力矩阵'
    def shortened(value, count):
        return value.encode('utf-16-le')[:count*2].decode('utf-16-le',errors='ignore')
    raw=shortened(raw,31); name=raw; counter=2
    while name.casefold() in used:
        suffix=f'_{counter}'; name=shortened(raw,31-len(suffix))+suffix; counter+=1
    used.add(name.casefold()); return name


def excel_date(raw):
    if not raw: return ''
    try:
        date=datetime.fromisoformat(raw.replace('Z','+00:00'))
        if date.tzinfo: date=business_time(date).replace(tzinfo=None)
        return (date-datetime(1899,12,30)).total_seconds()/86400
    except (ValueError,TypeError): return raw


def dimension_summary(assessment):
    """Keep untested dimensions visible instead of interpreting them as zero."""
    if assessment.get('assessment_mode') == 'direct' or assessment.get('source') == 'direct':
        return '无需理论考试\nTidak memerlukan ujian teori'
    scores={d['dimension']:d for d in assessment.get('dimension_scores',[]) if isinstance(d,dict) and d.get('dimension') in DIMENSION_LABELS}
    lines=[]
    for name,label in DIMENSION_LABELS.items():
        value=scores.get(name,{})
        percent=value.get('percent')
        lines.append(f'{label}：未考核' if percent is None else f'{label}：{percent:g}%（{value.get("question_count",0)}题）')
    return '\n'.join(lines)


def build_workshop_xlsx(workshop, position_matrices, exported_at, reviewer_names=None):
    """Return one clean workbook including every position/person/item in a workshop."""
    reviewer_names=reviewer_names or {}; sheets=[]; used=set()
    # Shared major-workshop banks can serve several numbered workshops. The
    # exporter checks employee ownership again, even if the API caller passes
    # an administrative matrix containing all staff for a shared position.
    workshop_id=workshop['id']
    scoped=[]
    for entry in position_matrices:
        people=[p for p in entry['matrix']['rows'] if p['employee'].get('workshop_id')==workshop_id]
        if entry['position'].get('major_workshop_id') and not people:
            continue
        scoped.append({**entry,'matrix':{**entry['matrix'],'rows':people}})
    position_matrices=scoped
    categorized_export=any(has_skill_categories(entry['matrix']['items']) for entry in position_matrices)
    custom_category_export=any(item.get('work_category_id') or item.get('work_category_name')
                               for entry in position_matrices for item in entry['matrix']['items'])
    stamp=business_time(datetime.fromisoformat(exported_at.replace('Z','+00:00'))).strftime('%Y-%m-%d %H:%M')
    for entry in position_matrices:
        position,m=entry['position'],entry['matrix']; items=m['items']; people=m['rows']
        people_pages=max(1,math.ceil(len(people)/10)); blocks=[]; block_pictures=[]
        end=max(16,len(items))+4
        for ep in range(people_pages):
            root,pics=matrix_page(workshop,position,items,people[ep*10:ep*10+10],0,ep+1,people_pages,stamp)
            blocks.append((root,end)); block_pictures.append(pics)
        root,offsets,last=stack_matrix_grids(blocks)
        pictures=[(column,number+offset,level,width,height)
                  for offset,pics in zip(offsets,block_pictures)
                  for column,number,level,width,height in pics]
        if len(blocks)>1: root.find(f'{{{S}}}pageSetup').set('fitToHeight','0')
        sheets.append((unique_name(position['name'],used),root,pictures,f'A1:N{last}'))
    if not sheets:
        root,data=sheet_base([24]*8)
        cell(row(data,1,40),1,workshop['name']+'能力矩阵',1)
        cell(row(data,2,40),1,'该车间尚未配置岗位或对应员工。请先录入岗位、作业项目和员工。',0)
        merges=sub(root,'mergeCells',{'count':'2'})
        for ref in ('A1:H1','A2:H2'): sub(merges,'mergeCell',{'ref':ref})
        sheets.append((unique_name('能力矩阵',used),root,[],'A1:H2'))
    # A typed, filterable register retains each automatic rating and its evidence.
    widths=[22,22,18,18,14,42,42,14,14,28,18,18,16,18,18,20,14,14,42,20,24,24,24,22,18,18,22,20,20,28]
    root,data=sheet_base(widths)
    headers=['车间','岗位','工号','员工姓名','员工状态','作业项目','作业项目（印尼语）','项目状态','综合能力等级','通用矩阵等级名称','理论总分(%)','作业理论(%)','实操评分(1至5)','实操百分比(%)','综合得分(%)','考核状态','考核题数','已考核维度数','五维理论得分','实操评分人','实操评分时间','理论评分时间','定级规则版本','当前考核类别','当前理论权重(%)','当前实操权重(%)','原评分考核类别','原评分理论权重(%)','原评分实操权重(%)','原评分规则版本']
    if categorized_export:
        widths.extend([30,24,16,22,24,30,24,48,40,30,36,24])
        headers.extend(['考核方式','技能分类','直接评分(1至5)','直接评分人','直接评分时间','直接评分规则版本','评分来源','评分备注','关联考试记录','能力分类','来源分类原文','来源分类位置'])
        if custom_category_export:
            widths.extend([24,30,36])
            headers.extend(['作业类别','作业类别（印尼语）','作业类别ID'])
        # sheet_base already wrote the original columns before the optional
        # audit columns were known. Extend it without changing the old widths.
        cols=root.find(f'{{{S}}}cols')
        for number,width in enumerate(widths[30:],31):
            sub(cols,'col',{'min':str(number),'max':str(number),'width':str(width),'customWidth':'1'})
    for c,v in enumerate(headers,1): cell(row(data,1,32) if c==1 else data[-1],c,v,8)
    idx=2
    for entry in position_matrices:
        position,m=entry['position'],entry['matrix']; names={i['id']:i for i in m['items']}
        for person in m['rows']:
            employee=person['employee']
            for assessment in person['cells']:
                item=names[assessment['work_item_id']]; level=assessment.get('level')
                direct=assessment_mode(item)=='direct'
                count=assessment.get('question_count',0)
                dimension_count=assessment.get('coverage',{}).get('dimension_count',sum(d.get('percent') is not None for d in assessment.get('dimension_scores',[])))
                status=assessment_label(assessment,item)
                reviewer=assessment.get('practical_reviewed_by') or ''
                values=[workshop['name'],position['name'],employee_number(employee),employee['name'],'启用' if employee.get('active',True) else '停用',item['name'],work_item_name_id(item),'启用' if item.get('active',True) else '停用',level if level is not None else status,LEVELS[level][0] if level is not None else status,None if direct else assessment.get('theory_exam_percent'),None if direct else assessment.get('theory_item_percent',assessment.get('knowledge_percent')),None if direct else assessment.get('practical_score'),None if direct else assessment.get('practical_percent'),None if direct else assessment.get('final_percent'),status,count,'' if direct else dimension_count,dimension_summary(dict(assessment,assessment_mode=assessment_mode(item))),'' if direct else reviewer_names.get(reviewer,reviewer),'' if direct else excel_date(assessment.get('practical_reviewed_at')),'' if direct else excel_date(assessment.get('theory_completed_at') or assessment.get('rated_at')),assessment.get('rule_version','')]
                values.extend(['' if direct else assessment.get('assessment_category_label') or category_label(assessment.get('assessment_category')) or '待设置',None if direct else weight_percent(assessment.get('theory_weight')),None if direct else weight_percent(assessment.get('practical_weight')),'' if direct else category_label(assessment.get('practical_assessment_category')),None if direct else weight_percent(assessment.get('practical_theory_weight')),None if direct else weight_percent(assessment.get('practical_practical_weight')),'' if direct else assessment.get('practical_rule_version') or ''])
                if categorized_export:
                    metadata=item_metadata(item)
                    direct_reviewer=assessment.get('reviewed_by') or reviewer
                    values.extend([metadata['assessment_mode_label']+'\n'+metadata['assessment_mode_label_id'],metadata['skill_category_label']+'\n'+metadata['skill_category_label_id'],assessment.get('direct_score') if direct else None,reviewer_names.get(direct_reviewer,direct_reviewer) if direct else '',excel_date(assessment.get('reviewed_at') or assessment.get('practical_reviewed_at')) if direct else '',assessment.get('rule_version','') if direct else '',assessment.get('source') or ('direct' if direct else ''),assessment.get('note',assessment.get('practical_note','')),None if direct else assessment.get('assignment_id')])
                    origin=item.get('seed_source') or {}
                    classification=('应知应会\nHarus tahu dan bisa' if matrix_classification(item)=='knowledge' else '本岗位技能\nKeterampilan pekerjaan')
                    values.extend([classification,origin.get('source_classification',''),origin.get('source_classification_merge') or origin.get('source_classification_cell','')])
                    if custom_category_export:
                        values.extend([metadata['work_category_label'],metadata['work_category_label_id'],metadata['work_category_id']])
                line_count=max(sum(max(1,math.ceil(sum(1 if ord(ch)<128 else 2 for ch in line)*8/(width*7-3))) for line in str(v if v is not None else '').split('\n')) for v,width in zip(values,widths))
                r=row(data,idx,max(36,min(409,line_count*15+6)))
                for c,v in enumerate(values,1): cell(r,c,v,9 if c in (21,22,35) and isinstance(v,(int,float)) else 4)
                idx+=1
    detail_end=col_name(len(headers))
    sub(root,'autoFilter',{'ref':f'A1:{detail_end}{max(1,idx-1)}'})
    sheets.append((unique_name('能力定级明细',used),root,[],f'A1:{detail_end}{max(1,idx-1)}'))
    root,data=sheet_base([12,30,48,90]); pictures=[]
    for c,v in enumerate(['等级','通用矩阵等级名称','Bahasa Indonesia','综合得分分档与通用矩阵定义'],1): cell(row(data,1,30) if c==1 else data[-1],c,v,8)
    for level,(label,indonesian,definition) in enumerate(LEVELS):
        r=row(data,level+2,90)
        definition_text=f'综合得分：{SCORE_BANDS[level]}。\n通用矩阵定义：{definition}'
        if categorized_export: definition_text+=f'\n直接评分技能：{level+1}/5，不折算百分比、不加权。'
        for c,v in enumerate([level,label,indonesian,definition_text],1): cell(r,c,v,3 if c==1 else 4)
    statuses=[('未考核','未参加理论考试或最近一场未覆盖该项目'),('理论待出分','理论尚未完成评分'),('待设置考核类别','管理员尚未明确选择类别 A或类别 B，不能录入实操评分，也不生成综合分和月亮等级'),('待实操','理论考试完成并出分、已设置考核类别且覆盖该项目，尚未完成实操评分；不设最低理论分'),('已完成','该作业项目已完成理论与实操评分，按当前人员类别的权重生成综合分和月亮等级')]
    if categorized_export:
        statuses[-1]=('已完成','标准作业已完成理论与实操评分，或直接评分技能已按五档评分并生成月亮图')
        statuses.append(('待直接评分','点检、数据等技能无需理论考试，尚未直接评分；不生成月亮图，也不计为零分'))
    for idx,(status,definition) in enumerate(statuses,7):
        r=row(data,idx,40)
        for c,v in enumerate([status,'','',definition],1): cell(r,c,v,4)
    note_row=13 if categorized_export else 12
    r=row(data,note_row,130 if categorized_export else 100)
    definition_note='综合得分＝该项目理论得分×当前类别理论权重＋实操评分×20×当前类别实操权重。理论与实操权重以当前评分配置为准。实操评分为1至5的整数，理论考试完成并出分、已设置考核类别且覆盖该作业项目即可评分，不设最低理论分。未完成实操不生成最终等级。修改员工类别后按当前类别重算，原评分记录及其当时类别、权重和规则版本保留；旧记录缺少的快照不补写。实操评分绑定最近一场已完成考试，重考后须重新评分。0级表示已完成理论与实操、综合得分低于60分。'
    if categorized_export: definition_note+='\n上述综合得分分档仅适用于理论考试＋现场实操。点检、数据等直接评分技能不参加考试，1、2、3、4、5分直接对应0、1、2、3、4级月亮，不折算百分比、不加权。直接评分不绑定考试，后续考试不会清除其评分。'
    cell(r,1,definition_note,7)
    merges=sub(root,'mergeCells',{'count':'1'}); sub(merges,'mergeCell',{'ref':f'A{note_row}:D{note_row}'})
    sheets.append((unique_name('等级说明',used),root,[],f'A1:D{note_row}'))
    workbook=ET.Element(f'{{{S}}}workbook'); views=sub(workbook,'bookViews'); sub(views,'workbookView')
    sheetlist=sub(workbook,'sheets'); defined=sub(workbook,'definedNames')
    rels=ET.Element(f'{{{P}}}Relationships')
    types=ET.Element(f'{{{CT}}}Types')
    for ext,content in [('rels','application/vnd.openxmlformats-package.relationships+xml'),('xml','application/xml'),('png','image/png')]: sub(types,'Default',{'Extension':ext,'ContentType':content},ns=CT)
    for part,content in [('/xl/workbook.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'),('/xl/styles.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml')]: sub(types,'Override',{'PartName':part,'ContentType':content},ns=CT)
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        for i,(name,root,pictures,area) in enumerate(sheets,1):
            sub(sheetlist,'sheet',{'name':name,'sheetId':str(i),f'{{{R}}}id':f'rId{i}'})
            sub(rels,'Relationship',{'Id':f'rId{i}','Type':R+'/worksheet','Target':f'worksheets/sheet{i}.xml'},ns=P)
            quoted="'"+name.replace("'","''")+"'!"
            sub(defined,'definedName',{'name':'_xlnm.Print_Area','localSheetId':str(i-1)},quoted+area)
            z.writestr(f'xl/worksheets/sheet{i}.xml',xml(root))
            sub(types,'Override',{'PartName':f'/xl/worksheets/sheet{i}.xml','ContentType':'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'},ns=CT)
            if pictures:
                drawing,drawingrels=picture_drawing(pictures)
                z.writestr(f'xl/drawings/drawing{i}.xml',drawing); z.writestr(f'xl/drawings/_rels/drawing{i}.xml.rels',drawingrels)
                sr=ET.Element(f'{{{P}}}Relationships'); sub(sr,'Relationship',{'Id':'rId1','Type':R+'/drawing','Target':f'../drawings/drawing{i}.xml'},ns=P)
                z.writestr(f'xl/worksheets/_rels/sheet{i}.xml.rels',xml(sr))
                sub(types,'Override',{'PartName':f'/xl/drawings/drawing{i}.xml','ContentType':'application/vnd.openxmlformats-officedocument.drawing+xml'},ns=CT)
        sub(rels,'Relationship',{'Id':f'rId{len(sheets)+1}','Type':R+'/styles','Target':'styles.xml'},ns=P)
        package=ET.Element(f'{{{P}}}Relationships'); sub(package,'Relationship',{'Id':'rId1','Type':R+'/officeDocument','Target':'xl/workbook.xml'},ns=P)
        z.writestr('_rels/.rels',xml(package)); z.writestr('xl/workbook.xml',xml(workbook)); z.writestr('xl/_rels/workbook.xml.rels',xml(rels)); z.writestr('xl/styles.xml',styles_xml())
        if any(s[2] for s in sheets):
            for level in range(5): z.writestr(f'xl/media/moon{level}.png',png_moon(level))
        z.writestr('[Content_Types].xml',xml(types))
    return output.getvalue()
