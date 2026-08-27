/**
 * 고정 배경 — 조용한 어두운 바탕.
 *
 * 원래는 색색 빛망울 3개 + 흐르는 네온 그리드 + 스캔라인이 깔려 있었는데,
 * 게임 캔버스 뒤에서 계속 움직여 눈이 아프다는 피드백을 받아 전부 걷어냈다.
 * 배경은 게임을 받쳐주기만 하면 된다.
 */
export default function Background() {
  return <div className="bg-layer" />;
}
