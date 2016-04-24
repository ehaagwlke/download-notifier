//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2016/Mar/06
//Version: 0.5

//Date: 2016/Mar/05
//Version: 0.4

//Date: 2015/Jun/20
//Version: 0.3

//Date: 2015/Mar/21
//Version: 0.2

//Date: 2014/Mar/29
//Version: 0.1

//*====================================*/

const notificationId = "BDNotification";
const storageDownIdKey = "BDNotificationDownID";

var extId = chrome.i18n.getMessage("@@extension_id"),
    prefix = "chrome-extension://" + extId,

    defaultIconUrl = prefix + "/img/icon-128.png",
    fileIconUrl = prefix + "/img/file-icon.png",
    folderIconUrl = prefix + "/img/folder-icon.png",
    defaultFolderIconUrl = prefix + "/img/default-folder-icon.png";

// The function for getting OS name
var os = (function(){
    var _ua = navigator.userAgent.toLowerCase(),
        _os;

    if(_ua.length){
        if(_ua.indexOf('windows') > -1){
            _os = "windows";
        }else if(_ua.indexOf('mac') > -1){
            _os = "Mac";
        }else{
            _os = "other";
        }
    }else{
        _os = "windows";
    }

    return _os;
}());

var ntfs = {},
    opt = {
        type: "basic",
        title: "Download Notifier",
        iconUrl: defaultIconUrl
    };

var shelper = new StorageHelper();

function i18n(msg){
    return chrome.i18n.getMessage(msg);
}

// A storage helper
function StorageHelper(){
    var ls = localStorage[storageDownIdKey];

    this.set = set;
    this.contains = contains;
    this.remove = remove;

    function set(did){
        var arr = [];

        if(ls){
            arr = ls.split(',');
            if(!contains(did) && !isNaN(did)){
                arr.push(did);
                ls = arr.join(',');
            }
        }else if(did && !isNaN(did)){
            ls = did+'';
        }

        return ls;
    }

    function remove(did){
        if(did && !isNaN(did)){
            ls = ls.replace(did, '')
                    .replace(',,',',')
                    .replace(/^,*|,*$/g, '');
        }
        return ls;
    }

    function contains(did){
        var arr = [],
            i = 0,
            al,
            result = false;

        if(ls){
            arr = ls.split(',');
            //console.log('arr = ', arr);

            if(arr.length > 0){
                al = arr.length;
                for(; i < al; i++){
                    if(parseInt(did, 10) === parseInt(arr[i], 10)){
                        result = true;
                        break;
                    }
                }
            }
        }
        return result;
    }
}

function showNotification(DItem){
    var obj = DItem,
        did,
        fname,
        _obj,
        _openFileButton,
        _openFolderButton,
        _openFolderButtonTitle;

    if(os === "windows"){
        _openFolderButtonTitle = i18n("nOpenFolderTitleWin");
    }else if(os === "mac"){
        _openFolderButtonTitle = i18n("nOpenFolderTitleMac");
    }else{
        _openFolderButtonTitle = i18n("nOpenFolderTitle");
    }

    if(obj.hasOwnProperty("state")){
        if(obj.state.current === "complete"){
            did = obj.id;

            shelper.set(did);

            chrome.downloads.search({id: did}, function(DItemArray){
                _obj = DItemArray[0];
                
                // get the file name
                fname = _obj.filename.replace(/^.*[\\\/]/, '');

                // set buttons' properties
                _openFileButton = {
                    title:  i18n("nOpenFileTitle"),
                    iconUrl: fileIconUrl
                };

                _openFolderButton = {
                    title: _openFolderButtonTitle,
                    iconUrl: folderIconUrl
                };

                opt.title = i18n("nDownFinished");
                opt.message = fname;
                opt.buttons = [_openFileButton, _openFolderButton];
                

                chrome.downloads.getFileIcon(did, {size: 32}, function(url){
                    setFileIcon(url);
                });

                function setFileIcon(url){
                    opt.iconURL = url ? url : defaultIconUrl;
                }

                ntfs[did] = {};
                ntfs[did]['opt'] = opt;
                ntfs[did]['notificationId'] = notificationId + '|' + did;

                // if we already have a notification shown
                // we just clear it, and create a new one
                // if not, we just create a new one.
                chrome.notifications.getAll(function(obj){
                    var notiId = ntfs[did].notificationId;

                    playSound();

                    if(obj.hasOwnProperty(notiId)){
                        chrome.notifications.clear(notiId, function(){
                            chrome.notifications.create(notiId, opt, function(nid){});
                        });
                    }else{
                        chrome.notifications.create(notiId, opt, function(nid){});
                    }
                });
            });
        }
    }
}

// Play a sound when downloaded
function playSound(){
    chrome.storage.sync.get([
        'BDIsPlaySound', 
        'BDSoundID', 
        'BDVolOfSound'], 
        function(obj){
            if(obj.BDIsPlaySound){
                var el    = document.createElement('audio');

                el.src = SOUNDS[obj.BDSoundID];
                el.autoplay = true;
                el.volume = obj.BDVolOfSound || 0.8;
            }
    });
}


function openOrShowFileById(downId, action, alertContent){
    if(!downId || !action){
        return;
    }

    var _id = downId,
        _action = action,
        _alertContent = alertContent,
        _actions = {
            "open": openFunc,
            "show": showFunc
        };

    // open downloaded file by id.
    function openFunc(id){
        chrome.downloads.open(id);
    }

    // show downloaded file by id.
    function showFunc(id){
        chrome.downloads.show(id);
    }

    chrome.downloads.search({id: _id}, function(DItem){
        var notiId = ntfs[_id].notificationId;

        if(DItem[0].exists){
            _actions[action](DItem[0].id);
        }else{
            chrome.notifications.clear(notiId, function(){});
            delete ntfs[_id];
            shelper.remove(_id);
            alert(_alertContent);
        }
    });
}

function clearNotificationWhenExistChange(DObj){
    var id = DObj.downid,
        exists;

    if(!id){
        return;
    }

    if(DObj.hasOwnProperty('exists')){
        exists = DObj.exists.current;
    }

    if(shelper.contains(id) && !exists){
        chrome.notifications.getAll(function(obj){
            var notiId = ntfs[id].notificationId;
            if(obj.hasOwnProperty(notiId)){
                chrome.notifications.clear(notiId, function(){
                    delete ntfs[id];
                    shelper.remove(id);
                });
            }
        });
    }
}

chrome.notifications.onButtonClicked.addListener(function(nid, btnIdx){
    var downId = parseInt(nid.split('|')[1], 10),
        strFileNotFound = i18n("nFileNotFound"),
        strIdNotFound = i18n("nDownIdNotFound");

    if(ntfs.hasOwnProperty(downId) && nid === ntfs[downId].notificationId){
        if(btnIdx === 0){
            if(shelper.contains(downId)){
                openOrShowFileById(downId, "open", strFileNotFound);
            }else{
                chrome.notifications.clear(nid, function(){});
                delete ntfs[downId];
                shelper.remove(downId);
                alert(strIdNotFound);
            }
        }

        if(btnIdx === 1){
            if(shelper.contains(downId)){
                openOrShowFileById(downId, "show", strFileNotFound);
            }else{
                chrome.notifications.clear(nid, function(){});
                delete ntfs[downId];
                shelper.remove(downId);
                alert(strIdNotFound);
            }
        }
    }else{
        alert(strFileNotFound);
    }
});
