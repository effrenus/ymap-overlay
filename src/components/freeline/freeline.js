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
