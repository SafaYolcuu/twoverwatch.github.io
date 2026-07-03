/**
 * Overwatch by Shinko to Kuma (bookmarklet sürümü)
 * Stack renkleri + sayı parse düzeltmeleri uygulanmıştır.
 */
(function () {
    'use strict';

    if (typeof jQuery === 'undefined' || typeof TWMap === 'undefined' || typeof game_data === 'undefined') {
        alert('Overwatch: Harita ve jQuery hazır değil. Sayfayı yenileyip tekrar deneyin.');
        return;
    }

    var WATCHTOWER_RADIUS = [1.1, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3, 3.4, 3.9, 4.4, 5.1, 5.8, 6.7, 7.6, 8.7, 10, 11.5, 13.1, 15];
    var DEFAULT_COLORS = [
        { color: '#FF0000', opacity: 0.3 },
        { color: '#FF5100', opacity: 0.3 },
        { color: '#FFAE00', opacity: 0.3 },
        { color: '#F2FF00', opacity: 0.3 },
        { color: '#B7FF00', opacity: 0.3 },
        { color: '#62FF00', opacity: 0.3 },
        { color: '#04FF00', opacity: 0.3 },
        { color: '#00FF7B', opacity: 0.3 },
        { color: '#00FFAE', opacity: 0.3 },
        { color: '#00C8FF', opacity: 0.3 },
        { color: '#006AFF', opacity: 0.3 },
        { color: '#1500FF', opacity: 0.3 },
        { color: '#4000FF', opacity: 0.3 },
        { color: '#8C00FF', opacity: 0.3 },
        { color: '#FF00D9', opacity: 0.3 }
    ];

    var options, playerIDs, urls = [], buildingUrls = [], playerData = [];
    var mapOverlay = TWMap;
    var targetData = [];
    var tileWidthX = TWMap.tileSize[0];
    var tileWidthY = TWMap.tileSize[1];
    var selectedVillages = [];
    var currentCoords = '';
    var settingsData, unitPopValues, packetSize, minimum, smallStack, mediumStack, bigStack, targetStackSize;

    var images = Array.from({ length: 3 }, function () { return new Image(); });
    images[0].src = '/graphic//map/incoming_attack.webp';
    images[1].src = '/graphic/buildings/wall.webp';
    images[2].src = '/graphic/buildings/farm.webp';

    function toInt(v) {
        if (typeof v === 'number' && !isNaN(v)) return Math.floor(v);
        if (!v && v !== 0) return 0;
        var n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
        return isNaN(n) ? 0 : n;
    }

    function toFloat(v) {
        if (typeof v === 'number' && !isNaN(v)) return v;
        if (!v && v !== 0) return 0;
        var s = String(v).replace(/\./g, '').replace(',', '.');
        var n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function playerDomId(playerID) {
        return String(playerID).replace(/[\s()]/g, '');
    }

    function getPlayerColor(player, index) {
        var sid = playerDomId(player.playerID);
        var def = DEFAULT_COLORS[index % DEFAULT_COLORS.length];
        var fromDom = $('#val' + sid).val();
        var fromDomAlpha = $('#alp' + sid).val();
        return {
            color: player.color || fromDom || def.color,
            opacity: toFloat(player.opacity !== undefined ? player.opacity : (fromDomAlpha !== undefined ? fromDomAlpha : def.opacity))
        };
    }

    function showNotification(msg) {
        var x = document.getElementById('overwatchNotification');
        if (!x) return;
        x.innerText = msg;
        x.className = 'show';
        setTimeout(function () { x.className = x.className.replace('show', ''); }, 3000);
    }

    function numberWithCommas(x) {
        x = x.toString();
        var pattern = /(-?\d+)(\d{3})/;
        while (pattern.test(x)) x = x.replace(pattern, '$1.$2');
        return x;
    }

    window.updateStackSizes = function () {
        minimum = toInt(minimum);
        smallStack = toInt(smallStack);
        mediumStack = toInt(mediumStack);
        bigStack = toInt(bigStack);
        if (bigStack <= 0) bigStack = 60000;
        $('#smallStack').val(smallStack);
        $('#mediumStack').val(mediumStack);
        $('#input-left').val(Math.floor(smallStack / bigStack * 100));
        $('#input-right').val(Math.floor(mediumStack / bigStack * 100));
        targetStackSize = bigStack;
        updateSlider();
        SettingsManager.save();
    };

    window.updateSmall = function (el) {
        smallStack = toInt(el.value);
        $('#input-left').val(Math.floor(smallStack / bigStack * 100));
        updateSlider();
        SettingsManager.save();
    };

    window.updateMedium = function (el) {
        mediumStack = toInt(el.value);
        $('#input-right').val(Math.floor(mediumStack / bigStack * 100));
        updateSlider();
        SettingsManager.save();
    };

    function updateSlider() {
        var range = document.querySelector('.slider > .range');
        var thumbLeft = document.querySelector('.slider > .thumb.left');
        var thumbRight = document.querySelector('.slider > .thumb.right');
        if (!range || !thumbLeft || !thumbRight || !bigStack) return;
        range.style.left = (smallStack / bigStack * 100) + '%';
        thumbRight.style.right = (100 - (mediumStack / bigStack * 100)) + '%';
        thumbLeft.style.left = (smallStack / bigStack * 100) + '%';
        range.style.right = (100 - (mediumStack / bigStack * 100)) + '%';
        var leftVal = toInt($('#input-left').val());
        var rightVal = toInt($('#input-right').val());
        $('.track').css('background-image', 'linear-gradient(to right, #75FFFF, black ' + (minimum / bigStack * 100) + '%, black ' + (leftVal - 10) + '%, red ' + leftVal + '%, red ' + rightVal + '%, yellow ' + (rightVal + 10) + '%, yellow 95%, green)');
    }

    function saveSettingsAndRedraw() {
        SettingsManager.updateFromUI();
        SettingsManager.save();
        recalculate();
        MapRenderer.makeMap();
    }

    function recalculate() {
        targetData = [];
        playerData.forEach(function (player, idx) {
            var style = getPlayerColor(player, idx);
            if (player.playerVillages) {
                player.playerVillages.forEach(function (village) {
                    targetData.push({
                        playerName: player.playerName,
                        tribeName: player.tribeName,
                        coord: village.coordinate,
                        incomingAttacks: village.attacksToVillage,
                        incomingSupports: 0,
                        currentStack: toInt(village.currentPop),
                        totalStack: toInt(village.totalPop),
                        watchtower: toInt(village.watchtower),
                        wall: village.wall,
                        checkedWT: !!player.checkedWT,
                        checkedWTMini: !!player.checkedWTMini,
                        color: style.color,
                        opacity: style.opacity,
                        unitsInVillage: village.unitsInVillage,
                        unitsEnRoute: village.unitsEnroute
                    });
                });
            }
        });
    }

    function importData() {
        try {
            var array = JSON.parse($('#importData').val());
            playerData = playerData.concat(array);
            showNotification('Oyuncu verisi içe aktarıldı!');
            UIManager.createOverview();
            jscolor.install();
            recalculate();
            MapRenderer.makeMap();
        } catch (e) {
            alert('Geçersiz JSON: ' + e.message);
        }
    }

    function exportData() {
        navigator.clipboard.writeText(JSON.stringify(playerData));
        showNotification('Oyuncu verisi panoya kopyalandı');
    }

    $('#contentContainer').eq(0).prepend('<style>' +
        '.overviewWithPadding th, .overviewWithPadding td { padding: 2px 10px; }' +
        '#overwatchNotification { visibility: hidden; min-width: 250px; margin-left: -125px; background-color: #f4e4bc; color: #000; border: 1px solid #7d510f; text-align: center; border-radius: 2px; padding: 16px; position: fixed; z-index: 10001; left: 50%; top: 50px; }' +
        '#overwatchNotification.show { visibility: visible; animation: owFadein 0.5s, owFadeout 0.5s 2.5s; }' +
        '@keyframes owFadein { from { top: 0; opacity: 0; } to { top: 50px; opacity: 1; } }' +
        '@keyframes owFadeout { from { top: 50px; opacity: 1; } to { top: 0; opacity: 0; } }' +
        '.middle { position: relative; width: 100%; max-width: 500px; }' +
        '.jscolor-picker-border { background: #f4e4bc !important; border: 1px solid #7d510f !important; }' +
        '.jscolor-picker-border canvas { border: 1px solid #7d510f !important; }' +
        '.slider { position: relative; z-index: 1; height: 10px; margin: 0 15px; }' +
        '.slider > .track { position: absolute; z-index: 1; left: 0; right: 0; top: 0; bottom: 0; border-radius: 5px; background-image: linear-gradient(to right, black, red, yellow, green); }' +
        '.slider > .range { position: absolute; z-index: 2; left: 25%; right: 25%; top: 0; bottom: 0; border-radius: 5px; background-color: #FF0000; }' +
        '.slider > .thumb { position: absolute; z-index: 3; width: 20px !important; height: 20px; border-radius: 50%; }' +
        '.slider > .thumb.left { background-color: #FF0000 !important; left: 25%; transform: translate(-10px, -5px); }' +
        '.slider > .thumb.right { background-color: #FF0000 !important; right: 25%; transform: translate(10px, -5px); }' +
        'input[type=range] { position: absolute; pointer-events: none; -webkit-appearance: none; z-index: 2; height: 10px; width: 100%; opacity: 0; }' +
        'input[type=range]::-webkit-slider-thumb { pointer-events: all; width: 30px; height: 30px; -webkit-appearance: none; }' +
        '</style>');

    var UIManager = {
        createOverview: function () {
            $('#overwatchNotification, #tribeLeaderUI').remove();
            $('#contentContainer').prepend(this.buildUI());
            this.setupEventListeners();
            this.setInitialValues();
            $('#tribeLeaderUI').draggable();
        },

        buildUI: function () {
            return '<div id="overwatchNotification"></div>' +
                '<div id="tribeLeaderUI" class="ui-widget-content vis" style="min-width:200px;background:#f4e4bc;position:fixed;cursor:move;z-index:9999;top:80px;left:20px;">' +
                '<div style="min-height:35px">' +
                '<h3 id="titleOverwatch" style="display:none;margin:auto;text-align:center;padding-top:6px">Overwatch</h3>' +
                '<img id="toggleIcon" style="position:absolute;left:20px;top:10px;" class="widget-button" src="graphic/minus.png" />' +
                '<div id="toggleUi"><center>' +
                '<table style="margin:30px 20px"><tr>' +
                '<td><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="playerSettingsButton" value="Oyuncu ayarları"/></td>' +
                '<td><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="stackSizeButton" value="Stack eşikleri"/></td>' +
                '<td><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="stackListButton" value="Stack listesi"/></td>' +
                '<td><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="importExportButton" value="İçe/Dışa aktar"/></td>' +
                '</tr></table>' +
                this.buildPlayerSettingsTab() + this.buildStackSizeTab() + this.buildStackListTab() + this.buildImportExportTab() +
                '<div style="margin:20px 20px"><a href="#" class="btn btn-default" id="redrawMapBtn">Haritayı yenile</a>' +
                '<br><small style="margin-top:10px">Overwatch — Shinko to Kuma / bookmarklet sürümü</small></div>' +
                '</center></div></div></div>';
        },

        buildPlayerSettingsTab: function () {
            var html = '<div id="playerSettings"><div style="max-height:600px!important;overflow-y:auto;margin:30px;width:fit-content;">' +
                '<table class="vis overviewWithPadding" style="border:1px solid #7d510f;min-width:600px;max-width:900px;">' +
                '<thead><tr><th>Oyuncu</th>';
            if ('watchtower' in game_data.village.buildings) {
                html += '<th style="width:80px;text-align:center;">Harita GK</th><th style="width:80px;text-align:center;">Minimap GK</th>';
            }
            html += '<th style="width:80px;text-align:center;">Renk</th><th>Gelen saldırı</th></tr></thead><tbody>';

            playerData.forEach(function (player, i) {
                var sid = playerDomId(player.playerID);
                var def = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
                var color = player.color || def.color;
                var opacity = player.opacity !== undefined ? player.opacity : def.opacity;
                var checkedWT = player.checkedWT || false;
                var checkedWTMini = player.checkedWTMini || false;
                var rowClass = i % 2 === 0 ? 'row_b' : 'row_a';
                html += '<tr class="' + rowClass + '"><td>' + player.playerName + '</td>';
                if ('watchtower' in game_data.village.buildings) {
                    html += '<td><center><input id="checkMapWT' + sid + '" type="checkbox"' + (checkedWT ? ' checked' : '') + '></center></td>';
                    html += '<td><center><input id="checkWTMini' + sid + '" type="checkbox"' + (checkedWTMini ? ' checked' : '') + '></center></td>';
                }
                html += '<td><center><button class="btn" id="color' + sid + '" data-jscolor="{valueElement:\'#val' + sid + '\', alphaElement:\'#alp' + sid + '\'}"></button>' +
                    '<input id="val' + sid + '" value="' + color + '" type="hidden">' +
                    '<input id="alp' + sid + '" value="' + opacity + '" type="hidden"></center></td>' +
                    '<td>' + player.attackCount + '</td></tr>';
            });

            if ('watchtower' in game_data.village.buildings) {
                html += '<tr style="border-top:1px solid black;"><td style="text-align:right">Tümünü seç:</td>' +
                    '<td><center><input id="checkAllWT" type="checkbox"></center></td>' +
                    '<td><center><input id="checkAllWTMini" type="checkbox"></center></td><td colspan="2"></td></tr>';
            }
            html += '</tbody></table></div></div>';
            return html;
        },

        buildStackSizeTab: function () {
            return '<div id="stackSize"><table class="vis" style="margin:30px;">' +
                '<tr><th>Boş</th><th colspan="2" style="width:400px;text-align:center">Küçük - Orta stack</th><th>Büyük stack</th></tr>' +
                '<tr style="height:70px"><td><input type="text" id="emptyStack" onchange="minimum=toInt(this.value);updateStackSizes();"></td>' +
                '<td colspan="2"><div class="middle"><div class="multi-range-slider">' +
                '<input type="range" id="input-left" min="0" max="100" value="25">' +
                '<input type="range" id="input-right" min="0" max="100" value="75">' +
                '<div class="slider"><div class="track"></div><div class="range"></div><div class="thumb left"></div><div class="thumb right"></div></div>' +
                '</div></div></td>' +
                '<td><input type="text" id="bigStack" onchange="bigStack=toInt(this.value);updateStackSizes();"></td></tr>' +
                '<tr><td></td><td><label>Küçük stack</label><input type="text" style="margin-left:20px;" onchange="updateSmall(this)" id="smallStack"></td>' +
                '<td style="text-align:right;"><label style="margin-right:10px;">Orta stack</label><input type="text" style="margin-right:20px;" onchange="updateMedium(this)" id="mediumStack"></td><td></td></tr>' +
                '</table>' +
                '<table class="vis overviewWithPadding" style="border:1px solid #7d510f;margin:20px;"><tbody><tr>' +
                game_data.units.map(function (unit) {
                    return '<td align="center"><input type="text" onchange="SettingsManager.save();" name="' + unit + '" id="' + unit + '" size="2" value="' + (unitPopValues[unit] || 0) + '"></td>';
                }).join('') +
                '</tr></tbody></table></div>';
        },

        buildStackListTab: function () {
            return '<div id="stackList"><div style="width:600px;margin:30px;">' +
                '<h1>Seçili köyler: <span id="countSelectedVillages">0</span></h1><hr>' +
                '<p><textarea rows="10" style="width:590px;max-height:155px;overflow-y:auto;" id="villageList"></textarea></p><hr>' +
                '<p><textarea rows="10" style="width:590px;max-height:155px;overflow-y:auto;" id="villageListBB"></textarea></p></div></div>';
        },

        buildImportExportTab: function () {
            return '<div id="importExport"><div style="width:600px;margin:30px;">' +
                '<h1>Dışa aktar</h1><hr><p><a href="#" class="btn btn-default" id="exportBtn">Oyuncuları dışa aktar</a></p><hr>' +
                '<h1>İçe aktar</h1><p><textarea rows="3" style="width:590px;" id="importData"></textarea></p>' +
                '<p><a href="#" class="btn btn-default" id="importBtn">Oyuncuları içe aktar</a></p></div></div>';
        },

        setupEventListeners: function () {
            var self = this;
            $('#checkAllWT').click(function () { $('input:checkbox[id^="checkMapWT"]').not(this).prop('checked', this.checked); });
            $('#checkAllWTMini').click(function () { $('input:checkbox[id^="checkWTMini"]').not(this).prop('checked', this.checked); });

            var inputLeft = document.getElementById('input-left');
            var inputRight = document.getElementById('input-right');
            var thumbLeft = document.querySelector('.slider > .thumb.left');
            var thumbRight = document.querySelector('.slider > .thumb.right');
            var range = document.querySelector('.slider > .range');

            function setLeftValue() {
                inputLeft.value = Math.min(parseInt(inputLeft.value, 10), parseInt(inputRight.value, 10) - 1);
                var percent = ((inputLeft.value - inputLeft.min) / (inputLeft.max - inputLeft.min)) * 100;
                thumbLeft.style.left = percent + '%';
                range.style.left = percent + '%';
                smallStack = Math.round(bigStack * (percent / 100));
                $('#smallStack').val(smallStack);
                updateSlider();
            }

            function setRightValue() {
                inputRight.value = Math.max(parseInt(inputRight.value, 10), parseInt(inputLeft.value, 10) + 1);
                var percent = ((inputRight.value - inputRight.min) / (inputRight.max - inputRight.min)) * 100;
                thumbRight.style.right = (100 - percent) + '%';
                range.style.right = (100 - percent) + '%';
                mediumStack = Math.round(bigStack * (percent / 100));
                $('#mediumStack').val(mediumStack);
                updateSlider();
            }

            setLeftValue();
            setRightValue();
            inputLeft.addEventListener('input', setLeftValue);
            inputRight.addEventListener('input', setRightValue);
            inputLeft.addEventListener('mouseup', function () { SettingsManager.save(); });
            inputRight.addEventListener('mouseup', function () { SettingsManager.save(); });

            $('.multi-range-slider, .slider, input[type=range]').on('mousedown touchstart', function (e) { e.stopPropagation(); });
            $('#toggleIcon').click(function () { self.toggleUI(); });
            $('#playerSettingsButton').click(function () { self.displayCategory('playerSettings'); });
            $('#stackSizeButton').click(function () { self.displayCategory('stackSize'); });
            $('#stackListButton').click(function () { self.displayCategory('stackList'); });
            $('#importExportButton').click(function () { self.displayCategory('importExport'); });
            $('#redrawMapBtn').click(function (e) { e.preventDefault(); saveSettingsAndRedraw(); });
            $(document).on('click', '#exportBtn', function (e) { e.preventDefault(); exportData(); });
            $(document).on('click', '#importBtn', function (e) { e.preventDefault(); importData(); });
        },

        setInitialValues: function () {
            $('#emptyStack').val(minimum);
            $('#smallStack').val(smallStack);
            $('#mediumStack').val(mediumStack);
            $('#bigStack').val(bigStack);
            $('#input-left').val(Math.floor(smallStack / bigStack * 100));
            $('#input-right').val(Math.floor(mediumStack / bigStack * 100));
            updateSlider();
            this.displayCategory('playerSettings');
        },

        displayCategory: function (category) {
            var all = ['stackList', 'stackSize', 'playerSettings', 'importExport'];
            $('#' + category).show();
            $('#' + category + 'Button').attr('class', 'btn evt-cancel-btn btn-confirm-yes');
            all.filter(function (c) { return c !== category; }).forEach(function (c) {
                $('#' + c).hide();
                $('#' + c + 'Button').attr('class', 'btn evt-confirm-btn btn-confirm-no');
            });
        },

        toggleUI: function () {
            var icon = $('#toggleIcon');
            icon.attr('src', icon.attr('src').indexOf('minus.png') >= 0 ? 'graphic/plus.png' : 'graphic/minus.png');
            $('#toggleUi, #titleOverwatch').toggle();
        }
    };

    var DataManager = {
        fetchPlayerIDs: async function () {
            var membersDef = await $.get('/game.php?screen=ally&mode=members_defense');
            options = $(membersDef).find('.input-nicer option:not(:first)');
            playerIDs = options.map(function (_, option) { return option.value; }).get();
            urls = playerIDs.map(function (id) { return '/game.php?screen=ally&mode=members_defense&player_id=' + id; });
        },

        fetchBuildingIDs: async function () {
            var membersBuildings = await $.get('/game.php?screen=ally&mode=members_buildings');
            var buildingOptions = $(membersBuildings).find('.input-nicer option:not(:first)');
            var playerBuildingIDs = buildingOptions.map(function (_, option) { return option.value; }).get();
            buildingUrls = playerBuildingIDs.map(function (id) { return '/game.php?screen=ally&mode=members_buildings&player_id=' + id; });
        },

        fetchAllData: async function () {
            var container = $('#contentContainer')[0] || $('#mobileHeader')[0];
            var width = container ? container.clientWidth : 800;
            $(container).eq(0).prepend(
                '<div id="progressbar" class="progress-bar progress-bar-alive">' +
                '<span id="count" class="label">0/' + urls.length + '</span>' +
                '<div id="progress"><span id="count2" class="label" style="width:' + width + 'px;">0/' + urls.length + '</span></div></div>'
            );

            var defenseData = await this.staggeredGetAll(urls, this.processDefenseData.bind(this), 'Birlik sayıları');
            var buildingData = await this.staggeredGetAll(buildingUrls, this.processBuildingData.bind(this), 'Bina bilgileri');
            $('#progressbar').remove();
            this.combineData(defenseData, buildingData);
            UIManager.createOverview();
            if (window.jscolor) jscolor.install();
            recalculate();
            MapRenderer.makeMap();
        },

        staggeredGetAll: function (urlList, onLoad, label) {
            var self = this;
            return new Promise(function (resolve, reject) {
                var numDone = 0;
                var results = [];
                var lastRequestTime = 0;

                function loadNext() {
                    if (numDone === urlList.length) {
                        resolve(results);
                        return;
                    }
                    var now = Date.now();
                    if (now - lastRequestTime < 200) {
                        setTimeout(loadNext, 200 - (now - lastRequestTime));
                        return;
                    }
                    $('#progress').css('width', ((numDone + 1) / urlList.length * 100) + '%');
                    $('#count, #count2').text(label + ': ' + (numDone + 1) + '/' + urlList.length);
                    lastRequestTime = now;
                    $.get(urlList[numDone])
                        .done(function (data) {
                            try {
                                results[numDone] = onLoad(numDone, data);
                                numDone++;
                                loadNext();
                            } catch (e) { reject(e); }
                        })
                        .fail(reject);
                }
                loadNext();
            });
        },

        processDefenseData: function (i, data) {
            var playerName = $(data).find('.input-nicer option:selected').text().trim();
            var tribeName = $(data).find('#content_value h2')[0].innerText.split('(')[0].trim();
            var hasIncomings = $(data).find('#ally_content img[src*="unit/att.webp"]').length > 0;
            var attackCount = hasIncomings
                ? $(data).find('.table-responsive table tr:first th:last')[0].innerText.replace(/[^0-9]/g, '')
                : 'Gelenleri paylaşmıyor';
            return {
                playerID: playerIDs[i],
                tribeName: tribeName,
                playerName: playerName,
                attackCount: attackCount,
                playerVillages: this.parseVillages(data, hasIncomings, attackCount)
            };
        },

        parseVillages: function (data, hasIncomings, attackCount) {
            var villages = [];
            var table = $(data).find('.table-responsive table tr:not(:first)');
            for (var i = 0; i < table.length / 2; i++) {
                var coordinate = table[i * 2].children[0].innerText.match(/\d+\|\d+/)[0];
                var unitsInVillage = {};
                var unitsEnroute = {};
                var currentPop = 0;
                var totalPop = 0;
                game_data.units.forEach(function (unit, j) {
                    var inVillage = toInt(table[i * 2].children[j + 3].innerText);
                    var enrouteRaw = table[i * 2 + 1].children[j + 1].innerText.trim();
                    var enroute = enrouteRaw === '?' ? 0 : toInt(enrouteRaw);
                    var pop = toInt(unitPopValues[unit]);
                    unitsInVillage[unit] = inVillage;
                    unitsEnroute[unit] = enroute;
                    if (enrouteRaw === '?') attackCount = 'Gerekli ayarları paylaşmıyor';
                    currentPop += inVillage * pop;
                    totalPop += (inVillage + enroute) * pop;
                });
                var attacksToVillage = hasIncomings ? toInt(table[i * 2].children[3 + game_data.units.length].innerText) : '---';
                villages.push({
                    coordinate: coordinate,
                    currentPop: currentPop,
                    totalPop: totalPop,
                    attacksToVillage: attacksToVillage,
                    unitsInVillage: unitsInVillage,
                    unitsEnroute: unitsEnroute
                });
            }
            return villages;
        },

        processBuildingData: function (j, buildingTable) {
            var villages = [];
            var wtImg = $(buildingTable).find('#ally_content img[src*="buildings/watchtower.webp"]');
            if (wtImg.length > 0) {
                var cellIndex = wtImg.parent().index();
                var wallIndex = $(buildingTable).find('#ally_content img[src*="buildings/wall.webp"]').parent().index();
                $(buildingTable).find('#ally_content tr:nth-child(n+2)').each(function (_, row) {
                    var coordinate = $(row).children(0).text().match(/\d+\|\d+/)[0];
                    villages.push({
                        coordinate: coordinate,
                        watchtower: toInt($($(row).find('td')[cellIndex]).text()),
                        wall: toInt($($(row).find('td')[wallIndex]).text())
                    });
                });
            } else {
                $(buildingTable).find('#ally_content tr:nth-child(n+2)').each(function (_, row) {
                    villages.push({
                        coordinate: $(row).children(0).text().match(/\d+\|\d+/)[0],
                        watchtower: 0,
                        wall: toInt($(row).children().last().text())
                    });
                });
            }
            return villages;
        },

        combineData: function (defenseData, buildingData) {
            var oldSettings = playerData.slice();
            playerData = defenseData.map(function (player, i) {
                var playerSettings = oldSettings.find(function (p) { return p.playerID === player.playerID; }) || {};
                var buildings = buildingData[i] || [];
                player.playerVillages.forEach(function (village) {
                    var build = buildings.find(function (b) { return b.coordinate === village.coordinate; });
                    village.watchtower = build ? build.watchtower : 0;
                    village.wall = build ? build.wall : '---';
                });
                return Object.assign({}, playerSettings, player);
            });
        },

        setupMapInterceptors: function () {
            var originalReceivedInfo = TWMap.popup.receivedPopupInformationForSingleVillage;
            TWMap.popup.receivedPopupInformationForSingleVillage = function (e) {
                originalReceivedInfo.call(TWMap.popup, e);
                if (Object.keys(e).length > 0) MapRenderer.makeOutput(e);
            };
            var originalDisplayForVillage = TWMap.popup.displayForVillage;
            TWMap.popup.displayForVillage = function (e, a, t) {
                originalDisplayForVillage.call(TWMap.popup, e, a, t);
                if (Object.keys(e).length > 0) MapRenderer.makeOutput(e);
            };
        }
    };

    var SettingsManager = {
        load: function () {
            var stored = localStorage.getItem('overwatchSettings');
            if (stored) {
                settingsData = JSON.parse(stored);
                packetSize = toInt(settingsData.packetSize) || 1000;
                minimum = toInt(settingsData.minimum);
                smallStack = toInt(settingsData.smallStack);
                mediumStack = toInt(settingsData.mediumStack);
                bigStack = toInt(settingsData.bigStack);
                unitPopValues = settingsData.unitPopValues || {};
                Object.keys(unitPopValues).forEach(function (k) { unitPopValues[k] = toInt(unitPopValues[k]); });
                targetStackSize = bigStack;
                playerData = settingsData.playerSettings || [];
            } else {
                this.setDefaults();
            }
        },

        setDefaults: function () {
            unitPopValues = {
                spear: 1, sword: 1, archer: 1, axe: 0, spy: 0, light: 0, marcher: 0,
                heavy: 4, catapult: 2, ram: 0, knight: 2, militia: 1, snob: 0
            };
            packetSize = 1000;
            minimum = 500;
            smallStack = 20000;
            mediumStack = 40000;
            bigStack = 60000;
            targetStackSize = bigStack;
            this.save();
        },

        save: function () {
            var playerSettings = playerData.map(function (player) {
                return {
                    color: player.color,
                    opacity: player.opacity,
                    checkedWT: player.checkedWT,
                    checkedWTMini: player.checkedWTMini,
                    playerID: player.playerID
                };
            });
            localStorage.setItem('overwatchSettings', JSON.stringify({
                packetSize: packetSize,
                minimum: minimum,
                smallStack: smallStack,
                mediumStack: mediumStack,
                bigStack: bigStack,
                playerSettings: playerSettings,
                unitPopValues: unitPopValues
            }));
            showNotification('Ayarlar kaydedildi');
        },

        updateFromUI: function () {
            minimum = toInt($('#emptyStack').val());
            smallStack = toInt($('#smallStack').val());
            mediumStack = toInt($('#mediumStack').val());
            bigStack = toInt($('#bigStack').val());
            targetStackSize = bigStack;
            Object.keys(unitPopValues).forEach(function (unit) {
                unitPopValues[unit] = toInt($('#' + unit).val());
            });
            playerData.forEach(function (player, idx) {
                var sid = playerDomId(player.playerID);
                var style = getPlayerColor(player, idx);
                player.color = $('#val' + sid).val() || style.color;
                player.opacity = toFloat($('#alp' + sid).val() || style.opacity);
                player.checkedWT = $('#checkMapWT' + sid).is(':checked');
                player.checkedWTMini = $('#checkWTMini' + sid).is(':checked');
            });
        }
    };

    var Calculator = {
        getStackColor: function (stack) {
            stack = toInt(stack);
            var min = toInt(minimum);
            var s = toInt(smallStack);
            var m = toInt(mediumStack);
            var b = toInt(bigStack);
            if (stack < min) return 'rgba(117, 255, 255, 0.5)';
            if (stack < s) return 'rgba(0, 0, 0, 0.5)';
            if (stack < m) return 'rgba(255, 0, 0, 0.5)';
            if (stack < b) return 'rgba(255, 255, 0, 0.5)';
            return 'rgba(0, 255, 0, 0.5)';
        }
    };

    var MapRenderer = {
        makeMap: function () {
            $('.mapOverlay_map_canvas, .mapOverlay_topo_canvas').remove();
            if (!mapOverlay.mapHandler._spawnSector) {
                mapOverlay.mapHandler._spawnSector = mapOverlay.mapHandler.spawnSector;
            }
            mapOverlay.mapHandler.spawnSector = function (data, sector) {
                mapOverlay.mapHandler._spawnSector(data, sector);
                MapRenderer.renderSector(data, sector);
            };
            mapOverlay.reload();
        },

        renderSector: function (data, sector) {
            var beginX = sector.x - data.x;
            var endX = beginX + mapOverlay.mapSubSectorSize;
            var beginY = sector.y - data.y;
            var endY = beginY + mapOverlay.mapSubSectorSize;
            var canvasId = 'mapOverlay_canvas_' + sector.x + '_' + sector.y;
            var el = document.getElementById(canvasId);
            if (el) el.remove();

            var canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.width = mapOverlay.map.scale[0] * mapOverlay.map.sectorSize;
            canvas.height = mapOverlay.map.scale[1] * mapOverlay.map.sectorSize;
            canvas.style.zIndex = 10;
            canvas.className = 'mapOverlay_map_canvas';
            canvas.id = canvasId;
            var ctx = canvas.getContext('2d');
            var stPixel = mapOverlay.map.pixelByCoord(sector.x, sector.y);
            var drew = false;

            targetData.forEach(function (element) {
                var t = element.coord.split('|');
                var tx = parseInt(t[0], 10);
                var ty = parseInt(t[1], 10);
                if (tx < sector.x || tx >= sector.x + 5 || ty < sector.y || ty >= sector.y + 5) return;
                var originXY = mapOverlay.map.pixelByCoord(tx, ty);
                var originX = (originXY[0] - stPixel[0]) + mapOverlay.tileSize[0] / 2;
                var originY = (originXY[1] - stPixel[1]) + mapOverlay.tileSize[1] / 2;
                MapRenderer.drawLeftTriangle(ctx, originX, originY, Calculator.getStackColor(element.currentStack));
                MapRenderer.drawRightTriangle(ctx, originX, originY, Calculator.getStackColor(element.totalStack));
                if (toInt(element.incomingAttacks) > 0) {
                    MapRenderer.iconOnMap(images[0], ctx, originX - 19, originY - 12, 15);
                    MapRenderer.textOnMap(element.incomingAttacks, ctx, originX - 5, originY - 8, 'white', '10px Arial');
                }
                if (element.wall < 20 || element.wall === '---') {
                    MapRenderer.iconOnMap(images[1], ctx, originX + 7, originY - 12, 15);
                    MapRenderer.textOnMap(element.wall, ctx, originX + 20, originY - 8, 'white', '10px Arial');
                }
                MapRenderer.iconOnMap(images[2], ctx, originX - 19, originY + 10, 15);
                MapRenderer.textOnMap(Math.floor(element.totalStack / 1000) + 'k', ctx, originX - 2, originY + 14, 'white', '10px Arial');
                if (element.watchtower > 0 && element.checkedWT) {
                    MapRenderer.drawMapTowers(ctx, originX, originY, element.watchtower, element.color, element.opacity);
                }
                drew = true;
            });

            if (drew) sector.appendElement(canvas, 0, 0);

            Object.keys(mapOverlay.minimap._loadedSectors).forEach(function (key) {
                var miniSector = mapOverlay.minimap._loadedSectors[key];
                var topoId = 'mapOverlay_topo_canvas_' + key;
                var topoEl = document.getElementById(topoId);
                if (topoEl) topoEl.remove();
                var topoCanvas = document.createElement('canvas');
                topoCanvas.style.position = 'absolute';
                topoCanvas.width = 250;
                topoCanvas.height = 250;
                topoCanvas.style.zIndex = 11;
                topoCanvas.className = 'mapOverlay_topo_canvas';
                topoCanvas.id = topoId;
                var topoCtx = topoCanvas.getContext('2d');
                var topoDrew = false;
                targetData.forEach(function (element) {
                    if (!(element.watchtower > 0 && element.checkedWTMini)) return;
                    var c = element.coord.split('|');
                    var x = (parseInt(c[0], 10) - miniSector.x) * 5 + 3;
                    var y = (parseInt(c[1], 10) - miniSector.y) * 5 + 3;
                    MapRenderer.drawTopoTowers(topoCtx, x, y, element.watchtower, element.color, element.opacity);
                    topoDrew = true;
                });
                if (topoDrew) miniSector.appendElement(topoCanvas, 0, 0);
            });

            selectedVillages.forEach(function (coord) {
                var parts = coord.split('|');
                var village = TWMap.villages[parseInt(parts[0], 10) * 1000 + parseInt(parts[1], 10)];
                if (village && village.id) {
                    $('[id="map_village_' + village.id + '"]').css({
                        filter: currentCoords.indexOf(coord) >= 0 ? 'brightness(800%) grayscale(100%)' : 'none'
                    });
                }
            });
        },

        drawMapTowers: function (ctx, x, y, wtLevel, color, opacity) {
            var wtr = WATCHTOWER_RADIUS[wtLevel - 1] || 1;
            ctx.save();
            ctx.lineWidth = 2;
            ctx.fillStyle = color || '#FF0000';
            ctx.globalAlpha = opacity || 0.3;
            ctx.strokeStyle = color || '#FF0000';
            ctx.beginPath();
            ctx.ellipse(x, y, wtr * TWMap.map.scale[0], wtr * TWMap.map.scale[1], 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#000000';
            ctx.moveTo(x - 6, y - 6);
            ctx.lineTo(x + 6, y + 6);
            ctx.moveTo(x + 6, y - 6);
            ctx.lineTo(x - 6, y + 6);
            ctx.stroke();
            ctx.restore();
        },

        drawTopoTowers: function (ctx, x, y, wtLevel, color, opacity) {
            ctx.save();
            ctx.lineWidth = 1;
            ctx.fillStyle = color || '#FF0000';
            ctx.globalAlpha = opacity || 0.3;
            ctx.strokeStyle = color || '#FF0000';
            ctx.beginPath();
            ctx.arc(x, y, (WATCHTOWER_RADIUS[wtLevel - 1] || 1) * 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#000000';
            ctx.moveTo(x - 2, y - 2);
            ctx.lineTo(x + 2, y + 2);
            ctx.moveTo(x + 2, y - 2);
            ctx.lineTo(x - 2, y + 2);
            ctx.stroke();
            ctx.restore();
        },

        drawLeftTriangle: function (ctx, x, y, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x - tileWidthX / 2, y - tileWidthY / 2);
            ctx.lineTo(x + tileWidthX / 2, y - tileWidthY / 2);
            ctx.lineTo(x - tileWidthX / 2, y + tileWidthY / 2);
            ctx.fill();
        },

        drawRightTriangle: function (ctx, x, y, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x + tileWidthX / 2, y - tileWidthY / 2);
            ctx.lineTo(x + tileWidthX / 2, y + tileWidthY / 2);
            ctx.lineTo(x - tileWidthX / 2, y + tileWidthY / 2);
            ctx.fill();
        },

        iconOnMap: function (img, ctx, x, y, size) {
            if (img.complete) ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        },

        textOnMap: function (text, ctx, x, y, color, font) {
            ctx.font = font;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.save();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.strokeText(String(text), x, y);
            ctx.fillText(String(text), x, y);
            ctx.restore();
        },

        makeOutput: function (data) {
            $('#overwatch_info').remove();
            var coordinate = data.xy.toString().substring(0, 3) + '|' + data.xy.toString().substring(3, 6);
            var thisData = targetData.filter(function (coord) { return coord.coord === coordinate; });
            if (thisData.length > 0) {
                var troopsHome = thisData[0].unitsInVillage || {};
                var troopsEnRoute = thisData[0].unitsEnRoute || {};
                var $villageInfoContainer = $('<div id="overwatch_info" style="background-color:#e5d7b2;"><h1>Overwatch</h1><table class="vis" style="width:100%"></table></div>');
                $villageInfoContainer.find('table').append('<tr><td>Evde</td>' + MapRenderer.makeTroopTds(troopsHome) + '</tr>');
                $villageInfoContainer.find('table').append('<tr><td>Yolda</td>' + MapRenderer.makeTroopTds(troopsEnRoute) + '</tr>');
                $villageInfoContainer.appendTo($('#map_popup'));
            } else {
                $('<div id="overwatch_info" style="background-color:#e5d7b2;"><h1>Bu köy için veri yok</h1></div>').appendTo($('#map_popup'));
            }
        },

        makeTroopTds: function (troops) {
            return game_data.units.map(function (unit) {
                var val = troops[unit];
                return '<td>' + (val || val === 0 ? val : '') + '</td>';
            }).join('');
        }
    };

    TWMap.map._handleClick = function (e) {
        var pos = this.coordByEvent(e);
        var coord = pos.join('|');
        var village = TWMap.villages[pos[0] * 1000 + pos[1]];
        var stacklist = '';
        var stacklistBB = '[table]\n[**]Koordinat[||]Oyuncu[||]Kabile[||]Stack[||]Paket[/**]\n';
        if (village && village.id) {
            if (currentCoords.indexOf(coord) < 0) {
                selectedVillages.push(coord);
                currentCoords += coord;
                $('[id="map_village_' + village.id + '"]').css({ filter: 'brightness(800%) grayscale(100%)' });
            } else {
                selectedVillages = selectedVillages.filter(function (v) { return v !== coord; });
                currentCoords = currentCoords.replace(coord, '');
                $('[id="map_village_' + village.id + '"]').css({ filter: 'none' });
            }
            selectedVillages.forEach(function (c) {
                var hit = targetData.filter(function (o) { return o.coord === c; });
                if (hit.length > 0) {
                    stacklist += 'Koordinat: ' + hit[0].coord + ' - Oyuncu: ' + hit[0].playerName + ' - Stack: ' + numberWithCommas(hit[0].totalStack) + ' - Paket: ' + Math.round((targetStackSize - hit[0].totalStack) / packetSize) + '\n';
                    stacklistBB += '[*][coord]' + hit[0].coord + '[/coord][|]' + hit[0].playerName + '[|]' + hit[0].tribeName + '[|]' + numberWithCommas(hit[0].totalStack) + '[|]' + Math.round((targetStackSize - hit[0].totalStack) / packetSize) + '\n';
                }
            });
            stacklistBB += '[/table]';
            $('#villageList').val(stacklist);
            $('#villageListBB').val(stacklistBB);
            $('#countSelectedVillages').text(selectedVillages.length);
        }
        return false;
    };

    window.toInt = toInt;
    window.SettingsManager = SettingsManager;

    SettingsManager.load();
    DataManager.setupMapInterceptors();
    showNotification('Overwatch başlatıldı, kabile verisi çekiliyor...');

    (async function () {
        try {
            await DataManager.fetchPlayerIDs();
            if (!playerIDs.length) {
                alert('Overwatch: Kabile üyesi bulunamadı.\nKabile lideri/yetkilisi misin? Kabile savunma ekranına erişimin var mı?');
                return;
            }
            await DataManager.fetchBuildingIDs();
            await DataManager.fetchAllData();
        } catch (e) {
            console.error(e);
            alert('Overwatch veri hatası:\n' + e.message);
        }
    })();
})();
