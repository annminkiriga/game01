// boss.js

// 二重定義エラーを防ぐため var を使用
if (typeof bosses === 'undefined') {
  var bosses = [];
}

// 移動範囲
const moveRangePatterns = {
  "A": { minY: 20,  maxY: 450 },
  "B": { minY: 20,  maxY: 250 },
  "C": { minY: 250, maxY: 450 },
  "D": { minY: 20,  maxY: 100 },
  "E": { minY: 200, maxY: 300 }
};

const bossImage = new Image();
bossImage.src = 'images/boss01.png'; 

function spawnBoss(bossId = "001") {
  const data = bossData[bossId];
  if (!data) return;

  const range = moveRangePatterns[data.moveRange] || moveRangePatterns["A"];
  
  // 出現位置（横）
  let spawnX = 176; 
  if (bosses.length === 1) spawnX = 50; 
  if (bosses.length === 2) spawnX = 300;

  const newBoss = {
    active: true,
    currentId: bossId,
    x: spawnX,
    y: -60,
    width: 48,
    height: 48,
    hp: data.hp,
    maxHp: data.hp,
    // ★ ここを微調整：minY（上端）から 40ピクセル ほど下に降りてくるようにします
    // これで「全体的に上に寄っている」感覚が解消されます
    targetY: range.minY + 40, 
    status: 'appearing', 
    damageFlashFrame: 0,
    invincibleFrame: 0,
    showStartTextFrame: 60,
    vx: 0, vy: 0, moveTimer: 0,
    baseSpeed: 3 * data.speed,
    stopFrameMax: data.stopFrame,
    explosionCount: 0,
    explosionTimer: 0,
    attackTimers: {},
    currentAttackType: null,
    attackDuration: 0,
    minY: range.minY,
    maxY: range.maxY,
    minX: 20,
    maxX: 400 - 48 - 20
  };

  // ... (以下、attackPatternの初期化などはそのまま)
  if (data.attackPattern) {
    Object.keys(data.attackPattern).forEach(key => {
      newBoss.attackTimers[key] = 0;
    });
  }
  bosses.push(newBoss);
}

function updateBoss() {
  // 全員が目的地に着いたかチェック
  const allArrived = bosses.every(b => b.y >= b.targetY);

  bosses.forEach((b) => {
    if (!b.active && b.status === 'dead') return;

    // 死亡判定
    if (b.hp <= 0 && b.status !== 'exploding' && b.status !== 'dead') {
      b.status = 'exploding';
      if (typeof playBigExplosion === 'function') playBigExplosion();
      return;
    }

    if (b.damageFlashFrame > 0) b.damageFlashFrame--;
    if (b.invincibleFrame > 0) b.invincibleFrame--;

    // --- 状態別の更新ロジック ---
    if (b.status === 'appearing') {
      if (b.y < b.targetY) {
        b.y += 1.5;
      } else {
        b.y = b.targetY;
        // ★ 全員が揃うまで待機状態へ
        if (allArrived) {
          b.status = 'wait_text';
          b.showStartTextFrame = 80; // 少し長めに表示
          if (b.y < b.minY) b.minY = b.y;
        }
      }
    } else if (b.status === 'wait_text') {
      b.showStartTextFrame--;
      if (b.showStartTextFrame <= 0) {
        b.status = 'battle';
      }
    } else if (b.status === 'battle') {
      updateBossMovementIndividual(b);
      updateBossAttackIndividual(b); 
    } else if (b.status === 'exploding') {
      updateExplodingStatusIndividual(b);
    }
  });
}

function updateBossMovementIndividual(b) {
  b.moveTimer--;
  if (b.moveTimer <= 0) {
    if (b.moveTimer > -b.stopFrameMax) {
      b.vx = 0; b.vy = 0;
    } else {
      decideBossMovementIndividual(b);
      b.moveTimer = 30;
    }
  }
  b.x += b.vx; b.y += b.vy;
  if (b.x < b.minX) { b.x = b.minX; b.vx *= -1; }
  if (b.x > b.maxX) { b.x = b.maxX; b.vx *= -1; }
  if (b.y < b.minY) { b.y = b.minY; b.vy *= -1; }
  if (b.y > b.maxY) { b.y = b.maxY; b.vy *= -1; }
}

function decideBossMovementIndividual(b) {
  let dangerLeft = 0, dangerRight = 0;
  if (typeof gameState !== 'undefined' && gameState.bullets) {
    gameState.bullets.forEach(bullet => {
      if (!bullet.isEnemyShot && bullet.y > b.y && bullet.y < b.y + 200) {
        if (bullet.x < b.x + b.width / 2) dangerLeft++;
        else dangerRight++;
      }
    });
  }
  b.vx = (dangerLeft > dangerRight) ? b.baseSpeed : -b.baseSpeed;
  b.vy = (Math.random() - 0.5) * 2;
}

