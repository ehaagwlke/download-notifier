//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2016/Mar/05
//Vesion: 0.8 (Manifest V3 service worker)

importScripts('consts.js', 'notification.js', 'download.js');

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
                chrome.downloads.setShelfEnabled(false);
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
    chrome.downloads.setShelfEnabled(true);
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
        chrome.downloads.setShelfEnabled(BDIsShowShelf);
    });
});

chrome.storage.onChanged.addListener(function(obj, area){
    if(area === "sync" && obj.hasOwnProperty('BDIsShowShelf')){
        var showShelf = obj.BDIsShowShelf.newValue;
        //console.log('BDIsShowShelf value changed to ', showShelf);
        chrome.downloads.setShelfEnabled(showShelf);
    }
});

chrome.downloads.onChanged.addListener(function(DLObj){
    saftyCheck(DLObj);
    updateBrowserActionIcon();
    showNotification(DLObj);
    clearNotificationWhenExistChange(DLObj);
});

/*===================Browser Action======================*/

chrome.action.onClicked.addListener(function(tab){
    createOrSelectDownloadPage();
});

function createOrSelectDownloadPage(){
    chrome.windows.getAll({populate: true}, function(wins){
        var i = 0,
            l = wins.length,
            tabs,
            j = 0,
            shouldCreate = true,
            WinId;

        for(; i < l; i++){
            if(wins[i].type === "normal" && wins[i].tabs.length > 0){
                tabs = wins[i].tabs;
                WinId = wins[i].id;

                for(; j < tabs.length; j++){
                    if(tabs[j].url === "chrome://downloads/"){
                        chrome.windows.update(WinId, {focused: true});
                        chrome.tabs.update(tabs[j].id, {'selected': true});
                        shouldCreate = false;
                        break;
                    }
                }
            }
        }

        if(shouldCreate){
            chrome.tabs.create({url: 'chrome://downloads', selected: true});
        }
    })
}

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
