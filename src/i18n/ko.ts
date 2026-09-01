/**
 * 화면에 보이는 모든 문자열 — 한국어.
 *
 * 다른 언어는 이 파일과 같은 키 구조로 (예: th.ts) 만들고 index.ts에서 바꿔 끼운다.
 * `{이름}` 자리표시자는 코드가 값으로 채운다 — 번역할 때 그대로 남겨 둘 것.
 * `**굵게**` 는 홈 화면 소개문에서 강조색으로 렌더된다.
 */
export const ko = {
  /** <html lang> */
  lang: 'ko',
  /** 본문 CSS 폰트 스택 */
  fontBody: "'Pretendard', 'Noto Sans Thai', 'Malgun Gothic', 'Noto Sans KR', sans-serif",
  /** 캔버스 글자 폰트 (크기 뒤에 붙는다) */
  canvasFont: 'Pretendard, "Noto Sans Thai", "Malgun Gothic", sans-serif',
  /** 큰 숫자 줄임 단위 — [기준값, 접미사] 큰 것부터. 태국어는 [[1e6,'M'],[1e3,'K']] 처럼 바꿔도 된다 */
  numUnits: [[1e8, '억'], [1e4, '만'], [1e3, '천']] as [number, string][],

  meta: {
    title: 'K-FOOD 게임천국',
    description: 'K-Food 박람회 PC방 부스 아케이드 — 점수로 등급 받고 음식 포인트 교환',
  },

  common: {
    mute: '음소거',
    top10: '{game} TOP 10',
    noRecords: '아직 기록이 없습니다',
    /** 게임 화면 하단 안내 */
    shellNote: '게임 종료 시 등급이 화면에 표시됩니다 · 직원에게 보여주고 포인트를 받으세요',
    best: '최고 {n}점',
    next: '다음',
  },

  /** 등급 문구 — S는 게임마다 다르고 A~D는 공통 */
  grade: {
    A: '대단해요!',
    B: '잘했어요!',
    C: '좋아요!',
    D: '다시 도전!',
  },

  /** 음식 이름 */
  foods: {
    coinbread: '10원빵',
    gimbap: '김밥',
    kimchi: '김치',
    tteokbokki: '떡뽁이',
    ramyeon: '라면',
    mandu: '만두',
    buldak: '불닭',
    sotteok: '소떡소떡',
    chicken: '양념치킨',
    cupteok: '컵떡볶이',
    cupramyeon: '컵라면',
    hotdog: '핫도그',
  },

  home: {
    badge: 'NOW OPEN · PC방 부스',
    title: 'K-FOOD 게임천국',
    intro1: '게임에서 점수를 올리고 **등급**을 받아',
    intro2: '부스에서 **음식 포인트**로 교환하세요',
    plays: '오늘 플레이 {n}회',
    reset: '기록 전체 초기화 (운영자용)',
    resetConfirm: '모든 게임 기록을 삭제할까요? (되돌릴 수 없음)',
    /** 홈 맨 아래 말풍선 */
    bubble: '즐겁게 게임하고 맛있는 K-푸드 받아가세요!',
  },

  /* ───────── 벡터 스트라이크 ───────── */
  shooter: {
    title: '벡터 스트라이크',
    tagline: '탄막을 뚫고 보스를 격파하라',
    bullets: [
      'P 아이템으로 무기 Lv.5까지 강화',
      '15웨이브 + 최종보스 3단 페이즈',
      '클리어 보너스로 S등급 도전',
    ],
    controls: 'MOUSE / 자동 사격',
    hintMouse: '이동 (사격 자동)',
    hintKeys: '키보드 이동',
    gradeS: '에이스 파일럿!',
    intro1: '마우스 또는 방향키로 이동 · 공격은 자동',
    intro2: 'P 아이템: 무기 강화 (최대 Lv.5) · 피격 시 1단계 하락!',
    intro3: '웨이브 {n}의 최종보스를 격파하면 클리어!',
    start: '클릭 또는 스페이스바로 시작',
    restart: '클릭 또는 스페이스바로 재시작',
    sound: 'M: 소리',
  },

  /* ───────── K-푸드 타워 ───────── */
  tower: {
    title: 'K-푸드 타워',
    tagline: '무게중심을 지배하라',
    bullets: [
      '실제 물리 엔진 — 중력만 작용합니다',
      '혼자 점수 도전 · 둘이서 번갈아 대전',
    ],
    hintMove: '이동',
    hintRotate: '회전',
    hintDrop: '놓기',
    hintCom: '무게중심 보기',
    gradeS: '전설의 요리사!',
    intro1: '접시 위에 음식을 쌓아 올리세요. 떨어뜨리면 끝입니다.',
    intro2: '중력만 작용합니다 — 무게중심을 지지점 위에 올리는 게 전부입니다',
    soloTitle: '혼자',
    soloSub: '무너질 때까지 쌓기',
    soloNote: '점수 · 등급이 나옵니다',
    duoTitle: '둘이',
    duoSub: '번갈아 쌓기',
    duoNote: '먼저 떨어뜨린 쪽이 패배',
    start: '숫자키 또는 화면을 눌러 시작',
    placed: '쌓은 개수 {n}',
    turn: '{p}P 차례',
    placedTotal: '총 {n}개 쌓임',
    btnRotate: '↻ 회전',
    btnDrop: '↓ 놓기',
    keys: '←→ 이동 · ↑↓ 회전 · SPACE 놓기 · G 무게중심 · R 메뉴 · M 소리',
    stable: 'τ ≈ 0  안정',
    unstable: 'τ ≠ 0  넘어간다',
    height: '높이 {n}',
    overSolo: '{n}개 쌓음 · 최고 {best}점',
    win: '{p}P 승리!',
    dropped: '{p}P가 떨어뜨렸습니다',
    overDuo: '둘이서 {n}개까지 쌓았습니다',
    restart: '화면을 누르거나 SPACE — 다시',
    /** 음식별 성격 설명 */
    foodDesc: {
      ramyeon: '냄비 바닥이 평평 — 최고의 받침',
      tteokbokki: '넓은 그릇 — 안정적인 받침',
      kimchi: '납작한 접시 — 아래를 받치기 좋다',
      mandu: '밑면이 평평해 잘 쌓인다',
      gimbap: '가장 길다 — 걸쳐서 다리를 놓아라',
      buldak: '봉지라 미끄럽다',
      cupramyeon: '컵 — 세워 두면 훌륭한 기둥',
      cupteok: '컵 — 위가 넓어 살짝 불안하다',
      chicken: '무겁고 비대칭 — 아래를 짓누른다',
      coinbread: '동그래서 잘 굴러간다 — 최악',
      sotteok: '길쭉한 꼬치 — 걸치기 좋다',
      hotdog: '가장 얇다 — 위에 뭘 올리기 어렵다',
    },
  },

  /* ───────── K-푸드 합치기 ───────── */
  merge: {
    title: 'K-푸드 합치기',
    tagline: '같은 음식을 붙여 진화시켜라',
    bullets: [
      '같은 음식끼리 닿으면 다음 단계로 진화',
      '10원빵부터 떡뽁이 한 그릇까지 12단계',
      '상자가 넘치면 끝 — 제한시간은 없습니다',
    ],
    hintAim: '조준',
    hintDrop: '놓기',
    gradeS: '한 상 차렸다!',
    evolution: '진화 순서',
    keys: '마우스/←→ 조준 · 클릭·SPACE 놓기 · R 처음으로 · M 소리',
    intro1: '같은 음식끼리 닿으면 합쳐져서 다음 단계로 진화합니다',
    intro2: '상자 밖으로 넘치면 끝 · 제한시간은 없습니다',
    chain: '10원빵 → 만두 → 김밥 → 소떡소떡 → 핫도그 → … → 떡뽁이',
    intro3: '떨어지는 음식은 앞 5단계에서만 나옵니다',
    intro4: '큰 음식은 오직 합쳐서만 만들 수 있습니다',
    start: '클릭하거나 스페이스바를 눌러 시작',
    over: '최고 단계 {name} · {n}번 합침',
    restart: '클릭하거나 스페이스바로 다시',
  },

  /* ───────── K-푸드 사격 ───────── */
  arrow: {
    title: 'K-푸드 사격',
    tagline: '젓가락을 불려 쓸어담아라',
    bullets: [
      '좌우로만 움직이면 발사는 자동',
      '내려오는 아이템을 골라 화력을 키움',
      '못 죽인 적이 내려오면 체력이 깎임',
    ],
    hintMove: '좌우 이동',
    hintAuto: '발사는 자동',
    gradeS: '전설의 사수!',
    boss: '보스 등장!',
    shieldPop: '보호막!',
    shield: '보호막 {n}',
    power: '화력 {n}',
    stats: '젓가락 {n} · 공격 x{mul} · 연사 {rate} · 관통 {pierce}',
    burst: '공격 ×{n}  {t}s',
    baseline: '기본 공격력 대비 {n}%',
    wave: '구간 {n}',
    keys: '마우스/←→ 좌우 · 발사는 자동 · R 처음으로 · M 소리',
    intro1: '좌우로만 움직이세요. 발사는 알아서 합니다',
    me: '나 (요리사)',
    enemy: '악당',
    intro2: '길에 떠내려오는 K-푸드를 몸으로 주우면',
    intro3: '불닭 ×3 · 김치 ×10 · 김밥 +3 …',
    intro4: '그만큼 세집니다',
    intro5: '못 죽인 악당이 내 앞까지 오면 체력이 깎입니다',
    intro6: '체력이 0이 되면 끝 · 5구간마다 보스',
    start: '클릭하거나 스페이스바를 눌러 시작',
    over: '{wave}구간 · {kills}명 처치 · 아이템 {picked}개',
    finalPower: '최종 화력 {n}',
    finalStats: '젓가락 {n} · 공격 x{mul} · 관통 {pierce}',
    restart: '클릭하거나 스페이스바로 다시',
    /** 아이템 위 글자 — tag는 크게, what은 작게 */
    items: {
      n3: { tag: '+2', what: '젓가락' },
      n6: { tag: '+4', what: '젓가락' },
      nx2: { tag: '×1.5', what: '젓가락' },
      dx2: { tag: '+30%', what: '공격력' },
      rate: { tag: '+20%', what: '연사' },
      pierce: { tag: '관통', what: '+1' },
      hp: { tag: '+40', what: '최대 체력' },
      heal: { tag: '회복', what: '체력 절반' },
      dx3: { tag: '×3', what: '7초 공격력' },
      dx10: { tag: '×10', what: '7초 공격력' },
    },
  },
};

export type Dict = typeof ko;
