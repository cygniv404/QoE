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
            // send metrics while playing video
            player.addEventListener(mediaPlayer.eventName.timeupdate, handleTimeUpdate);

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
                        sessionId: player.currentSrc(),
                        currentTime: player.currentTime(),
                        bufferLevel: player.videoBufferData().bufferLevel,
                        url: player.videoBufferData().downloadFailed.mediaDownload.url,
                        code: "0x" + player.videoBufferData().downloadFailed.code.toString(16),
                        message: player.videoBufferData().downloadFailed
                    };

                    // sendData("download-failed", data);
                });
            }

        }
        function handleBitrateChanges(event) {
            var metrics = {
                videoBitrate: player.currentPlaybackBitrate(),
                currentTime: player.currentTime(),

            }
            sendData("bitrate-switch", metrics);
        }
        function handleTimeUpdate(event) {
            var metrics = {
                videoFrameSize : player.videoWidth() * player.videoHeight(),
                videoBitrate: player.currentPlaybackBitrate(),
                bufferingEventsNumber: player.buffered().length,
                bufferingStateTime: player.videoBufferData().bufferLevel,
            }
            sendData("metric", metrics);
        }

        function sendData(eventId, data) {
            var eventLog = {
                id : sessionId,
                eventId: eventId,
                data: data
            };
            callback(eventLog);
        }
    });
}(window.amp));
