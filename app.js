const mapService = new MapService();
const timerWorker = new Worker('timerWorker.js');

// =======================================================
// 📡 FIREBASE TELEMETRY NETWORK CONFIGURATION (⚡同期・引継ぎ強化版)
// =======================================================
const firebaseConfig = {
  apiKey: "AIzaSyAIPTf5hDce2On4yTnyz4k_NU_Y9zf8Rgc",
  authDomain: "tokei-f0b9d.firebaseapp.com",
  databaseURL: "https://tokei-f0b9d-default-rtdb.firebaseio.com",
  projectId: "tokei-f0b9d",
  storageBucket: "tokei-f0b9d.firebasestorage.app",
  messagingSenderId: "504276428450",
  appId: "1:504276428450:web:c0134e3345762fdb6d99fb",
  measurementId: "G-T250Y2PDTB"
};

let db = null;
const USER_ID = "operator_hiro"; // 🏁 お前のオペレーターIDをここに完全ロック！

try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    pushLog("> TELEMETRY_SERVER: CLOUD FACTORY LINK ESTABLISHED.", "success");
    
    // 🟢 アプリ起動時にクラウドから過去の戦績・レベル・累計データを自動引き継ぎ！
    loadUserDataFromCloud();
  } else {
    pushLog("> TELEMETRY_SERVER: LOCAL MODE (FIREBASE KEY NOT SET).", "system");
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

// 🟢 クラウドからお前の全ステータス（レベル、XP、通算時間）をロードして復元する回路
async function loadUserDataFromCloud() {
  if (!db) return;
  try {
    pushLog("> TELEMETRY_SERVER: FETCHING DRIVER PROFILE...");
    const doc = await db.collection("user_profile").doc(USER_ID).get();
    
    if (doc.exists) {
      const cloudData = doc.data();
      userState.level = cloudData.level || 1;
      userState.xp = cloudData.xp || 0;
      
      // 過去の通算走行リザルトも引き継いで同期
      totalWorkTime = cloudData.totalWorkTime || 0;
      totalRestTime = cloudData.totalRestTime || 0;
      
      pushLog(`>>> [DATA_SYNC]: PROFILE RESTORED. RANK: OPERATOR [LV.${userState.level}] <<<`, "success");
    } else {
      pushLog("> TELEMETRY_SERVER: NO PREVIOUS PROFILE DETECTED. INITIALIZING NEW GRID.", "system");
      await saveUserDataToCloud(); // 初回プロフィール作成
    }
    updateStatusUI();
    resetTimeState();
  } catch (error) {
    console.error("Cloud Load Error:", error);
    pushLog("> TELEMETRY_SERVER: PROFILE SYNC REJECTED. RUNNING IN LOCAL MEMORY.", "radio-gp");
  }
}

// 🟢 現在のステータス（レベル、XP、通算時間）をクラウドへ保存する回路
async function saveUserDataToCloud() {
  if (!db) return;
  try {
    await db.collection("user_profile").doc(USER_ID).set({
      level: userState.level,
      xp: userState.xp,
      totalWorkTime: totalWorkTime,
      totalRestTime: totalRestTime,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    pushLog("> TELEMETRY_SERVER: CLOUD BACKUP SEQUENCE COMPLETED.", "success");
  } catch (error) {
    console.error("Cloud Save Error:", error);
    pushLog("> TELEMETRY_SERVER: BACKUP CRITICAL FAILURE.", "radio-gp");
  }
}

// =======================================================
// 🎸 LOCAL AUDIO & MULTI-VIDEO ENGINE CIRCUIT
// =======================================================
const workAudio = document.getElementById('local-work-audio');
const restAudio = document.getElementById('local-rest-audio');
const cockpitVideo = document.getElementById('cockpit-main-video'); 

const VIDEO_PLAYLIST = [
  "video/focus1.mp4",
  "video/focus2.mp4",
  "video/focus3.mp4"
];
let currentVideoIdx = 0;

if (workAudio && restAudio) {
  workAudio.addEventListener('error', () => console.warn(">> BGM_SYSTEM: music/work.m4a not detected."));
  restAudio.addEventListener('error', () => console.warn(">> BGM_SYSTEM: music/rest.m4a not detected."));
}

if (cockpitVideo) {
  cockpitVideo.addEventListener('ended', () => {
    currentVideoIdx = (currentVideoIdx + 1) % VIDEO_PLAYLIST.length;
    cockpitVideo.src = VIDEO_PLAYLIST[currentVideoIdx];
    pushLog(`> VIDEO_SYSTEM: TRACK ENDED. ROTATING TO NEXT COMPONENT [${currentVideoIdx + 1}/${VIDEO_PLAYLIST.length}]`, "system");
    
    if (isRunning) {
      const audioRouteEl = document.getElementById('audio-route-select');
      const audioRoute = audioRouteEl ? audioRouteEl.value : 'bgm';
      cockpitVideo.muted = (audioRoute !== 'video');
      cockpitVideo.volume = 0.45;
      cockpitVideo.play().catch(err => console.warn("Playlist Continuous Play Blocked:", err));
    }
  });
}

function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function safeSetStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}

function manageBgmPlayback() {
  const audioRouteEl = document.getElementById('audio-route-select');
  const audioRoute = audioRouteEl ? audioRouteEl.value : 'bgm';

  if (!isRunning) {
    if (cockpitVideo) cockpitVideo.pause();
    if (workAudio) workAudio.pause();
    if (restAudio) restAudio.pause();
    return;
  }

  if (audioRoute === 'video') {
    if (workAudio) workAudio.pause();
    if (restAudio) restAudio.pause();
    
    if (cockpitVideo) {
      cockpitVideo.muted = false;
      cockpitVideo.volume = 0.45; 
      cockpitVideo.play().catch(err => console.warn("Video Play Blocked:", err));
    }
  } else {
    if (cockpitVideo) {
      cockpitVideo.muted = true;
      cockpitVideo.play().catch(err => console.warn("Video Play Blocked:", err));
    }

    if (!workAudio || !restAudio) return;

    if (currentMode === "POMODORO" && pomoState === "REST") {
      workAudio.pause();
      if (restAudio.paused) {
        restAudio.volume = 0.25;
        restAudio.play().catch(err => console.warn("Audio Play Blocked:", err));
      }
    } else {
      restAudio.pause();
      if (workAudio.paused) {
        workAudio.volume = 0.25;
        workAudio.play().catch(err => console.warn("Audio Play Blocked:", err));
      }
    }
  }
}

// =======================================================
// 🔊 AUDIO SYSTEM & RETROWAVE FAILSAFE CIRCUIT
// =======================================================
let audioCtx = null;

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playRadioChirpFailsafe() {
  try {
    initAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (err) {
    console.error("Failsafe Chirp Error:", err);
  }
}

function playAlarmFailsafe() {
  try {
    initAudioContext();
    const now = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const timeOffset = i * 0.25;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square'; 
      osc.frequency.setValueAtTime(987.77, now + timeOffset); 
      gain.gain.setValueAtTime(0.1, now + timeOffset);
      gain.gain.linearRampToValueAtTime(0.01, now + timeOffset + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.15);
    }
  } catch (err) {
    console.error("Failsafe Alarm Error:", err);
  }
}

const radioAudio = new Audio('music/F1.m4a');
radioAudio.addEventListener('error', () => {
  console.warn(">> AUDIO_SYSTEM: music/F1.m4a not found. Failsafe activated.");
});

function triggerRadioSound() {
  playRadioChirpFailsafe();
  radioAudio.play().then(() => {
    pushLog("> AUDIO_SYSTEM: TELEMETRY M4A AUDIO TRANSMITTING...", "success");
  }).catch((err) => {
    console.warn("[Audio Play Blocked] Falling back to synthesis.", err);
    setTimeout(() => { playAlarmFailsafe(); }, 100);
  });
}

// =======================================================
// 🗺️ ROUTE PRESETS & DATA AREA
// =======================================================
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

let customStartCoords = null;
let customEndCoords = null;
let mapClickCount = 0;

const displayElement = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const modeSelect = document.getElementById('race-mode');
const bgSelector = document.getElementById('bg-selector'); 

const totalSettingRow = document.getElementById('total-setting-row');
const workSettingRow = document.getElementById('work-setting-row');
const restSettingRow = document.getElementById('rest-setting-row');

const routePreset = document.getElementById('route-preset');
const customCoordsDiv = document.getElementById('custom-coords');
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
    if(totalSettingRow) totalSettingRow.style.display = "flex";
    if(workSettingRow) workSettingRow.style.display = "flex";
    if(restSettingRow) restSettingRow.style.display = "flex";
    safeSetStyle('lap-counter', 'display', 'none');
    safeSetStyle('map-rem-label', 'visibility', 'visible');
    if(pomoIndicator) pomoIndicator.style.display = "block";
    if(totalRemainDisplay) totalRemainDisplay.style.display = "block";
  } else if (currentMode === "SPRINT") {
    if(totalSettingRow) totalSettingRow.style.display = "none";
    if(workSettingRow) workSettingRow.style.display = "flex";
    if(restSettingRow) restSettingRow.style.display = "none";
    safeSetStyle('lap-counter', 'display', 'none');
    safeSetStyle('map-rem-label', 'visibility', 'visible');
    if(pomoIndicator) pomoIndicator.style.display = "none";
    if(totalRemainDisplay) totalRemainDisplay.style.display = "none";
  } else { 
    if(totalSettingRow) totalSettingRow.style.display = "none";
    if(workSettingRow) workSettingRow.style.display = "none";
    if(restSettingRow) restSettingRow.style.display = "none";
    safeSetStyle('lap-counter', 'display', 'inline');
    safeSetStyle('map-rem-label', 'visibility', 'hidden');
    if(pomoIndicator) pomoIndicator.style.display = "none";
    if(totalRemainDisplay) totalRemainDisplay.style.display = "none";
  }
  resetTimeState();
});

