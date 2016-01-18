ymaps.modules.define(
    'drawer.bubble.layout.BubbleLayout',
    [
        'templateLayoutFactory',
        'geometry.pixel.Rectangle',
        'shape.Rectangle',
        'layout.storage',
        'util.dom.element',
        'util.dom.style'
    ],
    function (provide, templateLayoutFactory, PixelGeometry, RectangleShape, layoutStorage, domElement, domStyle) {

        var BubbleLayout = templateLayoutFactory.createClass([
            '<div class="bubble" style="display: block; width: 200px; height: 100px">',
            '<svg width="100%" height="100%" viewBox="0 0 600 500" preserveAspectRatio="none">',
            '<path d="m45.974792,28.993683c-22.159973,0 -40,17.839996 -40,40l0,239.583862c0,22.160004 17.840027,40.000031 40,40.000031l126.835815,0l-17.12085,103.648804l98.044495,-103.648804l299.583862,0c22.159973,0 40,-17.840027 40,-40.000031l0,-239.583862c0,-22.160004 -17.840027,-40 -40,-40l-507.343323,0z" id="path575" stroke="#000000" stroke-width="7.5" fill-rule="evenodd" fill="#ffffff"/>',
            '<rect height="0" width="2" y="52" x="-205" fill-opacity="0.75" stroke-linecap="null" stroke-linejoin="null" stroke-dasharray="null" stroke-width="7.5" stroke="#000000" fill="none"/>',
            '</svg>',
            '</div>'].join(''),
            {
                getSize: function () {
                    var element = domElement.findByClassName(this.getElement(), 'bubble');
                    return domStyle.getSize(element);
                },

                transform: function () {

                }
            }
        );

        layoutStorage.add('bubble#bubbleLayout', BubbleLayout);

        provide(BubbleLayout);
    }
);
