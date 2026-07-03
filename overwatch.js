/**
 * Overwatch bookmarklet loader
 * Haritada değilse yönlendirir, jscolor + uygulamayı yükler.
 */
(function () {
    'use strict';

    if (typeof game_data === 'undefined') {
        alert('Overwatch: Tribal Wars oyun sayfasında çalıştırın.');
        return;
    }

    if (window.location.href.indexOf('screen=map') < 0) {
        window.location.assign(game_data.link_base_pure + 'map');
        return;
    }

    if (window.__OVERWATCH_LOADED__) {
        console.log('Overwatch zaten yüklü.');
        return;
    }
    window.__OVERWATCH_LOADED__ = true;

    var BASE = 'https://safayolcuu.github.io/twoverwatch.github.io/';

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error('Script yüklenemedi: ' + src)); };
            (document.head || document.body).appendChild(s);
        });
    }

    Promise.resolve()
        .then(function () {
            if (window.jscolor) return;
            return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jscolor/2.5.2/jscolor.min.js');
        })
        .then(function () {
            return loadScript(BASE + 'overwatch-app.js?v=' + Date.now());
        })
        .catch(function (e) {
            console.error(e);
            alert('Overwatch yüklenemedi: ' + e.message);
            window.__OVERWATCH_LOADED__ = false;
        });
})();
