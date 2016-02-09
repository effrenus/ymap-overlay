(function (global){


var ym = {
    "project": {
        "preload": [],
        "namespace": "ymaps",
        "jsonpPrefix": "",
        "loadLimit": 500
    },
    "ns": {},
    "env": {},
    "envCallbacks": []
};

ym.modules = global['ymaps'].modules;

ym.modules.define(
    'drawer.bubble.Control',
    [
        'util.defineClass',
        'control.Button',
        'drawer.bubble.Overlay'
    ],
    function (provide, defineClass, Button, BubbleOverlay) {
        function Control () {
            Control.superclass.constructor.call(this, parameters);
            this.listeners = this.events
                                .group()
                                .add('select', this._onSelect, this)
                                .add('deselect', this._onDeSelect, this);

        }

        defineClass(Control, Button, {
            _onSelect: function () {
                this.getMap().events.add('click', this._addBubble, this);
            },

            _onDeSelect: function () {
                this.getMap().remove('click', this._addBubble, this);
            },

            _addBubble: function (event) {

            }
        });
    }
);

ymaps.modules.define(
    'drawer.bubble.layout.Layout',
    [
        'templateLayoutFactory',
        'geometry.pixel.Circle',
        'shape.Circle',
        'layout.storage',
        'util.dom.style',
        'util.dom.element',
        'util.css',
        'Monitor',
        'util.svgTools',
        'util.svgPath'
    ],
    function (provide, templateLayoutFactory, PixelGeometry, CircleShape,
            layoutStorage, domStyle, domElement, utilCss, Monitor, svgTools, svgPath) {

        var PIN_CLASS = utilCss.addPrefix('pin'),
            BUBBLE_CLASS = utilCss.addPrefix('bubble'),

            PADDING = 50, // padding from nearest point, needed to create bubble tail
            BUBBLE_PADDINGS = [15, 15], // content paddings inside bubble
            TO_PIN_DISTANCE = 50, // default distance from bubble to point
            TEXT_STYLE = {
                'font-size': 16,
                'font-family': 'Arial, sans-serif'
            };

        var Layout = templateLayoutFactory.createClass([
                '<ymaps class="' + PIN_CLASS + '" style="border-radius: 50%"></ymaps>',
                '<svg class="' + BUBBLE_CLASS + '" preserveAspectRatio="xMinYMin slice"></svg>'
            ].join(''),
            {
                build: function () {
                    Layout.superclass.build.call(this);

                    var element = this.getElement(),
                        options = this.getData().options,
                        radius = options.get('radius'),
                        coords = options.get('position'),
                        viewportSize = options.get('viewportSize'),
                        backgroundColor = options.get('backgroundColor', '#CCCCCC'),
                        textString = this.getData().text;

                    domStyle.css(domElement.findByClassName(element, PIN_CLASS), {
                        position: 'absolute',
                        width: radius * 2 + 'px',
                        height: radius * 2 + 'px',
                        backgroundColor: backgroundColor
                    });
                    this._setPinPosition([(coords[0] - radius), (coords[1] - radius)]);

                    this.monitor = new Monitor(options);
                    this.bindOptions();

                    /**
                     * Set SVG element width/height
                     */
                    this._setSVGSize([viewportSize[0], viewportSize[1]]);

                    this._transformMatrix = svgTools.getCoordTransformFactor(this._getSVGElement());

                    this._hiddenSvgTextNode = this._setupHiddenTextNode(textString);
                    this._textNodeSize = this._getTextBBox();

                    /**
                     * If text block width greater then viewport, truncate text string
                     */
                    if (this._textNodeSize[0] > viewportSize[0]) {
                        textString = this._getTruncatedString(viewportSize[0] - BUBBLE_PADDINGS[0] * 2);
                        this._hiddenSvgTextNode.textContent = textString;
                        this._textNodeSize = this._getTextBBox();
                    }

                    this._setupBubbleBounds();
                    this._currentPath = this._getRectPath(options.get('bubbleSVGBounds'));

                    this._setupBubble(this._currentPath);
                    this._setupSVGTail(coords);
                    this._setupText(textString);
                },

                /**
                 * Update pin position and bubble tail
                 * Invoked after pin position changed
                 */
                rebuild: function () {
                    var options = this.getData().options,
                        coords = options.get('position'),
                        radius = options.get('radius');

                    this._setPinPosition([(coords[0] - radius), (coords[1] - radius)]);
                    this._setupSVGTail(coords);
                },

                /**
                 * Bind listeners to option changes
                 */
                bindOptions: function () {
                    this.monitor.add('position', function (newVal, oldVal) {
                        var delta = [newVal[0] - oldVal[0], newVal[1] - oldVal[1]];

                        this._translateBubble(delta);
                        this.rebuild();
                    }, this);
                },

                /**
                 * Return bubble bound coordinates
                 * @return {Number[]}
                 */
                getBubbleBound: function () {
                    var bounds = this.getData().options.get('bubbleSVGBounds');

                    return [
                        this._toClientCoords(bounds[0]),
                        this._toClientCoords(bounds[1])
                    ];
                },

                /**
                 * Move bubble by delta pixels
                 * Input delta pixels converts to SVG coordinate system
                 * @param  {Number[]} delta Client pixels
                 */
                _translateBubble: function (delta) {
                    var bounds = this.getData().options.get('bubbleSVGBounds'),
                        transformedDelta = this._toSVGCoords(delta);

                    this.getData().options.set(
                        'bubbleSVGBounds',
                        [
                            [bounds[0][0] + transformedDelta[0], bounds[0][1] + transformedDelta[1]],
                            [bounds[1][0] + transformedDelta[0], bounds[1][1] + transformedDelta[1]]
                        ]
                    );

                    this._currentPath = this._getRectPath(this.getData().options.get('bubbleSVGBounds'));
                    this._svgPathElement.setAttribute('d', this._currentPath);
                    this._svgHiddenPath.setAttribute('d', this._currentPath);
                    this._updateTextPosition();
                },

                _setPinPosition: function (pos) {
                    var elm = domElement.findByClassName(this.getElement(), PIN_CLASS);
                    domStyle.setPosition(elm, pos);
                },

                /**
                 * Setup SVG element width, height and viewBox attribute
                 */
                _setSVGSize: function (size) {
                    this.getData().options.set('svgContainerSize', size);
                    // TODO: move to separate method _updateSVGSize (?)
                    domStyle.setSize(this._getSVGElement(), size);
                    domStyle.attr(this._getSVGElement(), {viewBox: '0 0 ' + size[0] + ' ' + size[1]});
                },

                /**
                 * Return SVG element
                 * @return {HTMLElement}
                 */
                _getSVGElement: function () {
                    return domElement.findByClassName(this.getElement(), BUBBLE_CLASS);
                },

                /**
                 * Convert from client coordinates to SVG coordinate system
                 * @param  {Number[]} coordinates
                 * @return {Number[]}
                 */
                _toSVGCoords: function (coordinates) {
                    return [
                        coordinates[0] / this._transformMatrix[0],
                        coordinates[1] / this._transformMatrix[1]
                    ];
                },

                /**
                 * Convert from SVG coordinates to client
                 * @param  {Number[]} coordinates
                 * @return {Number[]}
                 */
                _toClientCoords: function (coordinates) {
                    return [
                        coordinates[0] * this._transformMatrix[0],
                        coordinates[1] * this._transformMatrix[1]
                    ];
                },

                _updateBubblePosition: function (delat) {
                    var bounds = this.getData().options.get('bubbleSVGBounds');
                },

                /**
                 * Creates <text/> element with visibility hidden
                 * Needs for internal calculations
                 * @param {String} textString
                 */
                _setupHiddenTextNode: function (textString) {
                    var node = domElement.create({
                        tagName: 'text',
                        namespace: 'http://www.w3.org/2000/svg',
                        attr: {
                            x: 0,
                            y: 0,
                            visibility: 'hidden'
                        },
                        css: TEXT_STYLE
                    });

                    node.textContent = textString;
                    this._getSVGElement().appendChild(node);

                    return node;
                },

                /**
                 * Bubble SVG path
                 * @param  {Number[][]} bounds
                 * @return {String} path
                 */
                _getRectPath: function (bounds) {
                    return svgPath.toString.call([
                        'M', bounds[0][0], bounds[0][1],
                        'V', bounds[1][1],
                        'H', bounds[1][0],
                        'V', bounds[0][1],
                        'z'
                    ]);
                },

                /**
                 * Return SVG string path
                 * @param  {Number[]} tailPeakPoint
                 * @param  {Number} len
                 * @return {String} tail path
                 */
                _getTailPath: function (tailPeakPoint, len) {
                    var path = [],
                        to = this._svgHiddenPath.getPointAtLength(len + PADDING);

                    path.push(['L', tailPeakPoint[0], tailPeakPoint[1]]);
                    path.push(['L', to.x, to.y]);

                    return svgPath.toString.call(path);
                },

                /**
                 * Setup bubble bottom-left and top-right coordinates
                 */
                _setupBubbleBounds: function () {
                    var options = this.getData().options,
                        coords = options.get('position'),
                        width = this._textNodeSize[0] + (BUBBLE_PADDINGS[0] * 2),
                        height = this._textNodeSize[1] + (BUBBLE_PADDINGS[1] * 2),
                        distanceToPin = 20;

                    this.getData().options.set(
                        'bubbleSVGBounds',
                        [
                            this._toSVGCoords([coords[0] - (width / 2), coords[1] - distanceToPin]),
                            this._toSVGCoords([
                                coords[0] + width - (width / 2),
                                coords[1] - height - distanceToPin
                            ])
                        ]
                    );
                },

                /**
                 * Create SVG element for bubble and yet one, that is hidden
                 * Hidden element used for nearest point calculation
                 * @param  {String} path
                 */
                _setupBubble: function (path) {
                    this._svgPathElement = domElement.create({
                        tagName: 'path',
                        namespace: 'http://www.w3.org/2000/svg',
                        css: {
                            fill: '#FFFFFF',
                            stroke: '#333333',
                            'stroke-width': 2
                        },
                        attr: {
                            d: path
                        }
                    });
                    this._svgHiddenPath = domElement.create({
                        tagName: 'path',
                        namespace: 'http://www.w3.org/2000/svg',
                        attr: {
                            visibility: 'hidden',
                            d: path
                        }
                    });
                    this._getSVGElement().appendChild(this._svgPathElement);
                },

                /**
                 * Text element BBox
                 * @return {Number[]} In client coordinate sustem
                 */
                _getTextBBox: function () {
                    if (!this._hiddenSvgTextNode) {
                        throw new Error('You should setup hidden text element before invoke _getTextBBox');
                    }
                    var textBBox = this._hiddenSvgTextNode.getBBox();

                    return this._toClientCoords([textBBox.width, textBBox.height]);
                },

                /**
                 * I'm not sure that its the best solution
                 * Now nearest point on path is calculated, then path cutted to two part and between
                 * inserts tail path
                 * @param  {Number[]} pinCoords
                 */
                _setupSVGTail: function (pinCoords) {
                    var parts = [],
                        pathLength = this._svgHiddenPath.getTotalLength(),
                        pinSVGCoords = this._toSVGCoords(pinCoords),
                        nearestPoint = svgTools.findPathClosestPoint(this._svgHiddenPath, pinSVGCoords);

                    if (nearestPoint.lengthToPoint > 0.95 * pathLength) {
                        parts.push(svgPath.getSubpath(this._currentPath, 0, pathLength - PADDING));
                        parts.push(this._getTailPath(pinSVGCoords, pathLength - PADDING / 2));
                    } else if (nearestPoint.lengthToPoint < 0.05 * pathLength) {
                        parts.push(svgPath.getSubpath(this._currentPath, nearestPoint.lengthToPoint + PADDING, pathLength + nearestPoint.lengthToPoint - PADDING));
                        parts.push(this._getTailPath(pinSVGCoords, nearestPoint.lengthToPoint));
                    } else {
                        parts.push(svgPath.getSubpath(this._currentPath, 0, nearestPoint.lengthToPoint - PADDING));
                        parts.push(this._getTailPath(pinSVGCoords, nearestPoint.lengthToPoint));
                        parts.push(svgPath.getSubpath(this._currentPath, nearestPoint.lengthToPoint + PADDING, pathLength));
                    }

                    this._svgPathElement.setAttribute('d', svgPath.toString.call(parts));
                },

                /**
                 * Creates SVG text element with user text
                 * @param  {String} textString
                 */
                _setupText: function (textString) {
                    var bounds = this.getData().options.get('bubbleSVGBounds');

                    this._textSVGNode = domElement.create({
                        tagName: 'text',
                        namespace: 'http://www.w3.org/2000/svg',
                        attr: {
                            x: bounds[0][0] + (BUBBLE_PADDINGS[0] / this._transformMatrix[0]),
                            y: bounds[1][1] + this._textNodeSize[1] + (BUBBLE_PADDINGS[1] / this._transformMatrix[1])
                        },
                        css: TEXT_STYLE
                    });
                    this._textSVGNode.textContent = textString;

                    this._getSVGElement().appendChild(this._textSVGNode);
                },

                /**
                 * Truncate string so bubble fit to SVG container
                 * @param  {Number} contentWidth Bubble content width excluding paddings
                 * @return {String}
                 */
                _getTruncatedString: function (contentWidth) {
                    contentWidth = contentWidth / this._transformMatrix[0];

                    var node = this._hiddenSvgTextNode,
                        textString = this.getData().text,
                        len = node.getNumberOfChars(),
                        pivot = Math.floor(len / 2),
                        beforeDir = node.getSubStringLength(0, pivot) > contentWidth ? -1 : 1,
                        truncWidth;

                    for (var i = pivot + beforeDir; 0 < i < len;) {
                        truncWidth = node.getSubStringLength(0, i);
                        dir = truncWidth > contentWidth ?  -1 : 1;

                        if (dir == beforeDir) {
                            i += dir;
                        } else {
                            len = dir == 1 ? i : i - 1;
                            break;
                        }
                    }

                    return textString.substring(0, len);
                },

                /**
                 * Update SVG text element position
                 */
                _updateTextPosition: function () {
                    var node = this._textSVGNode,
                        bounds = this.getData().options.get('bubbleSVGBounds');

                    domStyle.attr(node, {
                        x: bounds[0][0] + (BUBBLE_PADDINGS[0] / this._transformMatrix[0]),
                        y: bounds[1][1] + this._textNodeSize[1] + (BUBBLE_PADDINGS[1] / this._transformMatrix[1])
                    });
                }
            }
        );

        layoutStorage.add('drawer#bubbleLayout', Layout);

        provide(Layout);
    }
);

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

            onPaneZoomChange: function () {},

            onPaneClientPixelsChange: function () {
                var layoutOptions = this._view.getLayoutSync().getData().options;
                layoutOptions.set('position', this.getPane().toClientPixels(this.getGeometry().getCoordinates()));
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
                        layout._translateBubble(event.get('delta'));
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

/**
 * Coming soon
 */

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

ymaps.modules.define(
    'drawer.freeline',
    [
        'util.defineClass',
        'option.Manager',
        'data.Manager',
        'drawer.freeline.Canvas',
        'control.Button'
    ],
    function (provide, defineClass, OptionManager, DataManager, Canvas, Button) {
        function Freeline(map) {
            this._map = map || null;
            this._canvas = new Canvas(map);
        }

        defineClass(Freeline, {
            setMap: function (map) {
                if (this._map != map) {
                    this._map = map;
                }
                return this;
            },

            getMap: function () {
                return this._map;
            },

            enable: function () {
                this._map.controls.add(this._getControl(), {float: 'none', position: {left: '5px', top: '5px'}});
                return this;
            },

            disable: function () {
                this._canvas.disable();
                this._removeControl();
                return this;
            },

            _getControl: function () {
                return this._control || (this._control = this._createControl());
            },

            _removeControl: function () {
                this._map.controls.remove(this._control);
            },

            _onButtonSelect: function () {
                this._canvas.enable();
            },

            _onButtonDeselect: function () {
                this._canvas.disable();
            },

            _createControl: function () {
                var toggleButton = new Button({
                    data: {
                        content: 'Draw'
                    },
                    options: {
                        maxWidth: 120
                    }
                });
                toggleButton.events
                    .add('select', this._onButtonSelect, this)
                    .add('deselect', this._onButtonDeselect, this);

                return toggleButton;
            }
        });

        provide(Freeline);
    }
);

/**
 * @fileOverview Excerpt from Snap.svg library to work with paths
 * @see https://github.com/adobe-webplatform/Snap.svg
 */
ym.modules.define(
    'util.svgPath',
    function (provide) {
        var has = "hasOwnProperty",
            p2s = /,?([a-z]),?/gi,
            toFloat = parseFloat,
            math = Math,
            PI = math.PI,
            mmin = math.min,
            mmax = math.max,
            pow = math.pow,
            abs = math.abs,
            Str = String,
            objectToString = Object.prototype.toString,
            pathCommand = /([a-z])[\s,]*((-?\d*\.?\d*(?:e[\-+]?\d+)?[\s]*,?[\s]*)+)/ig,
            pathValues = /(-?\d*\.?\d*(?:e[\-+]?\\d+)?)[\s]*,?[\s]*/ig;

        function paths(ps) {
            var p = paths.ps = paths.ps || {};
            if (p[ps]) {
                p[ps].sleep = 100;
            } else {
                p[ps] = {
                    sleep: 100
                };
            }
            setTimeout(function () {
                for (var key in p) if (p[has](key) && key != ps) {
                    p[key].sleep--;
                    !p[key].sleep && delete p[key];
                }
            });
            return p[ps];
        }
        function repush(array, item) {
            for (var i = 0, ii = array.length; i < ii; i++) if (array[i] === item) {
                return array.push(array.splice(i, 1)[0]);
            }
        }
        function cacher(f, scope, postprocessor) {
            function newf() {
                var arg = Array.prototype.slice.call(arguments, 0),
                    args = arg.join("\u2400"),
                    cache = newf.cache = newf.cache || {},
                    count = newf.count = newf.count || [];
                if (cache[has](args)) {
                    repush(count, args);
                    return postprocessor ? postprocessor(cache[args]) : cache[args];
                }
                count.length >= 1e3 && delete cache[count.shift()];
                count.push(args);
                cache[args] = f.apply(scope, arg);
                return postprocessor ? postprocessor(cache[args]) : cache[args];
            }
            return newf;
        }
        function is(o, type) {
            type = Str.prototype.toLowerCase.call(type);
            if (type == "finite") {
                return isFinite(o);
            }
            if (type == "array" &&
                (o instanceof Array || Array.isArray && Array.isArray(o))) {
                return true;
            }
            return  (type == "null" && o === null) ||
                    (type == typeof o && o !== null) ||
                    (type == "object" && o === Object(o)) ||
                    objectToString.call(o).slice(8, -1).toLowerCase() == type;
        }
        function clone(obj) {
            if (typeof obj == "function" || Object(obj) !== obj) {
                return obj;
            }
            var res = new obj.constructor;
            for (var key in obj) if (obj[has](key)) {
                res[key] = clone(obj[key]);
            }
            return res;
        }
        function parsePathString(pathString) {
            if (!pathString) {
                return null;
            }
            var pth = paths(pathString);
            if (pth.arr) {
                return pathClone(pth.arr);
            }

            var paramCounts = {a: 7, c: 6, o: 2, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, u: 3, z: 0},
                data = [];
            if (is(pathString, "array") && is(pathString[0], "array")) { // rough assumption
                data = pathClone(pathString);
            }
            if (!data.length) {
                Str(pathString).replace(pathCommand, function (a, b, c) {
                    var params = [],
                        name = b.toLowerCase();
                    c.replace(pathValues, function (a, b) {
                        b && params.push(+b);
                    });
                    if (name == "m" && params.length > 2) {
                        data.push([b].concat(params.splice(0, 2)));
                        name = "l";
                        b = b == "m" ? "l" : "L";
                    }
                    if (name == "o" && params.length == 1) {
                        data.push([b, params[0]]);
                    }
                    if (name == "r") {
                        data.push([b].concat(params));
                    } else while (params.length >= paramCounts[name]) {
                        data.push([b].concat(params.splice(0, paramCounts[name])));
                        if (!paramCounts[name]) {
                            break;
                        }
                    }
                });
            }
            data.toString = toString;
            pth.arr = pathClone(data);
            return data;
        }
        function box(x, y, width, height) {
            if (x == null) {
                x = y = width = height = 0;
            }
            if (y == null) {
                y = x.y;
                width = x.width;
                height = x.height;
                x = x.x;
            }
            return {
                x: x,
                y: y,
                width: width,
                w: width,
                height: height,
                h: height,
                x2: x + width,
                y2: y + height,
                cx: x + width / 2,
                cy: y + height / 2,
                r1: math.min(width, height) / 2,
                r2: math.max(width, height) / 2,
                r0: math.sqrt(width * width + height * height) / 2,
                path: rectPath(x, y, width, height),
                vb: [x, y, width, height].join(" ")
            };
        }
        function toString() {
            return this.join(",").replace(p2s, "$1");
        }
        function pathClone(pathArray) {
            var res = clone(pathArray);
            res.toString = toString;
            return res;
        }
        function getPointAtSegmentLength(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, length) {
            if (length == null) {
                return bezlen(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y);
            } else {
                return findDotsAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y,
                    getTotLen(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, length));
            }
        }
        function getLengthFactory(istotal, subpath) {
            function O(val) {
                return +(+val).toFixed(3);
            }
            return cacher(function (path, length, onlystart) {
                if (path instanceof Element) {
                    path = path.attr("d");
                }
                path = path2curve(path);
                var x, y, p, l, sp = "", subpaths = {}, point,
                    len = 0;
                for (var i = 0, ii = path.length; i < ii; i++) {
                    p = path[i];
                    if (p[0] == "M") {
                        x = +p[1];
                        y = +p[2];
                    } else {
                        l = getPointAtSegmentLength(x, y, p[1], p[2], p[3], p[4], p[5], p[6]);
                        if (len + l > length) {
                            if (subpath && !subpaths.start) {
                                point = getPointAtSegmentLength(x, y, p[1], p[2], p[3], p[4], p[5], p[6], length - len);
                                sp += [
                                    "C" + O(point.start.x),
                                    O(point.start.y),
                                    O(point.m.x),
                                    O(point.m.y),
                                    O(point.x),
                                    O(point.y)
                                ];
                                if (onlystart) {return sp;}
                                subpaths.start = sp;
                                sp = [
                                    "M" + O(point.x),
                                    O(point.y) + "C" + O(point.n.x),
                                    O(point.n.y),
                                    O(point.end.x),
                                    O(point.end.y),
                                    O(p[5]),
                                    O(p[6])
                                ].join();
                                len += l;
                                x = +p[5];
                                y = +p[6];
                                continue;
                            }
                            if (!istotal && !subpath) {
                                point = getPointAtSegmentLength(x, y, p[1], p[2], p[3], p[4], p[5], p[6], length - len);
                                return point;
                            }
                        }
                        len += l;
                        x = +p[5];
                        y = +p[6];
                    }
                    sp += p.shift() + p;
                }
                subpaths.end = sp;
                point = istotal ? len : subpath ? subpaths : findDotsAtSegment(x, y, p[0], p[1], p[2], p[3], p[4], p[5], 1);
                return point;
            }, null, clone);
        }
        var getTotalLength = getLengthFactory(1),
            getPointAtLength = getLengthFactory(),
            getSubpathsAtLength = getLengthFactory(0, 1);
        function findDotsAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t) {
            var t1 = 1 - t,
                t13 = pow(t1, 3),
                t12 = pow(t1, 2),
                t2 = t * t,
                t3 = t2 * t,
                x = t13 * p1x + t12 * 3 * t * c1x + t1 * 3 * t * t * c2x + t3 * p2x,
                y = t13 * p1y + t12 * 3 * t * c1y + t1 * 3 * t * t * c2y + t3 * p2y,
                mx = p1x + 2 * t * (c1x - p1x) + t2 * (c2x - 2 * c1x + p1x),
                my = p1y + 2 * t * (c1y - p1y) + t2 * (c2y - 2 * c1y + p1y),
                nx = c1x + 2 * t * (c2x - c1x) + t2 * (p2x - 2 * c2x + c1x),
                ny = c1y + 2 * t * (c2y - c1y) + t2 * (p2y - 2 * c2y + c1y),
                ax = t1 * p1x + t * c1x,
                ay = t1 * p1y + t * c1y,
                cx = t1 * c2x + t * p2x,
                cy = t1 * c2y + t * p2y,
                alpha = (90 - math.atan2(mx - nx, my - ny) * 180 / PI);
            return {
                x: x,
                y: y,
                m: {x: mx, y: my},
                n: {x: nx, y: ny},
                start: {x: ax, y: ay},
                end: {x: cx, y: cy},
                alpha: alpha
            };
        }
        function bezierBBox(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y) {
            if (!is(p1x, "array")) {
                p1x = [p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y];
            }
            var bbox = curveDim.apply(null, p1x);
            return box(
                bbox.min.x,
                bbox.min.y,
                bbox.max.x - bbox.min.x,
                bbox.max.y - bbox.min.y
            );
        }
        function isPointInsideBBox(bbox, x, y) {
            return  x >= bbox.x &&
                    x <= bbox.x + bbox.width &&
                    y >= bbox.y &&
                    y <= bbox.y + bbox.height;
        }
        function isBBoxIntersect(bbox1, bbox2) {
            bbox1 = box(bbox1);
            bbox2 = box(bbox2);
            return isPointInsideBBox(bbox2, bbox1.x, bbox1.y)
                || isPointInsideBBox(bbox2, bbox1.x2, bbox1.y)
                || isPointInsideBBox(bbox2, bbox1.x, bbox1.y2)
                || isPointInsideBBox(bbox2, bbox1.x2, bbox1.y2)
                || isPointInsideBBox(bbox1, bbox2.x, bbox2.y)
                || isPointInsideBBox(bbox1, bbox2.x2, bbox2.y)
                || isPointInsideBBox(bbox1, bbox2.x, bbox2.y2)
                || isPointInsideBBox(bbox1, bbox2.x2, bbox2.y2)
                || (bbox1.x < bbox2.x2 && bbox1.x > bbox2.x
                    || bbox2.x < bbox1.x2 && bbox2.x > bbox1.x)
                && (bbox1.y < bbox2.y2 && bbox1.y > bbox2.y
                    || bbox2.y < bbox1.y2 && bbox2.y > bbox1.y);
        }
        function base3(t, p1, p2, p3, p4) {
            var t1 = -3 * p1 + 9 * p2 - 9 * p3 + 3 * p4,
                t2 = t * t1 + 6 * p1 - 12 * p2 + 6 * p3;
            return t * t2 - 3 * p1 + 3 * p2;
        }
        function bezlen(x1, y1, x2, y2, x3, y3, x4, y4, z) {
            if (z == null) {
                z = 1;
            }
            z = z > 1 ? 1 : z < 0 ? 0 : z;
            var z2 = z / 2,
                n = 12,
                Tvalues = [-.1252,.1252,-.3678,.3678,-.5873,.5873,-.7699,.7699,-.9041,.9041,-.9816,.9816],
                Cvalues = [0.2491,0.2491,0.2335,0.2335,0.2032,0.2032,0.1601,0.1601,0.1069,0.1069,0.0472,0.0472],
                sum = 0;
            for (var i = 0; i < n; i++) {
                var ct = z2 * Tvalues[i] + z2,
                    xbase = base3(ct, x1, x2, x3, x4),
                    ybase = base3(ct, y1, y2, y3, y4),
                    comb = xbase * xbase + ybase * ybase;
                sum += Cvalues[i] * math.sqrt(comb);
            }
            return z2 * sum;
        }
        function getTotLen(x1, y1, x2, y2, x3, y3, x4, y4, ll) {
            if (ll < 0 || bezlen(x1, y1, x2, y2, x3, y3, x4, y4) < ll) {
                return;
            }
            var t = 1,
                step = t / 2,
                t2 = t - step,
                l,
                e = .01;
            l = bezlen(x1, y1, x2, y2, x3, y3, x4, y4, t2);
            while (abs(l - ll) > e) {
                step /= 2;
                t2 += (l < ll ? 1 : -1) * step;
                l = bezlen(x1, y1, x2, y2, x3, y3, x4, y4, t2);
            }
            return t2;
        }
        function intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
            if (
                mmax(x1, x2) < mmin(x3, x4) ||
                mmin(x1, x2) > mmax(x3, x4) ||
                mmax(y1, y2) < mmin(y3, y4) ||
                mmin(y1, y2) > mmax(y3, y4)
            ) {
                return;
            }
            var nx = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4),
                ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4),
                denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

            if (!denominator) {
                return;
            }
            var px = nx / denominator,
                py = ny / denominator,
                px2 = +px.toFixed(2),
                py2 = +py.toFixed(2);
            if (
                px2 < +mmin(x1, x2).toFixed(2) ||
                px2 > +mmax(x1, x2).toFixed(2) ||
                px2 < +mmin(x3, x4).toFixed(2) ||
                px2 > +mmax(x3, x4).toFixed(2) ||
                py2 < +mmin(y1, y2).toFixed(2) ||
                py2 > +mmax(y1, y2).toFixed(2) ||
                py2 < +mmin(y3, y4).toFixed(2) ||
                py2 > +mmax(y3, y4).toFixed(2)
            ) {
                return;
            }
            return {x: px, y: py};
        }
        function inter(bez1, bez2) {
            return interHelper(bez1, bez2);
        }
        function interHelper(bez1, bez2, justCount) {
            var bbox1 = bezierBBox(bez1),
                bbox2 = bezierBBox(bez2);
            if (!isBBoxIntersect(bbox1, bbox2)) {
                return justCount ? 0 : [];
            }
            var l1 = bezlen.apply(0, bez1),
                l2 = bezlen.apply(0, bez2),
                n1 = ~~(l1 / 8),
                n2 = ~~(l2 / 8),
                dots1 = [],
                dots2 = [],
                xy = {},
                res = justCount ? 0 : [];
            for (var i = 0; i < n1 + 1; i++) {
                var p = findDotsAtSegment.apply(0, bez1.concat(i / n1));
                dots1.push({x: p.x, y: p.y, t: i / n1});
            }
            for (i = 0; i < n2 + 1; i++) {
                p = findDotsAtSegment.apply(0, bez2.concat(i / n2));
                dots2.push({x: p.x, y: p.y, t: i / n2});
            }
            for (i = 0; i < n1; i++) {
                for (var j = 0; j < n2; j++) {
                    var di = dots1[i],
                        di1 = dots1[i + 1],
                        dj = dots2[j],
                        dj1 = dots2[j + 1],
                        ci = abs(di1.x - di.x) < .001 ? "y" : "x",
                        cj = abs(dj1.x - dj.x) < .001 ? "y" : "x",
                        is = intersect(di.x, di.y, di1.x, di1.y, dj.x, dj.y, dj1.x, dj1.y);
                    if (is) {
                        if (xy[is.x.toFixed(4)] == is.y.toFixed(4)) {
                            continue;
                        }
                        xy[is.x.toFixed(4)] = is.y.toFixed(4);
                        var t1 = di.t + abs((is[ci] - di[ci]) / (di1[ci] - di[ci])) * (di1.t - di.t),
                            t2 = dj.t + abs((is[cj] - dj[cj]) / (dj1[cj] - dj[cj])) * (dj1.t - dj.t);
                        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
                            if (justCount) {
                                res++;
                            } else {
                                res.push({
                                    x: is.x,
                                    y: is.y,
                                    t1: t1,
                                    t2: t2
                                });
                            }
                        }
                    }
                }
            }
            return res;
        }
        function rectPath(x, y, w, h, r) {
            if (r) {
                return [
                    ["M", +x + (+r), y],
                    ["l", w - r * 2, 0],
                    ["a", r, r, 0, 0, 1, r, r],
                    ["l", 0, h - r * 2],
                    ["a", r, r, 0, 0, 1, -r, r],
                    ["l", r * 2 - w, 0],
                    ["a", r, r, 0, 0, 1, -r, -r],
                    ["l", 0, r * 2 - h],
                    ["a", r, r, 0, 0, 1, r, -r],
                    ["z"]
                ];
            }
            var res = [["M", x, y], ["l", w, 0], ["l", 0, h], ["l", -w, 0], ["z"]];
            res.toString = toString;
            return res;
        }
        function ellipsePath(x, y, rx, ry, a) {
            if (a == null && ry == null) {
                ry = rx;
            }
            x = +x;
            y = +y;
            rx = +rx;
            ry = +ry;
            if (a != null) {
                var rad = Math.PI / 180,
                    x1 = x + rx * Math.cos(-ry * rad),
                    x2 = x + rx * Math.cos(-a * rad),
                    y1 = y + rx * Math.sin(-ry * rad),
                    y2 = y + rx * Math.sin(-a * rad),
                    res = [["M", x1, y1], ["A", rx, rx, 0, +(a - ry > 180), 0, x2, y2]];
            } else {
                res = [
                    ["M", x, y],
                    ["m", 0, -ry],
                    ["a", rx, ry, 0, 1, 1, 0, 2 * ry],
                    ["a", rx, ry, 0, 1, 1, 0, -2 * ry],
                    ["z"]
                ];
            }
            res.toString = toString;
            return res;
        }
        function pathToAbsolute(pathArray) {
            var pth = paths(pathArray);
            if (pth.abs) {
                return pathClone(pth.abs);
            }
            if (!is(pathArray, "array") || !is(pathArray && pathArray[0], "array")) { // rough assumption
                pathArray = parsePathString(pathArray);
            }
            if (!pathArray || !pathArray.length) {
                return [["M", 0, 0]];
            }
            var res = [],
                x = 0,
                y = 0,
                mx = 0,
                my = 0,
                start = 0,
                pa0;
            if (pathArray[0][0] == "M") {
                x = +pathArray[0][1];
                y = +pathArray[0][2];
                mx = x;
                my = y;
                start++;
                res[0] = ["M", x, y];
            }
            var crz = pathArray.length == 3 &&
                pathArray[0][0] == "M" &&
                pathArray[1][0].toUpperCase() == "R" &&
                pathArray[2][0].toUpperCase() == "Z";
            for (var r, pa, i = start, ii = pathArray.length; i < ii; i++) {
                res.push(r = []);
                pa = pathArray[i];
                pa0 = pa[0];
                if (pa0 != pa0.toUpperCase()) {
                    r[0] = pa0.toUpperCase();
                    switch (r[0]) {
                        case "A":
                            r[1] = pa[1];
                            r[2] = pa[2];
                            r[3] = pa[3];
                            r[4] = pa[4];
                            r[5] = pa[5];
                            r[6] = +pa[6] + x;
                            r[7] = +pa[7] + y;
                            break;
                        case "V":
                            r[1] = +pa[1] + y;
                            break;
                        case "H":
                            r[1] = +pa[1] + x;
                            break;
                        case "O":
                            res.pop();
                            dots = ellipsePath(x, y, pa[1], pa[2]);
                            dots.push(dots[0]);
                            res = res.concat(dots);
                            break;
                        case "U":
                            res.pop();
                            res = res.concat(ellipsePath(x, y, pa[1], pa[2], pa[3]));
                            r = ["U"].concat(res[res.length - 1].slice(-2));
                            break;
                        case "M":
                            mx = +pa[1] + x;
                            my = +pa[2] + y;
                        default:
                            for (j = 1, jj = pa.length; j < jj; j++) {
                                r[j] = +pa[j] + ((j % 2) ? x : y);
                            }
                    }
                } else if (pa0 == "O") {
                    res.pop();
                    dots = ellipsePath(x, y, pa[1], pa[2]);
                    dots.push(dots[0]);
                    res = res.concat(dots);
                } else if (pa0 == "U") {
                    res.pop();
                    res = res.concat(ellipsePath(x, y, pa[1], pa[2], pa[3]));
                    r = ["U"].concat(res[res.length - 1].slice(-2));
                } else {
                    for (var k = 0, kk = pa.length; k < kk; k++) {
                        r[k] = pa[k];
                    }
                }
                pa0 = pa0.toUpperCase();
                if (pa0 != "O") {
                    switch (r[0]) {
                        case "Z":
                            x = +mx;
                            y = +my;
                            break;
                        case "H":
                            x = r[1];
                            break;
                        case "V":
                            y = r[1];
                            break;
                        case "M":
                            mx = r[r.length - 2];
                            my = r[r.length - 1];
                        default:
                            x = r[r.length - 2];
                            y = r[r.length - 1];
                    }
                }
            }
            res.toString = toString;
            pth.abs = pathClone(res);
            return res;
        }
        function l2c(x1, y1, x2, y2) {
            return [x1, y1, x2, y2, x2, y2];
        }
        function q2c(x1, y1, ax, ay, x2, y2) {
            var _13 = 1 / 3,
                _23 = 2 / 3;
            return [
                    _13 * x1 + _23 * ax,
                    _13 * y1 + _23 * ay,
                    _13 * x2 + _23 * ax,
                    _13 * y2 + _23 * ay,
                    x2,
                    y2
                ];
        }

        // Returns bounding box of cubic bezier curve.
        function curveDim(x0, y0, x1, y1, x2, y2, x3, y3) {
            var tvalues = [],
                bounds = [[], []],
                a, b, c, t, t1, t2, b2ac, sqrtb2ac;
            for (var i = 0; i < 2; ++i) {
                if (i == 0) {
                    b = 6 * x0 - 12 * x1 + 6 * x2;
                    a = -3 * x0 + 9 * x1 - 9 * x2 + 3 * x3;
                    c = 3 * x1 - 3 * x0;
                } else {
                    b = 6 * y0 - 12 * y1 + 6 * y2;
                    a = -3 * y0 + 9 * y1 - 9 * y2 + 3 * y3;
                    c = 3 * y1 - 3 * y0;
                }
                if (abs(a) < 1e-12) {
                    if (abs(b) < 1e-12) {
                        continue;
                    }
                    t = -c / b;
                    if (0 < t && t < 1) {
                        tvalues.push(t);
                    }
                    continue;
                }
                b2ac = b * b - 4 * c * a;
                sqrtb2ac = math.sqrt(b2ac);
                if (b2ac < 0) {
                    continue;
                }
                t1 = (-b + sqrtb2ac) / (2 * a);
                if (0 < t1 && t1 < 1) {
                    tvalues.push(t1);
                }
                t2 = (-b - sqrtb2ac) / (2 * a);
                if (0 < t2 && t2 < 1) {
                    tvalues.push(t2);
                }
            }

            var x, y, j = tvalues.length,
                jlen = j,
                mt;
            while (j--) {
                t = tvalues[j];
                mt = 1 - t;
                bounds[0][j] = (mt * mt * mt * x0) + (3 * mt * mt * t * x1) + (3 * mt * t * t * x2) + (t * t * t * x3);
                bounds[1][j] = (mt * mt * mt * y0) + (3 * mt * mt * t * y1) + (3 * mt * t * t * y2) + (t * t * t * y3);
            }

            bounds[0][jlen] = x0;
            bounds[1][jlen] = y0;
            bounds[0][jlen + 1] = x3;
            bounds[1][jlen + 1] = y3;
            bounds[0].length = bounds[1].length = jlen + 2;


            return {
              min: {x: mmin.apply(0, bounds[0]), y: mmin.apply(0, bounds[1])},
              max: {x: mmax.apply(0, bounds[0]), y: mmax.apply(0, bounds[1])}
            };
        }

        function path2curve(path, path2) {
            var pth = !path2 && paths(path);
            if (!path2 && pth.curve) {
                return pathClone(pth.curve);
            }
            var p = pathToAbsolute(path),
                p2 = path2 && pathToAbsolute(path2),
                attrs = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null},
                attrs2 = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null},
                processPath = function (path, d, pcom) {
                    var nx, ny;
                    if (!path) {
                        return ["C", d.x, d.y, d.x, d.y, d.x, d.y];
                    }
                    !(path[0] in {T: 1, Q: 1}) && (d.qx = d.qy = null);
                    switch (path[0]) {
                        case "M":
                            d.X = path[1];
                            d.Y = path[2];
                            break;
                        case "S":
                            if (pcom == "C" || pcom == "S") { // In "S" case we have to take into account, if the previous command is C/S.
                                nx = d.x * 2 - d.bx;          // And reflect the previous
                                ny = d.y * 2 - d.by;          // command's control point relative to the current point.
                            }
                            else {                            // or some else or nothing
                                nx = d.x;
                                ny = d.y;
                            }
                            path = ["C", nx, ny].concat(path.slice(1));
                            break;
                        case "T":
                            if (pcom == "Q" || pcom == "T") { // In "T" case we have to take into account, if the previous command is Q/T.
                                d.qx = d.x * 2 - d.qx;        // And make a reflection similar
                                d.qy = d.y * 2 - d.qy;        // to case "S".
                            }
                            else {                            // or something else or nothing
                                d.qx = d.x;
                                d.qy = d.y;
                            }
                            path = ["C"].concat(q2c(d.x, d.y, d.qx, d.qy, path[1], path[2]));
                            break;
                        case "Q":
                            d.qx = path[1];
                            d.qy = path[2];
                            path = ["C"].concat(q2c(d.x, d.y, path[1], path[2], path[3], path[4]));
                            break;
                        case "L":
                            path = ["C"].concat(l2c(d.x, d.y, path[1], path[2]));
                            break;
                        case "H":
                            path = ["C"].concat(l2c(d.x, d.y, path[1], d.y));
                            break;
                        case "V":
                            path = ["C"].concat(l2c(d.x, d.y, d.x, path[1]));
                            break;
                        case "Z":
                            path = ["C"].concat(l2c(d.x, d.y, d.X, d.Y));
                            break;
                    }
                    return path;
                },
                fixArc = function (pp, i) {
                    if (pp[i].length > 7) {
                        pp[i].shift();
                        var pi = pp[i];
                        while (pi.length) {
                            pcoms1[i] = "A"; // if created multiple C:s, their original seg is saved
                            p2 && (pcoms2[i] = "A"); // the same as above
                            pp.splice(i++, 0, ["C"].concat(pi.splice(0, 6)));
                        }
                        pp.splice(i, 1);
                        ii = mmax(p.length, p2 && p2.length || 0);
                    }
                },
                fixM = function (path1, path2, a1, a2, i) {
                    if (path1 && path2 && path1[i][0] == "M" && path2[i][0] != "M") {
                        path2.splice(i, 0, ["M", a2.x, a2.y]);
                        a1.bx = 0;
                        a1.by = 0;
                        a1.x = path1[i][1];
                        a1.y = path1[i][2];
                        ii = mmax(p.length, p2 && p2.length || 0);
                    }
                },
                pcoms1 = [], // path commands of original path p
                pcoms2 = [], // path commands of original path p2
                pfirst = "", // temporary holder for original path command
                pcom = ""; // holder for previous path command of original path
            for (var i = 0, ii = mmax(p.length, p2 && p2.length || 0); i < ii; i++) {
                p[i] && (pfirst = p[i][0]); // save current path command

                if (pfirst != "C") // C is not saved yet, because it may be result of conversion
                {
                    pcoms1[i] = pfirst; // Save current path command
                    i && ( pcom = pcoms1[i - 1]); // Get previous path command pcom
                }
                p[i] = processPath(p[i], attrs, pcom); // Previous path command is inputted to processPath

                if (pcoms1[i] != "A" && pfirst == "C") pcoms1[i] = "C"; // A is the only command
                // which may produce multiple C:s
                // so we have to make sure that C is also C in original path

                fixArc(p, i); // fixArc adds also the right amount of A:s to pcoms1

                if (p2) { // the same procedures is done to p2
                    p2[i] && (pfirst = p2[i][0]);
                    if (pfirst != "C") {
                        pcoms2[i] = pfirst;
                        i && (pcom = pcoms2[i - 1]);
                    }
                    p2[i] = processPath(p2[i], attrs2, pcom);

                    if (pcoms2[i] != "A" && pfirst == "C") {
                        pcoms2[i] = "C";
                    }

                    fixArc(p2, i);
                }
                fixM(p, p2, attrs, attrs2, i);
                fixM(p2, p, attrs2, attrs, i);
                var seg = p[i],
                    seg2 = p2 && p2[i],
                    seglen = seg.length,
                    seg2len = p2 && seg2.length;
                attrs.x = seg[seglen - 2];
                attrs.y = seg[seglen - 1];
                attrs.bx = toFloat(seg[seglen - 4]) || attrs.x;
                attrs.by = toFloat(seg[seglen - 3]) || attrs.y;
                attrs2.bx = p2 && (toFloat(seg2[seg2len - 4]) || attrs2.x);
                attrs2.by = p2 && (toFloat(seg2[seg2len - 3]) || attrs2.y);
                attrs2.x = p2 && seg2[seg2len - 2];
                attrs2.y = p2 && seg2[seg2len - 1];
            }
            if (!p2) {
                pth.curve = pathClone(p);
            }
            return p2 ? [p, p2] : p;
        }

        provide({
            getSubpath: function (path, from, to) {
                if (getTotalLength(path) - to < 1e-6) {
                    return getSubpathsAtLength(path, from).end;
                }
                var a = getSubpathsAtLength(path, to, 1);
                return from ? getSubpathsAtLength(a, from).end : a;
            },
            toCubic: path2curve,
            toString: toString
        });

    }
);

