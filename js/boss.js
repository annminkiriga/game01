// boss.js

// --- 1. 移動範囲パターンの定義 ---
const moveRangePatterns = {
  "A": { minY: 20,  maxY: 450 }, // 全体
  "B": { minY: 20,  maxY: 250 }, // 上部
  "C": { minY: 250, maxY: 450 }, // 下部
  "D": { minY: 20,  maxY: 100 }, // 最上段
  "E": { minY: 200, maxY: 300 }  // 中央
};

const bossImage = new Image();
bossImage.src = 'images/boss01.png'; 

const boss = {
  active: false,
  currentId: "001",
  x: 0,
  y: -48,
  width: 48,
  height: 48,
  hp: 10,
  maxHp: 10,
  targetY: 80,
  status: 'appearing', 
  damageFlashFrame: 0,
  invincibleFrame: 0,
  showStartTextFrame: 0,
  vx: 0,
  vy: 0,
  moveTimer: 0,
  baseSpeed: 3,
  stopFrameMax: 0, // 一時停止時間
  minX: 20, maxX: 380, minY: 50, maxY: 250,
  explosionCount: 0,
  explosionTimer: 0,
  attackTimers: {} // 武器ごとのタイマー保持用
};

// --- 2. 初期化関数（stage.js のデータを反映） ---
function initBoss(bossId = "001") {
  const data = bossData[bossId];
  if (!data) return;

  boss.active = true;
  boss.currentId = bossId;
  boss.hp = data.hp;
  boss.maxHp = data.hp;
  boss.status = 'appearing';
  
  // 移動性能の反映
  boss.baseSpeed = 3 * data.speed; 
  boss.stopFrameMax = data.stopFrame;

  // 移動範囲の適用
  const range = moveRangePatterns[data.moveRange] || moveRangePatterns["A"];
  boss.minY = range.minY;
  boss.maxY = range.maxY;
  boss.minX = 20;
  boss.maxX = 400 - boss.width - 20;

  boss.x = (400 - boss.width) / 2;
  boss.y = -boss.height;
  boss.targetY = range.minY + 30;

  // 攻撃タイマーの初期化
  boss.currentAttackType = null; // ★これを追加
  boss.attackTimers = {};
  Object.keys(data.attackPattern).forEach(key => {
    boss.attackTimers[key] = 0;
  });

  boss.damageFlashFrame = 0;
  boss.invincibleFrame = 0;
  boss.moveTimer = 0;
  boss.vx = 0;
  boss.vy = 0;
  boss.explosionCount = 0;
}

// --- 3. 更新メイン ---
function updateBoss() {
  if (!boss.active) return;

  if (boss.hp <= 0 && boss.status !== 'exploding' && boss.status !== 'dead') {
    boss.status = 'exploding';
    boss.explosionCount = 0;
    boss.explosionTimer = 0;
    if (typeof playBigExplosion === 'function') playBigExplosion();
    return;
  }

  if (boss.damageFlashFrame > 0) boss.damageFlashFrame--;
  if (boss.invincibleFrame > 0) boss.invincibleFrame--;

  if (boss.status === 'appearing') {
    if (boss.y < boss.targetY) {
      boss.y += 1.5;
    } else {
      boss.status = 'battle';
      boss.showStartTextFrame = 60;
    }
  } else if (boss.status === 'battle') {
    updateBossMovement();
    updateBossAttack(); 
  } else if (boss.status === 'exploding') {
    updateExplodingStatus();
  }
}

// --- 4. 移動ロジック（一時停止対応） ---
function updateBossMovement() {
  boss.moveTimer--;
  
  if (boss.moveTimer <= 0) {
    // moveTimerがマイナスの間は一時停止（stopFrame分）
    if (boss.moveTimer > -boss.stopFrameMax) {
      boss.vx = 0;
      boss.vy = 0;
    } else {
      decideBossMovement();
      boss.moveTimer = 30; // 次の思考まで1秒
    }
  }

  boss.x += boss.vx;
  boss.y += boss.vy;

  if (boss.x < boss.minX) { boss.x = boss.minX; boss.vx *= -1; }
  if (boss.x > boss.maxX) { boss.x = boss.maxX; boss.vx *= -1; }
  if (boss.y < boss.minY) { boss.y = boss.minY; boss.vy *= -1; }
  if (boss.y > boss.maxY) { boss.y = boss.maxY; boss.vy *= -1; }
}

