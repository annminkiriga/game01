// game.js（統合・スマホ対応・FPS30・爆発音キュー方式）
// ■前半＋後半統合版
// ※構造・行数維持／削除なし／フレーム終端で爆発音再生

// 冒頭で bosses を定義（boss.jsより先に読み込まれても大丈夫なように var を使用）
if (typeof bosses === 'undefined') {  var bosses = [];}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

const playerImage = new Image();
playerImage.src = 'images/player-boss.png';
const enemyImage = new Image();
enemyImage.src = 'images/enemy1.png';

const bgm = new Audio('sounds/bgm.mp3');
bgm.loop = true;

// ── ボス撃破音（bigexplosion）の準備 ─────────
const bigExplosionSound = new Audio('sounds/bigexplosion.wav');

function playBigExplosion() {
    // クローンを作ることで、前の音が終わるのを待たずに連続再生できます
    const s = bigExplosionSound.cloneNode();
    s.volume = 0.7; // 迫力を出すために少し大きめ
    s.play();
}

// ── 爆発音プール（統合管理・初期ロード） ─────────
const EXPLOSION_SOUND_POOL_SIZE = 10;
const explosionSoundPool = [];
for(let i=0;i<EXPLOSION_SOUND_POOL_SIZE;i++){
  const s = new Audio('sounds/explosion.wav');
  s.preload = 'auto';
  explosionSoundPool.push(s);
}
let explosionSoundIndex = 0;

// ── 爆発音 再生制御（最適化：1フレーム1回・同時数制限） ─────────
const MAX_SIMULTANEOUS_EXPLOSION_SOUNDS = 2;
const EXPLOSION_SOUND_COOLDOWN = 80; // ms
let lastExplosionSoundTime = 0;
let explosionSoundQueued = false;

function queueExplosionSound(){
  explosionSoundQueued = true;
}

function flushExplosionSound(){
  if(!explosionSoundQueued) return;
  const now = performance.now();
  if (now - lastExplosionSoundTime < EXPLOSION_SOUND_COOLDOWN) {
    explosionSoundQueued = false;
    return;
  }

  let playingCount = 0;
  for (const s of explosionSoundPool) if (!s.paused) playingCount++;
  if (playingCount >= MAX_SIMULTANEOUS_EXPLOSION_SOUNDS) {
    explosionSoundQueued = false;
    return;
  }

  const s = explosionSoundPool[explosionSoundIndex];
  explosionSoundIndex = (explosionSoundIndex + 1) % explosionSoundPool.length;
  if (s.paused) {
    s.currentTime = 0;
    s.play().catch(()=>{});
    lastExplosionSoundTime = now;
  }
  explosionSoundQueued = false;
}

// ── ゲーム状態 ─────────
class GameState {
  constructor() {
    this.frameCount = 0;
    this.stageFrame = 0;
    this.gameStarted = false;
    this.selectedShots = [];
    this.currentStageIndex = 0;

    this.maxClearedLevel = 1; // 最初は LV-001 まで選択可能
    this.selectedLevelIndex = 1; // 選択中のレベル（初期値1）

    this.maxClearedLevel = parseInt(localStorage.getItem('maxClearedLevel')) || 1; 
    this.bestTimes = JSON.parse(localStorage.getItem('bestTimes')) || {};

    this.bossStartTime = 0; // ボス戦開始時の時刻
    this.bossClearTime = 0; // ボス戦にかかった秒数

    this.player = {
      width: canvasWidth,
      height: (canvasHeight/5)*(2/3),
      x:0,
      y:canvasHeight-(canvasHeight/5)*(2/3),
      color:'blue',
      damageFlashFrame: 0 // ★これをつける
    };

    this.bullets = [];
    this.enemies = [];

    // ── 爆発描画初期ロード処理 ─────────
    this.explosions = [];
    const EXPLOSION_POOL_SIZE = 40;
    for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
      this.explosions.push({
        active: false,
        x: 0,
        y: 0,
        radius: 0,
        maxRadius: 30,
        alpha: 1,
        isRocketExplosion: false,
        isGraveExplosion: false,
        color: null
      });
    }

