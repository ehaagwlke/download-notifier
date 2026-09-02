//Author: Dingbao.ai [a.k.a ehaagwlke]

// Finds an already-open chrome://downloads tab and focuses it,
// or opens a new one. Shared by the dangerous-download notification's
// "Review Download" button (js/background.js) and the popup's
// "View All Downloads" link (js/popup.js).
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
