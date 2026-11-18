/**
 * RUN SAM, RUN! — THE GREAT SAMOSA ESCAPE
 * A comical 2D Infinite Runner featuring the sentient Samosa character.
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const W = 1280;
const H = 720;
const GROUND_Y = 605;

// Load Hero Sprite
const heroImg = new Image();
heroImg.src = 'assets/samosa_hero.png';
let heroLoaded = false;
heroImg.onload = () => {
  heroLoaded = true;
};

// Load Chaser Face Sprite
const chaserFaceImg = new Image();
chaserFaceImg.src = 'assets/chaser_face.png';
let chaserFaceLoaded = false;
chaserFaceImg.onload = () => {
  chaserFaceLoaded = true;
};

// Web Audio Synthesizer for arcade sound effects
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, vol = 0.14, slideTo = null) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  jump(double = false) {
    this.init();
    this.playTone(double ? 380 : 270, 'triangle', 0.16, 0.16, double ? 740 : 540);
  }

  slide() {
    this.init();
    this.playTone(210, 'sine', 0.12, 0.12, 110);
  }

  coin() {
    this.init();
    this.playTone(680, 'sine', 0.08, 0.12, 980);
  }

  powerup() {
    this.init();
    this.playTone(440, 'triangle', 0.12, 0.15, 660);
    setTimeout(() => this.playTone(660, 'triangle', 0.18, 0.15, 990), 80);
  }

  smash() {
    this.init();
    this.playTone(150, 'sawtooth', 0.2, 0.2, 55);
  }

  squelch() {
    this.init();
    this.playTone(240, 'sawtooth', 0.25, 0.16, 95);
  }

  gameOver() {
    this.init();
    this.playTone(360, 'sawtooth', 0.22, 0.18, 220);
    setTimeout(() => this.playTone(220, 'sawtooth', 0.38, 0.18, 95), 190);
  }
}

const sfx = new SoundFX();

// UI Elements
const ui = {
  hud: document.getElementById('hud'),
  startScreen: document.getElementById('start-screen'),
  pauseScreen: document.getElementById('pause-screen'),
  gameoverScreen: document.getElementById('gameover-screen'),
  distance: document.getElementById('hud-distance'),
  coins: document.getElementById('hud-coins'),
  best: document.getElementById('hud-best'),
  dangerFill: document.getElementById('danger-fill'),
  dangerIcon: document.getElementById('danger-chaser-icon'),
  chaserLabel: document.getElementById('chaser-label'),
  speedBadge: document.getElementById('speed-badge'),
  powerupBar: document.getElementById('powerup-bar'),
  comicToast: document.getElementById('comic-toast'),
  btnGear: document.getElementById('btn-gear'),
  btnMute: document.getElementById('btn-mute'),
  btnPause: document.getElementById('btn-pause'),
  chkComicGear: document.getElementById('chk-comic-gear'),
  finalDistance: document.getElementById('final-distance'),
  finalCoins: document.getElementById('final-coins'),
  finalSmashed: document.getElementById('final-smashed'),
  finalBest: document.getElementById('final-best'),
  gameoverTitle: document.getElementById('gameover-title'),
  gameoverReason: document.getElementById('gameover-reason'),
  gameoverQuips: document.getElementById('gameover-quips'),
  gameoverBadge: document.getElementById('gameover-badge'),
};

// Stall signs in the Indian Bazaar
const BAZAAR_SHOPS = [
  { name: 'SHARMA SWEETS & SAMOSA', sub: 'FRESH GARAM KADHAI', color: '#ff7b00', awning: '#d62828' },
  { name: 'PAPPU CUTTING CHAI STALL', sub: 'ADRAK & ELAICHI SPECIAL', color: '#2ec4b6', awning: '#0f7173' },
  { name: 'DADI MASALA EMPORIUM', sub: '100% TEKHA MIRCHI', color: '#e63946', awning: '#9d0208' },
  { name: 'CHACHA BHEL & CHUTNEY', sub: 'KHATTA MEETHA MAGIC', color: '#38b000', awning: '#007200' },
  { name: 'BOMBAY BAZAAR TEXTILES', sub: 'SILK & SWEATBANDS', color: '#8338ec', awning: '#3a0ca3' },
  { name: 'GULLY CRICKET SPORTS', sub: 'SNEAKERS & BELANS', color: '#fb5607', awning: '#ff006e' }
];

// Chaser roster
const CHASERS = [
  {
    id: 'dadi',
    name: "ANGRY DADI'S BELAN",
    icon: '👵',
    shout: 'RUK JA SAMOSE!!',
    color: '#d62828'
  },
  {
    id: 'dog',
    name: 'SHERU THE GULLY DOG',
    icon: '🐕',
    shout: 'BHOW! CRISPY SNACK!',
    color: '#d97706'
  },
  {
    id: 'uncle',
    name: 'HUNGRY CHAI UNCLE',
    icon: '👨🏽‍🦳',
    shout: 'MERA CHAI TIME SNACK!',
    color: '#2563eb'
  }
];

// Game State
const state = {
  mode: 'START', // START, PLAYING, PAUSED, GAMEOVER
  time: 0,
  distance: 0,
  coins: 0,
  smashedCount: 0,
  bestDistance: parseInt(localStorage.getItem('run_sam_best') || '0', 10),
  baseSpeed: 490,
  currentSpeed: 490,
  chaserProximity: 0.26, // 0.12 (far) to 1.0 (caught!)
  chaserIndex: 0,
  chaserSwitchTimer: 0,
  wearComicGear: true,
  screenShake: 0,
  toastTimer: 0,

  // Active power-ups (seconds remaining)
  powerups: {
    chai: 0,    // Speed boost + invulnerable dash
    shield: 0,  // Extra Crispy Shield (1 hit or timed)
    magnet: 0   // Mint Chutney Magnet
  },

  // Chutney slow penalty timer
  chutneySlow: 0,

  // Entities
  obstacles: [],
  collectibles: [],
  particles: [],
  floatingTexts: [],
  shops: [],
  lanterns: [],
  clouds: [],

  // Spawners
  nextObstacleDist: 450,
  nextCoinDist: 260,
  nextPowerupDist: 950
};

// Player (Sam the Sentient Samosa)
const player = {
  x: 340,
  y: GROUND_Y,
  vy: 0,
  width: 96,
  height: 98,
  gravity: 2550,
  jumpForce: -930,
  jumpsUsed: 0,
  maxJumps: 2,
  isDucking: false,
  duckTimer: 0,
  runCycle: 0,
  rotation: 0,
  squashX: 1,
  squashY: 1,
  hurtFlash: 0,

  reset() {
    this.x = 340;
    this.y = GROUND_Y;
    this.vy = 0;
    this.jumpsUsed = 0;
    this.isDucking = false;
    this.rotation = 0;
    this.squashX = 1;
    this.squashY = 1;
    this.hurtFlash = 0;
  },

  jump() {
    if (this.jumpsUsed < this.maxJumps) {
      this.isDucking = false;
      this.vy = this.jumpsUsed === 0 ? this.jumpForce : this.jumpForce * 0.88;
      this.jumpsUsed++;
      this.squashX = 0.82;
      this.squashY = 1.22;
      sfx.jump(this.jumpsUsed > 1);

      // Spawn crispy crumbs on jump
      for (let i = 0; i < 8; i++) {
        spawnParticle(
          this.x + (Math.random() - 0.5) * 40,
          this.y - 10,
          (Math.random() - 0.5) * 180 - 60,
          -Math.random() * 140,
          Math.random() * 5 + 3,
          i % 2 === 0 ? '#fcbf49' : '#d97706',
          0.45
        );
      }

      if (this.jumpsUsed === 2) {
        spawnFloatingText('DOUBLE FLIP!', this.x, this.y - 110, '#ff7b00');
      }
    }
  },

  duck(active) {
    if (active) {
      if (this.y < GROUND_Y - 5) {
        // Fast drop in mid-air
        this.vy = Math.max(this.vy, 1100);
      }
      if (!this.isDucking) {
        sfx.slide();
      }
      this.isDucking = true;
      this.squashX = 1.25;
      this.squashY = 0.68;
    } else {
      this.isDucking = false;
    }
  },

  getHitbox() {
    const h = this.isDucking ? 58 : 84;
    const w = this.isDucking ? 88 : 74;
    return {
      x: this.x - w * 0.45,
      y: this.y - h,
      w: w * 0.9,
      h: h - 6
    };
  }
};

// Initialize Parallax Scenery
function initScenery() {
  state.shops = [];
  for (let i = 0; i < 5; i++) {
    const template = BAZAAR_SHOPS[i % BAZAAR_SHOPS.length];
    state.shops.push({
      x: i * 380,
      w: 330,
      h: 230 + (i % 2) * 25,
      ...template
    });
  }

  state.clouds = [];
  for (let i = 0; i < 6; i++) {
    state.clouds.push({
      x: i * 260 + Math.random() * 80,
      y: 65 + (i % 3) * 42,
      scale: 0.7 + Math.random() * 0.5
    });
  }
}

initScenery();
ui.best.textContent = state.bestDistance;

// Particle & Floating Text Helpers
function spawnParticle(x, y, vx, vy, size, color, life = 0.6) {
  state.particles.push({ x, y, vx, vy, size, color, life, maxLife: life });
}

function spawnFloatingText(text, x, y, color = '#fff') {
  state.floatingTexts.push({ text, x, y, vy: -85, life: 0.95, color });
}

function showComicToast(text) {
  ui.comicToast.textContent = text;
  ui.comicToast.classList.remove('hidden');
  state.toastTimer = 1.4;
}

// Start or Restart Game
function startGame() {
  sfx.init();
  state.mode = 'PLAYING';
  state.time = 0;
  state.distance = 0;
  state.coins = 0;
  state.smashedCount = 0;
  state.baseSpeed = 500;
  state.currentSpeed = 500;
  state.chaserProximity = 0.25;
  state.chaserIndex = 0;
  state.chaserSwitchTimer = 0;
  state.chutneySlow = 0;
  state.screenShake = 0;

  state.powerups.chai = 0;
  state.powerups.shield = 0;
  state.powerups.magnet = 0;

  state.obstacles = [];
  state.collectibles = [];
  state.particles = [];
  state.floatingTexts = [];

  state.nextObstacleDist = 520;
  state.nextCoinDist = 250;
  state.nextPowerupDist = 850;

  player.reset();

  ui.startScreen.classList.add('hidden');
  ui.pauseScreen.classList.add('hidden');
  ui.gameoverScreen.classList.add('hidden');
  ui.hud.classList.remove('hidden');

  showComicToast('BHAAGO SAM! OUT THE WINDOW!');
}

function triggerGameOver(reasonTitle, reasonDesc, quip, badgeText) {
  state.mode = 'GAMEOVER';
  sfx.gameOver();

  const finalMeters = Math.floor(state.distance);
  if (finalMeters > state.bestDistance) {
    state.bestDistance = finalMeters;
    localStorage.setItem('run_sam_best', String(finalMeters));
  }

  ui.best.textContent = state.bestDistance;
  ui.finalDistance.textContent = `${finalMeters}m`;
  ui.finalCoins.textContent = state.coins;
  ui.finalSmashed.textContent = state.smashedCount;
  ui.finalBest.textContent = `${state.bestDistance}m`;

  ui.gameoverTitle.textContent = reasonTitle;
  ui.gameoverReason.textContent = reasonDesc;
  ui.gameoverQuips.textContent = quip;
  ui.gameoverBadge.textContent = badgeText;

  ui.gameoverScreen.classList.remove('hidden');
}

// Spawning Obstacles
function spawnObstacle() {
  const types = ['belan_high', 'belan_low', 'onion', 'chutney', 'oil', 'teacup'];
  // Weight slightly by distance
  const pick = types[Math.floor(Math.random() * types.length)];

  if (pick === 'belan_high') {
    // Flying Danda / Lathh at head height — player can duck/slide under or jump over!
    state.obstacles.push({
      type: 'belan',
      subtype: 'high',
      x: W + 120,
      y: GROUND_Y - 78,
      w: 85,
      h: 24,
      vx: -140,
      angle: 0,
      label: 'FLYING DANDA LATHH'
    });
  } else if (pick === 'belan_low') {
    // Low spinning Lathh / Belan — jump over
    state.obstacles.push({
      type: 'belan',
      subtype: 'low',
      x: W + 120,
      y: GROUND_Y - 26,
      w: 82,
      h: 22,
      vx: -110,
      angle: 0,
      label: 'SPINNING LATHH'
    });
  } else if (pick === 'onion') {
    // Giant rolling red onion
    state.obstacles.push({
      type: 'onion',
      x: W + 120,
      y: GROUND_Y,
      w: 76,
      h: 76,
      vx: -130,
      angle: 0,
      label: 'GIANT RED ONION'
    });
  } else if (pick === 'chutney') {
    // Spicy green chutney puddle (slows you down if stepped in)
    state.obstacles.push({
      type: 'chutney',
      x: W + 130,
      y: GROUND_Y,
      w: 135,
      h: 24,
      vx: 0,
      triggered: false,
      label: 'SPICY GREEN CHUTNEY'
    });
  } else if (pick === 'oil') {
    // Sizzling hot oil patch (fatal unless shielding or chai dashing)
    state.obstacles.push({
      type: 'oil',
      x: W + 130,
      y: GROUND_Y,
      w: 125,
      h: 26,
      vx: 0,
      label: 'SIZZLING HOT OIL'
    });
  } else if (pick === 'teacup') {
    // Bouncing flying saucer & teacup
    state.obstacles.push({
      type: 'teacup',
      x: W + 120,
      y: GROUND_Y - 45,
      baseY: GROUND_Y - 50,
      w: 64,
      h: 54,
      vx: -95,
      phase: Math.random() * Math.PI * 2,
      label: 'FLYING TEACUP'
    });
  }
}

// Spawning Collectibles & Powerups
function spawnCoinArc() {
  const pattern = Math.random();
  const startX = W + 100;
  if (pattern < 0.5) {
    // Jump arc of Masala Coins
    for (let i = 0; i < 5; i++) {
      const arcY = GROUND_Y - 45 - Math.sin((i / 4) * Math.PI) * 115;
      state.collectibles.push({
        kind: 'coin',
        x: startX + i * 56,
        y: arcY,
        r: 20,
        collected: false
      });
    }
  } else {
    // Low row (great for sliding)
    for (let i = 0; i < 4; i++) {
      state.collectibles.push({
        kind: 'coin',
        x: startX + i * 58,
        y: GROUND_Y - 38,
        r: 20,
        collected: false
      });
    }
  }
}

function spawnPowerup() {
  const kinds = ['chai', 'shield', 'magnet'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  state.collectibles.push({
    kind,
    x: W + 120,
    y: GROUND_Y - 95 - Math.random() * 75,
    r: 28,
    collected: false
  });
}

// AABB Collision check
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Main Update Loop
function update(dt) {
  state.time += dt;

  if (state.mode !== 'PLAYING') return;

  // Toast timer
  if (state.toastTimer > 0) {
    state.toastTimer -= dt;
    if (state.toastTimer <= 0) {
      ui.comicToast.classList.add('hidden');
    }
  }

  // Screen shake decay
  if (state.screenShake > 0) {
    state.screenShake = Math.max(0, state.screenShake - dt * 28);
  }

  // Update Powerup timers
  for (const key of ['chai', 'shield', 'magnet']) {
    if (state.powerups[key] > 0) {
      state.powerups[key] = Math.max(0, state.powerups[key] - dt);
    }
  }

  if (state.chutneySlow > 0) {
    state.chutneySlow = Math.max(0, state.chutneySlow - dt);
  }

  // Rotate active chaser every 18 seconds for comic variety
  state.chaserSwitchTimer += dt;
  if (state.chaserSwitchTimer > 18) {
    state.chaserSwitchTimer = 0;
    state.chaserIndex = (state.chaserIndex + 1) % CHASERS.length;
    const c = CHASERS[state.chaserIndex];
    showComicToast(`${c.icon} ${c.shout}`);
  }

  // Compute speed
  state.baseSpeed = Math.min(880, 500 + state.distance * 0.22);
  let speedMult = 1.0;
  if (state.powerups.chai > 0) {
    speedMult = 1.55;
  } else if (state.chutneySlow > 0) {
    speedMult = 0.62;
  }
  state.currentSpeed = state.baseSpeed * speedMult;

  // Update Distance
  const distDelta = (state.currentSpeed * dt) / 42;
  state.distance += distDelta;

  // Update Chaser Proximity
  if (state.powerups.chai > 0) {
    state.chaserProximity = Math.max(0.14, state.chaserProximity - dt * 0.14);
  } else if (state.chutneySlow > 0) {
    state.chaserProximity = Math.min(1.0, state.chaserProximity + dt * 0.15);
  } else {
    // Slowly recover if running cleanly
    state.chaserProximity = Math.max(0.22, state.chaserProximity - dt * 0.025);
  }

  if (state.chaserProximity >= 1.0) {
    const chaser = CHASERS[state.chaserIndex];
    triggerGameOver(
      'CAUGHT FOR TEA TIME!',
      `${chaser.name} caught up and served you on a porcelain plate!`,
      `"${chaser.shout}"`,
      'SERVED WITH MINT CHUTNEY!'
    );
    return;
  }

  // Player Physics
  player.vy += player.gravity * dt;
  player.y += player.vy * dt;

  if (player.y >= GROUND_Y) {
    if (player.jumpsUsed > 0) {
      // Landing squash
      player.squashX = 1.22;
      player.squashY = 0.8;
    }
    player.y = GROUND_Y;
    player.vy = 0;
    player.jumpsUsed = 0;
  }

  // Smoothly restore squash & stretch
  player.squashX += (1 - player.squashX) * Math.min(1, dt * 14);
  player.squashY += (1 - player.squashY) * Math.min(1, dt * 14);
  player.runCycle += dt * (state.currentSpeed * 0.028);

  if (player.hurtFlash > 0) {
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  }

  // Parallax Scenery Update
  for (const cloud of state.clouds) {
    cloud.x -= state.currentSpeed * 0.12 * dt;
    if (cloud.x < -180) cloud.x = W + 120;
  }

  for (const shop of state.shops) {
    shop.x -= state.currentSpeed * 0.45 * dt;
    if (shop.x + shop.w < -60) {
      const maxRight = Math.max(...state.shops.map(s => s.x + s.w));
      const nextTemplate = BAZAAR_SHOPS[Math.floor(Math.random() * BAZAAR_SHOPS.length)];
      shop.x = maxRight + 50;
      shop.name = nextTemplate.name;
      shop.sub = nextTemplate.sub;
      shop.color = nextTemplate.color;
      shop.awning = nextTemplate.awning;
    }
  }

  // Spawners
  state.nextObstacleDist -= state.currentSpeed * dt;
  if (state.nextObstacleDist <= 0) {
    spawnObstacle();
    const minGap = Math.max(340, 560 - state.distance * 0.15);
    state.nextObstacleDist = minGap + Math.random() * 280;
  }

  state.nextCoinDist -= state.currentSpeed * dt;
  if (state.nextCoinDist <= 0) {
    spawnCoinArc();
    state.nextCoinDist = 420 + Math.random() * 350;
  }

  state.nextPowerupDist -= state.currentSpeed * dt;
  if (state.nextPowerupDist <= 0) {
    spawnPowerup();
    state.nextPowerupDist = 1350 + Math.random() * 750;
  }

  const pBox = player.getHitbox();

  // Update Obstacles
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const ob = state.obstacles[i];
    ob.x -= (state.currentSpeed - (ob.vx || 0)) * dt;

    if (ob.type === 'belan' || ob.type === 'onion') {
      ob.angle -= dt * 9.5;
    } else if (ob.type === 'teacup') {
      ob.phase += dt * 7;
      ob.y = ob.baseY + Math.sin(ob.phase) * 28;
    }

    // Build obstacle hitbox
    let obBox;
    if (ob.type === 'onion') {
      obBox = { x: ob.x - ob.w * 0.42, y: ob.y - ob.h * 0.88, w: ob.w * 0.84, h: ob.h * 0.84 };
    } else if (ob.type === 'belan') {
      obBox = { x: ob.x - ob.w * 0.45, y: ob.y - ob.h * 0.5, w: ob.w * 0.9, h: ob.h * 0.85 };
    } else if (ob.type === 'teacup') {
      obBox = { x: ob.x - ob.w * 0.4, y: ob.y - ob.h * 0.8, w: ob.w * 0.8, h: ob.h * 0.75 };
    } else {
      // Ground puddle (chutney or oil)
      obBox = { x: ob.x - ob.w * 0.44, y: GROUND_Y - 18, w: ob.w * 0.88, h: 18 };
    }

    if (rectsOverlap(pBox, obBox)) {
      // Check Invincibility (Chai Boost or Extra Crispy Shield)
      if (state.powerups.chai > 0 || state.powerups.shield > 0) {
        if (ob.type === 'chutney') {
          // Immune to chutney slow while shielded/dashing
        } else {
          sfx.smash();
          state.smashedCount++;
          state.coins += 15;
          state.screenShake = 10;
          spawnFloatingText(`CRUNCH! +15`, ob.x, ob.y - 40, '#fcbf49');
          for (let k = 0; k < 14; k++) {
            spawnParticle(
              ob.x,
              ob.y - 25,
              (Math.random() - 0.5) * 420,
              -Math.random() * 320,
              Math.random() * 7 + 4,
              k % 2 === 0 ? '#e63946' : '#fcbf49',
              0.55
            );
          }
          state.obstacles.splice(i, 1);
          continue;
        }
      } else {
        // Normal collision
        if (ob.type === 'chutney') {
          if (!ob.triggered) {
            ob.triggered = true;
            sfx.squelch();
            state.chutneySlow = 2.6;
            state.chaserProximity = Math.min(0.96, state.chaserProximity + 0.18);
            spawnFloatingText('SPICY CHUTNEY! SLOWED!', player.x, player.y - 95, '#38b000');
            for (let k = 0; k < 10; k++) {
              spawnParticle(
                player.x,
                GROUND_Y - 5,
                (Math.random() - 0.5) * 200,
                -Math.random() * 180,
                6,
                '#38b000',
                0.5
              );
            }
          }
        } else if (ob.type === 'oil') {
          // Sizzling hot oil patch is an instant fry hazard!
          triggerGameOver(
            'DOUBLE-FRIED IN THE KADHAI!',
            'You slipped into a sizzling hot oil patch and got extra-overcooked!',
            '"TOO HOT! MY CRUST IS BURNING!"',
            'SIZZLING OIL HAZARD'
          );
          return;
        } else {
          // Hit by Belan, Giant Onion, or Flying Teacup
          sfx.smash();
          state.screenShake = 14;
          player.hurtFlash = 0.7;
          state.chaserProximity += 0.34;
          spawnFloatingText(`OUCH! ${ob.label}!`, player.x, player.y - 100, '#e63946');
          for (let k = 0; k < 12; k++) {
            spawnParticle(
              ob.x,
              ob.y - 30,
              (Math.random() - 0.5) * 320,
              -Math.random() * 260,
              6,
              '#fcbf49',
              0.5
            );
          }
          state.obstacles.splice(i, 1);

          if (state.chaserProximity >= 1.0) {
            const chaser = CHASERS[state.chaserIndex];
            triggerGameOver(
              'SMASHED & SNACKED!',
              `A ${ob.label} knocked you down and ${chaser.name} grabbed you!`,
              '"MY CRISPY TRIANGLE CORNERS!"',
              'KNOCKED OUT IN THE BAZAAR'
            );
            return;
          }
          continue;
        }
      }
    }

    if (ob.x < -200) {
      state.obstacles.splice(i, 1);
    }
  }

  // Update Collectibles & Powerups
  for (let i = state.collectibles.length - 1; i >= 0; i--) {
    const item = state.collectibles[i];

    // Mint Chutney Magnet pull effect
    if (state.powerups.magnet > 0 && item.kind === 'coin') {
      const dx = player.x - item.x;
      const dy = (player.y - 48) - item.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 420) {
        item.x += (dx / Math.max(1, dist)) * 780 * dt;
        item.y += (dy / Math.max(1, dist)) * 780 * dt;
      } else {
        item.x -= state.currentSpeed * dt;
      }
    } else {
      item.x -= state.currentSpeed * dt;
    }

    const dx = player.x - item.x;
    const dy = (player.y - 46) - item.y;
    if (Math.hypot(dx, dy) < item.r + 44) {
      if (item.kind === 'coin') {
        sfx.coin();
        state.coins += 10;
        spawnFloatingText('+10', item.x, item.y - 15, '#fcbf49');
      } else if (item.kind === 'chai') {
        sfx.powerup();
        state.powerups.chai = 5.5;
        state.chutneySlow = 0;
        showComicToast('☕ GARAM CHAI TURBO BOOST!');
        spawnFloatingText('CHAI SPEED BOOST!', player.x, player.y - 110, '#ff7b00');
      } else if (item.kind === 'shield') {
        sfx.powerup();
        state.powerups.shield = 8.0;
        showComicToast('🛡️ EXTRA CRISPY SHIELD ACTIVATED!');
        spawnFloatingText('EXTRA CRISPY SHIELD!', player.x, player.y - 110, '#fcbf49');
      } else if (item.kind === 'magnet') {
        sfx.powerup();
        state.powerups.magnet = 9.0;
        showComicToast('🧲 MINT CHUTNEY MAGNET!');
        spawnFloatingText('MINT MAGNET!', player.x, player.y - 110, '#2ec4b6');
      }
      state.collectibles.splice(i, 1);
      continue;
    }

    if (item.x < -100) {
      state.collectibles.splice(i, 1);
    }
  }

  // Update Particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 680 * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // Update Floating Texts
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) state.floatingTexts.splice(i, 1);
  }

  updateHUD();
}

function updateHUD() {
  ui.distance.textContent = Math.floor(state.distance);
  ui.coins.textContent = state.coins;
  const pct = Math.min(95, Math.max(12, Math.round(state.chaserProximity * 95)));
  ui.dangerFill.style.width = `${pct}%`;
  ui.dangerIcon.style.left = `${pct}%`;

  const chaser = CHASERS[state.chaserIndex];
  ui.chaserLabel.textContent = `${chaser.icon} ${chaser.name}`;

  const mult = (state.currentSpeed / 500).toFixed(1);
  ui.speedBadge.textContent = `${mult}x SPEED`;

  // Render active power-up chips
  const chips = [];
  if (state.powerups.chai > 0) {
    const pct = Math.round((state.powerups.chai / 5.5) * 100);
    chips.push(`<div class="power-chip">☕ CHAI TURBO <div class="power-chip-bar"><div class="power-chip-fill" style="width:${pct}%;background:#ff7b00"></div></div></div>`);
  }
  if (state.powerups.shield > 0) {
    const pct = Math.round((state.powerups.shield / 8.0) * 100);
    chips.push(`<div class="power-chip">🛡️ CRISPY SHIELD <div class="power-chip-bar"><div class="power-chip-fill" style="width:${pct}%;background:#fcbf49"></div></div></div>`);
  }
  if (state.powerups.magnet > 0) {
    const pct = Math.round((state.powerups.magnet / 9.0) * 100);
    chips.push(`<div class="power-chip">🧲 MINT MAGNET <div class="power-chip-bar"><div class="power-chip-fill" style="width:${pct}%;background:#2ec4b6"></div></div></div>`);
  }
  if (state.chutneySlow > 0) {
    const pct = Math.round((state.chutneySlow / 2.6) * 100);
    chips.push(`<div class="power-chip">🟢 CHUTNEY SLOW <div class="power-chip-bar"><div class="power-chip-fill" style="width:${pct}%;background:#38b000"></div></div></div>`);
  }
  ui.powerupBar.innerHTML = chips.join('');
}

// ============================================================================
// RENDERING PIPELINE (Vibrant Indian Street Market + Comic Book Aesthetics)
// ============================================================================

function drawScene() {
  ctx.save();

  // Screen shake offset
  if (state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake;
    const sy = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(sx, sy);
  }

  // 1. Sunset Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, '#ff9e00');
  skyGrad.addColorStop(0.45, '#ffbe0b');
  skyGrad.addColorStop(1, '#ffe5a3');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Comic Sunburst Rays
  ctx.save();
  ctx.translate(W * 0.75, 130);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(900, -45);
    ctx.lineTo(900, 45);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Warm Glowing Sun
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(W * 0.75, 130, 62, 0, Math.PI * 2);
  ctx.fill();

  // Distant Mughal / Bazaar Silhouette Skyline
  ctx.fillStyle = '#e07a5f';
  for (let x = 0; x < W + 200; x += 180) {
    const offset = (x + Math.floor(state.distance * 2)) % 180;
    const bx = x - offset;
    ctx.fillRect(bx, GROUND_Y - 290, 140, 290);
    // Dome
    ctx.beginPath();
    ctx.arc(bx + 70, GROUND_Y - 290, 48, Math.PI, 0);
    ctx.fill();
  }

  // Clouds
  for (const c of state.clouds) {
    drawCloud(c.x, c.y, c.scale);
  }

  // 2. Decorative Festive Bunting Flags Across Street
  drawBuntingFlags();

  // 3. Midground Indian Bazaar Shops
  for (const shop of state.shops) {
    drawBazaarShop(shop);
  }

  // 4. Cobblestone Market Street Road
  drawGround();

  // 5. Obstacles
  for (const ob of state.obstacles) {
    drawObstacle(ob);
  }

  // 6. Collectibles & Power-Ups
  for (const item of state.collectibles) {
    drawCollectible(item);
  }

  // 7. Chaser Character (Angry Dadi / Sheru Dog / Hungry Uncle) on the Left
  drawChaser();

  // 8. Hero Player: Sam the Sentient Samosa!
  drawPlayer();

  // 9. Particles & Floating Comic Callouts
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const ft of state.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, ft.life * 1.4);
    ctx.font = '28px "Bangers", cursive';
    ctx.fillStyle = ft.color;
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 5;
    ctx.textAlign = 'center';
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  // Chai Turbo Speed Lines Overlay
  if (state.powerups.chai > 0) {
    drawSpeedLines();
  }

  ctx.restore();
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 252, 242, 0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.arc(26, -8, 34, 0, Math.PI * 2);
  ctx.arc(58, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBuntingFlags() {
  const colors = ['#d62828', '#fcbf49', '#2ec4b6', '#ff7b00', '#8338ec'];
  ctx.save();
  ctx.strokeStyle = '#1e1209';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 145);
  ctx.quadraticCurveTo(W * 0.5, 205, W, 140);
  ctx.stroke();

  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const fx = t * W;
    const fy = (1 - t) * (1 - t) * 145 + 2 * (1 - t) * t * 205 + t * t * 140;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(fx - 14, fy);
    ctx.lineTo(fx + 14, fy);
    ctx.lineTo(fx, fy + 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBazaarShop(shop) {
  const topY = GROUND_Y - shop.h;
  ctx.save();

  // Main Shop Wall
  ctx.fillStyle = '#fff3d6';
  ctx.strokeStyle = '#1e1209';
  ctx.lineWidth = 4;
  ctx.fillRect(shop.x, topY, shop.w, shop.h);
  ctx.strokeRect(shop.x, topY, shop.w, shop.h);

  // Inside dark counter opening
  ctx.fillStyle = '#3d2514';
  ctx.fillRect(shop.x + 22, topY + 78, shop.w - 44, shop.h - 78);

  // Hanging brass pots / spice jars inside stall
  ctx.fillStyle = '#fcbf49';
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.arc(shop.x + 58 + k * 68, topY + 115, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Striped Awning
  const stripeCount = 7;
  const sw = shop.w / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? shop.awning : '#fff';
    ctx.fillRect(shop.x + i * sw, topY + 42, sw, 32);
    ctx.strokeRect(shop.x + i * sw, topY + 42, sw, 32);
  }

  // Shop Signboard
  ctx.fillStyle = shop.color;
  ctx.fillRect(shop.x + 12, topY - 14, shop.w - 24, 50);
  ctx.strokeRect(shop.x + 12, topY - 14, shop.w - 24, 50);

  ctx.fillStyle = '#fff';
  ctx.font = '22px "Bangers", cursive';
  ctx.textAlign = 'center';
  ctx.fillText(shop.name, shop.x + shop.w / 2, topY + 12);

  ctx.fillStyle = '#fff8eb';
  ctx.font = '700 11px "Fredoka", sans-serif';
  ctx.fillText(shop.sub, shop.x + shop.w / 2, topY + 28);

  ctx.restore();
}

function drawGround() {
  // Street curb
  ctx.fillStyle = '#d4a373';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Top border line
  ctx.strokeStyle = '#1e1209';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  // Scrolling market paving stones
  const scrollOffset = (state.distance * 42) % 90;
  ctx.strokeStyle = 'rgba(30, 18, 9, 0.25)';
  ctx.lineWidth = 3;
  for (let x = -scrollOffset; x < W; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - 35, H);
    ctx.stroke();
  }
}

// Draw Obstacles
function drawObstacle(ob) {
  ctx.save();

  if (ob.type === 'belan') {
    // Desi Bamboo Danda / Lathh (Half-size)
    ctx.translate(ob.x, ob.y);
    ctx.rotate(ob.angle);
    ctx.scale(0.55, 0.55);
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 4;

    // Thick tapered wooden Lathh / Danda body
    const lathGrad = ctx.createLinearGradient(0, -18, 0, 18);
    lathGrad.addColorStop(0, '#f3c677');
    lathGrad.addColorStop(0.5, '#c87d32');
    lathGrad.addColorStop(1, '#7f4813');
    ctx.fillStyle = lathGrad;

    ctx.beginPath();
    ctx.moveTo(-78, -9);
    ctx.lineTo(72, -16);
    ctx.quadraticCurveTo(84, 0, 72, 16);
    ctx.lineTo(-78, 9);
    ctx.quadraticCurveTo(-84, 0, -78, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red grip handle wrap at the base
    ctx.fillStyle = '#d62828';
    ctx.beginPath();
    ctx.roundRect(-78, -10, 24, 20, 5);
    ctx.fill();
    ctx.stroke();

    // Brass / Iron Rings & Bamboo Knots (Desi Lathh nodes)
    ctx.fillStyle = '#fcbf49';
    for (const rx of [-32, 8, 46]) {
      ctx.beginPath();
      ctx.roundRect(rx, -15, 8, 30, 3);
      ctx.fill();
      ctx.stroke();
    }

    // Heavy iron studs on the thick striking end
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.arc(62, -7, 3.5, 0, Math.PI * 2);
    ctx.arc(62, 7, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glossy wood grain highlight
    ctx.fillStyle = 'rgba(255, 250, 224, 0.55)';
    ctx.fillRect(-48, -6, 100, 4);

    // Aggressive red motion whoosh rings
    ctx.strokeStyle = 'rgba(214, 40, 40, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0.2, Math.PI * 1.35);
    ctx.stroke();
  } else if (ob.type === 'onion') {
    // Giant Red Onion
    const r = ob.w * 0.48;
    ctx.translate(ob.x, ob.y - r);
    ctx.rotate(ob.angle);

    ctx.fillStyle = '#9d174d';
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Onion concentric rings
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0.5, Math.PI * 1.9);
    ctx.stroke();

    // Angry eyes on the giant onion
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-10, -4, 6, 0, Math.PI * 2);
    ctx.arc(10, -4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1209';
    ctx.beginPath();
    ctx.arc(-11, -4, 3, 0, Math.PI * 2);
    ctx.arc(9, -4, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (ob.type === 'chutney') {
    // Spicy Green Chutney Puddle
    ctx.translate(ob.x, GROUND_Y);
    ctx.fillStyle = '#38b000';
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.ellipse(0, 2, ob.w * 0.5, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bubbling green spice bubbles
    ctx.fillStyle = '#70e000';
    const b1 = Math.sin(state.time * 8 + ob.x) * 4;
    ctx.beginPath();
    ctx.arc(-25, -2 + b1, 6, 0, Math.PI * 2);
    ctx.arc(18, -4 - b1, 5, 0, Math.PI * 2);
    ctx.fill();

    // Label tag
    ctx.font = '15px "Bangers", cursive';
    ctx.fillStyle = '#1e1209';
    ctx.textAlign = 'center';
    ctx.fillText('SPICY CHUTNEY', 0, 24);
  } else if (ob.type === 'oil') {
    // Sizzling Hot Oil Patch
    ctx.translate(ob.x, GROUND_Y);
    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, ob.w * 0.5);
    grad.addColorStop(0, '#ffbe0b');
    grad.addColorStop(0.7, '#fb5607');
    grad.addColorStop(1, '#d62828');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 2, ob.w * 0.5, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sizzling flame sparks
    for (let s = -2; s <= 2; s++) {
      const fy = -8 - Math.abs(Math.sin(state.time * 12 + s)) * 16;
      ctx.fillStyle = s % 2 === 0 ? '#ff006e' : '#ffbe0b';
      ctx.beginPath();
      ctx.arc(s * 20, fy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = '15px "Bangers", cursive';
    ctx.fillStyle = '#d62828';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 SIZZLING OIL!', 0, 25);
  } else if (ob.type === 'teacup') {
    // Flying Teacup
    ctx.translate(ob.x, ob.y - 24);
    ctx.rotate(Math.sin(ob.phase) * 0.25);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 3.5;

    // Cup body
    ctx.beginPath();
    ctx.roundRect(-22, -18, 44, 34, [4, 4, 16, 16]);
    ctx.fill();
    ctx.stroke();

    // Chai inside
    ctx.fillStyle = '#c97a3e';
    ctx.beginPath();
    ctx.ellipse(0, -16, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

// Draw Collectibles & Powerups
function drawCollectible(item) {
  ctx.save();
  const bob = Math.sin(state.time * 6 + item.x * 0.03) * 6;
  ctx.translate(item.x, item.y + bob);

  if (item.kind === 'coin') {
    // Golden Masala Coin
    ctx.fillStyle = '#fcbf49';
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff7b00';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '14px "Bangers", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 1);
  } else {
    // Glowing Power-up Orb
    const colors = {
      chai: { bg: '#ff7b00', ring: '#ffe699', icon: '☕', label: 'CHAI BOOST' },
      shield: { bg: '#fcbf49', ring: '#fff', icon: '🛡️', label: 'CRISPY SHIELD' },
      magnet: { bg: '#2ec4b6', ring: '#a8f9ff', icon: '🧲', label: 'MINT MAGNET' }
    };
    const cfg = colors[item.kind];

    // Outer pulse halo
    ctx.fillStyle = cfg.ring;
    ctx.globalAlpha = 0.35 + Math.sin(state.time * 10) * 0.15;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Badge circle
    ctx.fillStyle = cfg.bg;
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.icon, 0, 2);

    ctx.font = '14px "Bangers", cursive';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 3;
    ctx.strokeText(cfg.label, 0, -34);
    ctx.fillText(cfg.label, 0, -34);
  }

  ctx.restore();
}

// Draw the Angry Chaser behind Sam on the left side of the screen
function drawChaser() {
  const chaser = CHASERS[state.chaserIndex];
  // Map proximity (0.14..1.0) to X coordinate (35 .. player.x - 85)
  const minX = 56;
  const maxX = player.x - 88;
  const cx = minX + (maxX - minX) * ((state.chaserProximity - 0.14) / 0.86);
  const bounce = Math.abs(Math.sin(state.time * 15)) * 14;
  const cy = GROUND_Y - bounce;

  ctx.save();
  ctx.translate(cx, cy);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(0, bounce, 40, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Running feet
  const legSwing = Math.sin(state.time * 22) * 20;
  ctx.fillStyle = '#1e1209';
  ctx.beginPath();
  ctx.ellipse(-14 + legSwing, -8, 13, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(14 - legSwing, -8, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (kurta/shirt colored by chaser mood)
  ctx.fillStyle = chaser.color;
  ctx.strokeStyle = '#1e1209';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-28, -72, 56, 56, 18);
  ctx.fill();
  ctx.stroke();

  // Back arm pumping
  ctx.save();
  ctx.translate(-18, -58);
  ctx.rotate(-Math.sin(state.time * 20) * 0.45);
  ctx.fillStyle = chaser.color;
  ctx.beginPath();
  ctx.roundRect(-10, 0, 16, 32, 7);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Head: User's Uploaded Chaser Face Sprite!
  ctx.save();
  const headTilt = Math.sin(state.time * 15) * 0.08 + 0.06;
  ctx.translate(2, -108);
  ctx.rotate(headTilt);
  if (chaserFaceLoaded) {
    const fw = 84;
    const fh = 96;
    ctx.drawImage(chaserFaceImg, -fw / 2, -fh / 2, fw, fh);
  } else {
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chaser.icon, 0, 0);
  }
  ctx.restore();

  // Waving Danda / Lathh in front hand (Half-size)
  ctx.save();
  ctx.translate(22, -52);
  const swingAngle = Math.sin(state.time * 18) * 0.55 - 0.55;
  ctx.rotate(swingAngle);

  // Arm holding the lathh
  ctx.fillStyle = chaser.color;
  ctx.strokeStyle = '#1e1209';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(-8, -8, 22, 15, 6);
  ctx.fill();
  ctx.stroke();

  // Scale the lathh to half size
  ctx.scale(0.52, 0.52);

  // Bamboo / Wooden Lathh shaft
  const clubGrad = ctx.createLinearGradient(0, -14, 0, 14);
  clubGrad.addColorStop(0, '#f3c677');
  clubGrad.addColorStop(0.5, '#c87d32');
  clubGrad.addColorStop(1, '#783f0e');
  ctx.fillStyle = clubGrad;
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(4, -7);
  ctx.lineTo(132, -16);
  ctx.quadraticCurveTo(146, 0, 132, 16);
  ctx.lineTo(4, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Red grip wrap near hand
  ctx.fillStyle = '#d62828';
  ctx.beginPath();
  ctx.roundRect(6, -8, 22, 16, 4);
  ctx.fill();
  ctx.stroke();

  // Brass rings / bamboo knots along the lathh
  ctx.fillStyle = '#fcbf49';
  for (const knotX of [45, 82, 116]) {
    const halfH = 8 + (knotX / 132) * 7;
    ctx.beginPath();
    ctx.roundRect(knotX, -halfH, 7, halfH * 2, 3);
    ctx.fill();
    ctx.stroke();
  }

  // Metal studs near the heavy tip
  ctx.fillStyle = '#e5e7eb';
  ctx.beginPath();
  ctx.arc(128, -7, 3.5, 0, Math.PI * 2);
  ctx.arc(128, 7, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wood shine line
  ctx.fillStyle = 'rgba(255, 250, 224, 0.55)';
  ctx.fillRect(30, -5, 92, 4);

  // Swing whoosh arc at tip
  ctx.strokeStyle = 'rgba(214, 40, 40, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 142, -0.35, 0.35);
  ctx.stroke();
  ctx.restore();

  // Speech shout when close
  if (state.chaserProximity > 0.48) {
    ctx.font = '19px "Bangers", cursive';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.strokeText(chaser.shout, 12, -162);
    ctx.fillText(chaser.shout, 12, -162);
  }

  ctx.restore();
}

// ============================================================================
// DRAW PLAYER: SAM THE SENTIENT SAMOSA (User's Uploaded Image + Tiny Red Sneakers!)
// ============================================================================
function drawPlayer() {
  ctx.save();

  // Ground shadow
  const heightOffGround = Math.max(0, GROUND_Y - player.y);
  const shadowScale = Math.max(0.35, 1 - heightOffGround / 320);
  ctx.fillStyle = 'rgba(30, 18, 9, 0.28)';
  ctx.beginPath();
  ctx.ellipse(player.x, GROUND_Y + 4, 48 * shadowScale, 11 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Translate to player center
  const baseH = 104;
  const baseW = 106;
  ctx.translate(player.x, player.y);

  // Apply hurt flash
  if (player.hurtFlash > 0 && Math.floor(player.hurtFlash * 20) % 2 === 0) {
    ctx.globalAlpha = 0.65;
  }

  // Extra Crispy Shield Bubble
  if (state.powerups.shield > 0) {
    ctx.save();
    ctx.strokeStyle = '#fcbf49';
    ctx.fillStyle = 'rgba(252, 191, 73, 0.22)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -52, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Mint Chutney Magnet Aura
  if (state.powerups.magnet > 0) {
    ctx.save();
    ctx.strokeStyle = '#2ec4b6';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, -52, 82 + Math.sin(state.time * 12) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Running tilt & squash/stretch
  const runBob = player.y >= GROUND_Y - 2 ? Math.abs(Math.sin(player.runCycle)) * 8 : 0;
  const tilt = player.y < GROUND_Y - 2
    ? Math.max(-0.28, Math.min(0.28, player.vy * 0.0003))
    : Math.sin(player.runCycle) * 0.06;

  ctx.translate(0, -runBob);
  ctx.scale(player.squashX, player.squashY);
  ctx.rotate(tilt);

  // 1. TINY RED SNEAKERS & RUNNING LEGS (from prompt!)
  if (state.wearComicGear) {
    const stride = player.y < GROUND_Y - 2 ? 0.7 : Math.sin(player.runCycle);
    const leftX = -18 + stride * 24;
    const leftY = -8 - Math.max(0, -stride) * 14;
    const rightX = 18 - stride * 24;
    const rightY = -8 - Math.max(0, stride) * 14;

    drawSneaker(leftX, leftY, stride * 0.35);
    drawSneaker(rightX, rightY, -stride * 0.35);
  }

  // 2. THE USER'S UPLOADED SENTIENT SAMOSA SPRITE
  const spriteW = baseW;
  const spriteH = baseH;
  const spriteY = state.wearComicGear ? -spriteH - 10 : -spriteH;

  if (heroLoaded) {
    ctx.drawImage(heroImg, -spriteW / 2, spriteY, spriteW, spriteH);
  } else {
    // Fallback triangle until loaded
    ctx.fillStyle = '#f4a261';
    ctx.beginPath();
    ctx.moveTo(0, spriteY);
    ctx.lineTo(50, spriteY + spriteH);
    ctx.lineTo(-50, spriteY + spriteH);
    ctx.closePath();
    ctx.fill();
  }

  // 3. COMIC SWEATBAND & PANIC SWEAT DROPS (Toggleable via Gear button!)
  if (state.wearComicGear) {
    // Sporty Red & White Sweatband across forehead
    ctx.save();
    ctx.fillStyle = '#d62828';
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-27, spriteY + 26, 54, 11, 5);
    ctx.fill();
    ctx.stroke();

    // White center stripe on headband
    ctx.fillStyle = '#fff';
    ctx.fillRect(-25, spriteY + 30, 50, 3);

    // Fluttering headband tails behind head
    const tailWave = Math.sin(state.time * 18) * 6;
    ctx.fillStyle = '#d62828';
    ctx.beginPath();
    ctx.moveTo(-27, spriteY + 30);
    ctx.lineTo(-48, spriteY + 24 + tailWave);
    ctx.lineTo(-44, spriteY + 36 + tailWave);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Comical Panic Sweat Drops flying off head
    const dropPhase = (state.time * 5) % 1;
    ctx.fillStyle = '#4cc9f0';
    ctx.strokeStyle = '#1e1209';
    ctx.lineWidth = 2;
    const dx = -34 - dropPhase * 22;
    const dy = spriteY + 20 - Math.sin(dropPhase * Math.PI) * 14;
    ctx.beginPath();
    ctx.arc(dx, dy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawSneaker(x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Leg
  ctx.strokeStyle = '#1e1209';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // White sock cuff
  ctx.fillStyle = '#fff';
  ctx.fillRect(-6, -7, 12, 5);

  // Red Sneaker body
  ctx.fillStyle = '#e63946';
  ctx.strokeStyle = '#1e1209';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-10, -3, 26, 13, [4, 10, 4, 4]);
  ctx.fill();
  ctx.stroke();

  // White rubber sole & toe cap
  ctx.fillStyle = '#fff';
  ctx.fillRect(-10, 6, 26, 4);

  ctx.restore();
}

function drawSpeedLines() {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const y = (i * 73 + (state.time * 400) % 70) % H;
    const x = ((i * 190 - state.time * 1400) % W + W) % W;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 110, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================
// INPUT HANDLING & EVENT LISTENERS
// ============================================================================
function toggleComicGear() {
  state.wearComicGear = !state.wearComicGear;
  ui.chkComicGear.checked = state.wearComicGear;
  ui.btnGear.textContent = state.wearComicGear ? '👟 GEAR: ON' : '👟 GEAR: OFF';
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (state.mode === 'START' || state.mode === 'GAMEOVER') {
      startGame();
    } else if (state.mode === 'PLAYING') {
      player.jump();
    } else if (state.mode === 'PAUSED') {
      state.mode = 'PLAYING';
      ui.pauseScreen.classList.add('hidden');
    }
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    if (state.mode === 'PLAYING') {
      player.duck(true);
    }
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state.mode === 'PLAYING') {
      state.mode = 'PAUSED';
      ui.pauseScreen.classList.remove('hidden');
    } else if (state.mode === 'PAUSED') {
      state.mode = 'PLAYING';
      ui.pauseScreen.classList.add('hidden');
    }
  } else if (e.code === 'KeyG') {
    toggleComicGear();
  } else if (e.code === 'KeyM') {
    sfx.muted = !sfx.muted;
    ui.btnMute.textContent = sfx.muted ? '🔇' : '🔊';
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    player.duck(false);
  }
});

// Mouse / Touch & Swipe Gestures on Canvas for Phone Playability
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

function isForcedRotatedPortrait() {
  return window.innerWidth <= 950 && window.innerHeight > window.innerWidth;
}

// Attempt fullscreen + horizontal orientation lock on mobile
async function requestMobileHorizontalLock() {
  try {
    const docEl = document.documentElement;
    if (!document.fullscreenElement && docEl.requestFullscreen) {
      await docEl.requestFullscreen();
    }
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) {}
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'PLAYING') return;
  touchStartX = e.clientX;
  touchStartY = e.clientY;
  touchMoved = false;
  player.jump();
});

canvas.addEventListener('pointermove', (e) => {
  if (state.mode !== 'PLAYING') return;
  const dx = e.clientX - touchStartX;
  const dy = e.clientY - touchStartY;
  // In rotated portrait mode (CSS rotate(90deg)), a downward swipe in game space is -dx
  const downDelta = isForcedRotatedPortrait() ? -dx : dy;
  if (!touchMoved && downDelta > 36) {
    touchMoved = true;
    player.duck(true);
    setTimeout(() => player.duck(false), 550);
  }
});

const btnFullscreen = document.getElementById('btn-fullscreen');
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      requestMobileHorizontalLock();
    }
  });
}

// UI Buttons
document.getElementById('btn-start-game').addEventListener('click', () => {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    requestMobileHorizontalLock();
  }
  startGame();
});
document.getElementById('btn-retry-game').addEventListener('click', startGame);
document.getElementById('btn-restart-pause').addEventListener('click', startGame);

document.getElementById('btn-resume-game').addEventListener('click', () => {
  state.mode = 'PLAYING';
  ui.pauseScreen.classList.add('hidden');
});

document.getElementById('btn-home-screen').addEventListener('click', () => {
  state.mode = 'START';
  ui.gameoverScreen.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.startScreen.classList.remove('hidden');
});

ui.btnPause.addEventListener('click', () => {
  if (state.mode === 'PLAYING') {
    state.mode = 'PAUSED';
    ui.pauseScreen.classList.remove('hidden');
  } else if (state.mode === 'PAUSED') {
    state.mode = 'PLAYING';
    ui.pauseScreen.classList.add('hidden');
  }
});

ui.btnMute.addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  ui.btnMute.textContent = sfx.muted ? '🔇' : '🔊';
});

ui.btnGear.addEventListener('click', toggleComicGear);
ui.chkComicGear.addEventListener('change', (e) => {
  state.wearComicGear = e.target.checked;
  ui.btnGear.textContent = state.wearComicGear ? '👟 GEAR: ON' : '👟 GEAR: OFF';
});

// Mobile Touch Buttons
const touchJump = document.getElementById('touch-jump');
const touchDuck = document.getElementById('touch-duck');

touchJump.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (state.mode === 'PLAYING') player.jump();
});

touchDuck.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (state.mode === 'PLAYING') player.duck(true);
});
touchDuck.addEventListener('pointerup', (e) => {
  e.stopPropagation();
  player.duck(false);
});
touchDuck.addEventListener('pointerleave', () => player.duck(false));

// Main Animation Loop
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  drawScene();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
