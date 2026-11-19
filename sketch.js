let characterSprite; // 儲存角色一的精靈圖
let walkSprite; // 儲存角色一的走路精靈圖
let magicSprite; // 儲存角色一的施法精靈圖
let magicEffectSprite; // 儲存角色一的魔法特效精靈圖
let bgImg; // 儲存外部森林背景圖
let bgLoadFailed = false; // 記錄外部背景圖是否載入失敗

let characterX; // 儲存角色一固定的水平中心位置
let bgScrollX = 0; // 記錄背景橫向捲動的累計偏移量
let isWalking = false; // 記錄角色是否已切換為走路動畫
let facingDirection = 1; // 記錄角色朝向（1 為右，-1 為左）
let isCasting = false; // 記錄角色是否正在播放施法動畫
let magicStartFrame = 0; // 記錄施法動畫開始時的畫面計數
let magicDirection = 1; // 記錄施法時鎖定的方向
let spaceIsDown = false; // 記錄空白鍵是否已按住以避免重複觸發
let activeEffects = []; // 儲存目前畫面上飛行中的魔法特效

const frameCountInSprite = 10; // 設定精靈圖包含的影格數
const frameWidth = 139.5; // 設定每個影格的寬度（1395 除以 10）
const frameHeight = 196; // 設定每個影格的高度
const walkFrameCount = 9; // 設定走路精靈圖包含的影格數
const walkFrameWidth = 1246 / walkFrameCount; // 計算走路動畫每格的寬度
const walkFrameHeight = 198; // 設定走路動畫每格的高度
const magicFrameCount = 4; // 設定施法精靈圖包含的影格數
const magicFrameWidth = 1039 / magicFrameCount; // 計算施法動畫每格的寬度
const magicFrameHeight = 146; // 設定施法動畫每格的高度
const effectFrameCount = 5; // 設定魔法特效精靈圖包含的影格數
const effectFrameWidth = 740 / effectFrameCount; // 計算魔法特效每格的寬度
const effectFrameHeight = 19; // 設定魔法特效每格的高度
const framesPerStep = 8; // 設定動畫每隔幾個畫面更新一格

// 鏡頭、地面與角色大小參數
const characterAnchorRatio = 0.45; // 角色固定在畫面的水平比例（0.5 為正中央）
const groundHeightRatio = 0.14; // 地板高度佔畫布的比例
const scrollSpeedFactor = 1.0; // 背景捲動速度倍率
const characterHeightRatio = 0.35; // 角色高度佔畫布的比例（已縮小，約佔畫面 1/3 高度；若要 2/3 可改為 0.66）

function preload() { // 在畫布建立前載入角色與背景圖片
  characterSprite = loadImage("1/stop/stop.png"); // 載入角色一的十格精靈圖
  walkSprite = loadImage("1/walk/walk.png"); // 載入角色一的九格走路精靈圖
  magicSprite = loadImage("1/magic/magic.png"); // 載入角色一的四格施法精靈圖
  magicEffectSprite = loadImage("1/magic_effect/magic_effect.png"); // 載入五格魔法特效精靈圖

  // 嘗試載入外部背景圖；若資料夾內尚無此檔案，改用程式生成像素森林，避免卡在 Loading 畫面
  bgImg = loadImage(
    "bg/forest.png",
    () => { bgLoadFailed = false; },
    () => {
      console.warn("找不到 bg/forest.png，已自動切換為內建像素森林背景。");
      bgLoadFailed = true;
    }
  );
} // 結束圖片載入函式

function setup() { // 初始化畫布與繪圖模式
  createCanvas(windowWidth, windowHeight); // 建立符合視窗尺寸的畫布
  noSmooth(); // 關閉平滑抗鋸齒，保持像素畫銳利度
  imageMode(CENTER); // 讓角色座標代表影格的中心點
  characterX = width * characterAnchorRatio; // 將角色水平位置固定在畫面中央附近
  frameRate(60); // 將動畫更新速率設定為每秒六十格

  // 若外部背景圖不存在，動態生成一張可無縫循環的像素森林貼圖
  if (bgLoadFailed || !bgImg || bgImg.width === 0) {
    bgImg = createFallbackPixelForest();
  }
} // 結束初始化函式