routePreset.addEventListener('change', (e) => {
  if (customCoordsDiv) {
    if (e.target.value === "custom") {
      customCoordsDiv.style.display = "flex";
    } else {
      customCoordsDiv.style.display = "none";
    }
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
  const inputTotal = document.getElementById('input-total-minutes');
  const inputWork = document.getElementById('input-minutes');
  const inputRest = document.getElementById('input-rest-minutes');

  const totalMins = inputTotal ? (parseInt(inputTotal.value) || 180) : 180;
  const workMins = inputWork ? (parseInt(inputWork.value) || 30) : 30;
  const restMins = inputRest ? (parseInt(inputRest.value) || 5) : 5;
  
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
    
    if(pomoIndicator) {
      pomoIndicator.innerText = `[[ STINT ${currentPomoCycle}: STIMULUS_RUN ]]`;
      pomoIndicator.style.color = "var(--accent-neon-pink)";
    }
    updateDisplay(timeLeft);
    updateTotalRemainDisplay(pomoTotalTimeLeft);
  } else { 
    timeLeft = 0; 
    enduranceLap = 1;
    safeSetText('lap-counter', `[LAP ${enduranceLap}]`);
    updateDisplay(0);
  }
  updateProgressMeter(0);
  updateLiveTelemetry();
  manageBgmPlayback();
}

async function initApp() {
  pushLog("> TRACK_SYSTEM: CONNECTING TO TELEMETRY NETWORK...");
  await loadSelectedRoute();
  // 注意：起動時にFirebase読込が完了した後に初期化が走るよう、loadUserDataFromCloud内でも呼んでいます
  resetTimeState();
  updateStatusUI();
  
  setInterval(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    
    if(realClockDisplay) realClockDisplay.innerText = `${h}:${m}:${s}`;
    const hudClock = document.getElementById('hud-clock');
    if(hudClock) hudClock.innerText = `SYS_TIME: ${h}:${m}:${s}`;
    
    if (!isRunning) {
      totalRestTime += 1000;
      tyreTemp = Math.max(60.0, tyreTemp - 0.3); 
      ersPercent = Math.min(100, ersPercent + 0.3); 
      updateLiveTelemetry();
    }
  }, 1000);
}

