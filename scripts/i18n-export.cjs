/**
 * src/i18n/ko.ts → i18n/strings-ko.xlsx  (번역용)
 *
 * 한글이 들어 있는 문자열만, 구역별로. 같은 문장은 한 번만 나온다.
 * 열: 구역 | 한국어 | 태국어(빈칸)
 * 되돌리기: node scripts/i18n-import.cjs <파일>  — 한국어 문장으로 키를 찾아 th.ts를 만든다.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { loadDict, SECTIONS, flatten } = require('./i18n-common.cjs');

const out = process.argv[2] || path.join(__dirname, '..', 'i18n', 'strings-ko.xlsx');
const dict = loadDict('ko');

const rows = [['구역', '한국어', '태국어']];
const seen = new Set();
for (const [key, val] of flatten(dict)) {
  const top = key.split('.')[0];
  if (SECTIONS[top] === '설정') continue;
  if (!/[가-힣]/.test(String(val))) continue;
  if (seen.has(val)) continue;
  seen.add(val);
  rows.push([SECTIONS[top] || top, val, '']);
}

const ws = XLSX.utils.aoa_to_sheet(rows);
ws['!cols'] = [{ wch: 18 }, { wch: 64 }, { wch: 64 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '번역');
fs.mkdirSync(path.dirname(out), { recursive: true });
XLSX.writeFile(wb, out);
console.log(`${rows.length - 1} strings → ${out}`);
