//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2015/Mar/21
//Version: 0.2

//Date: 2014/Mar/29
//Version: 0.1

function updateBrowserActionIcon(){
    var query = {'state': 'in_progress'};

    downloadSearchHelpler(query, function(arr){
        var count = arr.length,
            pct;

        if(count){
            pct = averageProgress(arr);

            setExtBadgeText(count + '');
            chrome.action.setBadgeBackgroundColor({color: "#00CD66"});
            setDownloadTitle(count, pct);

            if(pct === null){
                setExtIcon({path: '/img/icon-16.png'});
            }else{
                setExtIcon({imageData: {
                    16: drawProgressIcon(16, pct),
                    32: drawProgressIcon(32, pct)
                }});
            }
        }else{
            setExtIcon({path: '/img/icon-16.png'});
            showUnseenBadgeOrClear();
        }
    });
}

// Shown only when nothing is currently downloading (the in-progress
// branch above always takes priority) — a persistent count of
// completed downloads the user hasn't seen yet, cleared when the
// popup is opened. Uses chrome.storage.local so it survives service
// worker restarts.
function showUnseenBadgeOrClear(){
    chrome.storage.local.get('BDUnseenCompletedCount', function(obj){
        var unseen = obj.BDUnseenCompletedCount || 0;

        if(unseen > 0){
            setExtBadgeText(unseen > 99 ? '99+' : unseen + '');
            chrome.action.setBadgeBackgroundColor({color: "#2979FF"});
            chrome.action.setTitle({title: chrome.i18n.getMessage('aUnseenCompletedTooltip', [unseen + ''])});
        }else{
            setExtBadgeText('');
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

function setDownloadTitle(count, pct){
    var percentText = pct === null ? null : Math.round(pct * 100) + '',
        msg = percentText === null
            ? chrome.i18n.getMessage('aDownloadsTooltipNoPercent', [count + ''])
            : chrome.i18n.getMessage('aDownloadsTooltip', [count + '', percentText]);

    chrome.action.setTitle({title: msg});
}

// Draws a circular progress ring via OffscreenCanvas (the MV3-compatible
// replacement for the old DOM-canvas HProgressBar idea, which never
// actually worked in a service worker) and returns ImageData suitable
// for chrome.action.setIcon({imageData: ...}).
function drawProgressIcon(size, pct){
    var canvas = new OffscreenCanvas(size, size),
        ctx = canvas.getContext('2d'),
        cx = size / 2,
        cy = size / 2,
        lineWidth = Math.max(2, size * 0.16),
        radius = size / 2 - lineWidth / 2,
        startAngle = -Math.PI / 2,
        clamped = Math.min(Math.max(pct, 0), 1),
        endAngle = startAngle + (Math.PI * 2 * clamped);

    ctx.clearRect(0, 0, size, size);

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#00cd66';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();

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
