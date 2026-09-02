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

    var ICONS = {
        pause: '<svg viewBox="0 0 24 24" width="14" height="14"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>',
        resume: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
        cancel: '<svg viewBox="0 0 24 24" width="14" height="14"><line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        retry: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 13c0-4.42-3.58-8-8-8zm-6 8c0-1.01.25-1.97.7-2.8L5.24 8.74A7.93 7.93 0 004 13c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6z" fill="currentColor"/></svg>',
        open: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 2h9l5 5v15H6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
        show: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 6h6l2 2h10v11H3z" fill="currentColor"/></svg>',
        remove: '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="1.5"/></svg>',
        deleteFile: '<svg viewBox="0 0 24 24" width="14" height="14"><line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.5"/><path d="M6 7h12l-1 13H7z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
        keep: '<svg viewBox="0 0 24 24" width="14" height="14"><polyline points="4,12 9,17 20,6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
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
            frag.appendChild(actionButton('pPause', 'pause', item.id));
            frag.appendChild(actionButton('pCancel', 'cancel', item.id, 'bd-danger-btn'));
        }else if(status === 'paused'){
            frag.appendChild(actionButton('pResume', 'resume', item.id));
            frag.appendChild(actionButton('pCancel', 'cancel', item.id, 'bd-danger-btn'));
        }else if(status === 'interrupted'){
            frag.appendChild(actionButton('pRetry', 'retry', item.id));
            frag.appendChild(actionButton('pRemove', 'remove', item.id));
        }else if(status === 'completed'){
            frag.appendChild(actionButton('pOpen', 'open', item.id));
            frag.appendChild(actionButton('pShow', 'show', item.id));
            frag.appendChild(actionButton('pRemove', 'remove', item.id));
            frag.appendChild(actionButton('pDeleteFile', 'deleteFile', item.id, 'bd-danger-btn'));
        }else if(status === 'missing'){
            frag.appendChild(actionButton('pRemove', 'remove', item.id));
        }

        return frag;
    }

    function buildRow(item){
        var status = getStatus(item),
            name = basename(item),
            row = document.createElement('div'),
            fillEl = document.createElement('div'),
            iconImg = document.createElement('img'),
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

        fillEl.className = 'bd-progress-fill';
        if((status === 'downloading' || status === 'paused') && item.totalBytes > 0){
            pct = Math.min(100, Math.round((item.bytesReceived / item.totalBytes) * 100));
            fillEl.style.width = pct + '%';
        }else{
            fillEl.style.width = '0%';
        }
        row.appendChild(fillEl);

        iconImg.className = 'bd-file-icon';
        iconImg.alt = '';
        setIcon(item.id, iconImg);

        info.className = 'bd-download-info';

        nameEl.className = 'bd-download-name';
        nameEl.textContent = name;
        nameEl.title = name;

        statusEl.className = 'bd-download-status';
        statusEl.textContent = STATUS_LABELS[status] ? i18n(STATUS_LABELS[status]) : '';

        info.appendChild(nameEl);
        info.appendChild(statusEl);

        actionsEl.className = 'bd-download-actions';
        actionsEl.appendChild(buildActions(item, status));

        row.appendChild(iconImg);
        row.appendChild(info);
        row.appendChild(actionsEl);

        applyFilterToRow(row);

        return row;
    }

    function setIcon(id, imgNode){
        if(iconCache[id]){
            imgNode.src = iconCache[id];
            return;
        }
        chrome.downloads.getFileIcon(id, {size: 16}, function(url){
            if(url){
                iconCache[id] = url;
                imgNode.src = url;
            }
        });
    }

    function currentQuery(){
        return searchInput.value.trim().toLowerCase();
    }

    function rowMatchesQuery(row, query){
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
        if(existing){
            existing.parentNode.removeChild(existing);
        }
        toggleEmptyState();
    }

    function toggleEmptyState(){
        var hasVisible = countVisibleRows() > 0;
        emptyNode.textContent = currentQuery() ? i18n('pNoResults') : i18n('pEmpty');
        emptyNode.hidden = hasVisible;
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
            case 'open':
                chrome.downloads.open(id);
                break;
            case 'show':
                chrome.downloads.show(id);
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
                if(window.confirm(i18n('pConfirmDelete'))){
                    chrome.downloads.removeFile(id, function(){});
                }
                break;
        }
    }

    listNode.addEventListener('click', function(evt){
        var btn = evt.target.closest ? evt.target.closest('.bd-action-btn') : null;
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

    chrome.downloads.search({orderBy: ['-startTime'], limit: 50}, renderAll);
}());
