/**
 * Overwatch bookmarklet loader v2
 * - Haritaya yönlendirirken otomatik devam (sessionStorage)
 * - Anında yükleme bildirimi
 * - CDN engellenirse fetch + inline script yedegi
 */
(function () {
    'use strict';

    var BASES = [
        'https://cdn.jsdelivr.net/gh/SafaYolcuu/twoverwatch.github.io@main/',
        'https://raw.githubusercontent.com/SafaYolcuu/twoverwatch.github.io/main/',
        'https://safayolcuu.github.io/twoverwatch.github.io/'
    ];

    function isMapScreen() {
        if (typeof game_data !== 'undefined' && game_data.screen === 'map') return true;
        return /[?&]screen=map(?:&|$)/.test(window.location.href);
    }

    function mapUrl() {
        if (typeof game_data !== 'undefined' && game_data.village && game_data.village.id) {
            return '/game.php?village=' + game_data.village.id + '&screen=map';
        }
        return '/game.php?screen=map';
    }

    function showBanner(msg, isError) {
        var id = 'overwatch_boot_banner';
        var el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:14px;text-align:center;font:bold 14px sans-serif;color:#000;background:#f4e4bc;border-bottom:2px solid #7d510f;';
            (document.body || document.documentElement).appendChild(el);
        }
        el.style.background = isError ? '#ffb3b3' : '#f4e4bc';
        el.textContent = msg;
    }

    function hideBanner() {
        var el = document.getElementById('overwatch_boot_banner');
        if (el) el.remove();
    }

    function loadExternal(url) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = url;
            s.onload = function () { resolve('script'); };
            s.onerror = function () { reject(new Error('script tag: ' + url)); };
            (document.head || document.body).appendChild(s);
        });
    }

    function loadInline(url) {
        return fetch(url, { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
                return r.text();
            })
            .then(function (code) {
                var s = document.createElement('script');
                s.textContent = code;
                (document.head || document.body).appendChild(s);
            });
    }

    function loadWithFallback(path) {
        var urls = BASES.map(function (b) { return b + path; });
        var i = 0;

        function tryNext(err) {
            if (i >= urls.length) return Promise.reject(err || new Error('Tüm kaynaklar başarısız: ' + path));
            var url = urls[i++] + (path.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
            return loadExternal(url).catch(function () {
                return loadInline(url);
            }).catch(function (e) {
                return tryNext(e);
            });
        }

        return tryNext();
    }

    function boot() {
        if (typeof game_data === 'undefined') {
            alert('Overwatch: Tribal Wars oyun sayfasında çalıştırın.\n(klanlar.org / tribalwars üzerinde olmalısın)');
            return;
        }

        if (!isMapScreen()) {
            sessionStorage.setItem('overwatch_autostart', '1');
            showBanner('Overwatch: Haritaya yönlendiriliyor...');
            window.location.assign(mapUrl());
            return;
        }

        if (window.__OVERWATCH_RUNNING__) {
            showBanner('Overwatch zaten çalışıyor veya yükleniyor.');
            return;
        }
        window.__OVERWATCH_RUNNING__ = true;
        sessionStorage.removeItem('overwatch_autostart');
        showBanner('Overwatch yükleniyor... Lütfen bekleyin.');

        var chain = Promise.resolve();

        if (!window.jscolor) {
            chain = chain.then(function () {
                return loadExternal('https://cdnjs.cloudflare.com/ajax/libs/jscolor/2.5.2/jscolor.js')
                    .catch(function () {
                        return loadInline('https://cdn.jsdelivr.net/npm/jscolor@2.5.2/jscolor.js');
                    })
                    .catch(function () {
                        console.warn('jscolor yüklenemedi, renk seçici olmadan devam ediliyor.');
                    });
            });
        }

        chain
            .then(function () {
                return loadWithFallback('overwatch-app.js');
            })
            .then(function () {
                hideBanner();
            })
            .catch(function (e) {
                console.error(e);
                window.__OVERWATCH_RUNNING__ = false;
                showBanner('Overwatch HATA: ' + e.message, true);
                alert('Overwatch yüklenemedi:\n' + e.message + '\n\nF12 → Console sekmesine bak.');
            });
    }

    // Bookmarklet veya harita yönlendirmesi sonrası otomatik başlat
    if (sessionStorage.getItem('overwatch_autostart') === '1' || window.__OVERWATCH_BOOT_NOW__) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            setTimeout(boot, 300);
        }
    } else {
        boot();
    }
})();
