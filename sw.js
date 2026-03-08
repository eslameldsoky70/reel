/* ══════════════════════════════════════════════════════════════
   Islam Reels — Service Worker
   استراتيجية: Cache-First للملفات الثقيلة، Network-First للـ API
   ══════════════════════════════════════════════════════════════ */

/* ── Cache version — غيّر الرقم عند كل تحديث للموقع ───────────
   islamreels-v1 → islamreels-v2 → islamreels-v3 ...
   المتصفح سيحذف الكاش القديم تلقائياً في activate       */
const CACHE_NAME = 'islamreels-v1';

/* ملفات تُحفظ فور تثبيت الـ SW (يجب أن تكون موجودة على السيرفر) */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/libs/mp4-muxer.js',
  '/libs/ffmpeg/index.js',
  '/libs/ffmpeg/util.js',
  '/libs/ffmpeg-core.js',
  '/libs/ffmpeg-core.wasm',
];

/* ══ INSTALL — تحميل الملفات الأساسية مسبقاً ═══════════════════ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      /* نحاول precache كل ملف بشكل مستقل — فشل ملف واحد لا يوقف الباقي */
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] precache failed for', url, err.message)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ══ ACTIVATE — حذف cache القديم ══════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ══ FETCH — استراتيجيات التخزين حسب نوع الطلب ════════════════ */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* تجاهل non-GET والـ chrome-extension */
  if (event.request.method !== 'GET') return;
  if (!['http:', 'https:'].includes(url.protocol)) return;

  /* ── 1. ملفات WASM و JS الثقيلة: Cache-First ─────────────────
     بعد أول تحميل تُخدَم من الـ cache مباشرة (بدون شبكة)       */
  if (
    url.pathname.endsWith('.wasm') ||
    url.pathname.startsWith('/libs/') ||
    url.pathname.includes('ffmpeg') ||
    url.pathname.includes('mp4-muxer')
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  /* ── 2. الخطوط من Google: Cache-First ────────────────────────*/
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  /* ── 3. ملفات التطبيق الأساسية: Network-First مع Cache fallback */
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  /* ── 4. APIs القرآن والصوت: Network-Only (بيانات متغيرة) ──────*/
  if (
    url.hostname.includes('alquran') ||
    url.hostname.includes('qurancdn') ||
    url.hostname.includes('everyayah') ||
    url.hostname.includes('islamic.network') ||
    url.hostname.includes('verses.quran.com')
  ) {
    /* Network-Only مع graceful failure */
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  /* ── 5. كل الباقي: Stale-While-Revalidate ───────────────────*/
  event.respondWith(staleWhileRevalidate(event.request));
});

/* ══ استراتيجيات Cache ════════════════════════════════════════ */

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst fetch failed:', request.url);
    throw err;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('offline and no cache for: ' + request.url);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await fetchPromise;
}
