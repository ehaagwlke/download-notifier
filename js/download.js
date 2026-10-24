//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2015/Mar/21
//Version: 0.2

//Date: 2014/Mar/29
//Version: 0.1

// chrome.downloads.onChanged does not fire for bytesReceived updates, so
// the ring would only refresh on state changes. While anything is in
// progress we poll twice a second (each tick also advances the icon animation); the extension API call each tick also
// keeps the MV3 service worker from being idled out mid-download.
var BD_PROGRESS_POLL_MS = 500,
    bdProgressTimer = null,
    bdFrame = 0;

function startProgressPolling(){
    if(bdProgressTimer === null){
        bdProgressTimer = setInterval(updateBrowserActionIcon, BD_PROGRESS_POLL_MS);
    }
}

function stopProgressPolling(){
    if(bdProgressTimer !== null){
        clearInterval(bdProgressTimer);
        bdProgressTimer = null;
    }
}

function updateBrowserActionIcon(){
    var query = {'state': 'in_progress'};

    downloadSearchHelpler(query, function(arr){
        var count = arr.length,
            allPaused,
            pct,
            i;

        if(count){
            startProgressPolling();
            pct = averageProgress(arr);

            // Paused downloads stay "in_progress" in the API; the icon only
            // switches to the paused look when nothing is actually moving.
            allPaused = true;
            for(i = 0; i < arr.length; i++){
                if(!arr[i].paused){
                    allPaused = false;
                    break;
                }
            }

            // Always show the in-progress count (including a single download).
            setExtBadgeText(count + '');
            chrome.action.setBadgeBackgroundColor({color: allPaused ? BD_BADGE_AMBER : BD_BADGE_NEUTRAL});
            chrome.action.setBadgeTextColor({color: '#FFFFFF'});
            setDownloadTitle(count, pct, allPaused);
            bdFrame++;
            setDrawnIcon({mode: 'active', pct: pct, paused: allPaused, frame: bdFrame});
        }else{
            stopProgressPolling();
            showUnseenBadgeOrClear();
        }
    });
}

// Shown only when nothing is currently downloading (the in-progress
// branch above always takes priority) — completed downloads the user
// hasn't seen yet, cleared when the popup is opened. Rendered as a blue
// dot on the icon itself (no badge box over the glyph); the exact count
// lives in the tooltip. Uses chrome.storage.local so it survives service
// worker restarts.
function showUnseenBadgeOrClear(){
    chrome.storage.local.get('BDUnseenCompletedCount', function(obj){
        var unseen = obj.BDUnseenCompletedCount || 0;

        setExtBadgeText('');

        if(unseen > 0){
            setDrawnIcon({mode: 'idle', dot: true});
            chrome.action.setTitle({title: chrome.i18n.getMessage('aUnseenCompletedTooltip', [unseen + ''])});
        }else{
            setDrawnIcon({mode: 'idle', dot: false});
            chrome.action.setTitle({title: 'Better Downloader'});
        }
    });
}

function bumpUnseenCompletedCount(){
    chrome.storage.local.get('BDUnseenCompletedCount', function(obj){
        var count = (obj.BDUnseenCompletedCount || 0) + 1;
        chrome.storage.local.set({BDUnseenCompletedCount: count}, function(){
            updateBrowserActionIcon();
        });
    });
}

function clearUnseenCompletedCount(){
    chrome.storage.local.set({BDUnseenCompletedCount: 0}, function(){
        updateBrowserActionIcon();
    });
}

// Average completion (0..1) across in-progress downloads that report a
// known total size. Returns null when none of them do (pure
// indeterminate downloads), so callers can skip drawing a misleading
// 0% ring.
function averageProgress(items){
    var total = 0,
        known = 0,
        i,
        item;

    for(i = 0; i < items.length; i++){
        item = items[i];
        if(item.totalBytes > 0){
            total += item.bytesReceived / item.totalBytes;
            known++;
        }
    }

    return known ? total / known : null;
}

function setDownloadTitle(count, pct, paused){
    var percentText = pct === null ? null : Math.round(pct * 100) + '',
        key = paused ? 'aDownloadsPausedTooltip' : 'aDownloadsTooltip',
        msg = percentText === null
            ? chrome.i18n.getMessage(paused ? 'pStatePaused' : 'aDownloadsTooltipNoPercent', [count + ''])
            : chrome.i18n.getMessage(key, [count + '', percentText]);

    chrome.action.setTitle({title: msg});
}

// Toolbar icon palette. A service worker can't read the toolbar color, so
// the offscreen document reports the OS color scheme (js/offscreen.js) and
// the user can override it with the "Toolbar icon" option (BDIconStyle:
// 'auto' | 'dark' | 'light' = dark/light *icon*) when their Chrome theme
// differs from the OS. Color is reserved for state: amber = paused,
// green dot = unseen completions.
var BD_PALETTES = {
    darkIcon: {glyph: '#1D1F23', track: 'rgba(29, 31, 35, 0.22)', amber: '#D97706'},
    lightIcon: {glyph: '#F1F3F4', track: 'rgba(241, 243, 244, 0.30)', amber: '#FBBF24'}
},
    BD_BADGE_NEUTRAL = '#5F6368',
    BD_BADGE_AMBER = '#B45309',
    BD_DOT = '#12B76A',
    bdOsScheme = 'light',
    bdIconStyle = 'auto';

function bdPalette(){
    var darkToolbar = bdIconStyle === 'light' ||
        (bdIconStyle === 'auto' && bdOsScheme === 'dark');
    return darkToolbar ? BD_PALETTES.lightIcon : BD_PALETTES.darkIcon;
}

