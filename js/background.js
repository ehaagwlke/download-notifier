//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2016/Mar/05
//Vesion: 0.8 (Manifest V3 service worker)

importScripts('consts.js', 'notification.js', 'download.js', 'downloads-page.js');

/*======================Settings modifier========================*/


//When we got installed, the download shelf will
//be disabled. 'Cause we now have an amazing
//download manager, who need that shelf?
chrome.runtime.onInstalled.addListener(function(obj){
    if(obj.reason === "install" || obj.reason === "update"){
        
        chrome.storage.local.get('BDIsFirstRun', function(obj){
            if(!obj.hasOwnProperty('BDIsFirstRun')){
                chrome.runtime.openOptionsPage();
                chrome.notifications.getAll(function(obj){
                    if(obj.hasOwnProperty('BDNotification')){
                        chrome.notifications.clear('BDNotification', function(){
                            // do nothing now;
                        });
                    }
                });
            }
            chrome.storage.local.set({'BDIsFirstRun': false});
        });

        chrome.storage.sync.get(['BDIsShowShelf','BDIsPlaySound', 'BDVolOfSound'], function(obj){
            if(!obj.hasOwnProperty('BDIsShowShelf')){
                chrome.storage.sync.set({'BDIsShowShelf': false});
                setShelfVisibility(false);
            }

            if(!obj.hasOwnProperty('BDIsPlaySound')){
                chrome.storage.sync.set({'BDIsPlaySound': 1, 'BDSoundID': 0});   
            }

            if(!obj.hasOwnProperty('BDVolOfSound')){
                chrome.storage.sync.set({'BDVolOfSound': 0.8});
            }
        });

        updateBrowserActionIcon();
    }
});

//Clear the mess if we got uninstalled.
chrome.management.onUninstalled.addListener(function(id){
    setShelfVisibility(true);
    chrome.storage.local.clear();
    chrome.storage.sync.clear();
});

/*===================Settings modifier done======================*/

chrome.downloads.onCreated.addListener(function(DLItem){
    saftyCheck(DLItem);
    updateBrowserActionIcon();
    chrome.storage.sync.get('BDIsShowShelf', function(obj){
        var BDIsShowShelf = obj.BDIsShowShelf;
        //console.log('on downloads created ', BDIsShowShelf);
        setShelfVisibility(BDIsShowShelf);
    });
});

chrome.storage.onChanged.addListener(function(obj, area){
    if(area === "sync" && obj.hasOwnProperty('BDIsShowShelf')){
        var showShelf = obj.BDIsShowShelf.newValue;
        //console.log('BDIsShowShelf value changed to ', showShelf);
        setShelfVisibility(showShelf);
    }
});

// chrome.downloads.setShelfEnabled throws "No matching signature" if
// given anything but a real boolean (e.g. undefined, which happens
// when a storage.onChanged event reports a removed key's .newValue).
// Coerce defensively, and prefer the newer setUiOptions API where
// available, since setShelfEnabled is deprecated/being removed from
// Chrome in favor of it.
function setShelfVisibility(enabled){
    var isEnabled = !!enabled;

    if(chrome.downloads.setUiOptions){
        chrome.downloads.setUiOptions({enabled: isEnabled}, function(){
            if(chrome.runtime.lastError){
                console.error('setUiOptions failed:', chrome.runtime.lastError.message);
            }
        });
    }else if(chrome.downloads.setShelfEnabled){
        try{
            chrome.downloads.setShelfEnabled(isEnabled);
        }catch(e){
            console.error('setShelfEnabled failed:', e.message);
        }
    }
}

chrome.downloads.onChanged.addListener(function(DLObj){
    saftyCheck(DLObj);
    updateBrowserActionIcon();
    showNotification(DLObj);
    clearNotificationWhenExistChange(DLObj);
});

function saftyCheck(obj){
    if(obj && obj.hasOwnProperty("danger")){
        if(typeof obj.danger === "object"){
            if(obj.danger.current !== "safe" && obj.danger.current !== "accepted"){
                dangerDownloadHandler(obj.id);
            }
        }else{
            if(obj.danger !== "safe" && obj.danger !== "accepted"){
                dangerDownloadHandler(obj.id);
            }
        }
    }
}

function dangerDownloadHandler(id){
    var str = chrome.i18n.getMessage("aHarmfulFileAlert"),
        notiId = "BDDangerAlert|" + id;

    chrome.notifications.create(notiId, {
        type: "basic",
        iconUrl: "/img/icon-128.png",
        title: chrome.i18n.getMessage("extName"),
        message: str,
        buttons: [
            {title: chrome.i18n.getMessage("aHarmfulFileReviewButton")},
            {title: chrome.i18n.getMessage("aHarmfulFileCancelButton")}
        ],
        requireInteraction: true
    });
}

chrome.notifications.onButtonClicked.addListener(function(nid, btnIdx){
    if(nid.indexOf("BDDangerAlert|") === 0){
        var id = parseInt(nid.split('|')[1], 10);
        chrome.notifications.clear(nid, function(){});

        if(btnIdx === 0){
            createOrSelectDownloadPage();
        }else{
            chrome.downloads.cancel(id, function(){
                //do nothing;
            });
        }
    }
});

// The popup marks completed downloads as "seen" by sending this
// message the moment it opens (see js/popup.js).
chrome.runtime.onMessage.addListener(function(msg){
    if(msg && msg.type === 'BDPopupOpened'){
        clearUnseenCompletedCount();
    }
});