    this.shootingIntervalIds = {};
    this.totalEnemiesInStage = 0;
    this.shotKills = 0;
    this.realTimeRate = 0;

    this.bulletPool = [];
    this.enemyPool = [];
    this.initBulletPool();
    this.initEnemyPool();
  }

  initBulletPool(){
    const types = ['normal','spread','laser','homing','ripple','rocket','split','bounce','grave'];
    for(const type of types){
      const limit = shotLimits[type]*2;
      for(let i=0;i<limit;i++){
        const b = createBullet(0,0,0,0,0,0,'',{});
        b.type = type;
        b.active = false;
        this.bulletPool.push(b);
      }
    }
  }

  initEnemyPool(){
    const maxEnemies = 200;
    for(let i=0;i<maxEnemies;i++){
      this.enemyPool.push({
        x:0, y:0, width:40, height:40,
        dx:0, dy:0, angle:0, behavior:null,
        active:false
      });
    }
  }

  getBulletFromPool(type){
    for(const b of this.bulletPool){
      if(!b.active && b.type===type){
        b.active = true;
        return b;
      }
    }
    return null;
  }

  getEnemyFromPool(){
    for(const e of this.enemyPool){
      if(!e.active){
        e.active = true;
        return e;
      }
    }
    return null;
  }

  getExplosionFromPool(){
    for(const e of this.explosions){
      if(!e.active){
        e.active = true;
        return e;
      }
    }
    return null;
  }
}

const gameState = new GameState();

// ── レスポンシブ対応 ─────────
const gameContainer = document.getElementById('gameContainer');
const shotButtonsContainer = document.getElementById('shotButtonsContainer');
const startButton = document.getElementById('startButton');
const selectScreen = document.getElementById('selectScreen');

function resizeGame() {
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  const scaleX = containerWidth / canvasWidth;
  const scaleY = containerHeight / canvasHeight;
  const scale = Math.min(scaleX, scaleY);
  gameContainer.style.transformOrigin = 'top left';
  gameContainer.style.transform = `scale(${scale})`;
  gameContainer.style.position = 'absolute';
  gameContainer.style.left = `${(containerWidth - canvasWidth*scale)/2}px`;
  gameContainer.style.top = `${(containerHeight - canvasHeight*scale)/2}px`;
}
resizeGame();
window.addEventListener('resize', resizeGame);

// ── 爆発音・BGMの自動再生解除用（スマホ対応） ─────────
function unlockAudio() {
  // 初回再生は行わず、単に解禁フラグを立てるだけ
  // 音は startShootingMode() 内で通常通り再生
  // これでゲームスタート時の「カカッ！」を防止
  // スマホではタッチ後にplay()が有効になる
}

// ── ゲーム開始 ─────────
function startShootingMode() {
  if(gameState.selectedShots.length !== 3) return;

  // 1. HTMLパネルを消す
  const oldResult = document.getElementById('mission-result');
  if (oldResult) oldResult.remove();

  // 2. 判定フラグをリセット
  stageCleared = false; 
  stageCompleted = false;

// 3. ★ 複数ボス対応：ボス配列を完全にリセット
  // これにより、前のゲームのボスが残るのを防ぎ、新しい spawnBoss を受け入れ可能にします
  if (typeof bosses !== 'undefined') {
    bosses = []; 
  }

  // ── 以降は既存の処理 ──
  selectScreen.style.display = 'none';
  gameContainer.style.display = 'inline-block';
  gameState.gameStarted = true;
  gameState.frameCount=0;
  gameState.stageFrame=0;
  // ★ 修正：選択されたレベルのインデックスをセット
  gameState.currentStageIndex = gameState.selectedLevelIndex - 1
  gameState.bullets.length=0;
  gameState.enemies.length=0;

  for (const e of gameState.explosions) { e.active = false; }

  gameState.shootingIntervalIds={};
  gameState.totalEnemiesInStage = countStageEnemies(stages[0]);
  gameState.shotKills=0;
  setupShotButtons();
  bgm.currentTime=0;
  bgm.play(); // BGMはここで初回再生
  lastFrameTime = performance.now();
}