function draw() { // 每個畫面更新一次背景與角色
  background("#1a2634"); // 預設深色底色

  // 1. 角色方向與背景捲動計算
  const movingRight = keyIsDown(RIGHT_ARROW); // 檢查右方向鍵目前是否按住
  const movingLeft = keyIsDown(LEFT_ARROW); // 檢查左方向鍵目前是否按住
  isWalking = movingRight || movingLeft; // 沒有按住左右鍵時切回站立動畫
  const movementStep = constrain(width * 0.0045, 3, 9); // 依畫布寬度計算捲動速度

  if (movingRight) { // 按住右方向鍵時向右探索（背景向左捲動）
    isWalking = true; // 切換至走路動畫
    facingDirection = 1; // 設定角色朝向右方
    bgScrollX -= movementStep * scrollSpeedFactor; // 背景向左移動
  } else if (movingLeft) { // 按住左方向鍵且未按右鍵時向左折返（背景向右捲動）
    isWalking = true; // 切換至走路動畫
    facingDirection = -1; // 設定角色朝向左方
    bgScrollX += movementStep * scrollSpeedFactor; // 背景向右移動
  } // 結束方向鍵移動判斷

  // 2. 繪製全螢幕無縫橫向捲動背景
  drawParallaxBackground();

  // 計算地板頂部 Y 座標與縮小後的角色縮放尺寸
  const groundTopY = height * (1 - groundHeightRatio);
  const characterScale = min((height * characterHeightRatio) / frameHeight, (width * 0.4) / frameWidth); // 依設定比例等比例縮小角色
  const characterWidth = frameWidth * characterScale; // 計算角色基本顯示寬度
  const characterHeight = frameHeight * characterScale; // 計算角色基本顯示高度
  characterX = width * characterAnchorRatio; // 確保角色鎖定在畫面中央附近

  // 3. 施法與魔法特效生成
  if (isCasting && frameCount - magicStartFrame >= magicFrameCount * framesPerStep) { // 檢查施法動畫是否已完整播放一次
    isCasting = false; // 結束施法動畫並恢復一般角色動作
    activeEffects.push({
      x: characterX + (magicDirection * characterWidth) / 2,
      y: groundTopY - characterHeight * 0.52,
      direction: magicDirection
    }); // 在角色前方建立朝施法方向飛行的特效
  } // 結束施法動畫完成判斷

  // 4. 繪製角色精靈圖
  const activeSprite = isCasting ? magicSprite : isWalking ? walkSprite : characterSprite;
  const activeFrameCount = isCasting ? magicFrameCount : isWalking ? walkFrameCount : frameCountInSprite;
  const activeFrameWidth = isCasting ? magicFrameWidth : isWalking ? walkFrameWidth : frameWidth;
  const activeFrameHeight = isCasting ? magicFrameHeight : isWalking ? walkFrameHeight : frameHeight;
  const elapsedMagicFrames = frameCount - magicStartFrame;
  const frameIndex = isCasting ? floor(elapsedMagicFrames / framesPerStep) : floor(frameCount / framesPerStep) % activeFrameCount;
  const sourceX = frameIndex * activeFrameWidth;
  const activeWidth = activeFrameWidth * characterScale;
  const activeHeight = activeFrameHeight * characterScale;
  const characterY = groundTopY - activeHeight / 2 + 3;

  // 角色腳下像素陰影（隨角色縮小調整）
  noStroke();
  fill(10, 15, 25, 110);
  rectMode(CENTER);
  rect(characterX, groundTopY + 2, activeWidth * 0.55, 6);

  push();
  translate(characterX, characterY);
  scale(isCasting ? magicDirection : facingDirection, 1);
  image(activeSprite, 0, 0, activeWidth, activeHeight, sourceX, 0, activeFrameWidth, activeFrameHeight);
  pop();

  // 5. 更新與繪製飛行中的魔法特效（隨角色比例縮放並加上背景捲動補償）
  const effectScale = characterScale;
  const effectWidth = effectFrameWidth * effectScale;
  const effectHeight = effectFrameHeight * effectScale;
  const effectSpeed = max(6, width * 0.008);

  let worldShiftX = 0;
  if (movingRight) worldShiftX = -movementStep * scrollSpeedFactor;
  if (movingLeft) worldShiftX = movementStep * scrollSpeedFactor;

  for (let effectIndex = activeEffects.length - 1; effectIndex >= 0; effectIndex--) {
    const effect = activeEffects[effectIndex];
    effect.x += effect.direction * effectSpeed + worldShiftX;
    if (effect.x > width + effectWidth || effect.x < -effectWidth) {
      activeEffects.splice(effectIndex, 1);
      continue;
    }
    const effectFrameIndex = floor(frameCount / framesPerStep) % effectFrameCount;
    push();
    translate(effect.x, effect.y);
    scale(effect.direction, 1);
    image(magicEffectSprite, 0, 0, effectWidth, effectHeight, effectFrameIndex * effectFrameWidth, 0, effectFrameWidth, effectFrameHeight);
    pop();
  }
}

