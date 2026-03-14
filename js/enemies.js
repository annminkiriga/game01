// enemies.js
// ─────────────────────────────────────────────
// 敵出現・行動パターン管理（撃墜率対応版）
// ─────────────────────────────────────────────

// 敵生成関数
function spawnEnemy(x, y, options = {}, enemyList) {
  enemyList.push({
    x,
    y,
    width: options.width || 50,
    height: options.height || 50,
    dx: options.dx || 0,
    dy: options.dy !== undefined ? options.dy : 2,
    color: options.color || 'lime',
    behavior: options.behavior || null,
    frame: 0,
    stopDone: options.stopDone || false,
    crossCount: options.crossCount || 0,
    prevDirection: options.prevDirection || null,
    exiting: options.exiting || false,
    angle: 0,
    spawnX: options.spawnX,
    index: options.index
  });

  // 撃墜率用カウント
  if (typeof gameState !== 'undefined') gameState.totalEnemiesSpawned++;
}

// パターン出現
function spawnPattern(index, enemyList, canvas) {
  switch(index) {
    case 0:
      spawnEnemy(-30, -30, { color: 'aqua', behavior: 'curveRight' }, enemyList);
      break;
    case 1:
      spawnEnemy(430, -30, { color: 'violet', behavior: 'curveLeft' }, enemyList);
      break;
    case 2:
      spawnEnemy(190, -30, { width: 50, height: 50, color: 'yellow' }, enemyList);
      break;
    case 3:
      spawnEnemy(50, -30, { dx: 3, dy: 6, color: 'red' }, enemyList);
      spawnEnemy(90, -50, { dx: 3, dy: 6, color: 'red' }, enemyList);
      spawnEnemy(130, -70, { dx: 3, dy: 6, color: 'red' }, enemyList);
      break;
    case 4:
      for (let i = 0; i < 5; i++) {
        spawnEnemy(80 + i*40, -30, { dx: 1 - i*0.5, dy: 3, color: 'orange' }, enemyList);
      }
      break;
    case 5:
      for (let i = 0; i < 7; i++) {
        spawnEnemy(30 + i*50, -30, { dx: 5, dy: 2, color: 'lime', behavior: 'horizontalBounce' }, enemyList);
      }
      break;
    case 6:
      for (let i = 0; i < 4; i++) {
        spawnEnemy(60 + i*40, -30 - i*20, { dx: 2, dy: 2, color: 'pink', behavior: 'zigzag' }, enemyList);
      }
      break;
    case 7:
      for (let i = 0; i < 5; i++) {
        spawnEnemy(190, -30 - i*30, { dy: 1, color: 'cyan', behavior: 'accelerateDown' }, enemyList);
      }
      break;
    case 8:
      for (let i = 0; i < 6; i++) {
        spawnEnemy(50 + i*60, -30 - i*20, { dx: Math.random()*4 - 2, dy: 6, color: 'magenta', behavior: 'randomMove' }, enemyList);
      }
      break;
    case 9:
      const count = 8;
      const spacing = 40;
      const startX = 20;
      const startY = -30;
      for (let i = 0; i < count; i++) {
        spawnEnemy(startX + i*spacing, startY, { dx: 0, dy: 0, color: 'white', behavior: 'zigzagFall', width: 40, height: 40 }, enemyList);
      }
      break;
    case 10:
      slideRowExit(enemyList, canvas);
      break;
    case 11:
      spawnPattern11(enemyList, canvas);
      break;
    case 12:
      spawnPattern12(enemyList, canvas);
      break;
  }
}

// pattern10: 横一列スライド折り返し
function slideRowExit(enemyList, canvas) {
  const count = 8;
  const spacing = 50;
  const startY = 100;
  const speedX = 3;
  const startX = -spacing; // 左端外からスタート

  for (let i = 0; i < count; i++) {
    spawnEnemy(startX - i*spacing, startY, { 
      dx: speedX, dy: 0, color: 'lime', behavior: 'slideRowBounce', index: i 
    }, enemyList);
  }
}

// pattern11: 波状スインガー
function spawnPattern11(enemyList, canvas) {
  const count = 8;
  const spacing = 50;
  const totalWidth = (count - 1) * spacing;
  const startX = canvas.width / 2 - totalWidth / 2 - 25;
  const startY = -30;

  for (let i = 0; i < count; i++) {
    spawnEnemy(startX + i * spacing, startY, {
      dx: 0,
      dy: 1,
      color: 'white',
      behavior: 'pattern11',
      index: i,
      spawnX: startX + i * spacing
    }, enemyList);
  }
}

// pattern12: V字フォーメーション
function spawnPattern12(enemyList, canvas) {
  const centerX = canvas.width / 2;
  const startY = -40;
  const colors = ['red','orange','yellow','green','green','yellow','orange','red'];
  const offsets = [-1.5,-1,-0.5,0,0,0.5,1,1.5];
  const speedY = 1.5;

  for (let i = 0; i < 8; i++) {
    const dx = offsets[i] * 0.5;
    const dy = speedY;
    spawnEnemy(centerX + offsets[i]*40, startY, { dx, dy, color: colors[i], behavior: 'pattern12', index: i }, enemyList);
  }
}

