/**
 * 오프라인 캐시 — 행사장 와이파이가 끊겨도 부스 PC에서 게임이 계속 돌아가도록.
 * 한 번 로드되면 모든 정적 자원이 캐시되고, 이후에는 네트워크 없이도 실행된다.
 */
const CACHE = 'kfood-arcade-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  // 페이지 이동은 네트워크 우선 (배포된 새 버전을 바로 받도록), 실패 시 캐시된 셸로 폴백
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then(hit => hit || caches.match(req))),
    );
    return;
  }

  // 그 외 정적 자원은 캐시 우선 (파일명에 해시가 붙어 있어 안전)
  event.respondWith(
    caches.match(req).then(
      hit =>
        hit ||
        fetch(req).then(res => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
