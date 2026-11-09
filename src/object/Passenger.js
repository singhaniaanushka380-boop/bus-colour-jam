import Phaser from 'phaser';

/** A waiting passenger. The look (hat / hair / skin) is picked deterministically from its queue position. */
export class Passenger extends Phaser.GameObjects.Image {
  constructor(scene, x, y, color, variant) {
    super(scene, x, y, `pax_${color}_${variant % 4}`);
    this.colorName = color;
    this.variant = variant % 4;
    this.setScale(0.86);
    this.setOrigin(0.5, 0.86); // feet on the ground
    scene.add.existing(this);
  }

  /** Walk (hop) to a world point, then resolve. */
  walkTo(x, y, duration = 330) {
    return new Promise((resolve) => {
      const sx = this.x;
      const sy = this.y;
      const base = this.scaleX;
      this.setDepth(800);
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          if (!this.scene) return;
          const t = tw.getValue();
          this.x = Phaser.Math.Linear(sx, x, t);
          this.y = Phaser.Math.Linear(sy, y, t) - Math.sin(t * Math.PI * 2) * 7 - Math.sin(t * Math.PI) * 22;
          this.setScale(base * (1 + Math.sin(t * Math.PI * 4) * 0.05), base * (1 - Math.sin(t * Math.PI * 4) * 0.05) * (1 - t * 0.3));
        },
        onComplete: () => resolve(),
      });
    });
  }
}

export default Passenger;