// ── ステージの敵総数カウント ─────────
function countStageEnemies(stage) {
  let total=0;
  for(const event of stage){
    switch(event.patternIndex){
      case 0: case 1: case 2: total+=1; break;
      case 3: total+=3; break;
      case 4: total+=5; break;
      case 5: total+=7; break;
      case 6: total+=4; break;
      case 7: total+=5; break;
      case 8: total+=6; break;
      case 9: total+=8; break;
      case 10: total+=8; break;
      case 11: total+=8; break;
      case 12: total+=8; break;
    }
  }
  return total;
}

// ── ショットボタン生成 ─────────
function setupShotButtons() {
  const container = shotButtonsContainer;
  container.innerHTML='';
  const baseY = gameState.player.y + gameState.player.height/2 - 18;
  const iconSpacing = 120;
  const totalWidth = (gameState.selectedShots.length-1)*iconSpacing;
  const startX = gameState.player.x + gameState.player.width/2 - totalWidth/2 - 5;

  gameState.selectedShots.forEach((shotKey,i)=>{
    const btn = document.createElement('button');
    btn.className='shot-button';
    btn.style.top=baseY+'px';
    btn.style.left=(startX+i*iconSpacing-30)+'px';
    btn.style.width='60px';
    btn.style.height='36px';
    btn.style.position='absolute';
    btn.style.pointerEvents='auto';
    btn.style.padding='0';
    btn.style.lineHeight='0';
    btn.style.display='flex';
    btn.style.justifyContent='center';
    btn.style.alignItems='center';
    btn.style.touchAction='manipulation';
    btn.style.userSelect='none';
    btn.style.webkitUserSelect='none';
    btn.style.webkitTouchCallout='none';
    btn.style.webkitTapHighlightColor='transparent';
    btn.textContent='';
    const img = new Image();
    img.src = `images/${shotKey}_shot_icon.png`;
    img.style.width='60px';
    img.style.height='100%';
    img.style.display='block';
    img.style.margin='auto';
    img.style.touchAction='manipulation';
    btn.appendChild(img);

    btn.onmousedown = btn.ontouchstart = (e) => {
    // 古い boss.active の行は完全に削除してください
    if (typeof bosses !== 'undefined' && bosses.some(b => b.active && b.status === 'appearing')) return;
        if(gameState.shootingIntervalIds[shotKey]) return;
      const interval = shotKey==='spread'?333: shotKey==='rocket'?2000: shotKey==='normal'?220: shotKey==='ripple'?400:100;
      shotDefinitions[shotKey].func(gameState.bullets,gameState.player,gameState.enemies,canvas);
      gameState.shootingIntervalIds[shotKey] = setInterval(()=>{
        shotDefinitions[shotKey].func(gameState.bullets,gameState.player,gameState.enemies,canvas);
      }, interval);
    };
    btn.onmouseup=btn.onmouseleave=btn.ontouchend=btn.ontouchcancel=()=>{
      clearInterval(gameState.shootingIntervalIds[shotKey]);
      delete gameState.shootingIntervalIds[shotKey];
    };
    container.appendChild(btn);
  });
}

// ── ショット選択画面処理 ─────────
const shotSelectButtonsDiv = document.getElementById('shotSelectButtons');
const selectableShots = Object.keys(shotDefinitions);
let currentSelection = [];

