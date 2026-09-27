// Service worker for 植物志 PlantLog
// 参照食法典（FoodCode）sw.js 已验证有效的方案：network-first + skipWaiting/clients.claim。
// 植物志之前完全没有 Service Worker，纯靠浏览器自身的 HTTP 缓存——这在"添加到主屏幕"的
// 独立展示模式下特别容易出问题：没有地址栏、没有下拉刷新，如果托管方（比如 GitHub Pages）
// 给 index.html 设置了默认的 Cache-Control，浏览器可能会在完全不发起真实网络请求的情况下，
// 直接从本地磁盘缓存返回旧版本——这正是"明明部署了新代码，主屏图标却打开还是旧版本"的根因。
//
// 这个 Service Worker 的作用：
// 1. network-first：只要设备在线，每次都优先从服务器拿最新的 index.html，缓存只在离线时兜底用，
//    不是"够用就不折腾"的抄近路
// 2. {cache:'no-store'} 让这次 fetch 彻底绕开浏览器自己的 HTTP 缓存层，不给它"悄悄用本地磁盘缓存
//    应付过去"的机会——这是根治问题的关键一步，光靠 Service Worker 自己的缓存逻辑正确还不够
// 3. skipWaiting + clients.claim：新版本一装上就立刻接管页面，不用等所有标签页/主屏实例全部关掉
var CACHE_NAME = 'plantlog-shell-v1';
var APP_SHELL = [
  './',
  './index.html'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(APP_SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  var url = new URL(req.url);

  // 只处理同源GET请求，其它一律放行（比如以后接的AI Worker请求、POST等）
  if(req.method !== 'GET' || url.origin !== self.location.origin){
    return;
  }

  event.respondWith(
    fetch(req, {cache:'no-store'}).then(function(res){
      if(res && res.status === 200){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(req); // 离线时兜底返回上次缓存的版本；如果压根没缓存过，会走浏览器默认的离线报错
    })
  );
});
