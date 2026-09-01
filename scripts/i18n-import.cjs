/**
 * 번역된 엑셀 → src/i18n/<lang>.ts
 *
 *   node scripts/i18n-import.cjs i18n/strings-th.xlsx [th]
 *
 * 엑셀은 구역|한국어|태국어 — 한국어 문장으로 키를 찾는다. 태국어가 비면 한국어 유지.
 * 폰트·숫자 단위(설정)는 여기서 태국어 기본값으로 채운다.
 * 만든 뒤 src/i18n/index.ts 에서 `import { th } from './th'; export const T: Dict = th;` 로 바꾸면 끝.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { I18N_DIR, loadDict, unflatten } = require('./i18n-common.cjs');

const file = process.argv[2];
const lang = process.argv[3] || 'th';
if (!file) { console.error('사용법: node scripts/i18n-import.cjs <엑셀> [lang]'); process.exit(1); }

const wb = XLSX.readFile(file);
const ws = wb.Sheets['번역'] || wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const ko = loadDict('ko');
const { flatten } = require('./i18n-common.cjs');
// 한국어 문장 → 그 문장을 쓰는 모든 키 (같은 문장은 엑셀에 한 번만 나온다)
const keysByKo = new Map();
for (const [key, val] of flatten(ko)) {
  if (!keysByKo.has(val)) keysByKo.set(val, []);
  keysByKo.get(val).push(key);
}
const header = rows[0].map(String);
const KO = header.indexOf('한국어'), TR = header.indexOf('태국어');
const entries = [];
let filled = 0, missing = [];
for (const r of rows.slice(1)) {
  const koVal = String(r[KO] ?? ''), trVal = String(r[TR] ?? '').trim();
  if (!koVal) continue;
  const keys = keysByKo.get(koVal);
  if (!keys) { console.warn('⚠ 한국어 원문이 ko.ts와 다름 (건너뜀): ' + koVal); continue; }
  if (!trVal) { missing.push(koVal); continue; }
  for (const ph of koVal.match(/\{\w+\}/g) || []) if (!trVal.includes(ph)) console.warn('⚠ 자리표시자 ' + ph + ' 누락: ' + trVal);
  for (const k of keys) entries.push([k, trVal]);
  filled++;
}
const dict = unflatten(ko, entries);
dict.lang = lang;
if (lang === 'th') {
  dict.fontBody = "'Noto Sans Thai', 'Leelawadee UI', Tahoma, sans-serif";
  dict.canvasFont = '"Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif';
  dict.numUnits = [[1e6, 'M'], [1e3, 'K']];
}

const body = JSON.stringify(dict, null, 2)
  .replace(/^(\s*)"(\w+)":/gm, '$1$2:') // 키 따옴표 제거 (값 안의 따옴표는 그대로 — JSON 문자열은 그대로 TS 문자열이다)
  .replace(/numUnits: \[[\s\S]*?\]\s*\]/, m => m.replace(/\s+/g, ' ').replace(/\[ \[/, '[[').replace(/\] \]/, ']]') + ' as [number, string][]');

const out = path.join(I18N_DIR, `${lang}.ts`);
fs.writeFileSync(out, `/**
 * ${lang} — scripts/i18n-import.cjs 가 ${path.basename(file)} 에서 생성. 직접 고치지 말고 엑셀을 고쳐 다시 만들 것.
 * 비어 있던 항목은 한국어가 그대로 들어가 있다.
 */
import type { Dict } from './ko';

export const ${lang}: Dict = ${body};
`);
console.log(`${filled} translated, ${missing.length} left in Korean → ${out}`);
if (missing.length) console.log('  미번역: ' + missing.join(', '));
