# Overwatch Bookmarklet

Tribal Wars kabile savunma haritası overlay scripti.

## Kurulum

1. GitHub Pages: Repo → Settings → Pages → Source: `main` branch
2. [index.html](https://safayolcuu.github.io/twoverwatch.github.io/) sayfasındaki **Overwatch** düğmesini yer imlerine sürükle
3. Haritada bookmarklet'e tıkla

## Bookmarklet

```
javascript:(function(){if(typeof game_data==='undefined'){alert('Overwatch: TW oyun sayfasında çalıştırın.');return;}if(location.href.indexOf('screen=map')<0){location.assign(game_data.link_base_pure+'map');return;}if(window.__OVERWATCH_LOADED__){alert('Overwatch zaten yüklü.');return;}window.__OVERWATCH_LOADED__=true;var s=document.createElement('script');s.src='https://safayolcuu.github.io/twoverwatch.github.io/overwatch.js?'+Date.now();document.head.appendChild(s);})();
```
