/** i18n 스크립트 공용 — 사전 로드 · 평탄화 · 구역 이름 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'src', 'i18n');

/** 엑셀의 "구역" 열 — 사전 최상위 키 → 사람이 읽는 이름 */
const SECTIONS = {
  lang: '설정',
  fontBody: '설정',
  canvasFont: '설정',
  numUnits: '설정',
  meta: '공통 · 브라우저 탭',
  common: '공통',
  grade: '공통 · 등급 문구',
  foods: '공통 · 음식 이름',
  home: '홈 화면',
  shooter: '벡터 스트라이크',
  tower: 'K-푸드 타워',
  merge: 'K-푸드 합치기',
  arrow: 'K-푸드 사격',
};

/** 키별 비고 — 번역자가 알아야 할 맥락 */
const NOTES = {
  'lang': '<html lang> 값. 태국어는 th',
  'fontBody': 'CSS 폰트 스택. 태국어는 예: \'Leelawadee UI\', \'Noto Sans Thai\', Tahoma, sans-serif',
  'canvasFont': '게임 화면(캔버스) 폰트. 태국어는 예: "Leelawadee UI", "Noto Sans Thai", sans-serif',
  'numUnits': '큰 숫자 줄임 단위 (JSON). 태국어는 [[1000000,"M"],[1000,"K"]] 처럼',
  'meta.title': '브라우저 탭 제목',
  'meta.description': '검색엔진 설명 (화면에는 안 보임)',
  'common.top10': '{game}에 게임 이름이 들어감',
  'common.shellNote': '게임 화면 맨 아래 작은 안내',
  'common.best': '{n}=최고 점수',
  'common.next': '다음에 떨어질 음식 표시 라벨',
  'grade.A': '점수 등급 A~D 공통 문구. S는 게임마다 다름',
  'home.badge': '상단 작은 배지',
  'home.intro1': '**등급**은 금색 강조',
  'home.intro2': '**음식 포인트**는 청록색 강조',
  'home.plays': '{n}=오늘 플레이 횟수',
  'home.reset': '운영자용 버튼',
  'home.resetConfirm': '버튼 눌렀을 때 확인창',
  'shooter.controls': '카드 하단 조작 요약 (영문 키 이름은 그대로 두는 게 좋음)',
  'shooter.intro3': '{n}=마지막 웨이브 번호',
  'shooter.sound': "뒤에 ON/OFF 가 붙음",
  'tower.foodList': '{n}=음식 종류 수',
  'tower.placed': '{n}=쌓은 개수',
  'tower.turn': '{p}=1 또는 2 (플레이어 번호)',
  'tower.placedTotal': '{n}=쌓은 개수',
  'tower.stable': 'τ(토크) 기호는 그대로. 무게중심이 안정할 때',
  'tower.unstable': '무게중심이 벗어나 넘어갈 때',
  'tower.height': '{n}=탑 높이(px)',
  'tower.overSolo': '{n}=쌓은 개수, {best}=최고 점수',
  'tower.win': '{p}=이긴 플레이어 번호',
  'tower.dropped': '{p}=떨어뜨린 플레이어 번호',
  'tower.overDuo': '{n}=쌓은 개수',
  'tower.keys': '하단 키 안내. 키 이름(SPACE, G, R, M)은 그대로',
  'merge.keys': '하단 키 안내. 키 이름은 그대로',
  'merge.over': '{name}=음식 이름, {n}=합친 횟수',
  'merge.chain': '음식 이름은 "음식 이름" 구역 번역과 맞출 것',
  'arrow.keys': '하단 키 안내. 키 이름은 그대로',
  'arrow.shield': '{n}=남은 보호막 수',
  'arrow.power': '{n}=화력 수치',
  'arrow.stats': '{n}=젓가락 수, {mul}=공격 배수, {rate}=연사, {pierce}=관통',
  'arrow.burst': '{n}=배수, {t}=남은 초',
  'arrow.baseline': '{n}=퍼센트',
  'arrow.wave': '{n}=구간 번호',
  'arrow.over': '{wave}=구간, {kills}=처치 수, {picked}=아이템 수',
  'arrow.finalPower': '{n}=화력',
  'arrow.finalStats': '{n}=젓가락, {mul}=배수, {pierce}=관통',
  'arrow.intro3': '음식 이름은 "음식 이름" 구역 번역과 맞출 것',
  'arrow.me': '튜토리얼 그림 아래 라벨',
  'arrow.enemy': '튜토리얼 그림 아래 라벨',
};
const NOTE_PREFIX = {
  'arrow.items.': '아이템 위 글자 — tag는 크게(짧게!), what은 작게',
  'tower.foodDesc.': '타워에서 음식 고를 때 한 줄 설명',
  'foods.': '음식 이름 — 모든 게임 공통',
  '.bullets.': '홈 카드의 한 줄 설명 (3줄)',
  '.tagline': '홈 카드 부제',
  '.title': '게임 이름 — 홈 카드·게임 화면·순위표 공통',
  '.gradeS': 'S 등급 문구 (이 게임 전용)',
  '.hint': '게임 화면 상단 키 힌트 (짧게)',
  '.start': '시작 화면 맨 아래 안내',
  '.restart': '결과 화면 맨 아래 안내',
  '.intro': '시작 화면 설명',
  '.btn': '화면 터치 버튼 라벨 (짧게)',
};

function noteFor(key) {
  if (NOTES[key]) return NOTES[key];
  for (const [p, n] of Object.entries(NOTE_PREFIX)) if (key.includes(p)) return n;
  return '';
}

/** ko.ts / th.ts 를 Node에서 읽는다 — 타입 주석만 걷어내면 그대로 JS다 */
function loadDict(lang) {
  const file = path.join(I18N_DIR, `${lang}.ts`);
  let src = fs.readFileSync(file, 'utf8');
  src = src
    .replace(/^import .*$/gm, '')
    .replace(/^export type .*$/gm, '')
    .replace(/ as \[number, string\]\[\]/g, '')
    .replace(/: Dict\b/g, '')
    .replace(/export const (\w+)/, 'const $1')
    .replace(/export \{[^}]*\};?/g, '');
  const m = /const (\w+) =/.exec(src);
  const fn = new Function(src + `\nreturn ${m[1]};`);
  return fn();
}

/** 중첩 사전 → [키경로, 값, 비고][] */
function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (k === 'numUnits') out.push([key, JSON.stringify(v), noteFor(key)]);
    else if (Array.isArray(v)) v.forEach((s, i) => out.push([`${key}.${i}`, s, noteFor(`${key}.${i}`)]));
    else if (v && typeof v === 'object') flatten(v, key, out);
    else out.push([key, v, noteFor(key)]);
  }
  return out;
}

/** 평탄 키 → 값 을 사전 구조(ko와 동일)에 되돌린다 */
function unflatten(base, entries) {
  const out = JSON.parse(JSON.stringify(base));
  for (const [key, val] of entries) {
    if (val == null || String(val).trim() === '') continue;
    const parts = key.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    const last = parts[parts.length - 1];
    if (key === 'numUnits') cur[last] = JSON.parse(val);
    else if (Array.isArray(cur)) cur[Number(last)] = String(val);
    else cur[last] = String(val);
  }
  return out;
}

module.exports = { I18N_DIR, SECTIONS, loadDict, flatten, unflatten };