/**
 * @fileOverview
 */
ymaps.modules.define(
    'util.svgTools',
    [
        'util.svgPath'
    ],
    function (provide, svgPath) {

    provide({
        /**
         * Map coordinates to SVG coordinate system
         * @param {Number[]} coordinates
         * @param {HTMLElement} svgElement SVG element
         * @return {Number[]} Local SVG coordinates
         */
        toSVGCoordinates: function (coordinates, svgElement) {
            var globalPoint,
                point = svgElement.createSVGPoint();

            point.x = coordinates[0];
            point.y = coordinates[1];
            globalPoint = point.matrixTransform(svgElement.getScreenCTM().inverse());

            return [globalPoint.x, globalPoint.y];
        },

        getCoordTransformFactor: function (svgElement, inverse) {
            var matrix = svgElement.getScreenCTM();
            if (inverse) {
                matrix = matrix.inverse();
            }

            return [matrix.a, matrix.d];
        },

        /**
         * Convert path string
         * @param  {HTMLElement} pathNode
         * @return {Mixed[]}
         */
        parsePath: function (pathNode) {
            return svgPath.toCubic(pathNode.getAttribute('d'));
        },

        scale: function (path, x, y) {
            var matrix = [x, 0, y, 0],
                transformedPath = [];

            for (var i = 0, l = path.length; i < l; i++) {
                transformedPath[i] = [path[i][0]];
                for (var j = 1; j < path[i].length; j += 2) {
                    transformedPath[i].push(path[i][j] * matrix[0]);
                    transformedPath[i].push(path[i][j + 1] * matrix[2]);
                }
            }
            return transformedPath;
        },

        /**
         * @param  {HTMLElement} pathNode SVG path element
         * @param  {Number[]} point Point coordinates mapped to SVG coordinate system
         * @return {Number[]} Coordinates of the closest point on path
         */
        findPathClosestPoint: function (pathNode, point) {
            var pathLength = pathNode.getTotalLength(),
                precision = pathLength * 0.02,
                best,
                bestLength,
                bestDistance = Infinity;

            /**
             * Point coords on path at specific length
             * @param  {Number} len
             * @return {Number}
             */
            function getPointAtLength (len) {
                var coord = pathNode.getPointAtLength(len);
                return [coord.x, coord.y];
            }

            for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
                if ((scanDistance = getDistance(scan = getPointAtLength(scanLength), point)) < bestDistance) {
                    best = scan, bestLength = scanLength, bestDistance = scanDistance;
                }
            }

            precision *= 0.5;
            while (precision > 0.5) {
                var before,
                    after,
                    beforeLength,
                    afterLength,
                    beforeDistance,
                    afterDistance;

                if ((beforeLength = bestLength - precision) >= 0 &&
                    (beforeDistance = getDistance(before = getPointAtLength(beforeLength), point)) < bestDistance) {
                    best = before, bestLength = beforeLength, bestDistance = beforeDistance;
                } else if ((afterLength = bestLength + precision) <= pathLength &&
                            (afterDistance = getDistance(after = getPointAtLength(afterLength), point)) < bestDistance) {
                    best = after, bestLength = afterLength, bestDistance = afterDistance;
                } else {
                    precision *= 0.5;
                }
            }

            best.distance = Math.sqrt(bestDistance);
            best.lengthToPoint = bestLength;

            return best;
        }
    });

    /**
     * Calculate distance between points within SVG
     * @param  {Number[]} p1 [x, y]
     * @param  {Number[]} p2 [x, y]
     * @return {Number}
     */
    function getDistance (p1, p2) {
        var dx = p1[0] - p2[0],
            dy = p1[1] - p2[1];

        return dx * dx + dy * dy;
    }

});


})(this);