// ── 行動パターン更新 ─────────
function updateEnemiesBehavior(enemyList, canvas) {
  for (let i = enemyList.length - 1; i >= 0; i--) {
    const e = enemyList[i];
    e.frame++;

    // デフォルト動作
    if (!e.behavior) {
      e.x += e.dx;
      e.y += e.dy;
      e.angle = Math.atan2(e.dy, e.dx);
      if (e.y > canvas.height) {
        enemyList.splice(i, 1);
        if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
      }
      continue;
    }

    switch(e.behavior) {
      case 'curveRight': {
        const angle = e.frame * 0.05;
        const radius = 100;
        const prevX = e.x;
        const prevY = e.y;
        e.x = 200 + radius * Math.cos(angle - Math.PI);
        e.y = 200 + radius * Math.sin(angle - Math.PI);
        e.angle = Math.atan2(e.y - prevY, e.x - prevX);
        if (angle >= Math.PI) e.behavior = null;
        break;
      }
      case 'curveLeft': {
        const angle = e.frame * 0.05;
        const radius = 100;
        const prevX = e.x;
        const prevY = e.y;
        e.x = 200 + radius * Math.cos(Math.PI - angle);
        e.y = 200 + radius * Math.sin(Math.PI - angle);
        e.angle = Math.atan2(e.y - prevY, e.x - prevX);
        if (angle >= Math.PI) e.behavior = null;
        break;
      }
      case 'horizontalBounce':
        if (!e.stopDone) {
          e.y += e.dy;
          e.angle = Math.atan2(e.dy, 0);
          if (e.y >= 300) {
            e.y = 300;
            e.dy = 0;
            e.stopDone = true;
            e.crossCount = 0;
            e.prevDirection = e.dx>0?'right':'left';
          }
        } else if (!e.exiting) {
          e.x += e.dx;
          e.angle = Math.atan2(0, e.dx);
          if (e.x <=0 || e.x + e.width >= canvas.width) {
            const currentDir = e.dx>0?'right':'left';
            if (currentDir !== e.prevDirection) { 
              e.crossCount++;
              e.prevDirection = currentDir;
            }
            if (e.crossCount >= 1) e.exiting = true;
            else e.dx = -e.dx;
          }
        } else {
          e.x += e.dx;
          e.angle = Math.atan2(0, e.dx);
          if (e.x + e.width < 0 || e.x > canvas.width) {
            enemyList.splice(i, 1);
            if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
          }
        }
        break;

      case 'zigzag': {
        const prevX = e.x, prevY = e.y;
        e.x += e.dx * Math.sin(e.frame*0.2);
        e.y += e.dy;
        e.angle = Math.atan2(e.y - prevY, e.x - prevX);
        if (e.y - e.height > canvas.height) {
          enemyList.splice(i,1);
          if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
        }
        break;
      }

      case 'accelerateDown':
        e.dy += 0.1; e.y += e.dy; e.angle = Math.atan2(e.dy, e.dx);
        if (e.y - e.height > canvas.height) {
          enemyList.splice(i,1);
          if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
        }
        break;

      case 'randomMove':
        e.x += e.dx; e.y += e.dy; e.angle = Math.atan2(e.dy, e.dx);
        if (e.x < 0 || e.x + e.width > canvas.width) e.dx = -e.dx;
        if (e.y - e.height > canvas.height) {
          enemyList.splice(i,1);
          if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
        }
        break;

      case 'zigzagFall': {
        if (!e.speedX) e.speedX = 3.0;
        if (!e.dx || e.dx === 0) e.dx = e.speedX;
        if (!e.dy) e.dy = 0;
        const edgeLeft = 0, edgeRight = canvas.width, descentAmount = 40;
        e.x += e.dx; e.angle = Math.atan2(0, e.dx);
        if (e.x <= edgeLeft || e.x + e.width >= edgeRight) {
          e.x = (e.x <= edgeLeft ? edgeLeft : edgeRight - e.width);
          e.dx = -e.dx;
          e.y += descentAmount;
        }
        if (e.y - e.height > canvas.height || e.x + e.width < 0 || e.x > canvas.width) {
          enemyList.splice(i,1);
          if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
        }
        break;
      }

      case 'slideRowBounce':
        e.x += e.dx;
        e.angle = Math.atan2(0, e.dx);
        if (!e.exiting) {
          if (e.x + e.width >= canvas.width) { e.dx = -e.dx; e.exiting = true; }
        } else {
          if (e.x + e.width <= 0) {
            enemyList.splice(i, 1);
            if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
          }
        }
        break;

      case 'pattern11': {
        const amplitude = 30, speed = 0.05;
        e.y += 2;
        e.x = e.spawnX + Math.sin(e.frame * speed) * amplitude;
        e.angle = Math.atan2(2, e.x - e.spawnX);
        if (e.y > canvas.height) {
          enemyList.splice(i, 1);
          if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
        }
        break;
      }

      case 'pattern12':
        e.x += e.dx; e.y += e.dy; e.angle = Math.atan2(e.dy, e.dx);
        if (e.y > canvas.height) {
          enemyList.splice(i, 1);
          if (typeof gameState !== 'undefined') gameState.enemiesDestroyed++;
        }
        break;
    }
  }
}
