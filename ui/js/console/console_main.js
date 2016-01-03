
fs = require("fs");

console_main();

function console_main() {
    var config = new Config();
    var utils = new Utils();
    var uiBar = new UiBar();
    uiBar = {
        updateClock: function() {},
        updateStatistics: function() {}
    };
    var map = new Map();
    var markerIncrement = 0;
    map = {
        decodePath: decode_polyline,
        getDistances: map.getDistances,
        addMarker: function(path, pathId, isVisible, color, route) {
            console.log("add", markerIncrement, route);
            return {path: path, pathId: pathId, route: route, id: markerIncrement++}
        },
        updateMarker: function(marker, distanceFromStart, opacity, title) {
            console.log("update", marker.id, distanceFromStart - marker.distanceFromStart);
            marker.distanceFromStart = distanceFromStart;
            var prefix = 0, step;
            for(var i = 0; i<marker.path.length-2; i++) {
                step = distance(marker.path[i], marker.path[i+1]);
                if (prefix+step > distanceFromStart)
                    break;
                prefix += step;
            }
            var ratio = (distanceFromStart - prefix) / step;
            var lat = marker.path[i][0]+ratio*(marker.path[i+1][0]-marker.path[i][0]);
            var lon = marker.path[i][1]+ratio*(marker.path[i+1][1]-marker.path[i][1]);
            marker.latlon = [lat, lon];
            var mode = "bus";
            var msg = {
                veh: "fake"+marker.id,
                desi: marker.route,
                lat: lat,
                long: lon
            };
            var topic = "/fakehfp/journey/"+mode+"/"+msg.veh+"/"+msg.desi+"/0/XXX/00:00/XXX/XXX";
            console.log(topic, msg);
            if (lat && isFinite(lat) && lon && isFinite(lon)) {
                if (global.mqtt_client)
                    mqtt_client.publish(topic, JSON.stringify({VP:msg}));
            }
        },
        removeMarker: function(marker) {
            console.log("remove", marker.pathId)
        }
    };
    var gtfs = new Gtfs();
    var controller = new Controller(gtfs, map);
    var timing = new Timing(controller, uiBar);
    var tripTypeInfos = new TripTypeInfos(controller, uiBar);

    tripTypeInfos.init(config.visibleTypes);
//    uiBar.init(config.lang, tripTypeInfos);
    controller.init(config.lang, config.onlyRoutes, tripTypeInfos, config.interval);
    timing.init(config);
//    map.init(config.mapLat, config.mapLng, config.mapZoomLevel);

//    downloadGtfsJsonData(config.json_url);
    fs.readFile("ui/json/gtfs.json", function(err, data) {
        if (err) throw err;
        gtfs.init(JSON.parse(data));
        timing.downloadIsReady();
    });
}
