/**
 * 고정 배경 — 아이보리 바탕 위에 픽셀 구름·반짝이, 맨 아래 방콕/서울 스카이라인과 풀밭.
 *
 * 그림은 전부 public/deco 의 픽셀아트 PNG (시안 2안). 움직이는 건 구름(아주 느림)과 반짝이뿐.
 * 좁은 화면(<1100px)에서는 스카이라인·장식을 숨긴다 — 카드와 겹치면 안 되므로.
 */

const CLOUDS: [string, string, string, number, boolean][] = [
  // src, left, top, width, slow
  ['/deco/cloud-1.png', '4%', '7%', 150, true],
  ['/deco/cloud-2.png', '38%', '3%', 120, false],
  ['/deco/cloud-3.png', '72%', '10%', 170, true],
  ['/deco/cloud-4.png', '88%', '30%', 90, false],
];

const STARS: [string, string, string, number, number][] = [
  // src, left, top, size, delay
  ['/deco/star-yellow.png', '7%', '22%', 22, 0],
  ['/deco/star-purple.png', '14%', '58%', 18, 0.7],
  ['/deco/star-green.png', '24%', '34%', 16, 1.3],
  ['/deco/star-pink.png', '78%', '20%', 20, 0.4],
  ['/deco/star-yellow.png', '90%', '52%', 16, 1.1],
  ['/deco/star-purple.png', '93%', '72%', 22, 1.8],
  ['/deco/star-green.png', '68%', '78%', 16, 0.9],
  ['/deco/star-pink.png', '30%', '80%', 18, 1.6],
];

export default function Background() {
  return (
    <div className="bg-layer">
      {CLOUDS.map(([src, left, top, width, slow], i) => (
        <img key={i} src={src} alt="" className={`bg-cloud pixel${slow ? ' slow' : ''}`}
          style={{ left, top, width, animationDelay: `${-i * 11}s` }} />
      ))}
      {STARS.map(([src, left, top, size, delay], i) => (
        <img key={i} src={src} alt="" className="bg-star pixel"
          style={{ left, top, width: size, animationDelay: `${delay}s` }} />
      ))}
      <img src="/deco/skyline-bangkok.png" alt="" className="bg-skyline pixel deco-wide" style={{ left: 0 }} />
      <img src="/deco/skyline-seoul.png" alt="" className="bg-skyline pixel deco-wide" style={{ right: 0 }} />
      <div className="bg-ground" />
    </div>
  );
}