function decideBossMovement() {
  let dangerLeft = 0, dangerRight = 0;
  if (typeof gameState !== 'undefined' && gameState.bullets) {
    gameState.bullets.forEach(b => {
      if (!b.isEnemyShot && b.y > boss.y && b.y < boss.y + 250) {
        if (b.x < boss.x + boss.width / 2) dangerLeft++;
        else dangerRight++;
      }
    });
  }
  if (dangerLeft > 0 || dangerRight > 0) {
    boss.vx = (dangerLeft > dangerRight) ? boss.baseSpeed : -boss.baseSpeed;
  } else {
    boss.vx = (Math.random() > 0.5 ? 1 : -1) * boss.baseSpeed;
  }
  boss.vy = (Math.random() - 0.5) * 2;
}

// --- 5. 攻撃ロジック（同時発射禁止・1種類選択方式） ---
function updateBossAttack() {
  const data = bossData[boss.currentId];
  if (!data) return;

  // 初期化（タイマーがなければ作成）
  if (!boss.attackTimers) boss.attackTimers = {};

  // 現在、何かを撃っている最中（攻撃モード中）かチェック
  if (boss.currentAttackType) {
    const rate = data.attackPattern[boss.currentAttackType];
    const interval = 30 / rate; // 発射間隔（フレーム）

    if (!boss.attackTimers[boss.currentAttackType]) boss.attackTimers[boss.currentAttackType] = 0;
    boss.attackTimers[boss.currentAttackType]++;

    if (boss.attackTimers[boss.currentAttackType] >= interval) {
      // 弾を実際に撃つ（下の fireBossShot を呼び出す）
      fireBossShot(boss.currentAttackType);
      boss.attackTimers[boss.currentAttackType] = 0;

      // 攻撃の切り替え判定：約3秒(90フレーム)ごとに50%の確率で別の攻撃へ
      // （※ずっと同じ攻撃だと単調なので、たまにリセットします）
      if (Math.random() < 0.02) { 
        boss.currentAttackType = null; 
      }
    }
  } else {
    // 次に撃つ攻撃をランダムに選ぶ（attackPatternで0より大きいもの）
    const availableTypes = Object.keys(data.attackPattern).filter(type => data.attackPattern[type] > 0);
    if (availableTypes.length > 0) {
      const nextType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      boss.currentAttackType = nextType;
      boss.attackTimers[nextType] = 0;
    }
  }
}

// --- 6. 弾の発射実体（ここが消えていたのがエラーの原因です） ---
function fireBossShot(type) {
  const bX = boss.x + boss.width / 2;
  const bY = boss.y + boss.height;
  const options = { isEnemyShot: true, type: type }; // typeを渡して相打ち判定を確実にする

  switch (type) {
    case 'normal':
      gameState.bullets.push(createBullet(bX - 3, bY, 6, 15, 0, 5, 'white', options));
      break;
    case 'spread':
      const angles = [-0.2, 0, 0.2];
      angles.forEach(a => {
        gameState.bullets.push(createBullet(bX - 3, bY, 6, 15, 6 * Math.sin(a), 6 * Math.cos(a), 'pink', options));
      });
      break;
    case 'laser':
      // レーザーは少し速く、縦長にする
      gameState.bullets.push(createBullet(bX - 5, bY, 10, 100, 0, 10, 'red', { ...options, isLaser: true }));
      break;
    case 'rocket':
      gameState.bullets.push(createBullet(bX - 5, bY, 10, 20, 0, 3, 'orange', { ...options, isRocket: true }));
      break;
    case 'grave':
      gameState.bullets.push(createBullet(bX - 6, bY, 12, 12, 0, 4, 'gray', { ...options, isGrave: true, timer: 60 }));
      break;
  }
}

// --- 7. 爆発・描画系（ここも念のため含めておきます） ---
function updateExplodingStatus() {
  boss.explosionTimer--;
  if (boss.explosionTimer <= 0) {
    const rx = boss.x + Math.random() * boss.width;
    const ry = boss.y + Math.random() * boss.height;
    if (typeof spawnExplosion === 'function') {
      spawnExplosion(rx, ry, { maxRadius: 30, isRocketExplosion: true, silent: true });
    }
    boss.explosionCount++;
    boss.explosionTimer = 10;

    // 8回爆発したら終了
    if (boss.explosionCount >= 8) {
      boss.status = 'dead';    // クリア判定を起動させる
      boss.active = false;     // ★ここで画面から消す！
      console.log("Boss explosion finished. Status: dead, Active: false");
    }
  }
}

function drawBoss(ctx) {
  if (!boss.active) return;
  if (boss.invincibleFrame > 0 && boss.invincibleFrame % 4 < 2) return;
  ctx.save();
  if (boss.damageFlashFrame > 0) ctx.filter = 'brightness(10) grayscale(1)'; 
  if (bossImage.complete && bossImage.naturalWidth !== 0) {
    ctx.drawImage(bossImage, boss.x, boss.y, boss.width, boss.height);
  } else {
    ctx.fillStyle = 'red';
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
  }
  ctx.restore();
}