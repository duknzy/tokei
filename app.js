// モジュール初期化
const mapService = new MapService();
const timerWorker = new Worker('timerWorker.js');

// アプリケーション状態
const duration = 25 * 60 * 1000; // 25分
let timeLeft = duration;
let startTime = null;
let isRunning = false;
let userState = { xp: 0, level: 1 };

// DOM要素
const displayElement = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const statusSub = document.getElementById('status-sub');

// 渋谷駅から新宿駅東口の正確な実在地標ポイント
const SHIBUYA_STATION = [35.6580, 139.7016];
const SHINJUKU_STATION = [35.6909, 139.7003];

async function initApp() {
  pushLog("> TRACK_SYSTEM: CONNECTING TO OSRM NETWORK...");
  const result = await mapService.fetchOSRMRoute(SHIBUYA_STATION, SHINJUKU_STATION);
  
  if (result.success) {
    pushLog(`> ROUTE_DATA: LOADED. TOTAL DISTANCE: ${result.distance.toFixed(2)} km`, "success");
    pushLog(`> SYSTEM: MAP SNAPPING ENGAGED. READY TO TRANSIT.`);
  } else {
    pushLog(">> ERROR: OSRM API FEEDS OFFLINE. FALLBACKING...", "system");
  }
  
  updateDisplay(timeLeft);
  updateStatusUI();
}

// タイマー拍動イベント（Workerから受信）
timerWorker.onmessage = function(e) {
  if (e.data === 'TICK' && isRunning) {
    const elapsed = Date.now() - startTime;
    timeLeft = duration - elapsed;

    const progress = Math.min(elapsed / duration, 1.0);
    
    // 【修正】マップの更新と同時に、GPS通過通知を受け取って右側にログを吐く
    mapService.updatePosition(progress, (checkpointName) => {
      pushLog(`>> TACTICAL_GPS: PASSED [${checkpointName}]`, "system");
    });

    if (timeLeft <= 0) {
      timerWorker.postMessage('STOP');
      isRunning = false;
      updateDisplay(0);
      mapService.updatePosition(1.0);
      pushLog(">>> MISSION ACCOMPLISHED: DESTINATION REACHED.", "success");
      addXP(30);
      statusSub.innerText = "[ TRANSIT_COMPLETE ]";
      startBtn.innerText = "ENGAGE";
    } else {
      updateDisplay(timeLeft);
    }
  }
};

function updateDisplay(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  displayElement.innerText = `${m}:${s}`;
  displayElement.setAttribute('data-text', `${m}:${s}`);
}

function pushLog(text, type = "") {
  const logStream = document.getElementById('log-stream');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerText = text;
  logStream.appendChild(entry);
  logStream.scrollTop = logStream.scrollHeight;
}

function addXP(amount) {
  userState.xp += amount;
  pushLog(`> RECEIVED CREDIT_XP: +${amount}`, "success");
  let nextLevelXP = userState.level * 100;
  if (userState.xp >= nextLevelXP) {
    userState.xp -= nextLevelXP;
    userState.level += 1;
    pushLog(`>>> [NEURAL_UPGRADE]: NEW LEVEL ATTAINED: LV.${userState.level} <<<`, "system");
  }
  updateStatusUI();
}

function updateStatusUI() {
  document.getElementById('user-level').innerText = `RANK: OPERATOR [LV.${userState.level}]`;
  let nextLevelXP = userState.level * 100;
  document.getElementById('xp-text').innerText = `${userState.xp} / ${nextLevelXP} XP`;
  document.getElementById('user-state' /* Note: keeping original ID binding but targeting internal value */);
  document.getElementById('xp-fill').style.width = `${(userState.xp / nextLevelXP) * 100}%`;
}

startBtn.addEventListener('click', () => {
  if (!isRunning) {
    isRunning = true;
    startTime = Date.now() - (duration - timeLeft);
    timerWorker.postMessage('START');
    startBtn.innerText = "HALT";
    statusSub.innerText = "[ TRANSIT_RUNNING... ]";
    pushLog(">> SYSTEM: CENTRALISED RADAR LINK ESTABLISHED.", "system");
  } else {
    isRunning = false;
    timerWorker.postMessage('STOP');
    startBtn.innerText = "RESUME";
    statusSub.innerText = "[ TRANSIT_PAUSED ]";
    pushLog(">> SYSTEM: RADAR LINK TEMPORARILY SUSPENDED.", "system");
  }
});

resetBtn.addEventListener('click', () => {
  isRunning = false;
  timerWorker.postMessage('STOP');
  timeLeft = duration;
  updateDisplay(timeLeft);
  mapService.reset();
  startBtn.innerText = "ENGAGE";
  statusSub.innerText = "[ SYSTEM: STANDBY ]";
  pushLog(">> ALERT: USER FORCED PROCESS ABORTION.", "system");
});

initApp();