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
