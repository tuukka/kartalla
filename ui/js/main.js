/* Author: Panu Ranta, panu.ranta@iki.fi, http://14142.net/kartalla/about.html */

'use strict';

function main() {
    console.log('Heppa luppa!');
    var config = new Config();
    var utils = new Utils();
    var uiBar = new UiBar();
    var map = new Map();
    var gtfs = new Gtfs();
    var controller = new Controller(gtfs, map);
    var timing = new Timing(controller, uiBar);
    var tripTypeInfos = new TripTypeInfos(controller, uiBar);

    tripTypeInfos.init(config.vehicleTypes, config.visibleTypes);
    uiBar.init(config.lang, tripTypeInfos, createDataSelection(), createMapSelection());
    controller.init(config.lang, config.onlyRoutes, tripTypeInfos, config.interval);
    timing.init(config);
    map.init(config.mapLat, config.mapLng, config.mapZoomLevel);

    initResizeHandler();

    downloadGtfsJsonData(config.jsonUrl);

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

    function createDataSelection() {
        var names = ['HSL', 'Suomi', 'VR', 'Jyväskylä', 'Joensuu', 'Kuopio', 'Lappeenranta',
            'Oulu', 'Porvoo', 'Seinäjoki', 'Turku', 'Vaasa'];
        var selectedData = getDataTypeName(names, config.dataType);
        return {values: names, selectedValue: selectedData, changeType : function (newType) {
            config.restart(getDataType(newType));
            tripTypeInfos.restart(config.vehicleTypes, config.visibleTypes);
            uiBar.restart();
            controller.restart();
            timing.restart();
            map.restart(config.mapLat, config.mapLng, config.mapZoomLevel);
            downloadGtfsJsonData(config.jsonUrl);
        }};
    }

    function getDataTypeName(dataTypeNames, dataType) {
        for (var i = 0; i < dataTypeNames.length; i++) {
            if (getDataType(dataTypeNames[i]) == dataType) {
                return dataTypeNames[i];
            }
        }
        console.error('No %o in %o', dataType, dataTypeNames);
        return null;
    }

    function getDataType(dataTypeName) {
        return dataTypeName.toLowerCase().replace(/ä/g, 'a');
    }

    function createMapSelection() {
        var maps = ['Leaflet', 'Google'];
        var selectedMap = {true: 'Leaflet', false: 'Google'}[document.URL.indexOf('gmap') === -1];
        return {values: maps, selectedValue: selectedMap, changeType : function (newType) {
            var filePrefix = {'Leaflet': 'index', 'Google': 'gmap'}[newType];
            window.location = filePrefix + '.' + config.lang + '.html';
        }};
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

    this.restart = function () {
        state.downloadIsReady = false;
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
        s.names = null;
        return s;
    }

    this.init = function (vehicleTypes, visibleTypes) {
        state.types = createTypes();
        for (var typeName in state.types) {
            state.types[typeName].isUsed = (vehicleTypes.indexOf(typeName) != -1);
            state.types[typeName].isVisible = (visibleTypes.indexOf(typeName) != -1);
        }
        state.names = vehicleTypes;
    }

    this.restart = function (vehicleTypes, visibleTypes) {
        that.init(vehicleTypes, visibleTypes);
    }

    function createTypes() {
        var types = {};
        types.bus = {isUsed: false, isVisible: false, color: 'blue', count: 0};
        types.train = {isUsed: false, isVisible: false, color: 'red', count: 0};
        types.tram = {isUsed: false, isVisible: false, color: 'green', count: 0};
        types.metro = {isUsed: false, isVisible: false, color: 'orange', count: 0};
        types.ferry = {isUsed: false, isVisible: false, color: 'purple', count: 0};
        types.airplane = {isUsed: false, isVisible: false, color: 'olive', count: 0};
        return types;
    }

    this.getType = function (tripTypeName) {
        return state.types[tripTypeName];
    };

    this.getTypes = function () {
        return state.types;
    };

    this.getNames = function () {
        return state.names;
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
