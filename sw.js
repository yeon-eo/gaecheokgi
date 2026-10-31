// 개척기 서비스 워커 — 앱처럼 설치하고, 인터넷이 약해도 화면을 띄운다.
const VERSION = '20261031234353';
const SHELL = 'gc-shell-' + VERSION;
const LIBS = 'gc-libs-v1';
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './firebase-config.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('gc-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 게임 화면(HTML)·설정: 새 버전을 먼저 받아 보고, 안 되면 보관본
  if (url.origin === location.origin){
    if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.endsWith('firebase-config.js')){
      e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
      return;
    }
    e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(r => { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)); return r; }).catch(() => hit); return hit || net; }));
    return;
  }
  // 파이어베이스 라이브러리·글꼴: 한 번 받으면 보관본 사용
  if (/gstatic\.com\/firebasejs|cdnjs\.cloudflare\.com\/ajax\/libs\/firebase|fonts\.(googleapis|gstatic)\.com/.test(req.url)){
    e.respondWith(caches.open(LIBS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }))));
  }
  // 그 밖(게임 데이터 서버, 유튜브 등)은 그대로 통과
});

// ---- 푸시 알림: 앱이 꺼져 있어도 서버(GitHub Actions)가 보낸 알림을 띄운다 ----
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch(x){ p = {data:{title:'개척기', body: e.data ? e.data.text() : ''}}; }
  const d = p.data || p.notification || p;
  const title = d.title || '개척기';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined, renotify: !!d.tag,
    data: {tab: d.tab || 'home'},
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab) || 'home';
  const url = new URL('./?tab=' + tab, self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const c of all){ if (c.url.startsWith(self.registration.scope)){ await c.focus(); return; } }
    await self.clients.openWindow(url);
  })());
});
