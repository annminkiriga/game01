// stage.js

// 既存の bossData を生かしつつ、LV-001～005 を定義
// ※ boss.js の initBoss 内の引数名 (data.stopFrame / data.attackPattern) に合わせています
var bossData = {
  "001": {
    hp: 3, speed: 1.0, stopFrame: 20, moveRange: 'B',
    resistances: { normal: 1.0, spread: 0.5, laser: 0.1, homing: 0.5, ripple: 0.5, rocket: 0.1, split: 0.5, bounce: 0.5, grave: 0.1 },
    attackPattern: { 'normal': 1.0 }
  },
  "002": {
    hp: 2, speed: 1.2, stopFrame: 15, moveRange: 'B',
    resistances: { normal: 0.5, spread: 1.0, laser: 0.1, homing: 0.5, ripple: 1.0, rocket: 0.1, split: 0.5, bounce: 0.5, grave: 0.1 },
    attackPattern: { 'spread': 1.0, 'ripple': 0.3 }
  },
  "003": {
    hp: 2, speed: 0.8, stopFrame: 30, moveRange: 'E',
    resistances: { normal: 0.1, spread: 0.1, laser: 1.0, homing: 0.1, ripple: 0.1, rocket: 1.0, split: 0.5, bounce: 0.5, grave: 1.0 },
    attackPattern: { 'laser': 0.3, 'normal': 1.0 }
  },
  "004": {
    hp: 2, speed: 1.0, stopFrame: 10, moveRange: 'C',
    resistances: { normal: 0.2, spread: 0.2, laser: 0.6, homing: 0.1, ripple: 0.1, rocket: 0.6, split: 0.3, bounce: 0.3, grave: 0.6 },
    attackPattern: { 'homing': 1.0, 'ripple': 1.0 }
  },
  "005": {
    hp: 3, speed: 1.5, stopFrame: 0, moveRange: 'A',
    resistances: { normal: 0.2, spread: 0.2, laser: 0.6, homing: 0.1, ripple: 0.1, rocket: 0.6, split: 0.3, bounce: 0.3, grave: 0.6 },
    attackPattern: { 'normal': 1.0, 'rocket': 2.0 }
  }
};

// ステージ定義
var stages = [
  [{ frame: 30, type: 'BOSS', bossId: '001' }],
  [{ frame: 30, type: 'BOSS', bossId: '002' }],
  [{ frame: 30, type: 'BOSS', bossId: '003' }],
  [{ frame: 30, type: 'BOSS', bossId: '004' }],
  [{ frame: 30, type: 'BOSS', bossId: '005' }]
];