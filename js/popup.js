//Author: Dingbao.ai [a.k.a ehaagwlke]

;(function(){
    var listNode = document.getElementById('downloadList'),
        emptyNode = document.getElementById('emptyState'),
        viewAllBtn = document.getElementById('viewAllBtn'),
        searchInput = document.getElementById('searchInput'),
        searchToggle = document.getElementById('searchToggle'),
        headerEl = document.querySelector('.bd-popup-header'),
        iconCache = {};

    chrome.runtime.sendMessage({type: 'BDPopupOpened'});

    // BDTheme: 'auto' (default, follows the OS), 'light' or 'dark'.
    function applyTheme(theme){
        if(theme === 'light' || theme === 'dark'){
            document.documentElement.setAttribute('data-theme', theme);
        }else{
            document.documentElement.removeAttribute('data-theme');
        }
    }

    chrome.storage.sync.get('BDTheme', function(obj){
        applyTheme(obj.BDTheme);
    });

    chrome.storage.onChanged.addListener(function(changes, area){
        if(area === 'sync' && changes.BDTheme){
            applyTheme(changes.BDTheme.newValue);
        }
    });

    var ICONS = {
        pause: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5v14M16 5v14"/></svg>',
        resume: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5l12 7-12 7z"/></svg>',
        cancel: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        retry: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
        open: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/></svg>',
        show: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h6l2 2h10v11H3z"/></svg>',
        remove: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
        deleteFile: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
        copyLink: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1"/></svg>',
        keep: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
    };

    var PRIMARY_ACTION = {
        downloading: 'pause',
        paused: 'resume',
        interrupted: 'retry',
        completed: 'open',
        missing: 'remove'
        // 'dangerous' intentionally has no row-click primary action —
        // accepting or discarding a flagged-dangerous download always
        // requires an explicit button press, never an accidental row click.
    };

    function i18n(msg){
        return chrome.i18n.getMessage(msg);
    }

    document.getElementById('popupTitle').textContent = i18n('pTitle');
    viewAllBtn.textContent = i18n('pViewAll');
    searchInput.placeholder = i18n('pSearchPlaceholder');
    searchInput.setAttribute('aria-label', i18n('pSearchPlaceholder'));
    updateSearchToggleLabel();

    viewAllBtn.addEventListener('click', function(){
        createOrSelectDownloadPage();
        window.close();
    });

    function updateSearchToggleLabel(){
        var active = headerEl.classList.contains('bd-searching');
        searchToggle.setAttribute('aria-label', i18n(active ? 'pSearchClose' : 'pSearchLabel'));
    }

    function openSearch(){
        headerEl.classList.add('bd-searching');
        updateSearchToggleLabel();
    }

    function closeSearch(){
        headerEl.classList.remove('bd-searching');
        updateSearchToggleLabel();
    }

    searchToggle.addEventListener('click', function(){
        if(headerEl.classList.contains('bd-searching')){
            searchInput.value = '';
            applyFilter();
            closeSearch();
        }else{
            openSearch();
            searchInput.focus();
        }
    });

    searchInput.addEventListener('focus', openSearch);

    searchInput.addEventListener('blur', function(){
        if(!searchInput.value){
            closeSearch();
        }
    });

    searchInput.addEventListener('input', applyFilter);

    function basename(item){
        if(item.filename){
            return item.filename.replace(/^.*[\\\/]/, '');
        }
        if(item.url){
            try{
                return decodeURIComponent(item.url.split('/').pop().split('?')[0]) || item.url;
            }catch(e){
                return item.url;
            }
        }
        return '';
    }

    function formatBytes(n){
        var units = ['B', 'KB', 'MB', 'GB', 'TB'],
            i = 0;

        while(n >= 1024 && i < units.length - 1){
            n /= 1024;
            i++;
        }

        return (i === 0 || n >= 100 ? Math.round(n) : n.toFixed(1)) + ' ' + units[i];
    }

    // Language-neutral secondary line: "12.4 MB of 80 MB · 15%" while
    // running, the final size once done.
    function metaText(item, status){
        var pct;

        if(status === 'downloading' || status === 'paused'){
            if(item.totalBytes > 0){
                pct = Math.min(100, Math.round((item.bytesReceived / item.totalBytes) * 100));
                return formatBytes(item.bytesReceived) + ' / ' + formatBytes(item.totalBytes) + ' · ' + pct + '%';
            }
            return formatBytes(item.bytesReceived || 0);
        }

        if(item.fileSize > 0){
            return formatBytes(item.fileSize);
        }

        return '';
    }

    // Color-coded extension tile (replaces Chrome's generic gray file
    // icon). Hue per file category; lightness is theme-driven in CSS.
    var FILE_CATEGORIES = [
        {id: 'apps',      label: 'pTypeApps',      exts: 'dmg pkg exe msi deb rpm apk iso app'},
        {id: 'archives',  label: 'pTypeArchives',  exts: 'zip rar 7z tar gz tgz bz2 xz'},
        {id: 'documents', label: 'pTypeDocuments', exts: 'pdf doc docx ppt pptx xls xlsx txt md rtf csv pages key numbers epub'},
        {id: 'images',    label: 'pTypeImages',    exts: 'png jpg jpeg gif webp svg heic avif bmp tiff ico psd'},
        {id: 'video',     label: 'pTypeVideo',     exts: 'mp4 mov mkv avi webm m4v flv wmv'},
        {id: 'audio',     label: 'pTypeAudio',     exts: 'mp3 wav flac m4a aac ogg opus'},
        {id: 'code',      label: 'pTypeCode',      exts: 'js ts json py html css xml sh yml yaml sql log'}
    ],
        OTHER_CATEGORY = {id: 'other', label: 'pTypeOther'};

    function extOf(name){
        var m = /\.([A-Za-z0-9]{1,5})$/.exec(name);
        return m ? m[1].toLowerCase() : '';
    }

    function categoryOf(name){
        var ext = extOf(name),
            i;

        for(i = 0; ext && i < FILE_CATEGORIES.length; i++){
            if((' ' + FILE_CATEGORIES[i].exts + ' ').indexOf(' ' + ext + ' ') !== -1){
                return FILE_CATEGORIES[i];
            }
        }
        return OTHER_CATEGORY;
    }

    function fileTile(tile, name){
        var ext = extOf(name);

        tile.textContent = ext ? ext.toUpperCase() : 'FILE';
    }

    // "New" = started or finished after the previous time the popup was
    // opened. seenBaseline is that previous open time (0 until loaded).
    var seenBaseline = 0;

    function isNewItem(item){
        var t = Math.max(Date.parse(item.startTime) || 0, Date.parse(item.endTime) || 0);
        return t > seenBaseline;
    }

    function getStatus(item){
        if(item.danger && item.danger !== 'safe' && item.danger !== 'accepted'){
            return 'dangerous';
        }
        if(item.state === 'in_progress'){
            return item.paused ? 'paused' : 'downloading';
        }
        if(item.state === 'interrupted'){
            return 'interrupted';
        }
        if(item.state === 'complete'){
            return item.exists === false ? 'missing' : 'completed';
        }
        return 'unknown';
    }

    var STATUS_LABELS = {
        dangerous: 'pStateDangerous',
        downloading: 'pStateDownloading',
        paused: 'pStatePaused',
        interrupted: 'pStateInterrupted',
        completed: 'pStateCompleted',
        missing: 'pStateMissing',
        unknown: ''
    };

    function actionButton(label, action, id, extraClass){
        var btn = document.createElement('button'),
            text = i18n(label);

        btn.type = 'button';
        btn.innerHTML = ICONS[action] || '';
        btn.title = text;
        btn.setAttribute('aria-label', text);
        btn.className = 'bd-action-btn' + (extraClass ? ' ' + extraClass : '');
        btn.setAttribute('data-action', action);
        btn.setAttribute('data-id', id);
        return btn;
    }

    function buildActions(item, status){
        var frag = document.createDocumentFragment();

        if(status === 'dangerous'){
            frag.appendChild(actionButton('pDangerKeep', 'keep', item.id));
            frag.appendChild(actionButton('pDangerDiscard', 'cancel', item.id, 'bd-danger-btn'));
        }else if(status === 'downloading'){
            frag.appendChild(actionButton('pCopyLink', 'copyLink', item.id));
            frag.appendChild(actionButton('pPause', 'pause', item.id));
            frag.appendChild(actionButton('pCancel', 'cancel', item.id, 'bd-danger-btn'));
        }else if(status === 'paused'){
            frag.appendChild(actionButton('pCopyLink', 'copyLink', item.id));
            frag.appendChild(actionButton('pResume', 'resume', item.id));
            frag.appendChild(actionButton('pCancel', 'cancel', item.id, 'bd-danger-btn'));
        }else if(status === 'interrupted'){
            frag.appendChild(actionButton('pCopyLink', 'copyLink', item.id));
            frag.appendChild(actionButton('pRetry', 'retry', item.id));
            frag.appendChild(actionButton('pRemove', 'remove', item.id));
        }else if(status === 'completed'){
            frag.appendChild(actionButton('pCopyLink', 'copyLink', item.id));
            frag.appendChild(actionButton('pOpen', 'open', item.id));
            frag.appendChild(actionButton('pShow', 'show', item.id));
            frag.appendChild(actionButton('pRemove', 'remove', item.id));
            frag.appendChild(actionButton('pDeleteFile', 'deleteFile', item.id, 'bd-danger-btn'));
        }else if(status === 'missing'){
            frag.appendChild(actionButton('pCopyLink', 'copyLink', item.id));
            frag.appendChild(actionButton('pRemove', 'remove', item.id));
        }

        return frag;
    }

    function buildRow(item){
        var status = getStatus(item),
            name = basename(item),
            row = document.createElement('div'),
            fillEl = document.createElement('div'),
            trackEl = document.createElement('div'),
            iconTile = document.createElement('div'),
            metaEl = document.createElement('div'),
            info = document.createElement('div'),
            nameEl = document.createElement('div'),
            statusEl = document.createElement('div'),
            actionsEl = document.createElement('div'),
            pct;

        row.className = 'bd-download-item bd-status-' + status;
        row.id = 'dl-item-' + item.id;
        row.setAttribute('data-status', status);
        row.setAttribute('data-id', item.id);
        row.setAttribute('data-name', name.toLowerCase());
        row.setAttribute('data-type', categoryOf(name).id);
        if(isNewItem(item)){
            row.classList.add('bd-item-new');
        }

        fillEl.className = 'bd-progress-fill';
        if((status === 'downloading' || status === 'paused') && item.totalBytes > 0){
            pct = Math.min(100, Math.round((item.bytesReceived / item.totalBytes) * 100));
            fillEl.style.width = pct + '%';
        }else{
            fillEl.style.width = '0%';
        }

        iconTile.className = 'bd-file-tile';
        fileTile(iconTile, name);

        info.className = 'bd-download-info';

        nameEl.className = 'bd-download-name';
        nameEl.textContent = name;
        nameEl.title = name;

        statusEl.className = 'bd-download-status';
        statusEl.textContent = STATUS_LABELS[status] ? i18n(STATUS_LABELS[status]) : '';

        metaEl.className = 'bd-download-meta';
        metaEl.textContent = metaText(item, status);

        info.appendChild(nameEl);
        info.appendChild(metaEl);

        if(status === 'downloading' || status === 'paused'){
            trackEl.className = 'bd-progress-track';
            trackEl.appendChild(fillEl);
            info.appendChild(trackEl);
        }

        actionsEl.className = 'bd-download-actions';
        actionsEl.appendChild(buildActions(item, status));

        row.appendChild(iconTile);
        row.appendChild(info);
        row.appendChild(statusEl);
        row.appendChild(actionsEl);

        applyFilterToRow(row);

        return row;
    }

    // File-type filter: chips are built from the rows actually present
    // (history records count even when the file itself was deleted), so
    // only types with at least one item are offered.
    var activeType = 'all',
        typeFilterEl = document.getElementById('typeFilter'),
        typeFilterSig = '';

    function updateTypeFilter(){
        var rows = listNode.children,
            counts = {},
            order = FILE_CATEGORIES.concat([OTHER_CATEGORY]),
            chips = [],
            sig,
            i,
            t;

        for(i = 0; i < rows.length; i++){
            if(rows[i].classList.contains('bd-removing')){
                continue;
            }
            t = rows[i].getAttribute('data-type');
            counts[t] = (counts[t] || 0) + 1;
        }

        order.forEach(function(cat){
            if(counts[cat.id]){
                chips.push({id: cat.id, label: i18n(cat.label), count: counts[cat.id]});
            }
        });

        // A filter that no longer has items falls back to "All".
        if(activeType !== 'all' && !counts[activeType]){
            activeType = 'all';
            applyFilter();
        }

        // One type (or none) leaves nothing to filter by.
        if(chips.length < 2){
            typeFilterEl.hidden = true;
            typeFilterEl.textContent = '';
            typeFilterSig = '';
            return;
        }

        sig = activeType + '|' + chips.map(function(c){ return c.id + c.count; }).join(',');
        if(sig === typeFilterSig){
            return;
        }
        typeFilterSig = sig;

        typeFilterEl.textContent = '';
        [{id: 'all', label: i18n('pTypeAll'), count: 0}].concat(chips).forEach(function(c){
            var btn = document.createElement('button'),
                n;

            btn.type = 'button';
            btn.className = 'bd-type-chip' + (c.id === activeType ? ' bd-active' : '');
            btn.setAttribute('data-type', c.id);
            btn.setAttribute('aria-pressed', c.id === activeType ? 'true' : 'false');
            btn.textContent = c.label;
            if(c.count){
                n = document.createElement('span');
                n.className = 'bd-type-count';
                n.textContent = c.count;
                btn.appendChild(n);
            }
            typeFilterEl.appendChild(btn);
        });
        typeFilterEl.hidden = false;
    }

    typeFilterEl.addEventListener('click', function(evt){
        var btn = evt.target.closest ? evt.target.closest('.bd-type-chip') : null;
        if(btn){
            activeType = btn.getAttribute('data-type');
            applyFilter();
        }
    });

    // Vertical wheel scrolls the chip row sideways (no visible scrollbar).
    typeFilterEl.addEventListener('wheel', function(evt){
        if(evt.deltaY){
            typeFilterEl.scrollLeft += evt.deltaY;
            evt.preventDefault();
        }
    }, {passive: false});

    function currentQuery(){
        return searchInput.value.trim().toLowerCase();
    }

    function rowMatchesQuery(row, query){
        if(activeType !== 'all' && row.getAttribute('data-type') !== activeType){
            return false;
        }
        if(!query){
            return true;
        }
        return (row.getAttribute('data-name') || '').indexOf(query) !== -1;
    }

    function applyFilterToRow(row){
        row.hidden = !rowMatchesQuery(row, currentQuery());
    }

    function applyFilter(){
        var rows = listNode.children,
            i;

        for(i = 0; i < rows.length; i++){
            applyFilterToRow(rows[i]);
        }

        toggleEmptyState();
    }

    function countVisibleRows(){
        var rows = listNode.children,
            i,
            count = 0;

        for(i = 0; i < rows.length; i++){
            if(!rows[i].hidden){
                count++;
            }
        }

        return count;
    }

    function renderRow(item){
        var existing = document.getElementById('dl-item-' + item.id),
            row = buildRow(item);

        if(existing){
            existing.replaceWith(row);
        }else{
            listNode.insertBefore(row, listNode.firstChild);
        }

        toggleEmptyState();
    }

    function removeRow(id){
        var existing = document.getElementById('dl-item-' + id);
        if(!existing){
            return;
        }

        // Fade out, then drop the node.
        existing.classList.add('bd-removing');
        setTimeout(function(){
            if(existing.parentNode){
                existing.parentNode.removeChild(existing);
            }
            toggleEmptyState();
        }, 180);
    }

    function toggleEmptyState(){
        var hasVisible = countVisibleRows() > 0;
        emptyNode.textContent = (currentQuery() || activeType !== 'all') ? i18n('pNoResults') : i18n('pEmpty');
        emptyNode.hidden = hasVisible;
        listNode.hidden = !hasVisible;
        updateTypeFilter();
    }

    function renderAll(items){
        listNode.textContent = '';
        items.forEach(function(item){
            listNode.appendChild(buildRow(item));
        });
        toggleEmptyState();
    }

    function refreshItem(id){
        chrome.downloads.search({id: id}, function(arr){
            if(arr && arr[0]){
                renderRow(arr[0]);
            }
        });
    }

    function handleAction(action, id){
        switch(action){
            case 'pause':
                chrome.downloads.pause(id);
                break;
            case 'resume':
                chrome.downloads.resume(id);
                break;
            case 'cancel':
                chrome.downloads.cancel(id);
                break;
            case 'keep':
                chrome.downloads.acceptDanger(id, function(){});
                break;
            // Open/Show hand focus to another app, so the popup closes;
            // every other action manages the list and keeps it open.
            case 'open':
                chrome.downloads.open(id);
                window.close();
                break;
            case 'show':
                chrome.downloads.show(id);
                window.close();
                break;
            case 'retry':
                chrome.downloads.search({id: id}, function(arr){
                    var item = arr && arr[0];
                    if(item){
                        chrome.downloads.download({url: item.finalUrl || item.url});
                    }
                });
                break;
            case 'remove':
                chrome.downloads.erase({id: id});
                removeRow(id);
                break;
            case 'deleteFile':
                // Delete the file, then forget the history entry too, so
                // one confirmed action fully removes the item.
                chrome.downloads.removeFile(id, function(){
                    if(chrome.runtime.lastError){
                        console.error('removeFile failed:', chrome.runtime.lastError.message);
                        return;
                    }
                    chrome.downloads.erase({id: id});
                    removeRow(id);
                });
                break;
        }
    }

    // Inline two-step confirm for the destructive trash button: first
    // click arms it ("Delete file?"), second click within 3s confirms;
    // otherwise it quietly reverts.
    function armDeleteConfirm(btn){
        var label = i18n('pDeleteConfirm'),
            original = btn.innerHTML,
            originalTitle = btn.title;

        btn.classList.add('bd-confirming');
        btn.innerHTML = ICONS.keep + '<span>' + label + '</span>';
        btn.title = label;
        btn.setAttribute('aria-label', label);

        setTimeout(function(){
            if(btn.isConnected && btn.classList.contains('bd-confirming')){
                btn.classList.remove('bd-confirming');
                btn.innerHTML = original;
                btn.title = originalTitle;
                btn.setAttribute('aria-label', originalTitle);
            }
        }, 3000);
    }

    // Copy the source URL (finalUrl = after redirects) so a download can be
    // redone later even if the file is gone. Flashes a check on success.
    function copyLink(btn, id){
        chrome.downloads.search({id: id}, function(arr){
            var item = arr && arr[0],
                url = item && (item.finalUrl || item.url),
                original = btn.innerHTML,
                originalTitle = btn.title;

            if(!url){
                return;
            }

            navigator.clipboard.writeText(url).then(function(){
                var label = i18n('pLinkCopied');

                btn.classList.add('bd-copied');
                btn.innerHTML = ICONS.keep;
                btn.title = label;
                btn.setAttribute('aria-label', label);

                setTimeout(function(){
                    if(btn.isConnected){
                        btn.classList.remove('bd-copied');
                        btn.innerHTML = original;
                        btn.title = originalTitle;
                        btn.setAttribute('aria-label', originalTitle);
                    }
                }, 1500);
            }, function(err){
                console.error('copy link failed:', err);
            });
        });
    }

    listNode.addEventListener('click', function(evt){
        var btn = evt.target.closest ? evt.target.closest('.bd-action-btn') : null;
        if(btn && btn.getAttribute('data-action') === 'copyLink'){
            copyLink(btn, parseInt(btn.getAttribute('data-id'), 10));
            return;
        }

        if(btn && btn.getAttribute('data-action') === 'deleteFile' && !btn.classList.contains('bd-confirming')){
            armDeleteConfirm(btn);
            return;
        }

        if(btn){
            handleAction(btn.getAttribute('data-action'), parseInt(btn.getAttribute('data-id'), 10));
            return;
        }

        var row = evt.target.closest ? evt.target.closest('.bd-download-item') : null;
        if(!row){
            return;
        }

        var status = row.getAttribute('data-status'),
            primary = PRIMARY_ACTION[status];

        if(primary){
            handleAction(primary, parseInt(row.getAttribute('data-id'), 10));
        }
    });

    chrome.downloads.onCreated.addListener(function(item){
        renderRow(item);
    });

    chrome.downloads.onChanged.addListener(function(delta){
        refreshItem(delta.id);
    });

    chrome.downloads.onErased.addListener(function(id){
        removeRow(id);
    });

    // onChanged doesn't fire for bytesReceived, so while the popup is open
    // refresh running rows once a second — in place, so hover state and
    // the action buttons under the cursor aren't rebuilt.
    function updateLive(item){
        var row = document.getElementById('dl-item-' + item.id),
            fill,
            meta;

        if(!row || getStatus(item) !== row.getAttribute('data-status')){
            renderRow(item);
            return;
        }

        fill = row.querySelector('.bd-progress-fill');
        meta = row.querySelector('.bd-download-meta');

        if(fill && item.totalBytes > 0){
            fill.style.width = Math.min(100, (item.bytesReceived / item.totalBytes) * 100) + '%';
        }
        meta.textContent = metaText(item, row.getAttribute('data-status'));
    }

    setInterval(function(){
        if(!listNode.querySelector('.bd-status-downloading')){
            return;
        }
        chrome.downloads.search({state: 'in_progress'}, function(arr){
            (arr || []).forEach(updateLive);
        });
    }, 1000);

    chrome.storage.local.get('BDLastSeenTime', function(obj){
        seenBaseline = obj.BDLastSeenTime || 0;
        chrome.storage.local.set({BDLastSeenTime: Date.now()});
        chrome.downloads.search({orderBy: ['-startTime'], limit: 50}, renderAll);
    });
}());
