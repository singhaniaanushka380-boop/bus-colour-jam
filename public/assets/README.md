# public/assets

All BUS COLOR JAM graphics and sounds are generated in code (Phaser Graphics + Web Audio), so this
folder is intentionally empty of binary assets. Drop optional files here (e.g. `logo.png`) and load
them with `this.load.image('logo', 'assets/logo.png')` in `LoadingScene.preload()` - the relative
path works on Vercel and on any sub-path host.
