
window = {setInterval: setInterval};

document = {
    URL: '',
    documentElement: {getAttribute: function() {return 'foo'}},
};

google = {maps: {geometry: {spherical: {computeDistanceBetween: distance}}}};

// adapted from https://github.com/Leaflet/Leaflet/blob/master/src/geo/crs/CRS.Earth.js
function distance(latlng1, latlng2) {
    var latlng1 = {lat: latlng1[0], lng: latlng1[1]};
    var latlng2 = {lat: latlng2[0], lng: latlng2[1]};
    var rad = Math.PI / 180,
        lat1 = latlng1.lat * rad,
        lat2 = latlng2.lat * rad,
        a = Math.sin(lat1) * Math.sin(lat2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.cos((latlng2.lng - latlng1.lng) * rad);

    var res = 6378137 * Math.acos(Math.min(a, 1));
    return res;
}

// adapted from https://github.com/ahocevar/openlayers/blob/master/lib/OpenLayers/Format/EncodedPolyline.js
function decode_polyline(encoded, precision) {
    var len = encoded.length;
    var index = 0;
    var latlngs = [];
    var lat = 0;
    var lng = 0;

    precision = Math.pow(10, -(precision || 5));

    while (index < len) {
        var b;
        var shift = 0;
        var result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        latlngs.push([lat * precision, lng * precision]);
    }

    return latlngs;
};
