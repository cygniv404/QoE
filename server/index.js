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
app.use(express.urlencoded({extended:true}))

// max time range between bitrate switches
const BITRATE_MAX_SWITCH_TIME = 10

// metric events used in the API requests
const METRICS_EVENTS = {
    DEFAULT : 'metric',
    BITRATE_SWITCH: 'bitrate-switch'
};

// metric indexes to calculate
let HIGHEST_BITRATE_POSSIBLE = false;
let TOO_MANY_BITRATE_SWITCHES = false;
let TOO_MANY_BUFFERING = false;

// routes
app.get("/", (req,res)=>{
    res.json({message: "Welcome to Quality of Experience (QoE) Detector Application"})
})

app.post("/metrics", (req,res)=>{
    const data = req.body.data
    if (data.eventId === METRICS_EVENTS.DEFAULT){
        // save metrics to DB
        db.findOne({ id: data.id }, function (err, doc) {
            if (doc){
                db.update({ id: data.id },data)
            }else{
                db.insert(data)
            }
        });

        // calculate HIGHEST_BITRATE_POSSIBLE
        db.findOne({ id: data.id }, function (err, doc) {
            if (doc){
                const metric = doc.data;
                HIGHEST_BITRATE_POSSIBLE = metric.videoBitrate / metric.videoFrameSize > 3; // dummy test
                console.log('HIGHEST_BITRATE_POSSIBLE', HIGHEST_BITRATE_POSSIBLE)
                // further processing: send notification about HIGHEST_BITRATE_POSSIBLE
            }

        });
    }
    if (data.eventId === METRICS_EVENTS.BITRATE_SWITCH){
        // calculate TOO_MANY_BITRATE_SWITCHES
        db.findOne({ id: data.id }, function (err, doc) {
            if (doc){
                const metric = doc.data;
                if (metric.bitrateSwitchTime){
                    const previousSwitchTime = metric.bitrateSwitchTime;
                    const lastSwitchTime = data.currentTime;
                    if ((lastSwitchTime - previousSwitchTime) < BITRATE_MAX_SWITCH_TIME){
                        TOO_MANY_BITRATE_SWITCHES = true;
                        console.log('TOO_MANY_BITRATE_SWITCHES', TOO_MANY_BITRATE_SWITCHES)
                        // further processing: send notification about TOO_MANY_BITRATE_SWITCHES
                    }
                    db.update({id: data.id}, {bitrateSwitchTime: lastSwitchTime})
                }else{
                    db.update({id: data.id}, {bitrateSwitchTime: data.currentTime})
                }
            }
        });
    }
    res.json(data);
})

const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}.`);
})
