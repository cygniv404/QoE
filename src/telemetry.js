(function (mediaPlayer) {
    "use strict";
    // create sessionId for server side processing
    var sessionId  = window.crypto.randomUUID();

    mediaPlayer.plugin('telemetry', function (options) {
        var player = this;
        if (!!options && !!options.callback && typeof (options.callback) === 'function') {
            var callback = options.callback;
        }

        init();

        function init() {
            player.ready(handleReady);
            player.addEventListener(mediaPlayer.eventName.error, handleError);
        }

        function handleReady() {
            player.addEventListener(mediaPlayer.eventName.loadedmetadata, handleLoadedMetaData);
        }

        function handleError() {
            var err = player.error();
            var data = {
                sessionId: player.currentSrc(),
                currentTime: player.currentTime(),
                code: "0x" + err.code.toString(16),
                message: err.message
            };

            sendData("error", data);
        }

        function handleLoadedMetaData() {
            // handle video buffering
            player.addEventListener(mediaPlayer.eventName.waiting, handleBufferEventStart);
            player.addEventListener(mediaPlayer.eventName.resume, handleBufferEventEnd);


            // handle bitrate changes
            player.addEventListener(mediaPlayer.eventName.playbackbitratechanged, handleBitrateChanges)

            // handle audio download failure, only logged on the console.
            if (player.audioBufferData()) {
                player.audioBufferData().addEventListener(mediaPlayer.bufferDataEventName.downloadfailed, function () {

                    var data = {
                        sessionId: player.currentSrc(),
                        currentTime: player.currentTime(),
                        bufferLevel: player.audioBufferData().bufferLevel,
                        url: player.audioBufferData().downloadFailed.mediaDownload.url,
                        code: "0x" + player.audioBufferData().downloadFailed.code.toString(16),
                        message: player.audioBufferData().downloadFailed
                    };

                    // sendData("download-failed", data);
                });
            }

            // handle video download failure, only logged on the console.
            if (player.videoBufferData()) {
                player.videoBufferData().addEventListener(mediaPlayer.bufferDataEventName.downloadfailed, function () {

                    var data = {
                        videoFrameSize : player.videoWidth() * player.videoHeight(),
                        videoBitrate: player.currentPlaybackBitrate(),
                        bufferingEventsNumber: player.buffered(),
                        bufferingStateTime: player.videoBufferData(),
                        sessionId: player.currentSrc(),
                        currentTime: player.currentTime(),
                        bufferLevel: player.videoBufferData().bufferLevel,
                        url: player.videoBufferData().downloadFailed.mediaDownload.url,
                        code: "0x" + player.videoBufferData().downloadFailed.code.toString(16),
                        message: player.videoBufferData().downloadFailed
                    };

                    sendData("download-failed", data);
                });
            }

        }
        function handleBitrateChanges(event) {
            var metrics = {
                videoBitrate: player.currentPlaybackBitrate(),
                currentTime: window.Date.now(),

            }
            sendData("bitrate-switch", metrics);
        }
        function handleBufferEventStart(event) {
            var bufferStartTime = window.Date.now();
            var bufferEvent = {startTime:bufferStartTime, endTime: null}
            window.sessionStorage.setItem("bufferEvent", JSON.stringify(bufferEvent));
        }

        function handleBufferEventEnd(event) {
            var bufferEvent = JSON.parse(sessionStorage.getItem('bufferEvent'));
            if(bufferEvent){
                bufferEvent.endTime = window.Date.now();
                sendData("buffer-event", bufferEvent);
                sessionStorage.removeItem("bufferEvent");
            }
        }

        function sendData(eventId, data) {
            data.videoFrameSize = player.videoWidth() * player.videoHeight();
            var metric = {
                id : sessionId,
                eventId: eventId,
                data: data
            };
            callback(metric);
        }
    });
}(window.amp));
