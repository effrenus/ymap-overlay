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
        RectanglePixelGeometry, CircleShape, CirclePixelGeometry,
        HotspotView, Dragger, extend, EventManager) {

        var DEFAULT_PIN_RADIUS = 10,
            DEFAULT_PIN_COLOR = '#555555';

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
                console.log('zoom changed');
            },

            onPaneClientPixelsChange: function () {
                var layoutOptions = this._view.getLayoutSync().getData().options;
                layoutOptions.set('position', this.getPane().toClientPixels(this.getGeometry().getCoordinates()));
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
                            radius: this.options.get('radius', DEFAULT_PIN_RADIUS),
                            backgroundColor: this.options.get('backgroundColor', DEFAULT_PIN_COLOR),
                            viewportSize: this.getMap().container.getSize()
                        },
                        defaultValue: 'drawer#bubbleLayout'
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

            _getPinShape: function () {
                return new CircleShape(
                    new CirclePixelGeometry(
                        this.getGeometry().getCoordinates(),
                        this.options.get('radius', DEFAULT_PIN_RADIUS)
                    )
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
            }
        });

        provide(BubbleOverlay);
    }
);
