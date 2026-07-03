/**
 * Overwatch teşhis aracı
 * Kabile → Üyeler → Savunma sayfasında (bir oyuncu seçili) F12 Console'a yapıştır:
 *
 *   var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/SafaYolcuu/twoverwatch.github.io@main/diagnose.js?'+Date.now();document.head.appendChild(s);
 */
(function () {
    'use strict';

    if (typeof jQuery === 'undefined') {
        alert('jQuery yok — TW oyun sayfasında çalıştır.');
        return;
    }

    var $tables = jQuery('#ally_content table, .table-responsive table, table.vis');
    if (!$tables.length) {
        alert('Savunma tablosu bulunamadı.\nKabile → Üyeler → Savunma sayfasında, bir oyuncu seçili olmalı.');
        return;
    }

    var units = (typeof game_data !== 'undefined' && game_data.units) ? game_data.units : [];

    function readCell(cell) {
        if (!cell) return 0;
        var dc = jQuery(cell).attr('data-count') || jQuery(cell).find('[data-count]').first().attr('data-count');
        if (dc) return parseInt(String(dc).replace(/[^\d]/g, ''), 10) || 0;
        return parseInt(String(jQuery(cell).text()).replace(/[^\d]/g, ''), 10) || 0;
    }

    var report = {
        url: location.href,
        units: units,
        tables: []
    };

    $tables.each(function (ti) {
        var $t = jQuery(this);
        var entry = {
            index: ti,
            unitImgCount: $t.find('img[src*="unit_"]').length,
            coordCount: ($t.text().match(/\d{3}\|\d{3}/g) || []).length,
            header: [],
            sampleVillageRow: null,
            sampleEnrouteRow: null
        };

        $t.find('tr').each(function () {
            var unitHits = 0;
            jQuery(this).find('th, td').each(function () {
                var html = jQuery(this).html() || '';
                units.forEach(function (u) {
                    if (html.indexOf('unit_' + u) >= 0 || html.indexOf('data-unit="' + u + '"') >= 0) unitHits++;
                });
            });
            if (unitHits >= 3 && !entry.header.length) {
                jQuery(this).find('th, td').each(function () {
                    entry.header.push({
                        cellIndex: this.cellIndex,
                        tag: this.tagName,
                        text: jQuery(this).text().trim().slice(0, 40),
                        hasUnit: /unit_/.test(jQuery(this).html() || ''),
                        dataUnit: jQuery(this).find('[data-unit]').attr('data-unit') || null
                    });
                });
            }
        });

        var rows = $t.find('tr').toArray();
        for (var i = 0; i < rows.length; i++) {
            if (!/\d{3}\|\d{3}/.test(rows[i].innerText)) continue;
            var cells = [];
            for (var c = 0; c < rows[i].cells.length; c++) {
                cells.push({
                    cellIndex: rows[i].cells[c].cellIndex,
                    text: jQuery(rows[i].cells[c]).text().trim(),
                    count: readCell(rows[i].cells[c])
                });
            }
            entry.sampleVillageRow = { rowIndex: i, cells: cells };

            if (rows[i + 1] && !/\d{3}\|\d{3}/.test(rows[i + 1].innerText)) {
                var awayCells = [];
                for (var a = 0; a < rows[i + 1].cells.length; a++) {
                    awayCells.push({
                        cellIndex: rows[i + 1].cells[a].cellIndex,
                        text: jQuery(rows[i + 1].cells[a]).text().trim(),
                        count: readCell(rows[i + 1].cells[a])
                    });
                }
                entry.sampleEnrouteRow = { rowIndex: i + 1, cells: awayCells };
            }
            break;
        }

        report.tables.push(entry);
    });

    var json = JSON.stringify(report, null, 2);
    console.log('=== OVERWATCH DIAGNOSE ===\n', report);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(function () {
            alert('Teşhis raporu panoya kopyalandı.\n\nConsole\'da (F12) "OVERWATCH DIAGNOSE" çıktısına da bak.\nBu metni chat\'e yapıştır.');
        }).catch(function () {
            prompt('Panoya kopyalanamadı — Ctrl+C ile kopyala:', json);
        });
    } else {
        prompt('Teşhis raporu — Ctrl+C ile kopyala:', json);
    }
})();
