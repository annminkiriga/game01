// shots.js（軽量化版・スマホ対応・爆発軽量化） 前半

// ── 爆発管理 初期化 ─────────
if (typeof gameState !== 'undefined' && !gameState.explosions) {
  gameState.explosions = [];
}

// 爆発生成関数（唯一の正規ルート）
function spawnExplosion(x, y, options = {}) {
  if (typeof gameState === 'undefined') return;

  const explosion = {
    x,
    y,
    radius: 0,
    maxRadius: options.maxRadius || 20,
    alpha: 1.0,
    active: true,
    isRocketExplosion: !!options.isRocketExplosion,
    isGraveExplosion: !!options.isGraveExplosion,
    color: options.color || null
  };

  gameState.explosions.push(explosion);
}

const bulletSpeed = 10;

// 弾生成関数（プール対応）
function createBullet(x, y, width, height, dx, dy, color, options = {}) {
  return {
    x, y, width, height, dx, dy, color,
    type: options.type || 'normal', // ★これが必要です！
    isEnemyShot: !!options.isEnemyShot, 
    
    isLaser: !!options.isLaser,
    isRocket: !!options.isRocket,
    isSplit: !!options.isSplit,
    isSplitChild: !!options.isSplitChild,
    splitDone: !!options.splitDone,
    isBounce: !!options.isBounce,
    bounceCount: 0,
    isRipple: !!options.isRipple,
    radius: options.radius || 0,
    growRate: options.growRate || 0,
    speedY: options.speedY || 0,
    isGrave: !!options.isGrave,
    timer: options.timer || 0,
    exploded: false,
    isGraveActive: options.isGraveActive || false,
    blinkCounter: 0,
    visible: true,
  };
}

// 弾タイプ別制限
const shotLimits = {
  normal: 15, spread: 45, laser: 3, homing: 15, ripple: 9,
  rocket: 6, split: 10, bounce: 10, grave: 10
};

// 弾タイプをカウント
function countBulletsByType(bullets, typeCheck) {
  return bullets.filter(typeCheck).length;
}

// プレイヤー発射位置
function getFirePositions(player) {
  const left   = player.x + player.width * (1/6);
  const center = player.x + player.width * (1/2);
  const right  = player.x + player.width * (5/6);
  return [left, center, right];
}

// ── 各ショット発射関数 ─────────

function fireNormalShot(bullets, player) {
  if(countBulletsByType(bullets, b => b.color==='cyan') >= shotLimits.normal) return;
  for(const x of getFirePositions(player)) {
    bullets.push(createBullet(x-3, player.y, 6, 15, 0, -bulletSpeed, 'cyan'));
  }
}

function fireSpreadShot(bullets, player) {
  if(countBulletsByType(bullets, b => b.color==='pink') >= shotLimits.spread) return;
  const angles = [-0.3, 0, 0.3];
  for(const x of getFirePositions(player)) {
    for(const a of angles) {
      bullets.push(createBullet(x-3, player.y, 6, 15, bulletSpeed*Math.sin(a), -bulletSpeed*Math.cos(a), 'pink'));
    }
  }
}

function fireLaserShot(bullets, player) {
  if(countBulletsByType(bullets, b => b.color==='magenta') >= shotLimits.laser) return;
  for(const x of getFirePositions(player)) {
    bullets.push(createBullet(x-5, player.y-80, 10, 80, 0, -bulletSpeed*0.8, 'magenta', {isLaser:true}));
  }
}

function fireHomingShot(bullets, player, enemies, canvas) {
  if(countBulletsByType(bullets, b => b.color==='orange') >= shotLimits.homing) return;
  
  for(const x of getFirePositions(player)) {
    let dx = 0, dy = -bulletSpeed * 0.5;
    
    // ターゲット候補の選定
    let target = null;
    let minDistance = 9999;

    // 1. 全てのボスの中から、今戦っている（battle）一番近いボスを探す
    if (typeof bosses !== 'undefined' && bosses.length > 0) {
      bosses.forEach(b => {
        if (b.active && b.status === 'battle') {
          const dist = Math.hypot((b.x + b.width/2) - x, (b.y + b.height/2) - player.y);
          if (dist < minDistance) {
            minDistance = dist;
            target = b;
          }
        }
      });
    } 
    
    // 2. ボスがいなければ、ザコ敵の中から一番近いものを探す
    if (!target && enemies.length > 0) {
      enemies.forEach(e => {
        if (e.active) {
          const dist = Math.hypot((e.x + e.width/2) - x, (e.y + e.height/2) - player.y);
          if (dist < minDistance) {
            minDistance = dist;
            target = e;
          }
        }
      });
    }

    // ターゲットが見つかったら、その方向へ発射
    if (target) {
      const tx = target.x + (target.width / 2);
      const ty = target.y + (target.height / 2);
      const angle = Math.atan2(ty - player.y, tx - x);
      dx = bulletSpeed * 0.5 * Math.cos(angle);
      dy = bulletSpeed * 0.5 * Math.sin(angle);
    }
    
    bullets.push(createBullet(x-4, player.y, 8, 8, dx, dy, 'orange', { type: 'homing' }));
  }
}