function toggleShotSelection(shotKey, button){
  const handler = (e)=>{
    e.preventDefault(); e.stopPropagation();
    const idx = currentSelection.indexOf(shotKey);
    if(idx===-1 && currentSelection.length<3){
      currentSelection.push(shotKey);
      button.classList.add('selected');
    }
    else if(idx!==-1){
      currentSelection.splice(idx,1);
      button.classList.remove('selected');
    }
    startButton.disabled = currentSelection.length!==3;
  };
  button.onclick = handler;
  button.ontouchstart = handler;
}

function initSelectScreen() {
  shotSelectButtonsDiv.innerHTML = '';
  currentSelection = [];
  startButton.disabled = true;

  // 1. ショット選択ボタンの生成
  selectableShots.forEach(shotKey => {
    const btn = document.createElement('button');
    btn.textContent = shotDefinitions[shotKey].label;
    btn.style.width = '120px';
    btn.style.height = '50px';
    btn.style.fontSize = '19.2px';
    btn.style.margin = '5px';
    btn.style.borderRadius = '8px';
    btn.style.border = 'none';
    btn.style.color = 'white';
    btn.style.backgroundColor =
      shotKey === 'normal' ? 'cyan' :
      shotKey === 'spread' ? 'pink' :
      shotKey === 'laser' ? 'magenta' :
      shotKey === 'homing' ? 'orange' :
      shotKey === 'ripple' ? 'lightblue' :
      shotKey === 'rocket' ? 'red' :
      shotKey === 'split' ? 'purple' :
      shotKey === 'bounce' ? 'green' : 'darkgray';
    btn.style.touchAction = 'manipulation';
    btn.style.userSelect = 'none';
    btn.style.webkitUserSelect = 'none';

    toggleShotSelection(shotKey, btn);
    shotSelectButtonsDiv.appendChild(btn);
  });

  // 2. レベル表示更新用の関数定義
  function updateLevelDisplay() {
    const display = document.getElementById('levelDisplay');
    const prevBtn = document.getElementById('prevLevel');
    const nextBtn = document.getElementById('nextLevel');

    if (!display || !prevBtn || !nextBtn) return;

    display.textContent = `LV-${String(gameState.selectedLevelIndex).padStart(3, '0')}`;

    prevBtn.disabled = (gameState.selectedLevelIndex <= 1);
    nextBtn.disabled = (gameState.selectedLevelIndex >= gameState.maxClearedLevel || gameState.selectedLevelIndex >= stages.length);

    prevBtn.style.opacity = prevBtn.disabled ? "0.3" : "1";
    nextBtn.style.opacity = nextBtn.disabled ? "0.3" : "1";
  }

  // 3. レベル選択ボタンのイベント設定
  document.getElementById('prevLevel').onclick = (e) => {
    e.preventDefault();
    if (gameState.selectedLevelIndex > 1) {
      gameState.selectedLevelIndex--;
      updateLevelDisplay();
    }
  };

  document.getElementById('nextLevel').onclick = (e) => {
    e.preventDefault();
    if (gameState.selectedLevelIndex < gameState.maxClearedLevel && gameState.selectedLevelIndex < stages.length) {
      gameState.selectedLevelIndex++;
      updateLevelDisplay();
    }
  };

  // 4. 初回表示
  updateLevelDisplay();

  startButton.onclick = startShootingModeFromSelect;
  startButton.ontouchstart = startShootingModeFromSelect;
}

function toggleShotSelection(shotKey, button) {
  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const idx = currentSelection.indexOf(shotKey);
    if (idx === -1 && currentSelection.length < 3) {
      currentSelection.push(shotKey);
      button.style.opacity = '0.6';
      button.style.outline = '4px solid yellow';
    } else if (idx !== -1) {
      currentSelection.splice(idx, 1);
      button.style.opacity = '1';
      button.style.outline = 'none';
    }
    startButton.disabled = currentSelection.length !== 3;
  };
  button.onclick = handler;
  button.ontouchstart = handler;
}

