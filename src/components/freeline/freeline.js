ymaps.modules.define(
    'drawer.freeline',
    [
        'util.defineClass',
        'option.Manager',
        'data.Manager',
        'drawer.freeline.Behavior',
        'control.Button'
    ],
    function (provide, defineClass, OptionManager, DataManager, DrawerBehavior, Button) {
        function Freeline(map, options) {
            this._map = map || null;
            this.options = new OptionManager(options || {});
            this.state = new DataManager({
                enabled: false
            });
            this.behavior = new DrawerBehavior(map);

            this._control = this._createControl();
        }

        defineClass(Freeline, {
            setMap: function (map) {
                if (this._map !== map) {
                    this._map = map;
                }
                return this;
            },

            getMap: function () {
                return this._map;
            },

            enable: function () {
                if (!this.state.get('enabled')) {
                    this.behavior.enable();
                    this.state.set({enabled: true});
                    this._map.controls.add(this._control, {float: 'none', position: {left: '5px', top: '5px'}});
                }
                return this;
            },

            disable: function () {
                if (this.state.get('enabled')) {
                    this.behavior.disable();
                    this.state.set({enabled: false});
                }
                return this;
            },

            removeControl: function () {
                this._map.controls.remove(this._control);
            },

            _createControl: function () {
                var toggleButton = new Button({
                    data: {
                        content: 'BanksyMode'
                    },
                    options: {
                        maxWidth: 120
                    }
                });
                toggleButton.events
                    .add('select', this.enable, this)
                    .add('deselect', this.disable, this);

                return toggleButton;
            }
        });

        provide(Freeline);
    }
);