// リップルショット（後半で爆発処理）
function fireRippleShot(bullets, player) {
  if(countBulletsByType(bullets, b => b.isRipple) >= shotLimits.ripple) return;
  for(const x of getFirePositions(player)) {
    bullets.push(createBullet(
      x,
      player.y,
      0, 0,
      0, -bulletSpeed*0.6,
      'lightblue',
      {isRipple:true, radius:10, growRate:0.15, speedY:bulletSpeed*0.6}
    ));
  }
}

// ロケットショット
function fireRocketShot(bullets, player) {
  if(countBulletsByType(bullets, b => b.isRocket) >= shotLimits.rocket) return;
  for(const x of getFirePositions(player)) {
    bullets.push(createBullet(x-5, player.y, 10, 20, 0, -bulletSpeed*0.3, 'red', {isRocket:true}));
  }
}

// スプリットショット
function fireSplitShot(bullets, player) {
  if(countBulletsByType(bullets, b => b.isSplit) >= shotLimits.split) return;
  for(const x of getFirePositions(player)) {
    bullets.push(createBullet(x-4, player.y, 8, 15, 0, -bulletSpeed, 'purple', {isSplit:true, splitDone:false}));
  }
}

// バウンスショット
function fireBounceShot(bullets, player) {
  if(countBulletsByType(bullets, b => b.isBounce) >= shotLimits.bounce) return;
  for(const x of getFirePositions(player)) {
    bullets.push(createBullet(x-6, player.y, 12, 12, bulletSpeed*(Math.random()<0.5?-1:1), -bulletSpeed*0.8, 'green', {isBounce:true}));
  }
}

// グレイヴショット
function fireGraveShot(bullets, player) {
  if(countBulletsByType(bullets, b => b.isGrave && !b.exploded) >= shotLimits.grave) return;
  for(const x of getFirePositions(player)) {
    bullets.push(createBullet(x-6, player.y, 12, 12, 0, -bulletSpeed*0.6, 'darkgray', {isGrave:true, timer:60, isGraveActive:false, blinkCounter:0}));
  }
}

// ── ショット定義（後半と統合） ─────────
const shotDefinitions = {
  normal: {label:'通常弾', func:fireNormalShot},
  spread: {label:'拡散弾', func:fireSpreadShot},
  laser: {label:'レーザー', func:fireLaserShot},
  homing: {label:'ホーミング', func:fireHomingShot},
  ripple: {label:'リップル', func:fireRippleShot},
  rocket: {label:'ロケット', func:fireRocketShot},
  split: {label:'スプリット', func:fireSplitShot},
  bounce: {label:'バウンス', func:fireBounceShot},
  grave: {label:'グレイヴ', func:fireGraveShot}
};

// ■shots.js 後半（修正版）

// ■ shots.js 後半（相打ちロジック統合版）

