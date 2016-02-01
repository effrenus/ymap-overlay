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
            BUBBLE_PADDINGS = [15, 10], // content paddings inside bubble
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
                    this.monitor.add('position', function () {
                        this.rebuild();
                        this._updateBubblePosition();
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
                translateBubble: function (delta) {
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

                _updateBubblePosition: function () {
                    // update
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
                    return [
                        'M', bounds[0][0], bounds[0][1],
                        'V', bounds[1][1],
                        'H', bounds[1][0],
                        'V', bounds[0][1],
                        'z'
                    ].join(' ');
                },

                /**
                 * Return SVG string path
                 * @param  {Number[]} tailPeakPoint
                 * @param  {Number} len
                 * @return {String} tail path
                 */
                _getTailPath: function (tailPeakPoint, len) {
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

                    if (nearestPoint.lengthToPoint < PADDING) {
                        parts.push(
                            svgPath.getSubpath(this._currentPath, nearestPoint.lengthToPoint + PADDING, pathLength)
                        );
                        parts.push(
                            this._getTailPath(pinSVGCoords, nearestPoint.lengthToPoint)
                        );
                    } else if (nearestPoint.lengthToPoint > pathLength - PADDING) {
                        parts.push(
                            svgPath.getSubpath(this._currentPath, PADDING - (pathLength - nearestPoint.lengthToPoint), nearestPoint.lengthToPoint - PADDING)
                        );
                        parts.push(
                            this._getTailPath(pinSVGCoords, nearestPoint.lengthToPoint - pathLength)
                        );
                    } else {
                        parts.push(svgPath.getSubpath(this._currentPath, 0,   nearestPoint.lengthToPoint - PADDING));
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
