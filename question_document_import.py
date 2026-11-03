"""Deterministic, offline Word/text question preview; no database or network access.

Recognition is deliberately conservative: missing keys and unsupported content
remain visible as blocking diagnostics. Parsed rows are always unactivated drafts.
"""
from __future__ import annotations

import base64
import binascii
import io
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET

MAX_TEXT_BYTES = 1024 * 1024
MAX_DOCX_BYTES = 2 * 1024 * 1024
MAX_QUESTIONS = 2000
MAX_ZIP_ENTRIES = 512
MAX_UNCOMPRESSED_BYTES = 16 * 1024 * 1024
MAX_XML_BYTES = 4 * 1024 * 1024
DIMENSIONS = ('knowledge', 'operation', 'safety', 'quality', 'troubleshooting')
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
M = '{http://schemas.openxmlformats.org/officeDocument/2006/math}'
CJK = re.compile(r'[\u3400-\u9fff\U00020000-\U0003134f]')
QUESTION = re.compile(r'^\s*(?:(?:第\s*)?(\d{1,5})\s*[.．、:：)）\]］]|[（(]\s*(\d{1,5})\s*[）)])\s*(.*)$')
OPTION = re.compile(r'(?<!\S)(?:[（(]\s*([A-TＡ-Ｔ])\s*[）)]|([A-TＡ-Ｔ])\s*[.．、)）:：])\s*')
ANSWER = re.compile(r'(?:参考答案|标准答案|正确答案|答案|Kunci\s+Jawaban|Jawaban|Correct\s+Answer|Answer)\s*[:：]\s*', re.I)
PLACEHOLDER = re.compile(r'\[(?:请填写|请输入|待填写|Isi\b|Tuliskan\b)|【(?:请填写|请输入|待填写)', re.I)


class ParseError(ValueError):
    """Invalid source transport or a document that cannot safely be extracted."""


def _xml(data, label):
    if len(data) > MAX_XML_BYTES:
        raise ParseError(f'{label}过大，无法安全识别，请拆分文件')
    if re.search(br'<!\s*(?:DOCTYPE|ENTITY)\b', data.replace(b'\x00', b''), re.I):
        raise ParseError('Word 文件含不支持的 DTD 或实体定义，请另存为普通 .docx')
    try:
        root = ET.fromstring(data)
        if sum(1 for _ in root.iter()) > 150000:
            raise ParseError(f'{label}节点过多，请拆分文件')
        return root
    except (ET.ParseError, ValueError):
        raise ParseError(f'{label}格式损坏，请重新保存 Word 文件') from None


