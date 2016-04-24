//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2016/Mar/05
//Vesion: 0.8

//Date: 2015/Jun/21
//Vesion: 0.7

//Date: 2015/May/30
//Version: 0.6

//Date: 2015/May/16
//Version: 0.5
//Due to source management problems, this version is
//just a copy from the release version of the code.
//Now I switched to Github for source code management.

//Date: 2015/Apr/11
//Version: 0.4

//Date: 2015/Mar/22
//Version: 0.3

//Date: 2014/Apr/14
//Version: 0.2

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
    localStorage.clear();
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

chrome.browserAction.onClicked.addListener(function(tab){
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
        cfm = confirm(str);
    
    if(cfm){
        createOrSelectDownloadPage();
    }else{
        chrome.downloads.cancel(id, function(){
            //do nothing;
        });
    }
}