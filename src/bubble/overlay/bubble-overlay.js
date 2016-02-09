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
                BubbleOverlay.superclass.addToMap.call(this);
                this._setupDraggable();
            },

            getDefaultPane: function () {
                return 'areas';
            },

            onPaneZoomChange: function () {
            },

            onPaneClientPixelsChange: function () {
                var layout = this._view.getLayoutSync();
                layout.getData().options
                    .set('translateMode', true)
                    .set('position', this.getPane().toClientPixels(this.getGeometry().getCoordinates()))
                    .set('translateMode', false);
            },

            applyGeometryToView: function (view, position) {
                var clientCoordinates = this.getPane().toClientPixels(position.getCoordinates()),
                    layoutOptions = this._view.getLayoutSync().getData().options;

                layoutOptions.set('position', clientCoordinates);
            },

            applyShape: function () {
                // this._pinHotspot.setShape(
                //     this._pinHotspot._shape.shift(event.get('delta'))
                // );
            },

            getViewParams: function () {
                return {
                    position: this.getPane().fromClientPixels([0, 0]),
                    layout: {
                        options: {
                            position: this.getPane().toClientPixels(this.getGeometry().getCoordinates()),
                            radius: this.options.get('radius', DEFAULT_PIN_RADIUS),
                            backgroundColor: this.options.get('backgroundColor', DEFAULT_PIN_COLOR),
                            viewportSize: this.getMap().container.getSize()
                        },
                        defaultValue: 'drawer#bubbleLayout'
                    }
                };
            },

            getViewClass: function () {
                return DomView;
            },

            getViewCallbacks: function () {},

            geometryToViewPosition: function () {},

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
                this._setupDraggers();
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

            _setupDraggers: function () {
                this._pinDragger = new Dragger();

                this._pinDragger.events
                    .add('move', function (event) {
                        this.setGeometry(this.getGeometry().shift(event.get('delta')));
                        this._pinHotspot.setShape(
                            this._pinHotspot._shape.shift(event.get('delta'))
                        );
                    }, this);

                this._bubbleDragger = new Dragger();
                this._bubbleDragger.events
                    .add('move', function (event) {
                        this._bubbleHotspot.setShape(
                            this._bubbleHotspot._shape.shift(event.get('delta'))
                        );

                        var layout = this._view.getLayoutSync();
                        layout.translateBubble(event.get('delta'));
                        // TODO: set option, and after change invoke rebuild in layout
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