function updateBulletsAndCollisions(bullets, enemies, canvasWidth, canvasHeight, player) {
  const enemiesToRemove = new Set();
  const bulletsToRemove = new Set();

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (bulletsToRemove.has(i)) continue;

    // ── 1. 弾種ごとの特殊移動ロジック ──
    
    if (b.isGrave) {
      // グレイヴ：点滅とタイマー爆発
      b.blinkCounter++; b.visible = (b.blinkCounter % 10 < 5);
      b.x += b.dx; b.y += b.dy; b.timer--;
      if (!b.isGraveActive && b.y <= player.y - canvasHeight / 2) b.isGraveActive = true;
      if (b.timer <= 0 && !b.exploded) {
        b.exploded = true;
        spawnExplosion(b.x + b.width / 2, b.y + b.height / 2, { maxRadius: 45, isGraveExplosion: true });
        bulletsToRemove.add(i); continue;
      }
    } 
    else if (b.isRipple) {
      // リップル：拡大しながら進む
      b.y += (b.isEnemyShot ? (b.speedY || 5) : -(b.speedY || 6));
      b.radius += b.growRate;
    } 
    else if (b.isBounce) {
      // ★修正：バウンス（壁反射）
      b.x += b.dx;
      b.y += b.dy;
      // 左右の壁で反射
      if (b.x <= 0 || b.x + b.width >= canvasWidth) {
        b.dx *= -1;
        b.bounceCount++;
      }
    }
    else if (b.isSplit && !b.splitDone) {
      // ★修正：スプリット（中央付近で分裂）
      b.x += b.dx;
      b.y += b.dy;
      if (b.y < canvasHeight / 2) {
        b.splitDone = true;
        // 左右に分裂した子弾を生成して追加
        bullets.push(createBullet(b.x, b.y, 8, 8, -4, b.dy, b.color, { isSplitChild: true }));
        bullets.push(createBullet(b.x, b.y, 8, 8, 4, b.dy, b.color, { isSplitChild: true }));
        bulletsToRemove.add(i); // 親弾は消す
        continue;
      }
    }
    else {
      // 通常移動（スプリット子弾や通常弾など）
      b.x += b.dx;
      b.y += b.dy;
    }

    // ── 2. 画面外消滅 ──
    // バウンス弾などは上から抜けても良いように、消滅判定を少し広めに設定
    if (b.y < -150 || b.y > canvasHeight + 100 || b.x < -100 || b.x > canvasWidth + 100) {
      bulletsToRemove.add(i); continue;
    }

    // ── (以下、相打ち判定や敵との当たり判定はそのまま) ──

    // ── 2. 画面外消滅 ──
    if (b.y < -100 || b.y > canvasHeight + 100 || b.x < -100 || b.x > canvasWidth + 100) {
      bulletsToRemove.add(i); continue;
    }

    // ── 3. 相打ち判定（弾 vs 弾） ──
    // グレイヴは爆発前は相打ち対象外
    if (!(b.isGrave && !b.isGraveActive)) {
      for (let j = i - 1; j >= 0; j--) {
        const b2 = bullets[j];
        if (bulletsToRemove.has(j)) continue;

        // 勢力が違う（自機 vs 敵）場合のみ判定
        if (b.isEnemyShot !== b2.isEnemyShot) {
          if (b.x < b2.x + b2.width && b.x + b.width > b2.x &&
              b.y < b2.y + b2.height && b.y + b.height > b2.y) {
            
            let bRem = true;  // bを消すか
            let b2Rem = true; // b2を消すか

            // 特殊ルール：レーザー判定
            if (b.isLaser && !b2.isLaser) { b2Rem = true; bRem = false; } // レーザーが一方的に勝つ
            if (!b.isLaser && b2.isLaser) { bRem = true; b2Rem = false; } // レーザーが一方的に勝つ
            
            // 特殊ルール：グレイヴ（飛翔中）は相打ち不可
            if ((b.isGrave && !b.isGraveActive) || (b2.isGrave && !b2.isGraveActive)) {
              bRem = false; b2Rem = false;
            }

            if (bRem) bulletsToRemove.add(i);
            if (b2Rem) bulletsToRemove.add(j);
            
            if (bRem) break; // 自身が消えたら次の弾のループへ
          }
        }
      }
    }
    if (bulletsToRemove.has(i)) continue;

    // ── 4. 対ザコ敵・対ボス当たり判定（プレイヤーの弾のみ） ──
    if (!b.isEnemyShot) {
      // ザコ敵判定
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (e.x < b.x + b.width && e.x + e.width > b.x && e.y < b.y + b.height && e.y + e.height > b.y) {
          e.hitByPlayer = true;
          spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, { maxRadius: 22 });
          enemiesToRemove.add(j);
          if (!b.isLaser) bulletsToRemove.add(i);
          break;
        }
      }
    }
  }

  // 削除実行
  [...enemiesToRemove].sort((a, b) => b - a).forEach(idx => enemies.splice(idx, 1));
  [...bulletsToRemove].sort((a, b) => b - a).forEach(idx => bullets.splice(idx, 1));
}

// ── 描画系 ──
function drawBullets(ctx, bullets) {
  for (const b of bullets) {
    if (b.isGrave && !b.visible) continue;
    if (b.isRipple) {
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = b.isEnemyShot ? 'red' : 'lightblue';
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.width, b.height);
    }
  }
}

function updateExplosions() {
  for (const e of gameState.explosions) {
    if (!e.active) continue;
    e.radius += 2;
    e.alpha -= 0.05;
    if (e.alpha <= 0) e.active = false;
  }
}

function drawExplosions(ctx) {
  for (const e of gameState.explosions) {
    if (!e.active) continue;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = e.isRocketExplosion ? (e.color || `rgba(0,150,255,${e.alpha})`) : `rgba(255,150,0,${e.alpha})`;
    ctx.fill();
  }
}