async function loadSelectedRoute() {
  const presetKey = routePreset ? routePreset.value : 'shibuya_shinjuku';
  let start, end, trackName;

  if (presetKey === "custom") {
    if (!customStartCoords || !customEndCoords) {
      safeSetText('current-track-name', "ROUTE: AWAITING CUSTOM MAP INPUT...");
      return;
    }
    start = customStartCoords;
    end = customEndCoords;
    trackName = document.getElementById('current-track-name').innerText.replace("ROUTE: ", "");
  } else {
    const preset = ROUTE_PRESETS[presetKey] || ROUTE_PRESETS['shibuya_shinjuku'];
    start = preset.start;
    end = preset.end;
    trackName = preset.name;
    mapClickCount = 0;
  }

  safeSetText('current-track-name', `ROUTE: ${trackName}`);
  const result = await mapService.fetchOSRMRoute(start, end);
  if (result.success) {
    pushLog(`> ROUTE_DATA: GRID CALIBRATED. DISTANCE: ${result.distance.toFixed(2)} km`, "success");
  }
}

function updateProgressMeter(progress) {
  if(!rpmIndicator) return;
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
        safeSetText('lap-counter', `[LAP ${enduranceLap}]`);
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
          if(pomoIndicator) {
            pomoIndicator.innerText = `[[ PIT_STOP ${currentPomoCycle}: RECHARGING ]]`;
            pomoIndicator.style.color = "var(--success-green)";
          }
          pushLog(`>>> PIT-STOP TRIGGERED (STINT ${currentPomoCycle} END): ENTERING BOX. <<<`, "system");
          
          triggerRadioSound(); 
          manageBgmPlayback(); 
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
          if(pomoIndicator) {
            pomoIndicator.innerText = `[[ STINT ${currentPomoCycle}: STIMULUS_RUN ]]`;
            pomoIndicator.style.color = "var(--accent-magenta)";
          }
          pushLog(`>>> GREEN LIGHT (STINT ${currentPomoCycle}): BOX-OUT! ATTACK THE TRACK! <<<`, "success");
          
          triggerRadioSound(); 
          manageBgmPlayback(); 
        }
        updateDisplay(timeLeft);
      }
    }

    updateLiveTelemetry();
  }
};