function startShootingModeFromSelect(e){
  e.preventDefault(); e.stopPropagation();
  if(currentSelection.length!==3) return;

  gameState.selectedShots=[...currentSelection];

  // ★ スマホ音解放（BGMは触らない）
  unlockAudio();

  startShootingMode();
}

window.onload = () => {
  unlockAudio();      // 初回タッチで音解禁（空処理）
  initSelectScreen(); // ショット選択画面初期化
};

// ── FPS30対応メインループ ─────────
let lastFrameTime = performance.now();
const targetFPS = 30;
const fpsInterval = 1000/targetFPS;

function mainLoop(timestamp){
  if(!gameState.gameStarted){
    requestAnimationFrame(mainLoop);
    return;
  }

  const elapsed = timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  const deltaTime = elapsed / 1000;

  update(deltaTime);
  draw();
  flushExplosionSound(); // ★ フレーム終端で1回だけ音再生

  requestAnimationFrame(mainLoop);
}

// ── タイトル・記録画面の制御 ─────────
const titleScreen = document.getElementById('titleScreen');
const recordScreen = document.getElementById('recordScreen');

// 「スタート」ボタン：タイトル -> ショット選択
document.getElementById('btn-start-game').onclick = () => {
  titleScreen.style.display = 'none';
  selectScreen.style.display = 'block';
  initSelectScreen();
};

// 「記録」ボタン：タイトル -> 記録画面
document.getElementById('btn-show-records').onclick = () => {
  titleScreen.style.display = 'none';
  recordScreen.style.display = 'block';
  showRecords();
};

// 記録画面の「戻る」ボタン：記録画面 -> タイトル
document.getElementById('btn-back-to-title').onclick = () => {
  recordScreen.style.display = 'none';
  titleScreen.style.display = 'block';
};

// 記録を表示する関数
function showRecords() {
  const list = document.getElementById('recordList');
  if (!list) return;
  list.innerHTML = ''; 
  // 全てのステージをループ
  for (let i = 0; i < stages.length; i++) {
    const lvId = String(i + 1).padStart(3, '0');
    // gameState.bestTimes は game.js 前半の constructor で定義されている必要があります
    if (!gameState.bestTimes) gameState.bestTimes = {}; 
    
    const time = gameState.bestTimes[lvId];
    const timeText = time ? `<span style="color:#00ff00;">${time}秒</span>` : "---";
    list.innerHTML += `<div style="border-bottom: 1px solid #222; margin-bottom: 5px;">LV-${lvId}：${timeText}</div>`;
  }
}

// ── クリア時にベストタイムを更新する処理 ─────────
// ※checkBossCollisionの中で計測が終わった後に以下を追加します
// (すでに endTime の計算がある場所に、以下のベストタイム比較を組み込んでください)
/*
  const endTime = performance.now();
  gameState.bossClearTime = ((endTime - gameState.bossStartTime) / 1000).toFixed(2);
  
  // ★ ベストタイム更新ロジック
  const lvId = boss.currentId;
  if (!gameState.bestTimes[lvId] || parseFloat(gameState.bossClearTime) < parseFloat(gameState.bestTimes[lvId])) {
    gameState.bestTimes[lvId] = gameState.bossClearTime;
  }
*/

// ── 初期化の修正 ─────────
// game.js 前半にある window.onload を、タイトル画面が出るように上書き/調整します
window.onload = () => {
  if (typeof unlockAudio === 'function') unlockAudio();
  
  // 初期状態：タイトルだけ表示
  titleScreen.style.display = 'block';
  selectScreen.style.display = 'none';
  if (recordScreen) recordScreen.style.display = 'none';
  if (gameContainer) gameContainer.style.display = 'none';
  
  // メインループの初回呼び出し
  requestAnimationFrame(mainLoop);
};

// ── ゲーム更新・描画・爆発生成などは従来通り（省略せず統合済み）

//■game.js後半
// ■game.js後半（ボス戦対応・統合版）