// 繪製等比例滿版且可無限左右循環拼接的視差背景
function drawParallaxBackground() {
  if (!bgImg || bgImg.width === 0) return;

  push();
  imageMode(CORNER);

  const scaleFactor = height / bgImg.height;
  const scaledW = bgImg.width * scaleFactor;
  const scaledH = height;

  let startX = bgScrollX % scaledW;
  if (startX > 0) {
    startX -= scaledW;
  }

  for (let x = startX; x < width; x += scaledW) {
    image(bgImg, x, 0, scaledW, scaledH);
  }
  pop();
}

// 備援函式：當找不到外部圖片時，生成一張可左右無縫拼接的 16-bit 像素森林圖層
function createFallbackPixelForest() {
  const bw = 320;
  const bh = 180;
  const g = createGraphics(bw, bh);
  g.noSmooth();
  g.noStroke();

  const groundTop = floor(bh * (1 - groundHeightRatio));

  // 天空漸層
  const skyColors = [
    color(18, 22, 48),
    color(28, 34, 68),
    color(44, 48, 88),
    color(68, 62, 102),
    color(98, 76, 108)
  ];
  const bandH = ceil(groundTop / skyColors.length);
  for (let i = 0; i < skyColors.length; i++) {
    g.fill(skyColors[i]);
    g.rect(0, i * bandH, bw, bandH + 1);
  }

  // 遠景週期性山脈（使用 TWO_PI 確保左右邊界無縫銜接）
  g.fill(26, 35, 58);
  for (let x = 0; x < bw; x += 2) {
    const angle = (x / bw) * TWO_PI;
    const mountainH = floor(bh * 0.25 + sin(angle * 2) * (bh * 0.08) + cos(angle * 3) * (bh * 0.04));
    g.rect(x, groundTop - mountainH, 2, mountainH);
  }

  // 中景樹林
  g.fill(20, 42, 48);
  for (let x = 0; x < bw; x += 16) {
    const treeH = 52 + ((x * 7) % 24);
    const treeTop = groundTop - treeH;
    g.rect(x + 6, treeTop + 8, 3, treeH - 8);
    for (let tier = 0; tier < 4; tier++) {
      const w = 6 + tier * 4;
      g.rect(x + 7 - floor(w / 2), treeTop + tier * 9, w, 11);
    }
  }

  // 近景巨木
  const treePositions = [18, 86, 162, 240];
  for (let tx of treePositions) {
    g.fill(36, 26, 28);
    g.rect(tx, 16, 10, groundTop - 16);
    g.fill(54, 38, 36);
    g.rect(tx, 16, 4, groundTop - 16);
    g.fill(18, 56, 46);
    g.rect(tx - 14, 6, 38, 22);
    g.fill(28, 78, 56);
    g.rect(tx - 8, 0, 26, 14);
  }

  // 地板泥土與石磚紋理
  g.fill(48, 32, 26);
  g.rect(0, groundTop, bw, bh - groundTop);
  for (let gy = groundTop + 5; gy < bh; gy += 6) {
    for (let gx = 0; gx < bw; gx += 8) {
      const offset = ((gy / 6) % 2) * 4;
      g.fill(64, 44, 34);
      g.rect((gx + offset) % bw, gy, 6, 4);
    }
  }

  // 草皮表層
  g.fill(46, 128, 64);
  g.rect(0, groundTop, bw, 4);
  g.fill(74, 168, 76);
  g.rect(0, groundTop, bw, 2);

  return g;
}

function keyPressed() {
  if (keyCode === RIGHT_ARROW) {
    isWalking = true;
    facingDirection = 1;
    return false;
  }
  if (keyCode === LEFT_ARROW) {
    isWalking = true;
    facingDirection = -1;
    return false;
  }
  if (keyCode === 32) {
    if (!spaceIsDown && !isCasting) {
      isCasting = true;
      magicStartFrame = frameCount;
      magicDirection = facingDirection;
    }
    spaceIsDown = true;
    return false;
  }
}

function keyReleased() {
  if (keyCode === 32) {
    spaceIsDown = false;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  characterX = width * characterAnchorRatio;
}