//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2016/Mar/05
//Version: 0.2

/*====================================*/

// const ISPLAYSOUNDKEY = "BDIsPlaySound";
// const SOUNDTRACKID = "BDSoundID";
// const ISSHOWSHELF = "BDIsShowShelf";
// const VOLUMEOFSOUND = "BDVolOfSound";

;(function(w,d){
    var win = w,
        doc = d;

    var saCheckBoxNode   = $('soundAlert'),
        soundsSelectNode = $('sounds'),
        soundSelectNode  = $('alertSound'),
        showShelfNode    = $('showDownloadShelf'),
        volControlNode   = $('volumeOfSound');

    /*==========utilities==========*/
    function $(id){
        return doc.getElementById(id);
    }

    function i18n(msg){
        return chrome.i18n.getMessage(msg);
    }
    

    /*==========ui init==========*/
    $('soundAlertLabel').textContent = i18n('oSoundLabel');
    $('showDownloadShelfLabel').textContent = i18n('oDownloadShelfLabel');
    $('volLabel').textContent = i18n('oVolLabel');
    $('trackLabel').textContent = i18n('oTrackLabel');
    $('volNotes').textContent = i18n('oVolNotes');

    if(doc.body.getAttribute('data-page-type')){
        $('extName').textContent = i18n('extName') + ' ' + i18n('settings');
    }

    win.onload = function(){
        retrieveOptions();
    }


    /*==========selection events==========*/
    showShelfNode.addEventListener('change', function(){
        if(showShelfNode.checked){
            chrome.storage.sync.set({'BDIsShowShelf':true});
        }else{
            chrome.storage.sync.set({'BDIsShowShelf':false});
        }
    });

    saCheckBoxNode.addEventListener('change', function(){
        if(saCheckBoxNode.checked){
            soundsSelectNode.style.display = "block";
            chrome.storage.sync.set({'BDIsPlaySound':1});

            soundTrial();
            setVolume();
        }else{
            soundsSelectNode.style.display = "none";
            chrome.storage.sync.set({'BDIsPlaySound':0});
            chrome.storage.sync.remove('BDSoundID');
        }
    }, false);


    /*==========selection events==========*/

    function soundTrial(){
        var mediaControlNode = $('mediaControl');
        var audio = document.createElement('audio');
        var isPlaying = false;

        audio.src = SOUNDS[soundSelectNode.value];
        audio.volume = volControlNode.value;

        volControlNode.addEventListener('change', function(){
            vol = volControlNode.value;

            $('volValue').textContent = (vol * 100).toFixed(0);
            audio.volume = vol;
            chrome.storage.sync.set({'BDVolOfSound': vol});
        });

        //When select a sound from the drop list
        soundSelectNode.addEventListener('change', function(){
            if(isPlaying){
                audio.pause();
                mediaControlNode.src = STOPICON;
                isPlaying = false;
            }

            audio.src = SOUNDS[soundSelectNode.value];
            audio.play();

            chrome.storage.sync.set({'BDSoundID': soundSelectNode.value});
            mediaControlNode.src = PLAYICON;
        }, false);

        //Media playback control
        mediaControlNode.addEventListener('click', function(){
            if(isPlaying){
                audio.pause();
                audio.currentTime = 0;
            }else{
                audio.play();
                console.log('audio.volume: ', audio.volume);
            }
        }, false);

        audio.addEventListener('play', function(){           
            isPlaying = true;
            mediaControlNode.src = STOPICON;
        }, false);

        audio.addEventListener('playing', function(){
            isPlaying = true;
            mediaControlNode.src = STOPICON;
        }, false);

        audio.addEventListener('pause', function(){
            isPlaying = false;
            mediaControlNode.src = PLAYICON;
        }, false);

        audio.addEventListener('end', function(){
            isPlaying = false;
            mediaControlNode.src = PLAYICON;
        }, false);

        saCheckBoxNode.addEventListener('change', function(){
            if(!saCheckBoxNode.checked){
                audio.pause();
                audio.currentTime = 0;
                isPlaying = false;
                mediaControlNode.src = PLAYICON;
            }
        });
    }

    function setVolume(){
        var vol = 0;
        volControlNode.addEventListener('change', function(){
            vol = volControlNode.value;
            $('volValue').textContent = (vol * 100).toFixed(0);

            chrome.storage.sync.set({'BDVolOfSound': vol});
        });
    }

    function retrieveOptions(){
        chrome.storage.sync.get('BDIsPlaySound', function(obj){
            if(obj['BDIsPlaySound']){
                saCheckBoxNode.checked = true;
                soundsSelectNode.style.display = "block";
                setVolume();

                chrome.storage.sync.get('BDSoundID', function(obj){
                    soundSelectNode.options[obj.BDSoundID].selected = true;
                    soundTrial();
                });
            }
        });

        chrome.storage.sync.get('BDIsShowShelf', function(obj){
            if(obj['BDIsShowShelf']){
                showShelfNode.checked = true;
            }
        });

        chrome.storage.sync.get('BDVolOfSound', function(obj){
            if(obj['BDVolOfSound']){
                volControlNode.value = obj.BDVolOfSound;
                $('volValue').textContent = (obj.BDVolOfSound * 100).toFixed(0);
            }
        })
    }
}(window, document));