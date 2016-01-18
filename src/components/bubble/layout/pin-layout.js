ymaps.modules.define(
    'drawer.bubble.layout.PinLayout',
    [
        'templateLayoutFactory',
        'geometry.pixel.Circle',
        'shape.Circle',
        'layout.storage',
        'util.dom.style',
        'util.dom.element',
        'svg.tools'
    ],
    function (provide, templateLayoutFactory, PixelGeometry, CircleShape,
            layoutStorage, domStyle, domElement, svgTools) {

        // var toSVGCoord = svgTools.toSVGCoordinateSystem;

        var PADDING = 50,
            PIN_CLASSNAME = 'ymaps-pin',
            BUBBLE_PADDINGS = [15, 10],
            TO_PIN_DISTANCE = 50;

        var PinLayout = templateLayoutFactory.createClass([
            '<ymaps class="' + PIN_CLASSNAME + '" style="border-radius: 50%"></ymaps>',
            '<svg class="bubble-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">',
            '</svg>'
            ].join(''),
            {
                build: function () {
                    PinLayout.superclass.build.call(this);

                    var element = this.getElement(),
                        options = this.getData().options,
                        radius = options.get('radius'),
                        coords = options.get('position'),
                        backgroundColor = options.get('backgroundColor', '#CCCCCC');

                    domStyle.css(element.querySelector('.' + PIN_CLASSNAME), {
                        position: 'absolute',
                        width: radius * 2 + 'px',
                        height: radius * 2 + 'px',
                        backgroundColor: backgroundColor
                    });
                    this.setPinPosition([(coords[0] - radius), (coords[1] - radius)]);

                    this.setSVGSize([
                        options.get('viewportSize')[0],
                        options.get('viewportSize')[1]
                    ]);

                    this._transformMatrix = svgTools.getCoordTransformFactor(this.getSVGElement(), true);

                    this._setBubbleBounds();
                    this._currentPath = this._getRectPath(options.get('bubbleSVGBounds'));

                    this._setupBubble(this._currentPath);
                    this._setupSVGTail(coords);
                    this._setupText(options.get('text'));
                },

                rebuild: function () {
                    var options = this.getData().options,
                        coords = options.get('position'),
                        radius = options.get('radius');

                    this.setPinPosition([(coords[0] - radius), (coords[1] - radius)]);
                    this._setupSVGTail(coords);
                },

                bindOptions: function () {

                },

                getBubblePosition: function () {

                },

                setPinPosition: function (pos) {
                    var elm = this.getElement().querySelector('.' + PIN_CLASSNAME);
                    domStyle.setPosition(elm, pos);
                },

                setSVGSize: function (size) {
                    this.getData().options.set('svgContainerSize', size);
                    // TODO: move to separate method _updateSVGSize (?)
                    domStyle.setSize(this.getSVGElement(), size);
                },

                getSVGElement: function () {
                    return domElement.find(this.getElement(), '.bubble-svg', false);
                },

                getTextNodeSize: function (textString) {
                    var bbox,
                        svgTextNode = domElement.create({
                            tagName: 'text',
                            namespace: 'http://www.w3.org/2000/svg',
                            attr: {
                                x: 0,
                                y: 0,
                                'font-size': '30',
                                visibility: 'hidden'
                            }
                        });

                    svgTextNode.textContent = textString;
                    this.getSVGElement().appendChild(svgTextNode);
                    bbox = svgTextNode.getBBox();

                    svgTextNode.remove();
                    svgTextNode = null;

                    return this.toClientCoords([bbox.width, bbox.height]);
                },

                getBubbleBound: function () {
                    var bounds = this.getData().options.get('bubbleSVGBounds');

                    return [
                        this.toClientCoords(bounds[0]),
                        this.toClientCoords(bounds[1])
                    ];
                },

                toSVGCoords: function (coordinates) {
                    return [
                        coordinates[0] / this._transformMatrix[0],
                        coordinates[1] / this._transformMatrix[1]
                    ];
                },

                toClientCoords: function (coordinates) {
                    return [
                        coordinates[0] * this._transformMatrix[0],
                        coordinates[1] * this._transformMatrix[1]
                    ];
                },

                moveBubble: function (delta) {
                    var bounds = this.getData().options.get('bubbleSVGBounds'),
                        transformedDelta = this.toSVGCoords(delta);

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

                _getRectPath: function (bounds) {
                    return [
                        'M', bounds[0][0], bounds[0][1],
                        'V', bounds[1][1],
                        'H', bounds[1][0],
                        'V', bounds[0][1],
                        'z'
                    ].join(' ');
                },

                _getTailPath: function (point, tailPeakPoint, len) {
                    var path = '',
                        middle = this._svgHiddenPath.getPointAtLength(len),
                        to = this._svgHiddenPath.getPointAtLength(len + PADDING);

                    path += ['L', tailPeakPoint[0], tailPeakPoint[1]].join(' ');
                    path += ['L', to.x, to.y].join(' ');

                    return path;
                },

                /**
                 * Setup bubble bottom-left and top-right coordinates
                 */
                _setBubbleBounds: function () {
                    var options = this.getData().options,
                        coords = options.get('position'),
                        textNodeBounds = this.getTextNodeSize(this.getData().options.get('text'));

                    this.getData().options.set(
                        'bubbleSVGBounds',
                        [
                            this.toSVGCoords([coords[0] - 100, coords[1] - 20]),
                            this.toSVGCoords([coords[0] + textNodeBounds[0] - 100, coords[1] - textNodeBounds[1] - 20])
                        ]
                    );
                },

                /**
                 * Create SVG element for bubble and hidden copy
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
                            'stroke-width': 4
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
                    this.getSVGElement().appendChild(this._svgPathElement);
                },

                _setupSVGTail: function (pinCoords) {
                    var parts = [],
                        pinSVGCoords = this.toSVGCoords(pinCoords),
                        nearestPoint = svgTools.findPathClosestPoint(this._svgHiddenPath, pinSVGCoords);

                    parts.push(Snap.path.getSubpath(this._currentPath, 0,   nearestPoint.lengthToPoint - PADDING));
                    parts.push(this._getTailPath(nearestPoint, pinSVGCoords, nearestPoint.lengthToPoint));
                    parts.push(Snap.path.getSubpath(this._currentPath, nearestPoint.lengthToPoint + PADDING, this._svgHiddenPath.getTotalLength()));

                    this._svgPathElement.setAttribute('d', parts.join());
                },

                _setupText: function (textString) {
                    var bounds = this.getData().options.get('bubbleSVGBounds');

                    this._textSVGNode = domElement.create({
                        tagName: 'text',
                        namespace: 'http://www.w3.org/2000/svg',
                        attr: {
                            x: bounds[0][0] + (BUBBLE_PADDINGS[0] / this._transformMatrix[0]),
                            y: bounds[1][1] + (BUBBLE_PADDINGS[1] / this._transformMatrix[1]),
                            'font-size': '30'
                        }
                    });
                    this._textSVGNode.textContent = textString;

                    this.getSVGElement().appendChild(this._textSVGNode);
                },

                _updateTextPosition: function () {
                    var node = this.getSVGElement().querySelector('text'),
                        bounds = this.getData().options.get('bubbleSVGBounds');

                    domStyle.attr(node, {
                        x: bounds[0][0] + (BUBBLE_PADDINGS[0] / this._transformMatrix[0]),
                        y: bounds[1][1] + (BUBBLE_PADDINGS[1] / this._transformMatrix[1])
                    });
                }
            }
        );

        layoutStorage.add('bubble#pinLayout', PinLayout);

        provide(PinLayout);
    }
);