// ── ゲーム更新（update） ─────────
function update(deltaTime) {
  if (!gameState.gameStarted) return;

  gameState.frameCount++;
  gameState.stageFrame++;

  // 1. ステージ進行（ボス・ザコ出現判定）
  const currentStage = stages[gameState.currentStageIndex];
  if (currentStage) {
    for (const event of currentStage) {
      if (event.frame === gameState.stageFrame) {
        if (event.type === 'BOSS') {
          if (typeof spawnBoss === 'function') {
            spawnBoss(event.bossId || "001"); 
            gameState.bossStartTime = performance.now();
          }
        } else if (event.type !== 'END') {
          // typeがBOSSでもENDでもない場合はザコ敵パターンを生成
          spawnPattern(event.patternIndex, gameState.enemies, canvas, deltaTime);
        }
      }
    }
  }

  // 2. ボスの更新と当たり判定 (複数ボス対応)
  // 古い if(typeof boss...) は削除し、配列 bosses で一括管理
  if (typeof bosses !== 'undefined' && bosses.length > 0) {
    updateBoss(); 
    checkBossCollision(); 
  }

  // 3. 各種エンティティの更新
  updateEnemiesBehavior(gameState.enemies, canvas, deltaTime);
  updateBulletsAndCollisions(gameState.bullets, gameState.enemies, canvasWidth, canvasHeight, gameState.player);
  updateExplosions();

  // 4. 自機プレイヤーの被弾判定
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const b = gameState.bullets[i];
    if (b.isEnemyShot) {
      const p = gameState.player;
      if (b.x < p.x + p.width && b.x + b.width > p.x &&
          b.y < p.y + p.height && b.y + b.height > p.y) {
        p.damageFlashFrame = 3;
        if (!b.isLaser) gameState.bullets.splice(i, 1);
      }
    }
  }
  if (gameState.player.damageFlashFrame > 0) gameState.player.damageFlashFrame--;

  checkStageClear();
}

// ── ボス当たり判定（複数ボス・記録保存対応版） ─────────
function checkBossCollision() {
  bosses.forEach((b) => {
    if (!b.active || b.invincibleFrame > 0 || 
        b.status === 'exploding' || b.status === 'appearing') return;

    const bx = b.x + (b.width / 2);
    const by = b.y + (b.height / 2);
    const hitBoxSize = 24; 

    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
      const bullet = gameState.bullets[i];
      if (bullet.isEnemyShot) continue; 

      const bCenterX = bullet.x + (bullet.width / 2);
      const bCenterY = bullet.y + (bullet.height / 2);

      if (bCenterX > bx - hitBoxSize && bCenterX < bx + hitBoxSize &&
          bCenterY > by - hitBoxSize && bCenterY < by + hitBoxSize) {
        
        const data = bossData[b.currentId];
        let damageRate = 1.0; 
        if (data && data.resistances) {
          damageRate = data.resistances[bullet.type] || 0.1; 
        }
        
        b.hp -= (1 * damageRate);
        b.damageFlashFrame = 5;  
        b.invincibleFrame = 10; 

        queueExplosionSound();

// ボス撃破時の処理
        if (b.hp <= 0) {
          b.hp = 0;
          b.status = 'exploding';
          playBigExplosion();

          // クリアタイムの計測
          const endTime = performance.now();
          gameState.bossClearTime = ((endTime - gameState.bossStartTime) / 1000).toFixed(2);

          // ★ 修正：ボスのID(b.currentId)ではなく、現在のステージ番号(LV-010など)で保存する
          const lvId = String(gameState.selectedLevelIndex).padStart(3, '0');
          
          // ベストタイム更新と保存
          if (!gameState.bestTimes[lvId] || parseFloat(gameState.bossClearTime) < parseFloat(gameState.bestTimes[lvId])) {
            gameState.bestTimes[lvId] = gameState.bossClearTime;
          }
          localStorage.setItem('bestTimes', JSON.stringify(gameState.bestTimes));
          localStorage.setItem('maxClearedLevel', gameState.maxClearedLevel);
        }

        if (!bullet.isLaser) gameState.bullets.splice(i, 1);
        break; 
      }
    }
  });
}