async function finishSession(logMsg, earnedXP = 40, raceStatus = "FINISHED") {
  timerWorker.postMessage('STOP');
  isRunning = false;
  
  if (raceStatus === "FINISHED") {
    triggerRadioSound(); 
  } else {
    console.log(">> AUDIO_SYSTEM: RACE ABORTED. SOUND SUPPRESSED.");
  }

  manageBgmPlayback(); 
  addXP(earnedXP); // ⚠️ 注意: ここでレベルアップ処理とsaveUserDataToCloud()が自動連動するぞ！
  
  const statusSubEl = document.getElementById('status-sub');
  if(statusSubEl) statusSubEl.innerText = raceStatus === "FINISHED" ? "[ RACE_COMPLETE ]" : "[ DNF_RETIRED ]";
  if(startBtn) startBtn.innerText = "ENGAGE";

  const total = totalWorkTime + totalRestTime;
  const ratio = total === 0 ? 100 : Math.floor((totalWorkTime / total) * 100);
  const currentTrackEl = document.getElementById('current-track-name');
  const trackName = currentTrackEl ? currentTrackEl.innerText.replace("ROUTE: ", "") : "UNKNOWN CIRCUIT";
  
  const hudDiffEl = document.getElementById('hud-diff');
  const strategyName = hudDiffEl ? hudDiffEl.innerText : "GRAND_PRIX";
  const engineMap = `${strategyName} (${raceStatus})`;

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

  // 🟢 走行ごとのセッション単体記録をクラウドへ完全保存！
  if (db) {
    try {
      await db.collection("race_results").add({
        operatorId: USER_ID,
        trackName: trackName,
        engineMap: strategyName,
        raceStatus: raceStatus,
        workTimeMs: totalWorkTime,
        restTimeMs: totalRestTime,
        workRatio: ratio,
        earnedXp: earnedXP,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      pushLog("> TELEMETRY_SERVER: DATABASE RECORD ARCHIVED SECURELY.", "success");
      
      // レベル・XP・通算時間を全体プロファイルへ最新アップデート
      await saveUserDataToCloud();
    } catch (error) {
      pushLog("> TELEMETRY_SERVER: NETWORK TRANSMISSION ERROR.", "radio-gp");
      console.error(error);
    }
  }

  setTimeout(() => {
    // セッションクリア（累計保存後に実行されるので安全）
    totalWorkTime = 0;
    totalRestTime = 0;
    ersPercent = 100;
    tyreTemp = 60.0;
    resetTimeState();
    mapService.reset();
    if(startBtn) startBtn.innerText = "ENGAGE";
    safeSetText('status-sub', "[ SYSTEM: STANDBY ]");
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
  if(totalRemainDisplay) totalRemainDisplay.innerText = `TOTAL REMAIN: ${h}:${m}:${s}`;
}

function updateLiveTelemetry() {
  const statusEl = document.getElementById('hud-status');
  
  if (isRunning) {
    if (currentMode === "POMODORO") {
      if(statusEl) {
        statusEl.innerText = pomoState === "WORK" ? "STINT_RUN" : "PIT_STOP";
        statusEl.style.color = pomoState === "WORK" ? "var(--accent-neon-cyan)" : "var(--success-green)";
      }
    } else {
      if(statusEl) {
        statusEl.innerText = "PUSHING";
        statusEl.style.color = "var(--success-green)";
      }
    }
  } else if (totalWorkTime > 0 || totalRestTime > 0) {
    if(statusEl) {
      statusEl.innerText = "HALT_BOX";
      statusEl.style.color = "var(--text-white)";
    }
  } else {
    if(statusEl) {
      statusEl.innerText = "STANDBY";
      statusEl.style.color = "var(--highlight-yellow)";
    }
  }

  const total = totalWorkTime + totalRestTime;
  const ratio = total === 0 ? 100 : Math.floor((totalWorkTime / total) * 100);
  safeSetText('hud-bias', `${ratio}%`);

  const diffEl = document.getElementById('hud-diff');
  if(diffEl) {
    if (currentMode === "SPRINT") diffEl.innerText = "QUALIFY";
    else if (currentMode === "ENDURANCE") diffEl.innerText = "RACE_TRIM";
    else diffEl.innerText = "GRAND_PRIX"; 
  }

  safeSetText('ers-val', `${Math.floor(ersPercent)}%`);
  const ersBar = document.getElementById('ers-bar');
  if(ersBar) {
    ersBar.style.width = `${ersPercent}%`;
    ersBar.style.background = ersPercent < 20 ? "var(--accent-neon-pink)" : "var(--accent-neon-cyan)";
  }

  safeSetText('tyre-val', `${tyreTemp.toFixed(1)}°C`);
  const tyreBar = document.getElementById('tyre-bar');
  if(tyreBar) {
    const tyreWidth = Math.min(100, Math.max(0, ((tyreTemp - 60) / 40) * 100));
    tyreBar.style.width = `${tyreWidth}%`;
    tyreBar.style.background = tyreTemp >= 90.0 ? "var(--accent-neon-pink)" : "var(--success-green)";
  }
}

function updateDisplay(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  if(displayElement) {
    displayElement.innerText = `${m}:${s}`;
    displayElement.setAttribute('data-text', `${m}:${s}`);
  }
}

function pushLog(text, type = "") {
  const logStream = document.getElementById('log-stream');
  if(!logStream) return;
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
  
  // 🟢 XP増減が走ったら、即座にクラウドのバックアップデータを更新
  saveUserDataToCloud();
}

function updateStatusUI() {
  safeSetText('user-level', `RANK: OPERATOR [LV.${userState.level}]`);
  let nextLevelXP = userState.level * 100;
  safeSetText('xp-text', `${String(userState.xp).padStart(String(nextLevelXP).length, ' ')} / ${nextLevelXP} XP`);
  const xpFill = document.getElementById('xp-fill');
  if(xpFill) xpFill.style.width = `${(userState.xp / nextLevelXP) * 100}%`;
}

if(startBtn) {
  startBtn.addEventListener('click', async () => {
    initAudioContext();
    playRadioChirpFailsafe(); 

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
      safeSetText('status-sub', "[ GRAND_PRIX_RUNNING ]");
      pushLog(">> SYSTEM: GRAND PRIX START. TELEMETRY LIVE.", "system");
    } else {
      isRunning = false;
      timerWorker.postMessage('STOP');
      startBtn.innerText = "RESUME";
      safeSetText('status-sub', "[ TRANSIT_PAUSED ]");
      pushLog(">> SYSTEM: LINK SUSPENDED. RED FLAG STATUS.", "system");
      
      // 🟢 HALT（一時停止）時にも念のため進捗データをクラウドへオートセーブ
      saveUserDataToCloud();
    }
    updateLiveTelemetry();
    manageBgmPlayback(); 
  });
}

if(resetBtn) {
  resetBtn.addEventListener('click', () => {
    initAudioContext();
    if (totalWorkTime > 0) {
      finishSession("RACE ABORTED (DNF): SAVING TELEMETRY DATA.", 5, "DNF_RETIRED");
    } else {
      completelyResetMachine();
    }
  });
}

function completelyResetMachine() {
  isRunning = false;
  timerWorker.postMessage('STOP');
  totalWorkTime = 0;
  totalRestTime = 0;
  ersPercent = 100;
  tyreTemp = 60.0;
  resetTimeState();
  mapService.reset();
  if(startBtn) startBtn.innerText = "ENGAGE";
  safeSetText('status-sub', "[ SYSTEM: STANDBY ]");
  pushLog(">> ALERT: RACING LINE RESET TO ORIGINAL GRID.", "change");
  manageBgmPlayback(); 
  
  // 完全リセット時にもクラウドと状態を同期
  saveUserDataToCloud();
}

setTimeout(() => {
  if (!mapService || !mapService.map) return;
  
  mapService.map.on('click', async function(e) {
    if (isRunning) {
      pushLog("> TRACK_SYSTEM: TACTICAL MAP CLICK DENIED. SECTOR NAVIGATION LOCKED DURING RACE.", "radio-gp");
      return; 
    }

    const routePresetEl = document.getElementById('route-preset');
    if (!routePresetEl || routePresetEl.value !== 'custom') return;
    
    const latlng = e.latlng;
    if (mapClickCount === 0) {
      customStartCoords = [latlng.lat, latlng.lng];
      const startInput = document.getElementById('start-name-input');
      if(startInput) startInput.value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
      const endInput = document.getElementById('end-name-input');
      if(endInput) endInput.value = ""; 
      pushLog(`> GPS_CALIBRATION: START POINT PINNED [${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}]`, "system");
      mapClickCount = 1;
    } else {
      customEndCoords = [latlng.lat, latlng.lng];
      const endInput = document.getElementById('end-name-input');
      if(endInput) endInput.value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
      pushLog(`> GPS_CALIBRATION: END POINT PINNED [${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}]`, "system");
      mapClickCount = 0;
      
      safeSetText('current-track-name', "ROUTE: MAP PINPOINT SECTOR");
      const result = await mapService.fetchOSRMRoute(customStartCoords, customEndCoords);
      if (result.success) {
        pushLog(`> ROUTE_DATA: NEW RACING LINE GENERATED via MAP CLICK! (${result.distance.toFixed(2)} km)`, "success");
      }
    }
  });
}, 1000);

const searchRouteBtn = document.getElementById('search-route-btn');
if(searchRouteBtn) {
  searchRouteBtn.addEventListener('click', async () => {
    if (isRunning) {
      pushLog("> ERROR: RACING LINE NAVIGATION CHANGING BLOCKED DURING ACTIVE STINT.", "radio-gp");
      return;
    }

    const startInput = document.getElementById('start-name-input');
    const endInput = document.getElementById('end-name-input');
    const startName = startInput ? startInput.value.trim() : "";
    const endName = endInput ? endInput.value.trim() : "";
    
    if (!startName || !endName) {
      pushLog("> ERROR: BOTH START AND END PLACES ARE REQUIRED FOR LOCK-ON.", "radio-gp");
      return;
    }
    
    pushLog("> TELEMETRY: RESOLVING GRID COORDINATES FROM WORLD DATABASE...");
    
    const fetchCoords = async (query) => {
      try {
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

    safeSetText('current-track-name', `ROUTE: ${startName.toUpperCase()} ➔ ${endName.toUpperCase()}`);
    const result = await mapService.fetchOSRMRoute(customStartCoords, customEndCoords);
    if (result.success) {
      pushLog(`> ROUTE_DATA: SEARCH GRIDS LOCKED. DISTANCE: ${result.distance.toFixed(2)} km`, "success");
    }
  });
}

const audioRouteSelect = document.getElementById('audio-route-select');
if (audioRouteSelect) {
  audioRouteSelect.addEventListener('change', () => {
    initAudioContext();
    playRadioChirpFailsafe(); 
    manageBgmPlayback();      
    pushLog(`> AUDIO_SYSTEM: INTERCOM CHANNEL SWITCHED TO [${audioRouteSelect.value.toUpperCase()}].`, "system");
  });
}

initApp();