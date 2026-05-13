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
    this.step += 1;
  }

  sweep(fromFreq, toFreq, duration, type = "sine", gain = 0.08) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, toFreq), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.018);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.04);
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
    this.blip(988, 0.08, "triangle", 0.06, 10);
    window.setTimeout(() => this.blip(1318, 0.09, "triangle", 0.06, 18), 80);
    window.setTimeout(() => this.blip(1760, 0.12, "sine", 0.045, 12), 165);
  }

  harvestStart() {
    this.start();
    this.sweep(560, 110, 0.36, "sawtooth", 0.08);
    window.setTimeout(() => this.blip(92, 0.12, "triangle", 0.08, -40), 170);
  }

  harvestBurst() {
    this.start();
    this.sweep(260, 70, 0.16, "sawtooth", 0.055);
    this.blip(118, 0.09, "triangle", 0.07, -80);
    window.setTimeout(() => this.blip(740, 0.09, "square", 0.035, 180), 70);
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
    this.load.image("coin", "assets/new/coin.png");
    this.load.audio("bgm", "assets/audio/upbeat-loop.ogg");
    BUBBLE_ASSETS.forEach((key) => this.load.image(key, `assets/new/${key}.png`));
  }

  create() {
    this.matter.world.setBounds(18, 0, GAME_W - 36, GAME_H - 22, 48, true, true, false, true);
    this.matter.world.engine.gravity.y = 0.92;
    this.matter.world.engine.enableSleeping = false;

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
    if (!this.bgm) {
      this.bgm = this.sound.add("bgm", { loop: true, volume: 0.42 });
    }
    if (!this.bgm.isPlaying) this.bgm.play();
    this.time.delayedCall(180, () => this.seedBottomPile());
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

  makeBubble(x, y, type, radius, options = {}) {
    const bubble = this.matter.add.image(x, y, this.getBubbleTexture(type), null, {
      restitution: 0.48,
      friction: 0.045,
      frictionStatic: 0.1,
      frictionAir: 0.014,
      density: 0.0016,
      label: TYPES[type],
    });
    bubble.setDisplaySize(radius * 2, radius * 2);
    bubble.setData("baseScale", bubble.scaleX);
    bubble.setCircle(radius);
    bubble.setBounce(0.48);
    bubble.setFriction(0.045, 0.014, 0.1);
    bubble.setData("radius", radius);
    bubble.trashType = type;
    bubble.spawnedAt = options.spawnedAt ?? this.time.now;
    this.bubbles.add(bubble);
    if (options.angle !== undefined) bubble.setAngle(options.angle);
    if (options.velocity) bubble.setVelocity(options.velocity.x, options.velocity.y);
    if (options.angularVelocity !== undefined) bubble.setAngularVelocity(options.angularVelocity);
    return bubble;
  }

  seedBottomPile() {
    if (this.seededPile || this.gameOver) return;
    this.seededPile = true;
    const count = Phaser.Math.Between(11, 15);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 6);
      const col = i % 6;
      const radius = Phaser.Math.Between(28, 42);
      const x = 70 + col * 78 + Phaser.Math.Between(-18, 18);
      const y = GAME_H - 48 - row * 58 + Phaser.Math.Between(-8, 8);
      const type = Phaser.Math.Between(0, TYPES.length - 1);
      const bubble = this.makeBubble(x, y, type, radius, {
        angle: Phaser.Math.Between(-28, 28),
        spawnedAt: this.time.now - 2000,
        velocity: { x: Phaser.Math.FloatBetween(-0.35, 0.35), y: Phaser.Math.FloatBetween(-0.5, 0.2) },
        angularVelocity: Phaser.Math.FloatBetween(-0.02, 0.02),
      });
      bubble.setDepth(5 + i);
      this.pulse(bubble);
    }
    this.time.delayedCall(500, () => this.queueClusterCheck());
  }

  dropBubble() {
    if (!this.started || this.gameOver || this.isHarvesting || (this.lastDropAt && this.time.now - this.lastDropAt < 260)) return;
    this.lastDropAt = this.time.now;
    const radius = Phaser.Math.Between(30, 48);
    const type = this.nextType;
    const bubble = this.makeBubble(this.dropX, DROP_Y + 28, type, radius);
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
        bubble.setVelocity(bubble.body.velocity.x * 0.5, Math.max(bubble.body.velocity.y, 0.03));
        bubble.setAngularVelocity((bubble.body.angularVelocity || 0) * 0.45);
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
    if (!bubble?.active) return;
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
    const coin = this.add.image(x, y, "coin")
      .setDepth(45)
      .setDisplaySize(52, 52)
      .setAngle(Phaser.Math.Between(-18, 18));
    const coinScale = coin.scaleX;
    const hopX = x + Phaser.Math.Between(-42, 42);
    const hopY = y - Phaser.Math.Between(82, 128);
    this.tweens.add({
      targets: coin,
      delay: delay * 80,
      x: hopX,
      y: hopY,
      scaleX: coinScale * 1.62,
      scaleY: coinScale * 1.62,
      angle: coin.angle + Phaser.Math.Between(140, 260),
      duration: 430,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: coin,
          x: 92,
          y: 36,
          scaleX: coinScale * 0.28,
          scaleY: coinScale * 0.28,
          alpha: 0.16,
          angle: coin.angle + Phaser.Math.Between(420, 680),
          duration: 980,
          ease: "Cubic.easeInOut",
          onComplete: () => coin.destroy(),
        });
      },
    });
    this.time.delayedCall(delay * 80, () => this.audio.coin());
  }

  spawnHarvesterBurst(x, y, textureKey) {
    this.audio.harvestBurst();
    this.cameras.main.shake(90, 0.004);
    this.tweens.add({
      targets: this.harvesterMouth,
      scale: 0.72,
      duration: 120,
      yoyo: true,
      ease: "Sine.easeOut",
    });
    for (let i = 0; i < 6; i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
      const distance = Phaser.Math.Between(42, 92);
      const shard = i < 2
        ? this.add.image(x, y, textureKey).setDisplaySize(18, 18)
        : this.add.circle(x, y, Phaser.Math.Between(4, 8), Phaser.Math.RND.pick([0xf7c94b, 0xffffff, 0x15b7aa, 0xff6b4a]), 0.95);
      shard.setDepth(72).setAlpha(0.95);
      const shardScaleX = shard.scaleX;
      const shardScaleY = shard.scaleY;
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + Phaser.Math.Between(-8, 18),
        scaleX: shardScaleX * 0.15,
        scaleY: shardScaleY * 0.15,
        alpha: 0,
        angle: Phaser.Math.Between(-240, 240),
        duration: Phaser.Math.Between(260, 420),
        ease: "Cubic.easeOut",
        onComplete: () => shard.destroy(),
      });
    }
    const ring = this.add.circle(x, y, 16, 0xffffff, 0)
      .setStrokeStyle(4, 0xf7c94b, 0.9)
      .setDepth(71);
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 260,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  spawnSuckTrail(fromX, fromY, toX, toY, delay) {
    const trail = this.add.line(0, 0, fromX, fromY, toX, toY, 0xffffff, 0.58)
      .setOrigin(0, 0)
      .setDepth(58);
    const glow = this.add.line(0, 0, fromX, fromY, toX, toY, 0xf7c94b, 0.34)
      .setOrigin(0, 0)
      .setDepth(57);
    trail.setLineWidth(3, 1);
    glow.setLineWidth(8, 2);
    this.tweens.add({
      targets: [trail, glow],
      alpha: 0,
      delay,
      duration: 780,
      ease: "Cubic.easeOut",
      onComplete: () => {
        trail.destroy();
        glow.destroy();
      },
    });
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
    this.audio.harvestStart();
    this.cameras.main.shake(620, 0.012);

    const mouthX = GAME_W / 2;
    const mouthY = 116;
    const victims = [...this.bubbles]
      .filter((b) => b.active && !b.isClearing)
      .sort((a, b) => b.y - a.y)
      .slice(0, 12);
    const enterDuration = 680;
    const suckStart = 560;
    const suckGap = 95;
    const suckDuration = 700;
    const finishDelay = suckStart + victims.length * suckGap + 1180;

    this.harvesterMouth.setVisible(true).setAlpha(0).setPosition(mouthX, -230).setScale(0.44);
    this.tweens.add({
      targets: this.harvesterMouth,
      y: mouthY,
      alpha: 1,
      scale: 0.62,
      duration: enterDuration,
      ease: "Back.easeOut",
    });

    victims.forEach((bubble, index) => {
      this.time.delayedCall(suckStart + index * suckGap, () => {
        if (!bubble.active || bubble.isClearing) return;
        this.bubbles.delete(bubble);
        bubble.isClearing = true;
        bubble.setIgnoreGravity(true);
        bubble.setSensor(true);
        if (bubble.body?.collisionFilter) bubble.body.collisionFilter.mask = 0;
        bubble.setVelocity(0, 0);
        bubble.setDepth(66);
        const textureKey = bubble.texture.key;
        const burstX = mouthX + Phaser.Math.Between(-44, 44);
        const burstY = mouthY + Phaser.Math.Between(-8, 30);
        this.spawnSuckTrail(bubble.x, bubble.y, burstX, burstY, index * 12);
        this.tweens.add({
          targets: bubble,
          x: burstX,
          y: burstY,
          scaleX: bubble.scaleX * 0.2,
          scaleY: bubble.scaleY * 0.2,
          angle: bubble.angle + Phaser.Math.Between(520, 980),
          alpha: 0.88,
          duration: suckDuration,
          ease: "Back.easeIn",
          onComplete: () => {
            this.spawnHarvesterBurst(burstX, burstY, textureKey);
            this.spawnCoin(burstX, burstY, index % 5);
            this.queueBubbleDestroy(bubble);
          },
        });
      });
    });

    this.time.delayedCall(finishDelay, () => {
      this.tweens.add({
        targets: this.harvesterMouth,
        y: -250,
        alpha: 0,
        scale: 0.44,
        duration: 560,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.harvesterMouth.setVisible(false);
          this.isHarvesting = false;
          this.updateHarvester();
        },
      });
    });
    this.addCoins(victims.length * 6);
    this.time.delayedCall(finishDelay - 360, () => {
      if (victims.length) this.startCollapse({ x: mouthX, y: GAME_H - 140 });
      else this.wakeLooseBubbles();
    });
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