// ── 描画（draw） ─────────
function draw(){
  ctx.clearRect(0,0,canvasWidth,canvasHeight);

  ctx.save(); 
  if (gameState.player.damageFlashFrame > 0) {
    ctx.filter = 'brightness(5) grayscale(1)'; 
  }
  if (playerImage.complete && playerImage.naturalWidth !== 0) {
    ctx.drawImage(playerImage, gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height);
  } else {
    ctx.fillStyle = gameState.player.color;
    ctx.fillRect(gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height);
  }
  ctx.restore();

  if (typeof drawBoss === 'function') {
    drawBoss(ctx);
  }

  drawEnemies(ctx, gameState.enemies);
  drawBullets(ctx, gameState.bullets);
  drawExplosions(ctx, gameState.explosions);
}

// ── 敵描画 ─────────
function drawEnemies(ctx,enemies){
  for(const e of enemies){
    if(enemyImage.complete && enemyImage.naturalWidth!==0){
      ctx.save();
      ctx.translate(e.x+e.width/2, e.y+e.height);
      ctx.rotate((e.angle || 0)+Math.PI/2);
      ctx.drawImage(enemyImage, -e.width/2, -e.height, e.width, e.height);
      ctx.restore();
    } else {
      ctx.fillStyle=e.color || 'red';
      ctx.fillRect(e.x,e.y,e.width,e.height);
    }
  }
}

// ── ステージクリア管理 ─────────
let stageCleared = false;
function checkStageClear() {
  if (stageCleared) return;
  const livingBosses = bosses.filter(b => b.active);
  // ボスが生成されており、かつ全員が非アクティブ(撃破)ならクリア
  if (bosses.length > 0 && livingBosses.length === 0) {
    handleStageClear();
  }
}

