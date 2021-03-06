/* Author: Panu Ranta, panu.ranta@iki.fi, http://14142.net/kartalla/about.html */

'use strict';

function main() {
    var config = new Config();
    var utils = new Utils();
    var uiBar = new UiBar();
    var map = new Map();
    var gtfs = new Gtfs();
    var controller = new Controller(gtfs, map);
    var timing = new Timing(controller, uiBar);
    var tripTypeInfos = new TripTypeInfos(controller, uiBar);

    tripTypeInfos.init(config.visibleTypes);
    uiBar.init(config.lang, tripTypeInfos);
    controller.init(config.lang, config.onlyRoutes, tripTypeInfos, config.interval);
    timing.init(config);
    map.init(config.mapLat, config.mapLng, config.mapZoomLevel);

    initResizeHandler();

    downloadGtfsJsonData(config.json_url);

    function downloadGtfsJsonData(filename) {
        var readyEvent = document.createEvent('Event');
        readyEvent.initEvent('gtfsDownloadIsReady', false, false);
        document.addEventListener('gtfsDownloadIsReady', downloadIsReady, false);

        var startTime = new Date();
        var downloadRequest = null;

        utils.downloadUrl(filename, uiBar.updateDownloadProgress, function (request) {
            downloadRequest = request;
            document.dispatchEvent(readyEvent);
        });

        function downloadIsReady() {
            var duration = (((new Date()).getTime() - startTime.getTime()) / 1000).toFixed(1);
            gtfs.init(JSON.parse(downloadRequest.responseText));
            uiBar.setDataInfo(gtfs.getDtfsEpoch(), gtfs.getJsonEpoch(),
                              downloadRequest.responseText.length, duration,
                              isDownloadCompressed());
            timing.downloadIsReady();
        }

        function isDownloadCompressed() {
            var contentEncoding = downloadRequest.getResponseHeader('Content-Encoding');
            return ((contentEncoding !== null) && (contentEncoding === 'gzip'));
        }
    }

    function initResizeHandler() {
        window.onresize = resizeMap;

        resizeMap();

        function resizeMap() {
            var mapHeight = document.documentElement.clientHeight -
                document.getElementById('ui_bar').clientHeight;
            map.resize(mapHeight);
        }
    }
}

function Timing(controller, uiBar) {
    var that = this;
    var state = getState();

    function getState() {
        var s = {};
        s.startMapDate = null;
        s.startRealDate = null;
        s.tickMs = 1000;
        s.speedMultiplier = null;
        s.stopAfter = null;
        s.intervalId = null;
        s.downloadIsReady = false;
        return s;
    }

    this.init = function (config) {
        state.startMapDate = config.startDate;
        state.startRealDate = new Date();
        state.speedMultiplier = config.speed;
        state.stopAfter = config.stopAfter;
        state.intervalId = window.setInterval(function () {processTick();}, state.tickMs);
        uiBar.updateClock(getMapDate());
    };

    function processTick() {
        var mapDate = getMapDate();

        uiBar.updateClock(mapDate);

        if (state.downloadIsReady) {
            controller.update(mapDate);
        }

        if ((state.stopAfter !== null) && isTimeToStop(mapDate)) {
            window.clearInterval(state.intervalId);
            console.log('stopped after %d minutes', state.stopAfter);
        }
    }

    function getMapDate() {
        var realMsFromStart = (new Date()).getTime() - state.startRealDate.getTime();
        var mapMsFromStart = realMsFromStart * state.speedMultiplier;
        return new Date(state.startMapDate.getTime() + mapMsFromStart);
    }

    function isTimeToStop(mapDate) {
        var minutesSinceStart = ((mapDate.getTime() - state.startMapDate.getTime()) / 1000) / 60;
        return minutesSinceStart > state.stopAfter;
    }

    this.downloadIsReady = function () {
        state.downloadIsReady = true;
    };
}

function TripTypeInfos(controller, uiBar) {
    var that = this;
    var state = getState();

    function getState() {
        var s = {};
        s.types = null;
        return s;
    }

    this.init = function (visibleTypes) {
        state.types = createTypes();
        for (var typeName in state.types) {
            state.types[typeName].isVisible = (visibleTypes.indexOf(typeName) != -1);
        }
    }

    function createTypes() {
        var types = {};
        types.bus = {isVisible: false, color: 'blue', count: 0};
        types.train = {isVisible: false, color: 'red', count: 0};
        types.tram = {isVisible: false, color: 'green', count: 0};
        types.metro = {isVisible: false, color: 'orange', count: 0};
        types.ferry = {isVisible: false, color: 'purple', count: 0};
        return types;
    }

    this.getType = function (tripTypeName) {
        return state.types[tripTypeName];
    };

    this.getTypes = function () {
        return state.types;
    };

    this.getNames = function () {
        return ['bus', 'train', 'tram', 'metro', 'ferry'];
    };

    this.resetStatistics = function () {
        for (var tripTypeName in state.types) {
            state.types[tripTypeName].count = 0;
        }
    };

    this.refreshStatistics = function () {
        uiBar.updateStatistics();
    };

    this.toggleVisibility = function (tripTypeName) {
        state.types[tripTypeName].isVisible = !state.types[tripTypeName].isVisible;
        controller.updateTripTypeVisibility(tripTypeName);
    };
}
