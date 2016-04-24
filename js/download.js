//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2015/Mar/21
//Version: 0.2

//Date: 2014/Mar/29
//Version: 0.1

function updateBrowserActionIcon(){
    var query = {'state': 'in_progress'},
        count = 0,
        i     = 0,
        hPB   = new HProgressBar(),
        imgData;

    downloadSearchHelpler(query, function(arr){
        count = arr.length;

        if(count){
            setExtBadgeText(count+'');
            chrome.browserAction.setBadgeBackgroundColor({color: "#00CD66"});
            // imgData = hPB.draw(0.5);
            // setExtIcon({imageData: imgData});
        }else{
            setExtBadgeText('');
            setExtIcon({path: '/img/icon-19.png'});
        }
    });
}

function setExtIcon(obj){
    chrome.browserAction.setIcon(obj);
}

function setExtBadgeText(t){
    var obj = {"text": t};
    chrome.browserAction.setBadgeText(obj);
}

function downloadSearchHelpler(query, callback){
    chrome.downloads.search(query, function(DLArray){
        callback(DLArray);
    });
}