function loadIconSettings(){
    chrome.storage.sync.get('BDIconStyle', function(sync){
        chrome.storage.local.get('BDOsScheme', function(local){
            bdIconStyle = sync.BDIconStyle || 'auto';
            bdOsScheme = local.BDOsScheme === 'dark' ? 'dark' : 'light';
            updateBrowserActionIcon();
            requestOsScheme();
        });
    });
}

function requestOsScheme(){
    ensureOffscreenDocument(function(){
        chrome.runtime.sendMessage({type: 'BDQueryColorScheme'}, function(){
            void chrome.runtime.lastError;
        });
    });
}

chrome.runtime.onMessage.addListener(function(msg){
    var scheme;

    if(msg && msg.type === 'BDColorScheme'){
        scheme = msg.scheme === 'dark' ? 'dark' : 'light';
        if(scheme !== bdOsScheme){
            bdOsScheme = scheme;
            chrome.storage.local.set({BDOsScheme: scheme});
            updateBrowserActionIcon();
        }
    }
});

chrome.storage.onChanged.addListener(function(changes, area){
    if(area === 'sync' && changes.BDIconStyle){
        bdIconStyle = changes.BDIconStyle.newValue || 'auto';
        updateBrowserActionIcon();
    }
});

function setDrawnIcon(opts){
    setExtIcon({imageData: {
        16: drawIcon(16, opts),
        32: drawIcon(32, opts)
    }});
}

// Download glyph: arrow dropping into a tray, fitted into square `box`.
// Pause glyph: two vertical bars, same stroke weight as the arrow.
function drawPauseGlyph(ctx, x, y, box, color){
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.6, box * 0.2);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x + box * 0.32, y + box * 0.16);
    ctx.lineTo(x + box * 0.32, y + box * 0.84);
    ctx.moveTo(x + box * 0.68, y + box * 0.16);
    ctx.lineTo(x + box * 0.68, y + box * 0.84);
    ctx.stroke();
}

function drawGlyph(ctx, x, y, box, color, arrowDy){
    var dy = (arrowDy || 0) * box;
    var w = Math.max(1.6, box * 0.15);

    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x + box * 0.5, y + box * 0.08 + dy);
    ctx.lineTo(x + box * 0.5, y + box * 0.64 + dy);
    ctx.moveTo(x + box * 0.27, y + box * 0.42 + dy);
    ctx.lineTo(x + box * 0.5, y + box * 0.65 + dy);
    ctx.lineTo(x + box * 0.73, y + box * 0.42 + dy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + box * 0.14, y + box * 0.84);
    ctx.lineTo(x + box * 0.86, y + box * 0.84);
    ctx.stroke();
}

// Procedurally drawn flat toolbar icon (OffscreenCanvas — the MV3-compatible
// route). opts:
//   mode 'idle'   — green glyph, optional blue "unseen" dot top-right
//   mode 'active' — smaller glyph inside a progress ring; pct null means
//                   unknown size, so only the empty track is drawn;
//                   paused swaps in amber + a pause glyph
function drawIcon(size, opts){
    var canvas = new OffscreenCanvas(size, size),
        ctx = canvas.getContext('2d'),
        c = size / 2,
        start = -Math.PI / 2,
        pal = bdPalette(),
        ringW, r, inner, pct, color;

    ctx.clearRect(0, 0, size, size);

    if(opts.mode === 'active'){
        pct = opts.pct === null ? 0 : Math.min(Math.max(opts.pct, 0), 1);
        ringW = Math.max(2, size * 0.14);
        r = size / 2 - ringW / 2;

        ctx.lineWidth = ringW;
        ctx.lineCap = 'round';

        color = opts.paused ? pal.amber : pal.glyph;
        ctx.strokeStyle = pal.track;
        ctx.beginPath();
        ctx.arc(c, c, r, 0, Math.PI * 2);
        ctx.stroke();

        if(opts.pct === null && !opts.paused){
            // Unknown size: a spinning arc proves the download is alive.
            ctx.strokeStyle = color;
            ctx.beginPath();
            start += (opts.frame % 4) * Math.PI / 2;
            ctx.arc(c, c, r, start, start + Math.PI * 0.6);
            ctx.stroke();
        }else if(pct > 0){
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.arc(c, c, r, start, start + Math.PI * 2 * pct);
            ctx.stroke();
        }

        inner = size * 0.5;
        if(opts.paused){
            drawPauseGlyph(ctx, c - inner / 2, c - inner / 2, inner, color);
        }else{
            // Arrow bobs downward in a 4-frame loop while data is flowing.
            drawGlyph(ctx, c - inner / 2, c - inner / 2, inner, color,
                [0, 0.07, 0.14, 0.07][opts.frame % 4]);
        }
    }else{
        drawGlyph(ctx, size * 0.04, size * 0.04, size * 0.92, pal.glyph);

        if(opts.dot){
            r = size * 0.22;
            // Transparent gap around the dot, then the dot itself.
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(size - r - 0.5, r + 0.5, r + Math.max(1, size * 0.08), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = BD_DOT;
            ctx.beginPath();
            ctx.arc(size - r - 0.5, r + 0.5, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    return ctx.getImageData(0, 0, size, size);
}

function setExtIcon(obj){
    chrome.action.setIcon(obj, function(){
        if(chrome.runtime.lastError){
            console.error('setIcon failed:', chrome.runtime.lastError.message);
        }
    });
}

function setExtBadgeText(t){
    var obj = {"text": t};
    chrome.action.setBadgeText(obj);
}

function downloadSearchHelpler(query, callback){
    chrome.downloads.search(query, function(DLArray){
        callback(DLArray);
    });
}

// Draw the idle icon as soon as the service worker starts, so it matches
// the drawn states instead of showing the static manifest PNG.
loadIconSettings();
