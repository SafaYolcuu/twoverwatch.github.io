# Overwatch Bookmarklet

Tribal Wars kabile savunma haritası overlay scripti.

## Kurulum

1. GitHub Pages: Repo → Settings → Pages → Source: `main` branch
2. [index.html](https://safayolcuu.github.io/twoverwatch.github.io/) sayfasındaki **Overwatch** düğmesini yer imlerine sürükle
3. Haritada bookmarklet'e tıkla

## Bookmarklet

```
javascript:void((function(){try{sessionStorage.setItem('overwatch_autostart','1');window.__OVERWATCH_BOOT_NOW__=1;var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/SafaYolcuu/twoverwatch.github.io@main/overwatch.js?'+Date.now();s.onerror=function(){alert('Overwatch scripti indirilemedi.');};(document.head||document.body).appendChild(s);}catch(e){alert('Bookmarklet hatasi: '+e);}})())
```

GitHub Pages **Custom domain** alanına bir şey yazma; varsayılan URL yeterli.
