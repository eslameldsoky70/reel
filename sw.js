var CACHE_NAME = "islam-reels-v1";

self.addEventListener("install", function (e) {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", function (e) {
  /* لا تخزين مؤقت — مرور مباشر */
});

/* ────────── Push Notifications ────────── */
self.addEventListener("push", function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {}

  var title = data.title || "Islam Reels 🌙";
  var options = {
    body: data.body || "تعال استمع للقرآن الكريم",
    icon: data.icon || "./icons/icon-192.png",
    badge: data.badge || "./icons/icon-192.png",
    dir: "rtl",
    lang: "ar",
    data: { url: data.url || self.registration.scope },
    vibrate: [200, 100, 200],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var targetUrl = (e.notification.data && e.notification.data.url) || "/islam-reels/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes("/islam-reels")) {
          return list[i].focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
