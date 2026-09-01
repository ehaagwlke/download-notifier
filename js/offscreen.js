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
