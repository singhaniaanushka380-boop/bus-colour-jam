import Phaser from 'phaser';

export class Passenger extends Phaser.GameObjects.Image {
  constructor(scene, x, y, color, variant = 0) {
    const safeVariant = ((Number(variant) || 0) % 4 + 4) % 4;
    const textureKey = `pax_${color}_${safeVariant}`;

    super(scene, x, y, textureKey);

    scene.add.existing(this);

    this.setOrigin(0.5, 0.5);
  }

  walkTo(x, y, duration = 300) {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x,
        y,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => resolve(this),
      });
    });
  }
}