function updateBossAttackIndividual(b) {
  const data = bossData[b.currentId];
  if (!data || !data.attackPattern) return;
  if (!b.currentAttackType) {
    const availableTypes = Object.keys(data.attackPattern).filter(t => data.attackPattern[t] > 0);
    if (availableTypes.length > 0) {
      b.currentAttackType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      b.attackTimers[b.currentAttackType] = 0;
      b.attackDuration = 60 + Math.random() * 60; 
    }
    return;
  }
  const type = b.currentAttackType;
  const rate = data.attackPattern[type];
  const interval = 30 / rate;
  if (b.attackTimers[type] === undefined) b.attackTimers[type] = 0;
  b.attackTimers[type]++;
  b.attackDuration--; 
  if (b.attackTimers[type] >= interval) {
    fireBossShotIndividual(b, type);
    b.attackTimers[type] = 0;
  }
  if (b.attackDuration <= 0) b.currentAttackType = null;
}

function fireBossShotIndividual(b, type) {
  const bX = b.x + b.width / 2;
  const bY = b.y + b.height;
  const options = { isEnemyShot: true, type: type };
  switch (type) {
    case 'normal': gameState.bullets.push(createBullet(bX-3, bY, 6, 15, 0, 5, 'white', options)); break;
    case 'spread': [-0.3, 0, 0.3].forEach(a => gameState.bullets.push(createBullet(bX-3, bY, 6, 15, 7*Math.sin(a), 7*Math.cos(a), 'pink', options))); break;
    case 'laser': gameState.bullets.push(createBullet(bX-5, bY, 10, 120, 0, 12, 'red', { ...options, isLaser: true })); break;
    case 'ripple': gameState.bullets.push(createBullet(bX, bY, 0, 0, 0, 4, 'cyan', { ...options, isRipple: true, radius: 8, growRate: 0.15, speedY: 4 })); break;
    case 'rocket': gameState.bullets.push(createBullet(bX-6, bY, 12, 24, 0, 3, 'orange', { ...options, isRocket: true })); break;
    case 'split': gameState.bullets.push(createBullet(bX-4, bY, 8, 16, 0, 6, 'purple', { ...options, isSplit: true, splitDone: false })); break;
    case 'bounce': gameState.bullets.push(createBullet(bX-6, bY, 12, 12, 5*(Math.random()<0.5?-1:1), 4, 'lime', { ...options, isBounce: true })); break;
    case 'grave': gameState.bullets.push(createBullet(bX-8, bY, 16, 16, 0, 3, 'gray', { ...options, isGrave: true, timer: 70, isGraveActive: false, blinkCounter: 0 })); break;
  }
}

function updateExplodingStatusIndividual(b) {
  b.explosionTimer--;
  if (b.explosionTimer <= 0) {
    const rx = b.x + Math.random() * b.width;
    const ry = b.y + Math.random() * b.height;
    if (typeof spawnExplosion === 'function') spawnExplosion(rx, ry, { maxRadius: 30, silent: true });
    b.explosionCount++;
    b.explosionTimer = 10;
    if (b.explosionCount >= 8) { b.status = 'dead'; b.active = false; }
  }
}

function drawBoss(ctx) {
  let showGlobalText = false;
  let textFrame = 0;

  bosses.forEach((b) => {
    if (!b.active && b.status === 'dead') return;
    
    // ボス本体
    ctx.save();
    if (b.invincibleFrame > 0 && b.invincibleFrame % 4 < 2) ctx.globalAlpha = 0.3;
    if (b.damageFlashFrame > 0) ctx.filter = 'brightness(5) grayscale(1)'; 
    if (bossImage.complete && bossImage.naturalWidth !== 0) {
      ctx.drawImage(bossImage, b.x, b.y, b.width, b.height);
    }
    ctx.restore();

    // テキスト表示が必要な個体がいるかチェック
    if (b.status === 'wait_text') {
      showGlobalText = true;
      textFrame = b.showStartTextFrame;
    }
  });

  // --- 全体テキスト（LV-XXX START!）を一括描画 ---
  if (showGlobalText) {
    // 現在のレベルを取得（gameStateから取得するのが確実）
    const levelStr = String(gameState.selectedLevelIndex).padStart(3, '0');
    
    ctx.save();
    ctx.fillStyle = "yellow";
    ctx.font = "bold 40px sans-serif"; 
    ctx.textAlign = "center";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "black";
    
    // 画面中央に1つだけ表示
    ctx.fillText(`LV-${levelStr} START!`, 200, 220);
    
    // 文字のフェードアウト効果（残り20フレームで薄くする）
    if (textFrame < 20) {
      ctx.globalAlpha = textFrame / 20;
    }
    
    ctx.restore();
  }
}
