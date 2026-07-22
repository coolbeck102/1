import Phaser from 'phaser';

// 一个简单的 Phaser 3 示例场景：
// - 一个自动弹跳的球
// - 方向键可以推动球
// - 点击球得分（带缩放动效）
// 目的是验证整套本地开发环境（dev server + 浏览器渲染 + Phaser 初始化）可用。
class GameScene extends Phaser.Scene {
  private ball!: Phaser.GameObjects.Arc;
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private score = 0;
  private vel = { x: 3.2, y: 2.4 };
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super('game');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.scoreText = this.add
      .text(16, 16, 'Score: 0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setDepth(10);

    this.hintText = this.add
      .text(W / 2, H - 28, '方向键移动 · 点击小球加分', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#9aa0b4',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(10);

    this.ball = this.add.circle(W / 2, H / 2, 26, 0x4cc9f0);
    this.ball.setStrokeStyle(3, 0xffffff, 0.6);
    this.ball.setInteractive({ useHandCursor: true });
    this.ball.on('pointerdown', () => this.hitBall());

    this.cursors = this.input.keyboard!.createCursorKeys();

    // 暴露就绪标志，供自动化冒烟测试检测
    (window as unknown as { __GAME_READY__: boolean }).__GAME_READY__ = true;
    (window as unknown as { __GAME__: Phaser.Game }).__GAME__ = this.game;
  }

  private hitBall() {
    this.score += 1;
    this.scoreText.setText('Score: ' + this.score);
    this.tweens.add({
      targets: this.ball,
      scale: 1.35,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  update() {
    const b = this.ball;
    const W = this.scale.width;
    const H = this.scale.height;
    const r = 26;

    // 自动弹跳
    b.x += this.vel.x;
    b.y += this.vel.y;
    if (b.x < r || b.x > W - r) this.vel.x *= -1;
    if (b.y < r + 50 || b.y > H - r) this.vel.y *= -1;

    // 方向键推动
    const speed = 4.5;
    if (this.cursors.left.isDown) b.x -= speed;
    if (this.cursors.right.isDown) b.x += speed;
    if (this.cursors.up.isDown) b.y -= speed;
    if (this.cursors.down.isDown) b.y += speed;

    // 边界夹紧
    b.x = Phaser.Math.Clamp(b.x, r, W - r);
    b.y = Phaser.Math.Clamp(b.y, r + 50, H - r);
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // 自动选择 WebGL / Canvas
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#1d1f2b',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
};

new Phaser.Game(config);
