function sendMetric(data) {
    "use strict";
    console.log("Custom telemetry logger", data);

    var url = "http://localhost:8080/metrics/";
    window.axios({
        method : "post",
        url: url,
        data : {
            data
        }
    })
        .then( function (data){ console.log("Request Response", data.data) })
        .catch(function (err){ console.log("Request Error", err) })
}
