const GAME_W = 540;
const GAME_H = 960;
const DROP_Y = 76;
const DANGER_Y = 122;
const TYPES = [
  "pizza",
  "sock",
  "toast",
  "bandage",
  "shoe",
  "fishbone",
  "wire",
  "banana",
];
const BUBBLE_ASSETS = [
  "bubble-01",
  "bubble-02",
  "bubble-03",
  "bubble-04",
  "bubble-05",
  "bubble-06",
  "bubble-07",
  "bubble-08",
];

class GoofyAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.step = 0;
    this.lastBumpAt = 0;
    this.notes = [262, 330, 392, 523, 440, 392, 330, 294, 330, 392, 494, 659, 587, 494, 392, 330];
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
  }

  start() {
    this.ensure();
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this.timer) return;
    this.timer = window.setInterval(() => this.tick(), 118);
  }

  blip(freq, duration, type = "square", gain = 0.08, detune = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  tick() {
    const note = this.notes[this.step % this.notes.length];
    this.blip(note, 0.09, this.step % 4 === 0 ? "triangle" : "square", 0.045, 5);
    if (this.step % 4 === 0) this.blip(note / 2, 0.14, "triangle", 0.032, -6);
    if (this.step % 8 === 3) this.blip(note * 1.5, 0.045, "square", 0.026, 45);
    this.step += 1;
  }

  bump() {
    if (!this.ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBumpAt < 55) return;
    this.lastBumpAt = nowMs;
    this.blip(230 + Math.random() * 90, 0.035, "sine", 0.045, -80);
    this.blip(520 + Math.random() * 120, 0.025, "triangle", 0.025, 40);
  }

  pop() {
    this.start();
    this.blip(420, 0.05, "triangle", 0.12, 300);
    this.blip(150, 0.08, "sine", 0.07, -300);
  }

  coin() {
    this.start();
    this.blip(880, 0.05, "square", 0.07);
    window.setTimeout(() => this.blip(1175, 0.08, "square", 0.06), 45);
  }
}

class BubblishTrash extends Phaser.Scene {
  constructor() {
    super("BubblishTrash");
    this.dropX = GAME_W / 2;
    this.coins = 0;
    this.bubbles = new Set();
    this.isChecking = false;
    this.gameOver = false;
    this.isHarvesting = false;
    this.started = false;
    this.collapseUntil = 0;
    this.nextType = Phaser.Math.Between(0, TYPES.length - 1);
    this.audio = new GoofyAudio();
  }

  preload() {
    this.load.image("background", "assets/new/background.jpg");
    this.load.image("harvester-mouth", "assets/new/harvester-mouth.png");
    BUBBLE_ASSETS.forEach((key) => this.load.image(key, `assets/new/${key}.png`));
  }

