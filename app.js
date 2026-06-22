const mapService = new MapService();
const timerWorker = new Worker('timerWorker.js');

// =======================================================
// 📡 FIREBASE TELEMETRY NETWORK CONFIGURATION
// =======================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let db = null;
try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    pushLog("> TELEMETRY_SERVER: CLOUD FACTORY LINK ESTABLISHED.", "success");
  } else {
    pushLog("> TELEMETRY_SERVER: LOCAL MODE (FIREBASE KEY NOT SET).", "system");
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

const ROUTE_PRESETS = {
  shibuya_shinjuku: {
    start: [35.6580, 139.7016],
    end: [35.6909, 139.7003],
    name: "SHIBUYA STN ➔ SHINJUKU STN (4.5km)"
  },
  nagasaki_station: {
    start: [32.7532, 129.8712],
    end: [32.7744, 129.8631],
    name: "NAGASAKI STN ➔ PEACE PARK (3.2km)"
  }
};

let currentMode = "POMODORO"; 
let isRunning = false;
let startTime = null; 

let timeLeft = 0;           
let totalWorkTime = 0;      
let totalRestTime = 0;      
let ersPercent = 100;       
let tyreTemp = 60.0;        

let pomoState = "WORK";      
let currentPomoCycle = 1;   
let pomoTotalDuration = 0;  
let pomoTotalTimeLeft = 0;  
let pomoWorkDuration = 0;   
let pomoRestDuration = 0;   
let totalWorkExpected = 0;  
let currentWorkAccumulated = 0; 

let enduranceLap = 1;
const TIME_PER_LAP = 30 * 60 * 1000; 

let userState = { xp: 0, level: 1 };
// 🟢 スマートカスタムルート用の一時座標ストア
let customStartCoords = null;
let customEndCoords = null;
let mapClickCount = 0;

const displayElement = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const statusSub = document.getElementById('status-sub');
const modeSelect = document.getElementById('race-mode');
const bgSelector = document.getElementById('bg-selector'); 

const totalSettingRow = document.getElementById('total-setting-row');
const workSettingRow = document.getElementById('work-setting-row');
const restSettingRow = document.getElementById('rest-setting-row');

const routePreset = document.getElementById('route-preset');
const customCoordsDiv = document.getElementById('custom-coords');
const lapCounter = document.getElementById('lap-counter');
const mapRemLabel = document.getElementById('map-rem-label');
const rpmIndicator = document.getElementById('rpm-indicator');
const pomoIndicator = document.getElementById('pomo-state-indicator');
const totalRemainDisplay = document.getElementById('total-remain-display');
const realClockDisplay = document.getElementById('real-clock-display');

bgSelector.addEventListener('change', (e) => {
  const bgValue = e.target.value;
  if (bgValue !== 'none') {
    document.body.style.backgroundImage = `linear-gradient(rgba(5, 5, 8, 0.45), rgba(5, 5, 8, 0.45)), url('${bgValue}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
    pushLog(`> COCKPIT_SYSTEM: LOCAL WALLPAPER [${bgValue.toUpperCase()}] ENGAGED.`, "success");
  } else {
    document.body.style.backgroundImage = 'none';
    document.body.className = 'void-black';
    pushLog(`> COCKPIT_SYSTEM: BACK TO STEALTH VOID BLACK.`, "system");
  }
});

modeSelect.addEventListener('change', (e) => {
  currentMode = e.target.value;
  if (currentMode === "POMODORO") {
    totalSettingRow.style.display = "flex";
    workSettingRow.style.display = "flex";
    restSettingRow.style.display = "flex";
    lapCounter.style.display = "none";
    mapRemLabel.style.visibility = "visible";
    pomoIndicator.style.display = "block";
    totalRemainDisplay.style.display = "block";
  } else if (currentMode === "SPRINT") {
    totalSettingRow.style.display = "none";
    workSettingRow.style.display = "flex";
    restSettingRow.style.display = "none";
    lapCounter.style.display = "none";
    mapRemLabel.style.visibility = "visible";
    pomoIndicator.style.display = "none";
    totalRemainDisplay.style.display = "none";
  } else { 
    totalSettingRow.style.display = "none";
    workSettingRow.style.display = "none";
    restSettingRow.style.display = "none";
    lapCounter.style.display = "inline";
    mapRemLabel.style.visibility = "hidden";
    pomoIndicator.style.display = "none";
    totalRemainDisplay.style.display = "none";
  }
  resetTimeState();
});

routePreset.addEventListener('change', (e) => {
  if (e.target.value === "custom") {
    customCoordsDiv.style.display = "flex";
  } else {
    customCoordsDiv.style.display = "none";
  }
  loadSelectedRoute();
});

function calculateTotalWorkExpected(totalMs, workMs, restMs) {
  let tempTotal = totalMs;
  let expectedWork = 0;
  while (tempTotal > 0) {
    if (tempTotal >= workMs) {
      expectedWork += workMs;
      tempTotal -= workMs;
    } else {
      expectedWork += tempTotal;
      tempTotal = 0;
      break;
    }
    if (tempTotal >= restMs) {
      tempTotal -= restMs;
    } else {
      tempTotal = 0;
    }
  }
  return expectedWork;
}

function resetTimeState() {
  const totalMins = parseInt(document.getElementById('input-total-minutes').value) || 180;
  const workMins = parseInt(document.getElementById('input-minutes').value) || 30;
  const restMins = parseInt(document.getElementById('input-rest-minutes').value) || 5;
  
  pomoTotalDuration = totalMins * 60 * 1000;
  pomoWorkDuration = workMins * 60 * 1000;
  pomoRestDuration = restMins * 60 * 1000;

  if (currentMode === "SPRINT") {
    timeLeft = pomoWorkDuration;
    updateDisplay(timeLeft);
  } else if (currentMode === "POMODORO") {
    pomoState = "WORK";
    currentPomoCycle = 1;
    timeLeft = pomoWorkDuration;
    pomoTotalTimeLeft = pomoTotalDuration;
    currentWorkAccumulated = 0;
    
    totalWorkExpected = calculateTotalWorkExpected(pomoTotalDuration, pomoWorkDuration, pomoRestDuration);
    
    pomoIndicator.innerText = `[[ STINT ${currentPomoCycle}: STIMULUS_RUN ]]`;
    pomoIndicator.style.color = "var(--accent-neon-pink)";
    updateDisplay(timeLeft);
    updateTotalRemainDisplay(pomoTotalTimeLeft);
  } else { 
    timeLeft = 0; 
    enduranceLap = 1;
    lapCounter.innerText = `[LAP ${enduranceLap}]`;
    updateDisplay(0);
  }
  updateProgressMeter(0);
  updateLiveTelemetry();
}

async function initApp() {
  pushLog("> TRACK_SYSTEM: CONNECTING TO TELEMETRY NETWORK...");
  await loadSelectedRoute();
  resetTimeState();
  updateStatusUI();
  
  setInterval(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    
    realClockDisplay.innerText = `${h}:${m}:${s}`;
    document.getElementById('hud-clock').innerText = `SYS_TIME: ${h}:${m}:${s}`;
    
    if (!isRunning) {
      totalRestTime += 1000;
      tyreTemp = Math.max(60.0, tyreTemp - 0.3); 
      ersPercent = Math.min(100, ersPercent + 0.3); 
      updateLiveTelemetry();
    }
  }, 1000);
}

async function loadSelectedRoute() {
  const presetKey = routePreset.value;
  let start, end, trackName;

  if (presetKey === "custom") {
    // 座標がまだ入っていない場合はデフォルトのメッセージを出して待機
    if (!customStartCoords || !customEndCoords) {
      document.getElementById('current-track-name').innerText = "ROUTE: AWAITING CUSTOM MAP INPUT...";
      return;
    }
    start = customStartCoords;
    end = customEndCoords;
    trackName = document.getElementById('current-track-name').innerText.replace("ROUTE: ", "");
  } else {
    const preset = ROUTE_PRESETS[presetKey];
    start = preset.start;
    end = preset.end;
    trackName = preset.name;
    // プリセットに戻した時はクリックカウンターもリセット
    mapClickCount = 0;
  }

  document.getElementById('current-track-name').innerText = `ROUTE: ${trackName}`;
  const result = await mapService.fetchOSRMRoute(start, end);
  if (result.success) {
    pushLog(`> ROUTE_DATA: GRID CALIBRATED. DISTANCE: ${result.distance.toFixed(2)} km`, "success");
  }
}

function updateProgressMeter(progress) {
  const bars = rpmIndicator.querySelectorAll('.rpm-bar');
  const activeCount = Math.min(10, Math.floor(progress * 10)); 

  bars.forEach((b, i) => {
    if (i < activeCount) b.classList.add('active');
    else b.classList.remove('active');
  });
}

timerWorker.onmessage = function(e) {
  if (e.data === 'TICK' && isRunning) {
    const now = Date.now();
    const delta = now - startTime; 
    startTime = now; 

    if (currentMode === "SPRINT") {
      timeLeft -= delta;
      totalWorkTime += delta;
      
      tyreTemp = Math.min(100.0, tyreTemp + (delta / 12000));
      ersPercent = Math.max(0, ersPercent - (delta / 36000));
      
      const progress = Math.min((pomoWorkDuration - timeLeft) / pomoWorkDuration, 1.0);
      mapService.updatePosition(progress, (checkpointName) => {
        pushLog(`>> TACTICAL_GPS: PASSED [${checkpointName}]`, "system");
      });
      
      updateProgressMeter(progress);

      if (timeLeft <= 0) {
        updateProgressMeter(1.0);
        finishSession("MISSION ACCOMPLISHED: TARGET DESTINATION REACHED.", 30, "FINISHED");
      } else {
        updateDisplay(timeLeft);
      }

    } else if (currentMode === "ENDURANCE") {
      timeLeft += delta; 
      totalWorkTime += delta;

      tyreTemp = Math.min(100.0, tyreTemp + (delta / 12000));
      ersPercent = Math.max(0, ersPercent - (delta / 36000));

      updateDisplay(timeLeft);

      let currentLapElapsed = timeLeft % TIME_PER_LAP;
      let progress = currentLapElapsed / TIME_PER_LAP;
      
      updateProgressMeter(progress);

      let calculatedLap = Math.floor(timeLeft / TIME_PER_LAP) + 1;
      if (calculatedLap > enduranceLap) {
        enduranceLap = calculatedLap;
        lapCounter.innerText = `[LAP ${enduranceLap}]`;
        mapService.resetCheckpoints(); 
        pushLog(`>>> LAP_${enduranceLap}: ENTERING NEW SECTOR GRID. PUSH HARD!`, "success");
        addXP(20);
      }

      mapService.updatePosition(progress, (checkpointName) => {
        pushLog(`>> ENDURANCE_GPS: LAP ${enduranceLap} [${checkpointName}] PASSED`, "system");
      });

    } else if (currentMode === "POMODORO") {
      pomoTotalTimeLeft -= delta;
      updateTotalRemainDisplay(pomoTotalTimeLeft);

      if (pomoTotalTimeLeft <= 0) {
        updateTotalRemainDisplay(0);
        updateProgressMeter(1.0);
        mapService.updatePosition(1.0);
        finishSession("GRAND PRIX COMPLETE: FULL RACE DISTANCE COVERED!", 50, "FINISHED");
        return;
      }

      const overallProgress = Math.min(currentWorkAccumulated / totalWorkExpected, 1.0);

      if (pomoState === "WORK") {
        timeLeft -= delta;
        totalWorkTime += delta;
        currentWorkAccumulated += delta; 
        
        tyreTemp = Math.min(100.0, tyreTemp + (delta / 10000)); 
        ersPercent = Math.max(0, ersPercent - (delta / 30000)); 

        mapService.updatePosition(overallProgress, (checkpointName) => {
          pushLog(`>> POMODORO_GPS: STINT ${currentPomoCycle} [${checkpointName}] PASSED`, "system");
        });

        updateProgressMeter(overallProgress);

        if (timeLeft <= 0) {
          pomoState = "REST";
          timeLeft = pomoRestDuration;
          pomoIndicator.innerText = `[[ PIT_STOP ${currentPomoCycle}: RECHARGING ]]`;
          pomoIndicator.style.color = "var(--success-green)";
          pushLog(`>>> PIT-STOP TRIGGERED (STINT ${currentPomoCycle} END): ENTERING BOX. <<<`, "system");
          addXP(15);
        }
        updateDisplay(timeLeft);

      } else {
        timeLeft -= delta;
        totalRestTime += delta; 

        tyreTemp = Math.max(60.0, tyreTemp - (delta / 5000));      
        ersPercent = Math.min(100, ersPercent + (delta / 4000));   

        updateProgressMeter(overallProgress);

        if (timeLeft <= 0) {
          pomoState = "WORK";
          currentPomoCycle++;
          timeLeft = pomoWorkDuration;
          mapService.resetCheckpoints(); 
          pomoIndicator.innerText = `[[ STINT ${currentPomoCycle}: STIMULUS_RUN ]]`;
          pomoIndicator.style.color = "var(--accent-neon-pink)";
          pushLog(`>>> GREEN LIGHT (STINT ${currentPomoCycle}): BOX-OUT! ATTACK THE TRACK! <<<`, "success");
        }
        updateDisplay(timeLeft);
      }
    }

    updateLiveTelemetry();
  }
};

// 🏁 【全面換装】チームラジオ風テレメトリー無線ログ＆高速自動スタンバイシステム
async function finishSession(logMsg, earnedXP = 40, raceStatus = "FINISHED") {
  timerWorker.postMessage('STOP');
  isRunning = false;
  
  addXP(earnedXP);
  statusSub.innerText = raceStatus === "FINISHED" ? "[ RACE_COMPLETE ]" : "[ DNF_RETIRED ]";
  startBtn.innerText = "ENGAGE";

  const total = totalWorkTime + totalRestTime;
  const ratio = total === 0 ? 100 : Math.floor((totalWorkTime / total) * 100);
  const trackName = document.getElementById('current-track-name').innerText.replace("ROUTE: ", "");
  const engineMap = `${document.getElementById('hud-diff').innerText} (${raceStatus})`;

  // 右側ログストリームへチームラジオを高速連射
  pushLog(`========================================`, "system");
  if (raceStatus === "FINISHED") {
    pushLog(`[TEAM RADIO] GP: "Haha, yes Hiro! Absolutely clinical stint. Beautiful job, that's P1!"`, "radio-gp");
  } else {
    pushLog(`[TEAM RADIO] GP: "Copy that, Hiro. DNF confirmed. Bring the car back straight to the box."`, "radio-gp");
  }
  pushLog(`[TEAM RADIO] --- TELEMETRY RECAP ---`, "radio-telemetry");
  pushLog(`[TEAM RADIO] CIRCUIT : ${trackName}`, "radio-telemetry");
  pushLog(`[TEAM RADIO] STRATEGY: ${engineMap}`, "radio-telemetry");
  pushLog(`[TEAM RADIO] WORK    : ${formatMsToTimeStr(totalWorkTime)}`, "radio-telemetry");
  pushLog(`[TEAM RADIO] PIT STOP: ${formatMsToTimeStr(totalRestTime)}`, "radio-telemetry");
  pushLog(`[TEAM RADIO] RATIO   : ${ratio}% EFFICIENCY`, "radio-telemetry");
  pushLog(`[TEAM RADIO] CREDITS : +${earnedXP} XP EARNED`, "radio-telemetry");
  pushLog(`[TEAM RADIO] GP: "Data stream locked. Resetting systems for the next stint. Head down."`, "radio-gp");
  pushLog(`========================================`, "system");

  if (db) {
    try {
      await db.collection("race_results").add({
        trackName: trackName,
        engineMap: document.getElementById('hud-diff').innerText,
        raceStatus: raceStatus,
        workTimeMs: totalWorkTime,
        restTimeMs: totalRestTime,
        workRatio: ratio,
        earnedXp: earnedXP,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      pushLog("> TELEMETRY_SERVER: DATABASE RECORD ARCHIVED SECURELY.", "success");
    } catch (error) {
      pushLog("> TELEMETRY_SERVER: NETWORK TRANSMISSION ERROR.", "radio-gp");
      console.error(error);
    }
  } else {
    pushLog("> TELEMETRY_SERVER: LOCAL DRIVING MODE (NO CLOUD BACKUP).", "system");
  }

  // 🟢 モーダルを介さず、1秒後に自動でコックピットをクリーンリセットして次戦へ完全準備
  setTimeout(() => {
    totalWorkTime = 0;
    totalRestTime = 0;
    ersPercent = 100;
    tyreTemp = 60.0;
    resetTimeState();
    mapService.reset();
    startBtn.innerText = "ENGAGE";
    statusSub.innerText = "[ SYSTEM: STANDBY ]";
    pushLog(">> COCKPIT_SYSTEM: HARDWARE RE-CONFIGURED AND READY FOR NEXT SECTOR.", "success");
  }, 1000);
}

function formatMsToTimeStr(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}m ${s}s`;
}

function updateTotalRemainDisplay(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  totalRemainDisplay.innerText = `TOTAL REMAIN: ${h}:${m}:${s}`;
}

function updateLiveTelemetry() {
  const statusEl = document.getElementById('hud-status');
  
  if (isRunning) {
    if (currentMode === "POMODORO") {
      statusEl.innerText = pomoState === "WORK" ? "STINT_RUN" : "PIT_STOP";
      statusEl.style.color = pomoState === "WORK" ? "var(--accent-neon-cyan)" : "var(--success-green)";
    } else {
      statusEl.innerText = "PUSHING";
      statusEl.style.color = "var(--success-green)";
    }
  } else if (totalWorkTime > 0 || totalRestTime > 0) {
    statusEl.innerText = "HALT_BOX";
    statusEl.style.color = "var(--text-white)";
  } else {
    statusEl.innerText = "STANDBY";
    statusEl.style.color = "var(--highlight-yellow)";
  }

  const total = totalWorkTime + totalRestTime;
  const ratio = total === 0 ? 100 : Math.floor((totalWorkTime / total) * 100);
  document.getElementById('hud-bias').innerText = `${ratio}%`;

  const diffEl = document.getElementById('hud-diff');
  if (currentMode === "SPRINT") diffEl.innerText = "QUALIFY";
  else if (currentMode === "ENDURANCE") diffEl.innerText = "RACE_TRIM";
  else diffEl.innerText = "GRAND_PRIX"; 

  document.getElementById('ers-val').innerText = `${Math.floor(ersPercent)}%`;
  document.getElementById('ers-bar').style.width = `${ersPercent}%`;
  document.getElementById('ers-bar').style.background = ersPercent < 20 ? "var(--accent-neon-pink)" : "var(--accent-neon-cyan)";

  document.getElementById('tyre-val').innerText = `${tyreTemp.toFixed(1)}°C`;
  const tyreWidth = ((tyreTemp - 60) / 40) * 100;
  document.getElementById('tyre-bar').style.width = `${tyreWidth}%`;
  document.getElementById('tyre-bar').style.background = tyreTemp >= 90.0 ? "var(--accent-neon-pink)" : "var(--success-green)";
}

function updateDisplay(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
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
  document.getElementById('xp-text').innerText = `${String(userState.xp).padStart(String(nextLevelXP).length, ' ')} / ${nextLevelXP} XP`;
  document.getElementById('xp-fill').style.width = `${(userState.xp / nextLevelXP) * 100}%`;
}

startBtn.addEventListener('click', async () => {
  if (!isRunning) {
    if (totalWorkTime === 0 && totalRestTime === 0) {
      startBtn.disabled = true;
      await loadSelectedRoute();
      mapService.reset();
      resetTimeState();
      startBtn.disabled = false;
    }

    isRunning = true;
    startTime = Date.now(); 
    timerWorker.postMessage('START');
    startBtn.innerText = "HALT";
    statusSub.innerText = "[ GRAND_PRIX_RUNNING ]";
    pushLog(">> SYSTEM: GRAND PRIX START. TELEMETRY LIVE.", "system");
  } else {
    isRunning = false;
    timerWorker.postMessage('STOP');
    startBtn.innerText = "RESUME";
    statusSub.innerText = "[ TRANSIT_PAUSED ]";
    pushLog(">> SYSTEM: LINK SUSPENDED. RED FLAG STATUS.", "system");
  }
  updateLiveTelemetry();
});

resetBtn.addEventListener('click', () => {
  if (totalWorkTime > 0) {
    finishSession("RACE ABORTED (DNF): SAVING TELEMETRY DATA.", 5, "DNF_RETIRED");
  } else {
    completelyResetMachine();
  }
});

function completelyResetMachine() {
  isRunning = false;
  timerWorker.postMessage('STOP');
  totalWorkTime = 0;
  totalRestTime = 0;
  ersPercent = 100;
  tyreTemp = 60.0;
  resetTimeState();
  mapService.reset();
  startBtn.innerText = "ENGAGE";
  statusSub.innerText = "[ SYSTEM: STANDBY ]";
  pushLog(">> ALERT: RACING LINE RESET TO ORIGINAL GRID.", "change");
}

// 🟢 【MAP CLICK】地図を2回クリックしてルートを強制生成するロジック
// mapService内に保持されているLeafletのmapオブジェクトへ直接リンクする
setTimeout(() => {
  if (!mapService || !mapService.map) return;
  
  mapService.map.on('click', async function(e) {
    // TRACKが"custom"の時だけクリックを受け付ける
    if (document.getElementById('route-preset').value !== 'custom') return;
    
    const latlng = e.latlng;
    if (mapClickCount === 0) {
      customStartCoords = [latlng.lat, latlng.lng];
      document.getElementById('start-name-input').value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
      document.getElementById('end-name-input').value = ""; // ゴールをクリア
      pushLog(`> GPS_CALIBRATION: START POINT PINNED [${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}]`, "system");
      mapClickCount = 1;
    } else {
      customEndCoords = [latlng.lat, latlng.lng];
      document.getElementById('end-name-input').value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
      pushLog(`> GPS_CALIBRATION: END POINT PINNED [${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}]`, "system");
      mapClickCount = 0;
      
      // 2点揃ったので即座にOSRMルートを生成
      document.getElementById('current-track-name').innerText = "ROUTE: MAP PINPOINT SECTOR";
      const result = await mapService.fetchOSRMRoute(customStartCoords, customEndCoords);
      if (result.success) {
        pushLog(`> ROUTE_DATA: NEW RACING LINE GENERATED via MAP CLICK! (${result.distance.toFixed(2)} km)`, "success");
      }
    }
  });
}, 1000);

// 🟢 【TEXT SEARCH】地名から座標を自動計算する Nominatim エンジン
document.getElementById('search-route-btn').addEventListener('click', async () => {
  const startName = document.getElementById('start-name-input').value.trim();
  const endName = document.getElementById('end-name-input').value.trim();
  
  if (!startName || !endName) {
    pushLog("> ERROR: BOTH START AND END PLACES ARE REQUIRED FOR LOCK-ON.", "radio-gp");
    return;
  }
  
  pushLog("> TELEMETRY: RESOLVING GRID COORDINATES FROM WORLD DATABASE...");
  
  // 地名から座標を引く超軽量インライン関数
  const fetchCoords = async (query) => {
    try {
      // 緯度経度が直接入っている（マップクリック等）場合はそのまま返す
      if (query.includes(',')) {
        return query.split(',').map(v => parseFloat(v.trim()));
      }
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  customStartCoords = await fetchCoords(startName);
  if (!customStartCoords) {
    pushLog(`> ERROR: COULD NOT RESOLVE STARTING GRID [${startName}]`, "radio-gp");
    return;
  }
  
  customEndCoords = await fetchCoords(endName);
  if (!customEndCoords) {
    pushLog(`> ERROR: COULD NOT RESOLVE DESTINATION GRID [${endName}]`, "radio-gp");
    return;
  }

  // 座標が確定したのでメインのルートローダーを実行
  document.getElementById('current-track-name').innerText = `ROUTE: ${startName.toUpperCase()} ➔ ${endName.toUpperCase()}`;
  const result = await mapService.fetchOSRMRoute(customStartCoords, customEndCoords);
  if (result.success) {
    pushLog(`> ROUTE_DATA: SEARCH GRIDS LOCKED. DISTANCE: ${result.distance.toFixed(2)} km`, "success");
  }
});

initApp();