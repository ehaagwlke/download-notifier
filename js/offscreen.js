// Runs inside the hidden Offscreen Document created by js/notification.js.
// Plays notification sounds on behalf of the service worker, which has
// no DOM/Audio element of its own.
chrome.runtime.onMessage.addListener(function(msg){
    if(msg && msg.type === 'BDPlaySound'){
        var el = new Audio(msg.soundUrl);
        el.volume = msg.volume;
        el.play();
    }
});

// Reports the OS color scheme (matchMedia isn't available in the service
// worker) so the toolbar icon can pick a dark or light glyph.
var bdDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function reportColorScheme(){
    chrome.runtime.sendMessage({
        type: 'BDColorScheme',
        scheme: bdDarkQuery.matches ? 'dark' : 'light'
    }, function(){
        void chrome.runtime.lastError;
    });
}

bdDarkQuery.addEventListener('change', reportColorScheme);
chrome.runtime.onMessage.addListener(function(msg){
    if(msg && msg.type === 'BDQueryColorScheme'){
        reportColorScheme();
    }
});
reportColorScheme();
