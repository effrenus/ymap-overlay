ymaps.modules.define('drawer.freeline.Behavior', [
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

    var FreelineBehavior = function (map) {
        this._isDrawing = false;
        this._map = map;
        this._geometries = [];
        this._pane = new EventsPane(map, {
            zIndex: 850
        });
        this.options = new OptionManager(DEFAULT_OPTIONS);
    };

    defineClass(FreelineBehavior, {
        enable: function () {
            this._startListening();
            this._map.panes.append('drawerPane', this._pane);
        },

        disable: function () {
            this._stopListening();
            this._map.panes.remove(this._pane);
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
                new LineStringGeometry(this._points), {}, this.options.get('polyline'));
            this._overlay.setMap(this._map);
        },

        getGeometries: function () {
            return this._geometries;
        },

        _saveCurrentGeometry: function () {
            this._geometries.push(new LineStringGeometry(this._points));
        },

        _onMouseDown: function (event) {
            if (this._isDrawing) {
                return;
            }
            this._points = [event.get('globalPixels')];
            this._constructOverlay();
            this._isDrawing = true;
            this._listeners
                .add('mouseup', this._onMouseUp, this)
                .add('mousemove', this._onMouseMove, this);
        },

        _onMouseUp: function (event) {
            this._saveCurrentGeometry();
            this._points = null;
            this._isDrawing = false;
            this._listeners
                .remove('mouseup', this._onMouseUp, this)
                .remove('mousemove', this._onMouseMove, this);
        },

        _onMouseMove: function (event) {
            this._points.push(event.get('globalPixels'));
            this._updateOverlayGeometry();
        },

        _updateOverlayGeometry: function () {
            this._overlay.setGeometry(new LineStringGeometry(this._points));
        }
    });

    provide(FreelineBehavior);
});
