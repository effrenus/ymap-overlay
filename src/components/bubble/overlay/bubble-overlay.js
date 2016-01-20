ymaps.modules.define(
    'drawer.bubble.Overlay',
    [
        'util.defineClass',
        'overlay.BaseWithView',
        'overlay.view.Dom',
        'shape.Rectangle',
        'geometry.pixel.Rectangle',
        'shape.Circle',
        'geometry.pixel.Circle',
        'overlay.view.Hotspot',
        'util.Dragger',
        'util.extend',
        'event.Manager',

        'drawer.bubble.layout.Layout'
    ],
    function (provide, defineClass, BaseWithView, DomView, RectangleShape,
        RectanglePixelGeometry, CircleShape,
        CirclePixelGeometry, HotspotView, Dragger, extend, EventManager) {

        function BubbleOverlay (geometry, data, options) {
            BubbleOverlay.superclass.constructor.call(this, geometry, data, options);
        }

        defineClass(BubbleOverlay, BaseWithView, {
            addToMap: function () {
                this._setupView();
                this._setupInteractiveView();
                this._setupDraggable();
            },

            getDefaultPane: function () {
                return 'areas';
            },

            onPaneZoomChange: function (zoomDiff) {

            },

            // Triggered by pane `clientpixelschange` event
            // see https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IContainerPane-docpage/#event-clientpixelschange
            // or it work for shape not overlay
            onPaneClientPixelsChange: function () {
                console.log('onPaneClientPixelsChange', this.getGeometry());
            },

            applyGeometry: function () {
                this.applyGeometryToView(this.getOffsetGeometry(this.getGeometry()));
            },

            applyGeometryToView: function (geometry) {
                this._applyGeometry(geometry);
            },

            // Override, because `_hotspotView.setShape` inside parent method throw error
            applyShape: function () {},

            _setupView: function () {
                this._view = new DomView({
                    position: this.getPane().fromClientPixels([0, 0]),
                    options: this.options,
                    pane: this.resolvePane(this.monitor.get('pane')),
                    zIndex: this.monitor.get('zIndex'),
                    layout: {
                        options: {
                            position: this.getPane().toClientPixels(this.getGeometry().getCoordinates()),
                            text: this.getData().text || '',
                            radius: this.options.get('radius', 10),
                            backgroundColor: this.options.get('backgroundColor', 'green'),
                            viewportSize: this.getMap().container.getSize()
                        },
                        defaultValue: 'bubble#layout'
                    }
                });
            },

            _setupHotspotView: function () {
                var defaultParams = {
                    options: this.options,
                    eventMapper: this.getEventMapper(),
                    containerPane: this.resolvePane(this.monitor.get('pane')),
                    pane: this.resolvePane(this.monitor.get('eventsPane')),
                    zIndex: this.monitor.get('zIndex'),
                    monitorInteractiveOption: true
                };

                this._pinEvents = new EventManager();
                this._pinHotspot = new HotspotView(extend({}, defaultParams, {
                    shape: this._getPinShape(),
                    eventMapper: this._pinEvents
                }));

                this._bubbleEvents = new EventManager();
                this._bubbleHotspot = new HotspotView(extend({}, defaultParams, {
                    shape: this._getBubbleShape(),
                    eventMapper: this._bubbleEvents
                }));
            },

            _getPixelCoordinates: function () {
                var map = this.getMap(),
                    coordinates = this.getGeometry().getCoordinates();

                return map.options.get('projection').toGlobalPixels(coordinates, map.getZoom());
            },

            _setupDraggable: function () {
                this._setupDragger();
                this._pinEvents.add('mousedown', function (event) {
                    var domEvent = event.get('domEvent');
                    if (domEvent.get('button') == 0) {
                        this._pinDragger.start(domEvent);
                        event.preventDefault();
                    }
                }, this);

                this._bubbleEvents.add('mousedown', function (event) {
                    var domEvent = event.get('domEvent');
                    if (domEvent.get('button') == 0) {
                        this._bubbleDragger.start(domEvent);
                        event.preventDefault();
                    }
                }, this);
            },

            _setupDragger: function () {
                this._pinDragger = new Dragger();

                this._pinDragger.events
                    .add('move', function (event) {
                        this._pinHotspot.setShape(
                            this._pinHotspot._shape.shift(event.get('delta'))
                        );

                        var layoutOptions = this._view.getLayoutSync().getData().options;
                        layoutOptions.set('position', event.get('position'));
                    }, this)
                    .add('stop', function (event) {

                    }, this);

                this._bubbleDragger = new Dragger();
                this._bubbleDragger.events
                    .add('move', function (event) {
                        this._bubbleHotspot.setShape(
                            this._bubbleHotspot._shape.shift(event.get('delta'))
                        );

                        var layout = this._view.getLayoutSync();
                        layout.translateBubble(event.get('delta'));
                        layout.rebuild();
                    }, this);
            },

            _updateGeometry: function (pos) {
                var map = this.getMap();
                var globalPos = map.converter.pageToGlobal(pos);
                this.getGeometry().setCoordinates(
                    map.options.get('projection').fromGlobalPixels(globalPos, map.getZoom())
                );
            },

            _getPinShape: function () {
                return new CircleShape(
                    new CirclePixelGeometry(this.getGeometry().getCoordinates(), 10)
                );
            },

            _getBubbleShape: function () {
                var rectBounds = this._view.getLayoutSync().getBubbleBound(),
                    converter = this.getMap().converter;

                return new RectangleShape(
                    new RectanglePixelGeometry([
                        converter.pageToGlobal(rectBounds[0]),
                        converter.pageToGlobal(rectBounds[1])
                    ])
                );
            },

            _applyGeometry: function (geometry) {
                this._view.setPosition(this.geometryToViewPosition(geometry));
            }
        });

        provide(BubbleOverlay);
    }
);
