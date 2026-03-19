// stage.js

// 各ボスのステータス定義
var bossData = {
  "001": {
    hp: 1, speed: 1.0, stopFrame: 20, moveRange: 'B',
    resistances: { normal: 1.0, spread: 0.5, laser: 0.1, homing: 0.5, ripple: 0.5, rocket: 0.1, split: 0.5, bounce: 0.5, grave: 0.1 },
    attackPattern: { 'normal': 1.0 }
  },
  "002": {
    hp: 1, speed: 1.2, stopFrame: 15, moveRange: 'B',
    resistances: { normal: 0.5, spread: 1.0, laser: 0.1, homing: 0.5, ripple: 1.0, rocket: 0.1, split: 0.5, bounce: 0.5, grave: 0.1 },
    attackPattern: { 'spread': 1.0, 'ripple': 0.3 }
  },
  "003": {
    hp: 1, speed: 0.8, stopFrame: 30, moveRange: 'E',
    resistances: { normal: 0.1, spread: 0.1, laser: 1.0, homing: 0.1, ripple: 0.1, rocket: 1.0, split: 0.5, bounce: 0.5, grave: 1.0 },
    attackPattern: { 'laser': 0.33, 'normal': 1.0 }
  },
  "004": {
    hp: 1, speed: 1.0, stopFrame: 10, moveRange: 'C',
    resistances: { normal: 0.1, spread: 0.1, laser: 0.6, homing: 0.2, ripple: 0.2, rocket: 0.6, split: 0.3, bounce: 0.3, grave: 0.6 },
    attackPattern: { 'normal': 3.0, 'spread': 1.0 }
  },
  "005": {
    hp: 1, speed: 1.5, stopFrame: 0, moveRange: 'A',
    resistances: { normal: 0.2, spread: 0.2, laser: 0.6, homing: 0.1, ripple: 0.1, rocket: 0.6, split: 0.3, bounce: 0.3, grave: 0.6 },
    attackPattern: { 'normal': 1.0, 'rocket': 2.0 }
  },
  "006": {
    hp: 1, speed: 1.0, stopFrame: 0, moveRange: 'D',
    resistances: { normal: 0.05, spread: 0.2, laser: 0.5, homing: 0.2, ripple: 0.05, rocket: 0.5, split: 0.3, bounce: 0.3, grave: 0.5 },
    attackPattern: { 'normal': 2.0, 'ripple': 1.0 }
  },
  "007": {
    hp: 1, speed: 0.2, stopFrame: 10, moveRange: 'B',
    resistances: { normal: 0.1, spread: 0.05, laser: 0.3, homing: 0.1, ripple: 0.05, rocket: 0.3, split: 0.2, bounce: 0.2, grave: 0.3 },
    attackPattern: { 'spread': 1.0, 'ripple': 3.0 }
  },
  "008": {
    hp: 1, speed: 3.0, stopFrame: 0, moveRange: 'A',
    resistances: { normal: 0.3, spread: 0.3, laser: 0.5, homing: 0.2, ripple: 0.3, rocket: 0.5, split: 0.3, bounce: 0.05, grave: 0.5 },
    attackPattern: { 'bounce': 3.0 }
  },
  "009": {
    hp: 1, speed: 1.0, stopFrame: 0, moveRange: 'E',
    resistances: { normal: 0.05, spread: 0.05, laser: 0.05, homing: 0.1, ripple: 0.2, rocket: 0.5, split: 0.3, bounce: 0.3, grave: 0.5 },
    attackPattern: { 'normal': 3.0, 'spread': 3.0, 'laser': 0.33 }
  }
};

// ステージ構成定義
// LV-010 以降は、複数のBOSSイベントを並べることで同時出現を実現します
var stages = [
  [{ frame: 30, type: 'BOSS', bossId: '001' }], // LV-001
  [{ frame: 30, type: 'BOSS', bossId: '002' }], // LV-002
  [{ frame: 30, type: 'BOSS', bossId: '003' }], // LV-003
  [{ frame: 30, type: 'BOSS', bossId: '004' }], // LV-004
  [{ frame: 30, type: 'BOSS', bossId: '005' }], // LV-005
  [{ frame: 30, type: 'BOSS', bossId: '006' }], // LV-006
  [{ frame: 30, type: 'BOSS', bossId: '007' }], // LV-007
  [{ frame: 30, type: 'BOSS', bossId: '008' }], // LV-008
  [{ frame: 30, type: 'BOSS', bossId: '009' }], // LV-009
  
  // ★ LV-010: 二体同時出現（LV-002 と LV-003）
  [
    { frame: 30, type: 'BOSS', bossId: '002' },
    { frame: 31, type: 'BOSS', bossId: '003' }
  ]
];
