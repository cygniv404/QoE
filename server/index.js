// In-memory only datastore to handle metrics
var Datastore = require('nedb');
var db = new Datastore();

// setup express with cors
const express = require('express')
const cors = require('cors')
const app = express()
let corsOptions = {
    origin: "http://localhost:8000"
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({extended: true}))

// max time range between bitrate switches
const BITRATE_MAX_SWITCH_TIME = 10

// metric events used in the API requests
const METRICS_EVENTS = {
    DEFAULT: 'metric',
    BITRATE_SWITCH: 'bitrate-switch',
    BUFFER_EVENT: 'buffer-event'
};

// metric indexes to calculate
let HIGHEST_BITRATE_POSSIBLE = false;
let TOO_MANY_BITRATE_SWITCHES = false;
let TOO_MANY_BUFFERING = false;

function calculateTooManyBuffering(bufferEvents) {

    // test for last added buffering event longer than 1s
    if (bufferEvents[bufferEvents.length - 1].bufferState > 1) {
        return true
    }

    // more than 3 buffering event longer than 500ms per 30s
    let bufferEventsCount = 0;
    let bufferEventsTimeLapse = 0;
    bufferEvents.slice().reverse().forEach(function (item) {
        if (item.bufferState > 0.5) {
            if (bufferEventsTimeLapse === 0) {
                bufferEventsTimeLapse = item.bufferStartTime
                bufferEventsCount++
            } else {
                bufferEventsTimeLapse = bufferEventsTimeLapse - item.bufferStartTime
                if ((bufferEventsTimeLapse / 1000) > 30) {
                    return false
                } else {
                    bufferEventsCount++
                }
            }
        }
        if (bufferEventsCount > 3) {
            return true
        }
    });
    return false
}

function calculateHighestBitratePossible(videoBitrate, videoFrameSize) {
    const newVideoFrameSize = videoBitrate / 60 // Frame Rate in (fps)
    return newVideoFrameSize < videoFrameSize;

}

// routes
app.get("/", (req, res) => {
    res.json({message: "Welcome to Quality of Experience (QoE) Detector Application"})
})

app.post("/metrics", (req, res) => {
    const reqMetric = req.body.data;

    // init record
    db.insert({
        _id: reqMetric.id,
        videoFrameSize: reqMetric.data.videoFrameSize,
        videoBitrate: null,
        bufferEvents: []
    });

    // calculate TOO_MANY_BITRATE_SWITCHES & HIGHEST_BITRATE_POSSIBLE
    if (reqMetric.eventId === METRICS_EVENTS.BITRATE_SWITCH) {
        // calculate HIGHEST_BITRATE_POSSIBLE
        db.update({_id: reqMetric.id}, {$set: {videoBitrate: reqMetric.data.videoBitrate}})
        HIGHEST_BITRATE_POSSIBLE = calculateHighestBitratePossible(reqMetric.data.videoBitrate, reqMetric.data.videoFrameSize)
        if (HIGHEST_BITRATE_POSSIBLE) {
            // further processing...
            console.log('sessionId', reqMetric.id, 'HIGHEST_BITRATE_POSSIBLE', HIGHEST_BITRATE_POSSIBLE)
        }

        // calculate TOO_MANY_BITRATE_SWITCHES
        db.findOne({_id: reqMetric.id}, function (err, doc) {
            if (doc) {
                const metric = doc;
                if (metric.bitrateSwitchTime) {
                    const previousSwitchTime = metric.bitrateSwitchTime;
                    const lastSwitchTime = reqMetric.currentTime;
                    const newBitrate = reqMetric.videoBitrate
                    if ((lastSwitchTime - previousSwitchTime) / 1000 < BITRATE_MAX_SWITCH_TIME) {
                        TOO_MANY_BITRATE_SWITCHES = true;
                        console.log('TOO_MANY_BITRATE_SWITCHES', TOO_MANY_BITRATE_SWITCHES)
                        // further processing: send notification about TOO_MANY_BITRATE_SWITCHES
                    }
                    db.update({id: reqMetric.id}, {bitrateSwitchTime: lastSwitchTime, videoBitrate: newBitrate})
                } else {
                    db.update({id: reqMetric.id}, {bitrateSwitchTime: reqMetric.currentTime})
                }
            }
        });
    }

    // calculate TOO_MANY_BUFFERING
    if (reqMetric.eventId === METRICS_EVENTS.BUFFER_EVENT) {
        db.findOne({_id: reqMetric.id}, function (err, doc) {
            if (doc) {
                const bufferEvent = {
                    bufferState: (reqMetric.data.endTime - reqMetric.data.startTime) / 1000, // is seconds
                    bufferStartTime: reqMetric.data.startTime
                }
                const bufferEvents = doc.bufferEvents;
                bufferEvents.push(bufferEvent)
                db.update({_id: reqMetric.id}, {$set: {bufferEvents: bufferEvents}});

                TOO_MANY_BUFFERING = calculateTooManyBuffering(bufferEvents)
                if (TOO_MANY_BUFFERING) {
                    // further processing...
                    console.log('sessionId', reqMetric.id, 'TOO_MANY_BUFFERING', TOO_MANY_BUFFERING)
                }
            }
        });

    }

    // return request object for debug
    res.json(reqMetric);
})


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
})