function handleStageClear() {
  if (stageCleared) return;
  stageCleared = true; 
  stopBGM();

  // 現在クリアしたレベルを数値で取得
  const clearedLevel = gameState.selectedLevelIndex;
  
  // 次のレベルを解放
  if (clearedLevel >= gameState.maxClearedLevel) {
      gameState.maxClearedLevel = clearedLevel + 1;
      localStorage.setItem('maxClearedLevel', gameState.maxClearedLevel);
  }
  // ... (以下、リザルトパネルの表示などはそのまま)

  const resultDiv = document.createElement('div');
  resultDiv.className = 'mission-result-panel'; 
  resultDiv.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.95);padding:40px;border:3px solid gold;border-radius:15px;text-align:center;color:white;z-index:3000;box-shadow: 0 0 20px gold;`;

  const isAllClear = (clearedLevel === stages.length);

  if (isAllClear) {
    resultDiv.innerHTML = `
      <h1 style="color: gold; margin-top: 0; font-size: 40px; text-shadow: 0 0 10px yellow;">✨ ALL CLEAR! ✨</h1>
      <p style="font-size: 24px; margin: 20px 0;">おめでとうございます！<br>全てのミッションを完遂しました！</p>
      <p style="font-size: 18px; color: #ccc;">FINAL TIME: <span style="color: #00ff00; font-weight: bold;">${gameState.bossClearTime}s</span></p>
      <div style="margin-top: 30px;">
        <button id="btn-to-title-final" style="padding: 15px 30px; font-size: 20px; cursor: pointer; background: gold; color: black; border: none; border-radius: 5px; font-weight: bold;">タイトルへ戻る</button>
      </div>
    `;
  } else {
    resultDiv.innerHTML = `
      <h2 style="color: yellow; margin-top: 0;">MISSION CLEAR</h2>
      <p style="font-size: 20px; margin-bottom: 20px;">
        CLEAR TIME: <span style="color: #00ff00; font-weight: bold;">${gameState.bossClearTime}s</span>
      </p>
      <div style="display: flex; gap: 20px; justify-content: center;">
        <button id="btn-to-select" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">武器選択へ</button>
        <button id="btn-to-next" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #228b22; color: white; border: none; border-radius: 5px;">次へ</button>
      </div>
    `;
  }

  document.body.appendChild(resultDiv);

  if (isAllClear) {
    document.getElementById('btn-to-title-final').onclick = () => {
      resultDiv.remove();
      gameState.gameStarted = false;
      stageCleared = false;
      document.getElementById('gameContainer').style.display = 'none';
      document.getElementById('titleScreen').style.display = 'block';
    };
  } else {
    document.getElementById('btn-to-select').onclick = () => { resultDiv.remove(); goToShotSelect(); };
    document.getElementById('btn-to-next').onclick = () => {
      bosses = []; // 配列リセット
      gameState.selectedLevelIndex++; // 次のレベルへ
      resultDiv.remove();
      gameState.stageFrame = 0;
      stageCleared = false; 
      bgm.play();
      startShootingMode(); // 再セットアップして開始
    };
  }
}

function goToShotSelect(){
  gameState.gameStarted = false;
  stageCleared = false;
  gameContainer.style.display = 'none';
  selectScreen.style.display = 'block';
  stopBGM();
  initSelectScreen();
}

function stopBGM(){ bgm.pause(); bgm.currentTime = 0; }

function drawExplosions(ctx, explosions) {
  for (const e of explosions) {
    if (!e.active) continue;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = e.isRocketExplosion ? `rgba(0,150,255,${e.alpha})` : `rgba(255,150,0,${e.alpha})`;
    ctx.fill();
  }
}

function updateExplosions() {
  for (const e of gameState.explosions) {
    if (!e.active) continue;
    e.radius += 2; e.alpha -= 0.05;
    if (e.alpha <= 0) e.active = false;
  }
}

function spawnExplosion(x, y, options = {}) {
  const e = gameState.getExplosionFromPool();
  if(!e) return;
  e.active = true; e.x = x; e.y = y; e.radius = 0; e.alpha = 1;
  e.maxRadius = options.maxRadius || 30;
  e.isRocketExplosion = options.isRocketExplosion || false;
  queueExplosionSound();
}

// ── ボタン等のイベント登録 ─────────
// 変数名は前半で定義されている titleScreen, recordScreen に合わせます
if (document.getElementById('btn-start-game')) {
  document.getElementById('btn-start-game').onclick = () => {
    titleScreen.style.display = 'none';
    selectScreen.style.display = 'block';
    initSelectScreen();
  };
}

if (document.getElementById('btn-show-records')) {
  document.getElementById('btn-show-records').onclick = () => {
    titleScreen.style.display = 'none';
    recordScreen.style.display = 'block';
    showRecords();
  };
}

if (document.getElementById('btn-back-to-title')) {
  document.getElementById('btn-back-to-title').onclick = () => {
    recordScreen.style.display = 'none';
    titleScreen.style.display = 'block';
  };
}

if (document.getElementById('btn-clear-records')) {
  document.getElementById('btn-clear-records').onclick = () => {
    if (confirm("すべての記録を消去しますか？")) {
      localStorage.clear();
      gameState.bestTimes = {};
      gameState.maxClearedLevel = 1;
      gameState.selectedLevelIndex = 1;
      showRecords();
      alert("リセットしました。");
    }
  };
}

// ── 初期表示 ─────────
window.onload = () => {
  if (typeof unlockAudio === 'function') unlockAudio();
  
  // 画面の初期状態をセット
  titleScreen.style.display = 'block';
  selectScreen.style.display = 'none';
  recordScreen.style.display = 'none';
  gameContainer.style.display = 'none';
  
  // ループ開始
  requestAnimationFrame(mainLoop);
};