  create() {
    this.matter.world.setBounds(18, 0, GAME_W - 36, GAME_H - 22, 48, true, true, false, true);
    this.matter.world.engine.gravity.y = 0.92;
    this.matter.world.engine.enableSleeping = true;

    this.add.image(GAME_W / 2, GAME_H / 2, "background").setDisplaySize(GAME_W + 170, GAME_H).setDepth(-5);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0.18).setDepth(-4);
    this.add.rectangle(GAME_W / 2, DANGER_Y, GAME_W - 42, 4, 0xe34b4b).setDepth(20);
    this.add.text(24, DANGER_Y - 30, "危险线", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "16px",
      color: "#b83333",
      fontStyle: "900",
    }).setDepth(20);

    this.coinText = this.add.text(24, 22, "金币 0", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "26px",
      color: "#f7c94b",
      fontStyle: "900",
      stroke: "#2d2a28",
      strokeThickness: 3,
    }).setDepth(20);
    this.add.text(GAME_W / 2, 24, "移动顶部投放点，点击/触摸丢垃圾泡泡", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#6d6257",
    }).setOrigin(0.5, 0).setDepth(20);

    this.dropLine = this.add.line(0, 0, this.dropX, 30, this.dropX, DROP_Y + 26, 0x2d2a28, 0.25)
      .setOrigin(0, 0)
      .setDepth(15);
    this.hook = this.add.circle(this.dropX, DROP_Y, 14, 0xffffff, 1)
      .setStrokeStyle(4, 0x2d2a28)
      .setDepth(16);
    this.preview = this.add.image(this.dropX, DROP_Y + 42, this.getBubbleTexture(this.nextType))
      .setDisplaySize(84, 84)
      .setAlpha(0.9)
      .setDepth(14);
    this.harvesterMouth = this.add.image(GAME_W / 2, -230, "harvester-mouth")
      .setDepth(70)
      .setScale(0.5)
      .setFlipY(true)
      .setVisible(false);
    this.createStartScreen();

    this.bindCanvasInput();

    this.matter.world.on("collisionstart", (event) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA.gameObject;
        const b = pair.bodyB.gameObject;
        if (a?.isClearing || b?.isClearing) continue;
        const impact = Math.abs(pair.collision.depth || 0);
        const fastEnough = (Math.abs(a?.body?.velocity?.x || 0) + Math.abs(a?.body?.velocity?.y || 0) +
          Math.abs(b?.body?.velocity?.x || 0) + Math.abs(b?.body?.velocity?.y || 0)) > 2.2;
        if (a?.trashType !== undefined && b?.trashType !== undefined && fastEnough) this.audio.bump();
        if (a?.trashType !== undefined && a.trashType === b?.trashType) {
          this.queueClusterCheck();
          if (fastEnough && impact > 0.8) {
            this.pulse(a);
            this.pulse(b);
          }
        }
      }
    });

    this.time.addEvent({ delay: 500, loop: true, callback: () => this.checkDanger() });
    this.time.addEvent({ delay: 260, loop: true, callback: () => this.settleSlowBubbles() });
    this.harvester = document.getElementById("harvester");
    this.harvester.addEventListener("click", () => this.useHarvester());
    this.updateHarvester();
  }

  bindCanvasInput() {
    const canvas = this.game.canvas;
    const updateFromClientX = (clientX) => {
      if (!this.started || this.gameOver || this.isHarvesting) return;
      const bounds = canvas.getBoundingClientRect();
      const localX = ((clientX - bounds.left) / bounds.width) * GAME_W;
      this.setDropX(localX);
    };
    const dropFromClientX = (clientX) => {
      if (!this.started || this.gameOver || this.isHarvesting) return;
      updateFromClientX(clientX);
      this.audio.start();
      this.dropBubble();
    };

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointermove", (event) => updateFromClientX(event.clientX), { passive: true });
    canvas.addEventListener("pointerup", (event) => {
      event.preventDefault();
      dropFromClientX(event.clientX);
    });
    canvas.addEventListener("click", (event) => {
      event.preventDefault();
      dropFromClientX(event.clientX);
    });
    canvas.addEventListener("touchend", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      event.preventDefault();
      dropFromClientX(touch.clientX);
    }, { passive: false });
  }

  createStartScreen() {
    this.startLayer = this.add.container(0, 0).setDepth(100);
    const scrim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xf4dfbd, 0.9);
    const mouth = this.add.image(GAME_W / 2, 180, "harvester-mouth").setScale(0.36).setFlipY(true).setAlpha(0.96);
    const titleShadow = this.add.text(GAME_W / 2 + 4, 355 + 5, "Bubblish\nTrash", {
      fontFamily: "Arial Black, Microsoft YaHei, sans-serif",
      fontSize: "58px",
      lineSpacing: -10,
      color: "#7a4b23",
      fontStyle: "900",
      align: "center",
    }).setOrigin(0.5);
    const title = this.add.text(GAME_W / 2, 355, "Bubblish\nTrash", {
      fontFamily: "Arial Black, Microsoft YaHei, sans-serif",
      fontSize: "58px",
      lineSpacing: -10,
      color: "#15b7aa",
      stroke: "#ffffff",
      strokeThickness: 8,
      fontStyle: "900",
      align: "center",
    }).setOrigin(0.5);
    const subtitle = this.add.text(GAME_W / 2, 468, "把怪怪泡泡丢进垃圾场，三颗同类就会爆金币", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "18px",
      color: "#5f4a3a",
      fontStyle: "900",
    }).setOrigin(0.5);

    const bubbles = [
      [88, 600, 0, 82, -14],
      [452, 604, 1, 82, 12],
      [138, 704, 2, 76, 9],
      [402, 706, 4, 76, -10],
      [270, 664, 3, 74, 0],
    ].map(([x, y, type, size, angle]) =>
      this.add.image(x, y, this.getBubbleTexture(type)).setDisplaySize(size, size).setAngle(angle).setAlpha(0.95),
    );

    const buttonBack = this.add.rectangle(GAME_W / 2, 790, 230, 62, 0xf7c94b, 1)
      .setStrokeStyle(4, 0x2d2a28)
      .setInteractive({ useHandCursor: true });
    const buttonText = this.add.text(GAME_W / 2, 790, "开始游戏", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "28px",
      color: "#2d2a28",
      fontStyle: "900",
    }).setOrigin(0.5);
    const hint = this.add.text(GAME_W / 2, 860, "点击开始后，移动顶部投放点并点击投放", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#7b6754",
    }).setOrigin(0.5);

    this.startLayer.add([scrim, mouth, titleShadow, title, subtitle, ...bubbles, buttonBack, buttonText, hint]);
    this.tweens.add({
      targets: bubbles,
      y: "+=10",
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: (_, i) => i * 110,
    });
    this.tweens.add({
      targets: mouth,
      scale: 0.36,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    buttonBack.on("pointerdown", () => this.startGame());
    buttonText.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.startGame());
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    this.audio.start();
    this.tweens.add({
      targets: this.startLayer,
      alpha: 0,
      y: -24,
      duration: 260,
      ease: "Cubic.easeIn",
      onComplete: () => this.startLayer.destroy(),
    });
  }

  getBubbleTexture(type) {
    return BUBBLE_ASSETS[type % BUBBLE_ASSETS.length];
  }

  moveDropper(pointer) {
    if (!this.started || this.gameOver || this.isHarvesting) return;
    const bounds = this.game.canvas.getBoundingClientRect();
    const localX = ((pointer.event.clientX - bounds.left) / bounds.width) * GAME_W;
    this.setDropX(localX);
  }

  setDropX(localX) {
    this.dropX = Phaser.Math.Clamp(localX, 54, GAME_W - 54);
    this.hook.setPosition(this.dropX, DROP_Y);
    this.preview.setPosition(this.dropX, DROP_Y + 42).setDisplaySize(84, 84);
    this.dropLine.setTo(this.dropX, 30, this.dropX, DROP_Y + 26);
  }

  dropBubble() {
    if (!this.started || this.gameOver || this.isHarvesting || (this.lastDropAt && this.time.now - this.lastDropAt < 260)) return;
    this.lastDropAt = this.time.now;
    const radius = Phaser.Math.Between(30, 48);
    const type = this.nextType;
    const bubble = this.matter.add.image(this.dropX, DROP_Y + 28, this.getBubbleTexture(type), null, {
      restitution: 0.48,
      friction: 0.045,
      frictionStatic: 0.1,
      frictionAir: 0.014,
      density: 0.0016,
      label: TYPES[type],
      sleepThreshold: 45,
    });
    bubble.setDisplaySize(radius * 2, radius * 2);
    bubble.setData("baseScale", bubble.scaleX);
    bubble.setCircle(radius);
    bubble.setBounce(0.48);
    bubble.setFriction(0.045, 0.014, 0.1);
    bubble.setData("radius", radius);
    bubble.trashType = type;
    bubble.spawnedAt = this.time.now;
    this.bubbles.add(bubble);
    this.pulse(bubble);

    this.nextType = Phaser.Math.Between(0, TYPES.length - 1);
    this.preview.setTexture(this.getBubbleTexture(this.nextType)).setDisplaySize(84, 84);
  }

  pulse(target) {
    if (!target?.active) return;
    const baseScale = target.getData("baseScale") || target.scaleX;
    this.tweens.killTweensOf(target);
    target.setScale(baseScale);
    this.tweens.add({
      targets: target,
      scale: baseScale * 1.08,
      duration: 70,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => {
        if (target.active && !target.isClearing) target.setScale(baseScale);
      },
    });
  }

  queueClusterCheck() {
    if (!this.started || this.isChecking || this.gameOver || this.isHarvesting) return;
    this.isChecking = true;
    this.time.delayedCall(70, () => {
      this.isChecking = false;
      this.findClusters();
    });
  }

  settleSlowBubbles() {
    if (!this.started || this.gameOver || this.isHarvesting) return;
    this.bubbles.forEach((bubble) => {
      if (!bubble.active || bubble.isClearing || !bubble.body) return;
      if (bubble.y < GAME_H * 0.55) return;
      const speed = Math.hypot(bubble.body.velocity.x, bubble.body.velocity.y);
      if (speed < 0.08) {
        bubble.setVelocity(0, 0);
        bubble.setAngularVelocity(0);
        if (this.matter?.body?.setSleeping) this.matter.body.setSleeping(bubble.body, true);
      }
    });
  }

  findClusters() {
    const list = [...this.bubbles].filter((b) => b.active && !b.isClearing);
    const seen = new Set();
    for (const root of list) {
      if (seen.has(root)) continue;
      const cluster = [];
      const stack = [root];
      seen.add(root);
      while (stack.length) {
        const current = stack.pop();
        cluster.push(current);
        for (const other of list) {
          if (seen.has(other) || other.trashType !== current.trashType) continue;
          const max = current.getData("radius") + other.getData("radius") + 8;
          if (Phaser.Math.Distance.Between(current.x, current.y, other.x, other.y) <= max) {
            seen.add(other);
            stack.push(other);
          }
        }
      }
      if (cluster.length >= 3) {
        this.clearCluster(cluster);
        return;
      }
    }
  }

  clearCluster(cluster) {
    this.audio.pop();
    this.cameras.main.shake(120, 0.004);
    const center = {
      x: Phaser.Math.Average(cluster.map((bubble) => bubble.x)),
      y: Phaser.Math.Average(cluster.map((bubble) => bubble.y)),
    };
    cluster.forEach((bubble, index) => {
      this.spawnCoin(bubble.x, bubble.y, index);
      this.spawnBurstGhost(bubble);
      this.queueBubbleDestroy(bubble);
    });
    this.addCoins(cluster.length * 10);
    this.startCollapse(center);
  }

  startCollapse(center) {
    this.collapseUntil = this.time.now + 520;
    this.matter.world.engine.gravity.y = 1.28;
    this.wakeLooseBubbles(center, true);
    this.time.delayedCall(120, () => this.wakeLooseBubbles(center, true));
    this.time.delayedCall(300, () => this.wakeLooseBubbles(center, false));
    this.time.delayedCall(560, () => {
      this.matter.world.engine.gravity.y = 0.92;
    });
  }

  wakeLooseBubbles(center = null, strong = false) {
    this.bubbles.forEach((bubble) => {
      if (!bubble.active || bubble.isClearing || !bubble.body) return;
      if (this.matter?.body?.setSleeping) this.matter.body.setSleeping(bubble.body, false);
      const vx = bubble.body.velocity.x;
      const vy = bubble.body.velocity.y;
      const nearHole = center
        ? Math.abs(bubble.x - center.x) < 150 && bubble.y < center.y + 95
        : false;
      const downward = strong && nearHole ? 1.9 : strong ? 1.15 : 0.72;
      const nudgeX = nearHole ? Phaser.Math.Clamp((center.x - bubble.x) * 0.01, -0.9, 0.9) : 0;
      bubble.setVelocity(vx + nudgeX, Math.max(vy, downward));
      bubble.setAngularVelocity((bubble.body.angularVelocity || 0) + Phaser.Math.FloatBetween(-0.018, 0.018));
    });
  }

  queueBubbleDestroy(bubble) {
    if (!bubble?.active || bubble.isClearing) return;
    this.bubbles.delete(bubble);
    bubble.isClearing = true;
    bubble.setVisible(false);
    bubble.setActive(false);
    bubble.setVelocity(0, 0);
    bubble.setAngularVelocity(0);
    bubble.setIgnoreGravity(true);
    bubble.setSensor(true);
    if (bubble.body?.collisionFilter) bubble.body.collisionFilter.mask = 0;
    bubble.setPosition(-9999, -9999);
  }

  spawnBurstGhost(bubble) {
    const ghost = this.add.image(bubble.x, bubble.y, bubble.texture.key)
      .setDepth(25)
      .setScale(bubble.scaleX, bubble.scaleY)
      .setAngle(bubble.angle);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: ghost.scaleX * 1.55,
      angle: bubble.angle + Phaser.Math.Between(-35, 35),
      duration: 180,
      ease: "Back.easeIn",
      onComplete: () => ghost.destroy(),
    });
  }

  spawnCoin(x, y, delay) {
    const coin = this.add.circle(x, y, 8, 0xf7c94b, 1).setStrokeStyle(2, 0x9b6c19).setDepth(30);
    this.tweens.add({
      targets: coin,
      x: 92,
      y: 36,
      scale: 0.35,
      alpha: 0.2,
      delay: delay * 35,
      duration: 470,
      ease: "Cubic.easeInOut",
      onComplete: () => coin.destroy(),
    });
    this.time.delayedCall(delay * 35, () => this.audio.coin());
  }

  addCoins(amount) {
    this.coins += amount;
    this.coinText.setText(`金币 ${this.coins}`);
    this.updateHarvester();
  }

  updateHarvester() {
    this.harvester.disabled = this.coins < 100 || this.gameOver || this.isHarvesting;
    this.harvester.textContent = this.coins >= 100 ? "启动收割机" : `收割机 ${Math.max(0, 100 - this.coins)}`;
  }

  useHarvester() {
    if (!this.started || this.coins < 100 || this.gameOver || this.isHarvesting) return;
    this.isHarvesting = true;
    this.coins -= 100;
    this.coinText.setText(`金币 ${this.coins}`);
    this.updateHarvester();
    this.audio.pop();
    this.cameras.main.shake(500, 0.016);

    const mouthX = GAME_W / 2;
    const mouthY = 116;
    const victims = [...this.bubbles]
      .filter((b) => b.active && !b.isClearing)
      .sort((a, b) => b.y - a.y)
      .slice(0, 10);

    this.harvesterMouth.setVisible(true).setAlpha(0).setPosition(mouthX, -230).setScale(0.44);
    this.tweens.add({
      targets: this.harvesterMouth,
      y: mouthY,
      alpha: 1,
      scale: 0.58,
      duration: 420,
      ease: "Back.easeOut",
    });

    victims.forEach((bubble, index) => {
      this.time.delayedCall(260 + index * 45, () => {
        if (!bubble.active || bubble.isClearing) return;
        this.bubbles.delete(bubble);
        bubble.isClearing = true;
        bubble.setIgnoreGravity(true);
        bubble.setSensor(true);
        if (bubble.body?.collisionFilter) bubble.body.collisionFilter.mask = 0;
        bubble.setVelocity(0, 0);
        this.spawnCoin(bubble.x, bubble.y, index % 4);
        this.tweens.add({
          targets: bubble,
          x: mouthX,
          y: mouthY,
          scaleX: 0.04,
          scaleY: 0.04,
          alpha: 0,
          duration: 380,
          ease: "Cubic.easeIn",
          onComplete: () => this.queueBubbleDestroy(bubble),
        });
      });
    });

    this.time.delayedCall(1120, () => {
      this.tweens.add({
        targets: this.harvesterMouth,
        y: -250,
        alpha: 0,
        scale: 0.44,
        duration: 360,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.harvesterMouth.setVisible(false);
          this.isHarvesting = false;
          this.updateHarvester();
        },
      });
    });
    this.addCoins(victims.length * 4);
    this.time.delayedCall(720, () => this.wakeLooseBubbles());
  }

  checkDanger() {
    if (!this.started || this.gameOver || this.isHarvesting || this.time.now < this.collapseUntil) return;
    const danger = [...this.bubbles].some((bubble) => {
      if (!bubble.active || bubble.isClearing || this.time.now - bubble.spawnedAt < 1400) return false;
      return bubble.y - bubble.getData("radius") < DANGER_Y;
    });
    if (!danger) return;
    this.gameOver = true;
    this.updateHarvester();
    this.cameras.main.shake(450, 0.012);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x2d2a28, 0.62).setDepth(80);
    this.add.text(GAME_W / 2, GAME_H / 2 - 34, "垃圾满啦！", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "46px",
      color: "#ffffff",
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(81);
    this.add.text(GAME_W / 2, GAME_H / 2 + 28, "刷新页面再来一局", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "22px",
      color: "#f7c94b",
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(81);
  }
}

if (window.Phaser) {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: GAME_W,
    height: GAME_H,
    backgroundColor: "#f5f5f5",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "matter", matter: { debug: false } },
    scene: BubblishTrash,
  });
} else {
  document.getElementById("boot-error").hidden = false;
}