def _docx_text(encoded):
    if not isinstance(encoded, str) or len(encoded) > ((MAX_DOCX_BYTES + 2) // 3) * 4:
        raise ParseError('Word 文件最大为 2 MiB')
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise ParseError('Word 文件内容编码无效，请重新选择 .docx 文件') from None
    if not raw or len(raw) > MAX_DOCX_BYTES:
        raise ParseError('请选择不超过 2 MiB 的 .docx 文件')
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ZIP_ENTRIES or sum(x.file_size for x in entries) > MAX_UNCOMPRESSED_BYTES:
                raise ParseError('Word 解压后内容过大，请拆分文件')
            names = [x.filename for x in entries]
            if len(names) != len(set(names)):
                raise ParseError('Word 文件包含重复内容条目，无法安全识别')
            for entry in entries:
                parts = entry.filename.replace('\\', '/').split('/')
                if entry.flag_bits & 1:
                    raise ParseError('不支持加密 Word 文件，请取消密码后上传')
                if entry.filename.startswith(('/', '\\')) or '..' in parts:
                    raise ParseError('Word 压缩结构异常，请重新保存 .docx 文件')
                if entry.file_size > MAX_UNCOMPRESSED_BYTES or entry.file_size > max(entry.compress_size, 1) * 300:
                    raise ParseError('Word 压缩比例异常，请拆分或重新保存文件')
                low = entry.filename.lower()
                if low.endswith(('vbaproject.bin', '.docm')) or low.startswith(('word/embeddings/', 'word/activex/')):
                    raise ParseError('Word 含宏或嵌入对象，请转为普通文字后导入')
                if low.endswith(('.xml', '.rels')):
                    root = _xml(archive.read(entry), 'Word XML')
                    if low.endswith('.rels') and any(x.get('TargetMode', '').lower() == 'external' for x in root.iter()):
                        raise ParseError('Word 含外部引用，请移除外部链接后再导入')
            if 'word/document.xml' not in names or '[Content_Types].xml' not in names:
                raise ParseError('文件不是有效的 .docx，请在 Word 中另存为 .docx')
            root = _xml(archive.read('word/document.xml'), 'Word 正文')
            blocked = {W + 'drawing', W + 'pict', W + 'object', M + 'oMath', M + 'oMathPara'}
            if any(x.tag in blocked for x in root.iter()):
                raise ParseError('Word 正文包含图片、公式或嵌入对象，无法可靠识别，请转为文字后导入')
            if any(x.tag in {W + 'altChunk', W + 'subDoc'} for x in root.iter()):
                raise ParseError('Word 正文包含外部文档内容，请转为普通文字后导入')
            # Auto-numbered Word paragraphs have no number in w:t; silently
            # dropping their numbering would risk combining separate questions.
            if any(x.tag == W + 'numPr' for x in root.iter()):
                raise ParseError('Word 使用了自动编号，请复制全文到“粘贴文字”，或改用模板中的手动编号')
            texts = []
            for paragraph in root.iter(W + 'p'):
                pieces = []
                for node in paragraph.iter():
                    if node.tag == W + 't':
                        pieces.append(node.text or '')
                    elif node.tag == W + 'tab':
                        pieces.append('\t')
                    elif node.tag in (W + 'br', W + 'cr'):
                        pieces.append('\n')
                texts.append(''.join(pieces))
            text = '\n'.join(texts)
    except ParseError:
        raise
    except (zipfile.BadZipFile, RuntimeError, OSError, NotImplementedError, OverflowError):
        raise ParseError('Word 文件损坏、被加密或格式不支持，请重新保存 .docx') from None
    if len(text.encode('utf-8')) > MAX_TEXT_BYTES:
        raise ParseError('Word 提取文字超过 1 MiB，请拆分后导入')
    return text


def _norm(text):
    return unicodedata.normalize('NFKC', text).strip()


def _question_start(line):
    match = QUESTION.match(line)
    if not match:
        return None
    return int(match[1] or match[2]), match[3].strip()


def _section(line):
    text = _norm(line).lower()
    text = re.sub(r'^(?:[一二三四五六七八九十百]+|[ivx]+|\d+)\s*[.、:)]\s*', '', text)
    if len(text) > 220:
        return None
    numbered = _question_start(line)
    if numbered:
        # An actual stem can begin with words such as 判断 or Single choice.
        # Only a complete type label (optionally followed by a count or a
        # bilingual heading) may consume an Arabic-numbered source line.
        label = _norm(numbered[1]).lower()
        name = r'(?:单项选择题?|单选题?|多项选择题?|多选题?|选择题|判断题?|single\s+choice(?:\s+questions?)?|multiple\s+choice(?:\s+questions?)?|multiple\s+answers|true\s*(?:or|/)\s*false|pilihan\s+ganda(?:\s+kompleks)?|benar\s*(?:atau|/)\s*salah|填空题?|简答题?|问答题?|论述题?|计算题|essay|esai|uraian|isian)'
        if not re.fullmatch(name + r'\s*(?:[(/].*)?', label):
            return None
    if re.match(r'(?:多项选择|多选|multiple\s+(?:choice.*multiple|answers|select)|pilihan\s+ganda\s+(?:kompleks|lebih)|pilih\s+lebih\s+dari\s+satu)', text):
        return 'multiple'
    if re.match(r'(?:单项选择|单选|选择题|single\s+(?:choice|answer)|multiple\s+choice|pilihan\s+ganda)', text):
        return 'single'
    if re.match(r'(?:判断题|判断|true\s*(?:or|/|and|-)\s*false|benar\s*(?:atau|/|dan)\s*salah)', text):
        return 'true_false'
    if re.match(r'(?:填空|简答|问答|论述|名词解释|计算题|essay|esai|uraian|isian|fill\s+in)', text):
        return 'unsupported'
    return None


def _answer_heading(line):
    text = _norm(line)
    return bool(re.match(r'^(?:参考答案|标准答案|答案汇总|Kunci\s+Jawaban|Answer\s+Key|Answers)(?:\s|[/：:]|$)', text, re.I))


def _language_parts(lines, prefer_zh=False):
    """Keep source text; split only explicit labels, scripts, or clear bilingual / pairs."""
    result = {'zh': [], 'id': []}
    meaningful = [x.strip() for x in lines if x.strip()]
    for index, source in enumerate(meaningful):
        explicit = re.match(r'^(中文|汉语|印尼文|印尼语|Bahasa\s+Indonesia|Indonesia|ZH|ID)\s*[:：]\s*(.*)$', source, re.I)
        if explicit:
            lang = 'zh' if explicit[1].lower() in ('中文', '汉语', 'zh') else 'id'
            result[lang].append(explicit[2])
            continue
        segments = re.split(r'\s+[/／]\s*', source, maxsplit=1)
        if len(segments) == 2 and CJK.search(segments[0]) and not CJK.search(segments[1]):
            result['zh'].append(segments[0].strip()); result['id'].append(segments[1].strip())
        else:
            lang = 'zh' if CJK.search(source) else 'id'
            # Numeric, unit-only alternatives often have a separate localized
            # decimal line; use source order only in a Chinese bilingual question.
            if prefer_zh and index == 0 and len(meaningful) > 1 and re.match(r'^[\d+−～~≤≥<>=±]', source):
                lang = 'zh'
            result[lang].append(source)
    return '\n'.join(result['zh']), '\n'.join(result['id'])


def _parse_answer(value):
    text = _norm(value).strip(' \t()（）[]【】。.')
    text = re.sub(r'^(?:参考答案|标准答案|正确答案|答案|Kunci\s+Jawaban|Jawaban|Answer)\s*[:：]?\s*', '', text, flags=re.I)
    text = text.strip(' \t()（）[]【】。.')
    if not text:
        return None, '答案为空'
    parts = [x.strip() for x in re.split(r'\s*[/／]\s*|\s+', text) if x.strip()]
    truth = {'正确': True, '对': True, '是': True, '√': True, '✓': True, '✔': True, 'benar': True, 'true': True,
             '错误': False, '错': False, '否': False, '×': False, '✗': False, '✕': False, 'salah': False, 'false': False}
    booleans = [truth[x.lower()] for x in parts if x.lower() in truth]
    if booleans:
        if len(booleans) != len(parts):
            return None, '判断答案含无法识别的内容'
        if len(set(booleans)) != 1:
            return None, '中印双语判断答案互相冲突'
        return ('truth', booleans[0]), None
    letters = re.sub(r'[\s,，、;；/／+&和及]+', '', text).upper()
    if re.fullmatch(r'[A-T]{1,20}', letters):
        if len(set(letters)) != len(letters):
            return None, '标准答案包含重复选项'
        return ('keys', tuple(sorted(letters))), None
    return None, f'无法识别答案“{value[:100]}”，请只填写选项编号或正确/错误'


def _inline_answer(text):
    found = list(ANSWER.finditer(text))
    if not found:
        return text.strip(), []
    start = found[0].start()
    before = text[:start].rstrip(' (（')
    values = []
    for i, match in enumerate(found):
        end = found[i + 1].start() if i + 1 < len(found) else len(text)
        values.append(text[match.end():end].strip().rstrip(')）'))
    return before, values


def _option_segments(line):
    matches = list(OPTION.finditer(line))
    if not matches:
        return None
    # Only recognize an option list beginning at the start of a source line.
    if line[:matches[0].start()].strip():
        return None
    return [(unicodedata.normalize('NFKC', m[1] or m[2]), line[m.end():matches[i + 1].start() if i + 1 < len(matches) else len(line)].strip()) for i, m in enumerate(matches)]


def _tf_options(line):
    text = _norm(line).lower()
    return bool((('正确' in text and '错误' in text) or (re.search(r'\bbenar\b', text) and re.search(r'\bsalah\b', text)) or (re.search(r'\btrue\b', text) and re.search(r'\bfalse\b', text))) and len(text) < 150 and not _question_start(line))


def parse(body):
    """Return preview rows and blocking diagnostics; never import or activate rows."""
    if not isinstance(body, dict):
        raise ParseError('请提交文件或粘贴文字')
    item = body.get('work_item_id')
    if not isinstance(item, str) or not item.strip() or len(item) > 200:
        raise ParseError('请先选择要导入的作业项目')
    dimension = body.get('dimension', 'knowledge')
    if dimension not in DIMENSIONS:
        raise ParseError('考核维度不正确')
    if body.get('source_type') == 'docx':
        text = _docx_text(body.get('content_base64'))
    elif body.get('source_type') == 'text':
        text = body.get('text')
        if not isinstance(text, str):
            raise ParseError('请粘贴题目文字')
        try:
            size = len(text.encode('utf-8'))
        except UnicodeEncodeError:
            raise ParseError('文字含无效字符，请重新复制') from None
        if size > MAX_TEXT_BYTES:
            raise ParseError('粘贴文字最大为 1 MiB，请拆分后导入')
    else:
        raise ParseError('仅支持 .docx 或粘贴文字')
    if not text.strip():
        raise ParseError('没有读取到题目文字')
    if any(unicodedata.category(x) in ('Cs',) or (unicodedata.category(x) == 'Cc' and x not in '\n\r\t') for x in text):
        raise ParseError('文字含不支持的控制字符，请重新复制')
    errors, warnings, raw, keys = [], [], [], []
    section, current, mode = None, None, 'questions'
    reference_section = None
    unused = []

    def add_question(number, title, line_no):
        nonlocal current
        if len(raw) >= MAX_QUESTIONS:
            raise ParseError('一次最多识别 2000 道题，请拆分后导入')
        current = {'number': number, 'section': section, 'titles': [], 'options': [], 'answers': [],
                   'errors': [], 'warnings': [], 'source': [], 'line': line_no, 'last_option': None, 'tf_labels': False}
        raw.append(current)
        if section == 'unsupported':
            current['errors'].append('不支持该题型，仅支持单选、多选和判断题')
        consume(title)

    def consume(line):
        if not current:
            return
        current['source'].append(line)
        content, answers = _inline_answer(line)
        current['answers'].extend(answers)
        if not content:
            return
        if _tf_options(content):
            current['tf_labels'] = True
            return
        if re.match(r'^(?:解析|说明|Pembahasan|Penjelasan|Explanation)\s*[:：]', content, re.I):
            current['warnings'].append('题目解析未作为题干导入，请核对预览')
            return
        parts = _option_segments(content)
        if parts:
            for key, value in parts:
                option = {'key': key, 'lines': [value]}
                current['options'].append(option); current['last_option'] = option
        elif current['last_option'] is not None:
            current['last_option']['lines'].append(content)
        else:
            current['titles'].append(content)

    for line_no, original in enumerate(text.replace('\r\n', '\n').replace('\r', '\n').split('\n'), 1):
        line = original.strip()
        if not line:
            continue
        if _answer_heading(line) and not ANSWER.search(line):
            mode = 'answers'; current = None
            continue
        # A heading with a colon may also carry all the numbered answer keys.
        if _answer_heading(line) and not _question_start(line):
            marker = ANSWER.search(line)
            if marker:
                remainder = line[marker.end():].strip()
                if remainder and _question_start(remainder):
                    mode = 'answers'; current = None; line = remainder
                elif not remainder:
                    mode = 'answers'; current = None; continue
        detected = _section(line)
        if detected:
            if mode == 'answers':
                reference_section = detected
            else:
                section = detected; current = None
            continue
        if mode == 'answers':
            # Support compact key lists, including table cells separated by tabs.
            chunks = re.split(r'(?<=\S)\s+(?=\d{1,5}\s*[.．、:：)）])', line)
            for chunk in chunks:
                start = _question_start(chunk)
                if start:
                    keys.append((reference_section, start[0], start[1], line_no))
                elif chunk.strip():
                    errors.append(f'第 {line_no} 行：参考答案格式无法识别，请使用“1. A”这样的编号答案')
            continue
        start = _question_start(line)
        if start:
            number, title = start
            # Some bilingual documents repeat the number for the translation.
            opposite = current and not current['options'] and not current['answers'] and number == current['number'] and bool(CJK.search('\n'.join(current['titles']))) != bool(CJK.search(title))
            if opposite:
                consume(title)
            else:
                add_question(number, title, line_no)
        elif current:
            if re.match(r'^\d{1,5}\s+\S', line):
                errors.append(f'第 {line_no} 行：疑似题号缺少标点，请使用“1. 题干”格式')
            if re.match(r'^(?:[（(]\s*)?[U-ZＵ-Ｚ]\s*[.．、)）:：]', line):
                errors.append(f'第 {line_no} 行：选项编号超过 A 至 T 的范围')
            consume(line)
        else:
            unused.append((line_no, line))
    if not raw:
        errors.append('未识别到编号题目，请按“1. 题干”格式填写')
    # Preamble titles and known instructions are harmless. Number-like or option
    # content outside a question is always surfaced instead of silently omitted.
    for line_no, line in unused:
        if re.match(r'^[\d（(\[【]', line) or _option_segments(line):
            errors.append(f'第 {line_no} 行：内容没有对应题目，请检查题号或题型标题')
    if unused:
        warnings.append(f'有 {len(unused)} 行标题或说明未作为题目导入，请对照原文核对识别题数')
    lookup = {}
    for q in raw:
        lookup.setdefault((q['section'], q['number']), []).append(q)
    for duplicate in lookup.values():
        if len(duplicate) > 1:
            for q in duplicate:
                q['errors'].append('同一题型内题号重复，无法可靠对应答案，请重新编号')
    for ref_type, number, value, line_no in keys:
        candidates = [q for q in raw if q['number'] == number and (ref_type is None or ref_type == q['section'])]
        if len(candidates) == 1:
            candidates[0]['answers'].append(value)
        elif not candidates:
            errors.append(f'第 {line_no} 行：答案题号 {number} 没有对应题目')
        else:
            errors.append(f'第 {line_no} 行：答案题号 {number} 对应多道题，请在答案处标明题型并避免同题型重号')
    rows, questions = [], []
    for index, q in enumerate(raw):
        zh, ind = _language_parts(q['titles'])
        question_type = q['section']
        parsed_answers = []
        for answer in q['answers']:
            parsed, error = _parse_answer(answer)
            if error:
                q['errors'].append(error)
            elif parsed not in parsed_answers:
                parsed_answers.append(parsed)
        if len(parsed_answers) > 1:
            q['errors'].append('同一道题的标准答案互相冲突，请核对行内与参考答案')
        answer = parsed_answers[0] if len(parsed_answers) == 1 else None
        if not question_type:
            if q['tf_labels'] or (answer and answer[0] == 'truth'):
                question_type = 'true_false'
            else:
                question_type = 'multiple' if answer and answer[0] == 'keys' and len(answer[1]) > 1 else 'single'
            q['warnings'].append('未标明题型，已根据选项与明确答案识别，请核对')
        if question_type == 'unsupported':
            question_type = 'single'
        options = []
        for opt in q['options']:
            oz, oi = _language_parts(opt['lines'], bool(zh))
            options.append({'key': opt['key'], 'text_zh': oz, 'text_id': oi})
        if question_type == 'true_false':
            if options:
                if len(options) != 2:
                    q['errors'].append('判断题只能有两个选项')
            else:
                # Standard true/false UI labels are fixed type vocabulary; no
                # question, option content, or answer is translated/invented.
                options = [{'key': 'A', 'text_zh': '正确', 'text_id': 'Benar'}, {'key': 'B', 'text_zh': '错误', 'text_id': 'Salah'}]
        if not (zh or ind):
            q['errors'].append('题干为空')
        if len(options) < 2:
            q['errors'].append('至少需要两个明确选项；不支持的填空、简答题请先整理')
        if len(options) > 20:
            q['errors'].append('选项超过 20 个')
        if len({o['key'] for o in options}) != len(options):
            q['errors'].append('选项编号重复，请检查换行与选项编号')
        for opt in options:
            if not (opt['text_zh'] or opt['text_id']):
                q['errors'].append(f'选项 {opt["key"]} 文字为空')
        correct = []
        if answer:
            if answer[0] == 'truth':
                if question_type != 'true_false':
                    q['errors'].append('选择题答案为正确/错误，与题型不一致')
                else:
                    # For explicit options, resolve only by their own source
                    # labels. Never assume option A means true when reordered.
                    matching = []
                    for option in options:
                        value = ' / '.join(x for x in (option['text_zh'], option['text_id']) if x)
                        parsed, _ = _parse_answer(value)
                        if parsed == answer:
                            matching.append(option['key'])
                    if len(matching) == 1:
                        correct = matching
                    else:
                        q['errors'].append('判断题答案无法对应唯一选项')
            else:
                correct = list(answer[1])
                if question_type != 'multiple' and len(correct) != 1:
                    q['errors'].append('单选或判断题只能有一个标准答案')
                if any(key not in {o['key'] for o in options} for key in correct):
                    q['errors'].append('标准答案编号不在选项中')
        else:
            q['errors'].append('缺少明确标准答案，请填写“答案：A”或补全参考答案')
        if PLACEHOLDER.search('\n'.join(q['source'])):
            q['errors'].append('仍有模板占位文字，请填写实际题干和选项')
        if not zh or not ind or any(not o['text_zh'] or not o['text_id'] for o in options):
            q['warnings'].append('部分题干或选项只有一种语言；不会自动翻译，请核对后补齐')
        q['errors'] = list(dict.fromkeys(q['errors']))
        q['warnings'] = list(dict.fromkeys(q['warnings']))
        row = {'work_item_id': item.strip(), 'dimension': dimension, 'type': question_type,
               'title_zh': zh, 'title_id': ind, 'options': options, 'correct_answer': correct, 'points': 2, 'status': 'draft'}
        rows.append(row)
        questions.append({'number': q['number'], 'label': f'第 {q["number"]} 题', 'row_index': index,
                          'errors': q['errors'], 'warnings': q['warnings'], 'source_text': '\n'.join(q['source'])})
    warnings.append('识别结果须核对后确认导入；统一保存为草稿，每题 2 分，文档原分值不自动沿用')
    return {'rows': rows, 'questions': questions, 'errors': list(dict.fromkeys(errors)),
            'warnings': warnings, 'question_count': len(rows), 'source_text': text,
            'can_import': bool(rows) and not errors and not any(q['errors'] for q in questions)}
