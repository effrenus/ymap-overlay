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
                precision = pathLength * 0.125,
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

            best = [best.x, best.y];
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
