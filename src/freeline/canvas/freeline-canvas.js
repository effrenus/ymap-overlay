ymaps.modules.define('drawer.freeline.Canvas', [
    'util.defineClass',
    'option.Manager',
    'pane.EventsPane',
    'overlay.static.Polyline',
    'geometry.pixel.LineString'
], function (provide, defineClass, OptionManager, EventsPane, PolylineOverlay, LineStringGeometry) {
    var DEFAULT_OPTIONS = {
        polyline: {
            strokeWidth: 6,
            strokeOpacity: 0.65
        }
    };

    var FreelineCanvas = function (map) {
        this._map = map;
        this._geometries = [];
        this._pane = new EventsPane(map, {
            zIndex: 850
        });
    };

    defineClass(FreelineCanvas, {
        enable: function () {
            this._startListening();
            this._map.panes.append('drawerPane', this._pane);
        },

        disable: function () {
            this._stopListening();
            this._map.panes.remove(this._pane);
        },

        getGeometries: function () {
            return this._geometries;
        },

        _startListening: function () {
            this._listeners = this._pane.events.group()
                .add('mousedown', this._onMouseDown, this);
        },

        _stopListening: function () {
            this._listeners.removeAll();
        },

        _constructOverlay: function () {
            this._overlay = new PolylineOverlay(
                new LineStringGeometry(this._currentPath), {}, DEFAULT_OPTIONS.polyline);
            this._overlay.setMap(this._map);
        },

        _onMouseDown: function (event) {
            this._currentPath = [event.get('globalPixels')];
            this._constructOverlay();
            this._listeners
                .add('mouseup', this._onMouseUp, this)
                .add('mousemove', this._onMouseMove, this);
        },

        _onMouseMove: function (event) {
            this._currentPath.push(event.get('globalPixels'));
            this._updateOverlayGeometry();
        },

        _onMouseUp: function (event) {
            this._geometries.push(new LineStringGeometry(this._currentPath));
            this._currentPath = null;
            this._listeners
                .remove('mouseup', this._onMouseUp, this)
                .remove('mousemove', this._onMouseMove, this);
        },

        _updateOverlayGeometry: function () {
            this._overlay.setGeometry(new LineStringGeometry(this._currentPath));
        }
    });

    provide(FreelineCanvas);
});
