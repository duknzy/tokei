const mapService = new MapService();
const timerWorker = new Worker('timerWorker.js');

// =======================================================
// 📡 FIREBASE TELEMETRY NETWORK CONFIGURATION
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
const USER_ID = "operator_hiro"; 

try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    pushLog("> TELEMETRY_SERVER: CLOUD FACTORY LINK ESTABLISHED.", "success");
    loadUserDataFromCloud();
  } else {
    pushLog("> TELEMETRY_SERVER: LOCAL MODE (FIREBASE KEY NOT SET).", "system");
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

// =======================================================
// 🎸 LOCAL AUDIO & MULTI-VIDEO ENGINE CIRCUIT
// =======================================================
const workAudio = document.getElementById('local-work-audio');
const restAudio = document.getElementById('local-rest-audio');
const cockpitVideo = document.getElementById('cockpit-main-video'); 

let pipWindow = null; 
let lastRegisteredVirtualLap = 1; 

// 🏎️ 【VIDEO PLAYLIST】動画の種類をここで無限に増やせるぞ！
const VIDEO_PLAYLIST = [
  "video/focus1.mp4",
  "video/focus2.mp4",
  "video/focus3.mp4",
  "video/focus4.mp4", 
  "video/focus5.mp4",
  "video/focus6.mp4"
];
let currentVideoIdx = 0;  

// 🏎️ 【BGM PLAYLIST】作業用BGMのマルチローテーション配列だ！
const WORK_AUDIO_PLAYLIST = [
  "music/work1.m4a",
  "music/work2.m4a",
  "music/work3.m4a",
  "music/work4.m4a",
  "music/work5.m4a",
  "music/work6.m4a",
  "music/work7.m4a",
  "music/work8.m4a",
  "music/work9.m4a"
];
let currentWorkAudioIdx = 0;

if (workAudio && restAudio) {
  workAudio.addEventListener('error', () => console.warn(">> BGM_SYSTEM: music/work.m4a not detected."));
  restAudio.addEventListener('error', () => console.warn(">> BGM_SYSTEM: music/rest.m4a not detected."));
}

// 🟢 動画終了時に確実に次の動画へロード＆「強制プレイアタック」を叩き込む回路
if (cockpitVideo) {
  cockpitVideo.addEventListener('ended', () => {
    currentVideoIdx = (currentVideoIdx + 1) % VIDEO_PLAYLIST.length;
    
    cockpitVideo.src = VIDEO_PLAYLIST[currentVideoIdx];
    cockpitVideo.load(); 
    
    pushLog(`> VIDEO_SYSTEM: TRACK ENDED. SHIFT UP NEXT COMPONENT [${currentVideoIdx + 1}/${VIDEO_PLAYLIST.length}]`, "system");
    
    if (isRunning) {
      const audioRouteEl = document.getElementById('audio-route-select');
      const audioRoute = audioRouteEl ? audioRouteEl.value : 'bgm';
      cockpitVideo.muted = (audioRoute !== 'video');
      cockpitVideo.volume = 0.45;
      
      // 🔥 ブラウザブロック対策の強制プレイアタック（ダメなら即ミュートでブン回す）
      const playPromise = cockpitVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("Auto Play Stream Blocked. Retrying with mute encryption.", err);
          cockpitVideo.muted = true;
          cockpitVideo.play().catch(e => console.error("Final Cockpit Video Crash:", e));
        });
      }
    }
  });
}

// 🟢 作業用BGM終了時に自動で次のトラックへシフトアップする回路
if (workAudio) {
  workAudio.addEventListener('ended', () => {
    if (currentMode === "POMODORO" && pomoState === "WORK" && isRunning) {
      currentWorkAudioIdx = (currentWorkAudioIdx + 1) % WORK_AUDIO_PLAYLIST.length;
      
      workAudio.src = WORK_AUDIO_PLAYLIST[currentWorkAudioIdx];
      workAudio.load();
      
      pushLog(`> BGM_SYSTEM: TRACK ENDED. NEXT AUDIO STREAM ENGAGED [${currentWorkAudioIdx + 1}/${WORK_AUDIO_PLAYLIST.length}]`, "system");
      
      const audioRouteEl = document.getElementById('audio-route-select');
      const audioRoute = audioRouteEl ? audioRouteEl.value : 'bgm';
      
      if (audioRoute === 'bgm') {
        workAudio.volume = 0.25;
        workAudio.play().catch(err => console.warn("Audio Play Blocked:", err));
      }
    }
  });
}

async function loadUserDataFromCloud() {
  if (!db) return;
  try {
    pushLog("> TELEMETRY_SERVER: FETCHING DRIVER PROFILE...");
    const doc = await db.collection("user_profile").doc(USER_ID).get();
    
    if (doc.exists) {
      const cloudData = doc.data();
      userState.level = cloudData.level || 1;
      userState.xp = cloudData.xp || 0;
      totalWorkTime = cloudData.totalWorkTime || 0;
      totalRestTime = cloudData.totalRestTime || 0;
      pushLog(`>>> [DATA_SYNC]: PROFILE RESTORED. RANK: OPERATOR [LV.${userState.level}] <<<`, "success");
    } else {
      pushLog("> TELEMETRY_SERVER: NO PREVIOUS PROFILE DETECTED. INITIALIZING NEW GRID.", "system");
      await saveUserDataToCloud();
    }
    updateStatusUI();
    resetTimeState();
  } catch (error) {
    console.error("Cloud Load Error:", error);
    pushLog("> TELEMETRY_SERVER: PROFILE SYNC REJECTED. RUNNING IN LOCAL MEMORY.", "radio-gp");
  }
}

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

function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function safeSetStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}

// 🟢 【バグ修正完了】音声の衝突とフライング二重点火を完全にアンダーカットするBGM管理回路
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
    if (workAudio) { workAudio.pause(); workAudio.currentTime = 0; }
    if (restAudio) { restAudio.pause(); restAudio.currentTime = 0; restAudio.load(); }
    
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
      workAudio.currentTime = 0;
      if (restAudio.paused) {
        restAudio.volume = 0.25;
        restAudio.play().catch(err => console.warn("Audio Play Blocked:", err));
      }
    } else {
      // 🚨 【核心】休憩から作業に戻った瞬間、休憩音声をストップさせ、さらに .load() で非同期バッファごと強制フラッシュ！
      restAudio.pause();
      restAudio.currentTime = 0; 
      restAudio.load(); 
      
      if (workAudio.paused) {
        if (!workAudio.src.includes(WORK_AUDIO_PLAYLIST[currentWorkAudioIdx])) {
          workAudio.src = WORK_AUDIO_PLAYLIST[currentWorkAudioIdx];
          workAudio.load();
        }
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
const skipBtn = document.getElementById('skip-btn'); // 🟢 スキップボタン（オーバーテイク）
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

  lastRegisteredVirtualLap = 1; 
  if (mapService) mapService.resetCheckpoints();

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
    timeLeft = TIME_PER_LAP; 
    enduranceLap = 1;
    safeSetText('lap-counter', `[LAP ${enduranceLap}]`);
    updateDisplay(timeLeft);
  }
  updateProgressMeter(0);
  updateLiveTelemetry();
  manageBgmPlayback();
}

// =======================================================
// 🎛 *CORE TIMER HYPER-DRIVE WORKER LINK*
// =======================================================
timerWorker.onmessage = function(e) {
  if (e.data === 'TICK') {
    if (!isRunning) return;

    const delta = 100; // 1拍動あたり100ms減算

    if (currentMode === "POMODORO") {
      pomoTotalTimeLeft = Math.max(0, pomoTotalTimeLeft - delta);
      if (pomoTotalTimeLeft <= 0) {
        isRunning = false;
        timerWorker.postMessage('STOP');
        triggerRadioSound();
        safeSetText('hud-status', "FINISH");
        safeSetStyle('hud-status', 'color', 'var(--success-green)');
        safeSetText('timer-display', "00:00");
        if (cockpitVideo) cockpitVideo.pause();
        if (workAudio) workAudio.pause();
        if (restAudio) restAudio.pause();
        
        addXpWithLevelCheck(50);
        pushLog(`>>>> [GRAND PRIX FINISH]: EXCELLENT DRIVE! ALL SECTORS PURPLE! +50XP <<<<`, "success");
        saveUserDataToCloud();
        return;
      } else {
        timeLeft = Math.max(0, timeLeft - delta);
        if (pomoState === "WORK") {
          currentWorkAccumulated += delta;
          addXpWithLevelCheck(0.1); 
          totalWorkTime += delta;
          tyreTemp = Math.min(125.0, tyreTemp + (delta / 10000));
          ersPercent = Math.max(0, ersPercent - (delta / 30000));
          const stintProgress = Math.min((pomoWorkDuration - timeLeft) / pomoWorkDuration, 1.0);
          updateProgressMeter(stintProgress);
        } else {
          totalRestTime += delta;
          tyreTemp = Math.max(60.0, tyreTemp - (delta / 5000));
          ersPercent = Math.min(100, ersPercent + (delta / 4000));
          updateProgressMeter(0);
        }

        if (timeLeft <= 0) {
          triggerRadioSound();
          if (pomoState === "WORK") {
            pomoState = "REST";
            timeLeft = pomoRestDuration;
            if (mapService) mapService.resetCheckpoints();
            if(pomoIndicator) {
              pomoIndicator.innerText = `[[ PIT_STOP ${currentPomoCycle}: RECHARGING ]]`;
              pomoIndicator.style.color = "var(--success-green)";
            }
            pushLog(`>>> TRIGGERED (STINT ${currentPomoCycle} END): ENTERING BOX. <<<`, "system");
            manageBgmPlayback();
          } else {
            // 🟢 休憩終了時、フライングさせずに確実に次セクションへ移行する回路
            triggerBoxOut();
          }
        }
        updateDisplay(timeLeft);
      }
    } else if (currentMode === "SPRINT") {
      timeLeft = Math.max(0, timeLeft - delta);
      totalWorkTime += delta;
      addXpWithLevelCheck(0.12);
      ersPercent = Math.max(0, ersPercent - (delta / 25000));
      tyreTemp = Math.min(125.0, tyreTemp + (delta / 8000));
      
      const sprintProgress = Math.min((pomoWorkDuration - timeLeft) / pomoWorkDuration, 1.0);
      updateProgressMeter(sprintProgress);

      if (timeLeft <= 0) {
        isRunning = false;
        timerWorker.postMessage('STOP');
        triggerRadioSound();
        pushLog("> RACE_CONTROL: CHEQUERED FLAG! SPRINT MISSION ACCOMPLISHED.", "success");
        addXpWithLevelCheck(30);
        if (startBtn) startBtn.innerText = "ENGAGE";
        manageBgmPlayback();
        saveUserDataToCloud();
      }
      updateDisplay(timeLeft);
    } else {
      // 🏎 ENDURANCE モード
      timeLeft = Math.max(0, timeLeft - delta);
      totalWorkTime += delta;
      addXpWithLevelCheck(0.15);
      ersPercent = Math.max(0, ersPercent - (delta / 40000));
      tyreTemp = Math.min(120.0, tyreTemp + (delta / 12000));

      const enduranceProgress = (timeLeft % TIME_PER_LAP) / TIME_PER_LAP;
      updateProgressMeter(enduranceProgress);

      if (timeLeft <= 0) {
        triggerRadioSound();
        enduranceLap++;
        safeSetText('lap-counter', `[LAP ${enduranceLap}]`);
        pushLog(`> RACE_CONTROL: LAP COMPLETED. ENTERING LAP ${enduranceLap}. KEEP PUSHING!`, "success");
        timeLeft = TIME_PER_LAP;
        if (mapService) mapService.resetCheckpoints();
      }
      updateDisplay(timeLeft);
    }
    updateLiveTelemetry();
  }
};

// 🟢 PIT_STOP脱出（通常終了・スキップボタン共通マッピング）
function triggerBoxOut() {
  pomoState = "WORK";
  currentPomoCycle++;
  timeLeft = pomoWorkDuration;
  if (mapService) mapService.resetCheckpoints();
  pushLog(`> RACE_CONTROL: GREEN LIGHT. BOX OUT AND ATTACK THE STINT [CYCLE ${currentPomoCycle}]`, "success");
  manageBgmPlayback();
  saveUserDataToCloud();
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

// =======================================================
// 🟢 TELEMETRY HUD MANAGEMENT
// =======================================================
function updateLiveTelemetry() {
  const statusEl = document.getElementById('hud-status');
  if (isRunning) {
    if (currentMode === "POMODORO") {
      if(statusEl) {
        statusEl.innerText = pomoState === "WORK" ? "STINT_RUN" : "PIT_STOP";
        statusEl.style.color = pomoState === "WORK" ? "var(--accent-neon-pink)" : "var(--success-green)";
      }
    } else if (currentMode === "SPRINT") {
      if(statusEl) { statusEl.innerText = "SPRINT_ATTACK"; statusEl.style.color = "var(--accent-neon-cyan)"; }
    } else {
      if(statusEl) { statusEl.innerText = "ENDURANCE_RACE"; statusEl.style.color = "var(--success-green)"; }
    }
  } else {
    if(statusEl) { statusEl.innerText = "STANDBY"; statusEl.style.color = "var(--terminal-dim-text)"; }
  }

  let progress = 0;
  let stateText = "[[ STANDBY ]]";
  let stateColor = "var(--highlight-yellow)";

  if (isRunning) {
    if (currentMode === "POMODORO") {
      stateText = pomoState === "WORK" ? `[[ STINT ${currentPomoCycle} ]]` : "[[ PIT_STOP ]]";
      stateColor = pomoState === "WORK" ? "var(--accent-neon-pink)" : "var(--success-green)";
      progress = Math.min(currentWorkAccumulated / totalWorkExpected, 1.0);
    } else if (currentMode === "SPRINT") {
      stateText = "[[ QUALIFY ]]";
      stateColor = "var(--success-green)";
      progress = Math.min((pomoWorkDuration - timeLeft) / pomoWorkDuration, 1.0);
    } else {
      stateText = `[[ LAP ${enduranceLap} ]]`;
      stateColor = "var(--accent-neon-cyan)";
      progress = (timeLeft % TIME_PER_LAP) / TIME_PER_LAP;
    }
  } else {
    if (totalWorkTime > 0 || totalRestTime > 0) {
      stateText = "[[ RED FLAG ]]";
      stateColor = "var(--text-white)";
    }
    if (currentMode === "POMODORO") progress = Math.min(currentWorkAccumulated / totalWorkExpected, 1.0);
    else if (currentMode === "SPRINT") progress = Math.min((pomoWorkDuration - timeLeft) / pomoWorkDuration, 1.0);
    else progress = (timeLeft % TIME_PER_LAP) / TIME_PER_LAP;
  }

  // OSRMのリアル距離をベースにHUDへ同期
  const speedEl = document.getElementById('tel-speed');
  const gearEl = document.getElementById('tel-gear');
  const dstEl = document.getElementById('tel-dst');
  const realRouteDist = mapService ? (mapService.totalDistanceKm || 0) : 0;

  if (isRunning && mapService) {
    mapService.updatePosition(progress, (cpName) => {
      pushLog(`> TELEMETRY: SECTOR CHECKPOINT PASSED [${cpName.toUpperCase()}]`, "success");
      addXpWithLevelCheck(5);
    });
  }

  if (!isRunning) {
    if(speedEl) speedEl.innerText = "0";
    if(gearEl) { gearEl.innerText = "N"; gearEl.style.color = "var(--highlight-yellow)"; }
    if(dstEl) dstEl.innerText = `${realRouteDist.toFixed(2)} / ${realRouteDist.toFixed(2)}`;
  } else if (currentMode === "POMODORO" && pomoState === "REST") {
    if(speedEl) speedEl.innerText = "0";
    if(gearEl) { gearEl.innerText = "N"; gearEl.style.color = "var(--highlight-yellow)"; }
    const remainDist = Math.max(0, realRouteDist * (1 - progress));
    if(dstEl) dstEl.innerText = `${remainDist.toFixed(2)} / ${realRouteDist.toFixed(2)}`;
  } else {
    const virtualSpeed = Math.floor(280 + Math.random() * 65 + (ersPercent > 20 ? 15 : 0));
    if(speedEl) speedEl.innerText = virtualSpeed;
    if(gearEl) {
      gearEl.innerText = virtualSpeed > 320 ? "8" : virtualSpeed > 290 ? "7" : "6";
      gearEl.style.color = "var(--accent-neon-cyan)";
    }
    const remainDist = Math.max(0, realRouteDist * (1 - progress));
    if(dstEl) dstEl.innerText = `${remainDist.toFixed(2)} / ${realRouteDist.toFixed(2)}`;
  }

  safeSetStyle('ers-bar', 'width', `${ersPercent}%`);
  safeSetStyle('tyre-bar', 'width', `${(tyreTemp / 130) * 100}%`);

  if (pomoIndicator && currentMode === "POMODORO") {
    pomoIndicator.innerText = `[[ SESSION: ${pomoState} (CYCLE ${currentPomoCycle}) ]]`;
    pomoIndicator.style.color = pomoState === "WORK" ? "var(--accent-neon-pink)" : "var(--success-green)";
  }

  if (currentMode === "POMODORO") {
    updateTotalRemainDisplay(pomoTotalTimeLeft);
    const currentProgTotal = (totalWorkExpected - (pomoState === "WORK" ? timeLeft : 0)) / (totalWorkExpected || 1);
    const currentVirtualLap = Math.floor(currentProgTotal * 50) + 1;
    if (currentVirtualLap !== lastRegisteredVirtualLap) {
      lastRegisteredVirtualLap = currentVirtualLap;
      pushLog(`> RACE_CONTROL: ENTERING LAP ${currentVirtualLap} / 50`, "system");
    }
  }

  // 🟢 削られていた Picture-in-Picture ステアリングHUDへのストリーム同期の完全復元
  updatePipHUD(timeLeft, progress, stateText, stateColor);
}

// 🟢 削られていた 10連RPMステアリングバー対応の PiP HUD 描画
function updatePipHUD(ms, progress, stateText, stateColor) {
  if (!pipWindow) return;
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  
  const timerEl = pipWindow.document.getElementById('pip-timer');
  const modeEl = pipWindow.document.getElementById('pip-mode');
  
  if (timerEl) timerEl.innerText = `${m}:${s}`;
  if (modeEl) {
    modeEl.innerText = stateText;
    modeEl.style.color = stateColor;
  }
  
  const pipBars = pipWindow.document.querySelectorAll('.pip-rpm-bar');
  if (pipBars.length > 0) {
    const activeCount = Math.floor(progress * pipBars.length);
    pipBars.forEach((bar, idx) => {
      if (idx < activeCount) {
        if (idx < 5) bar.style.background = "var(--success-green, #05ffa1)";
        else if (idx < 8) bar.style.background = "var(--highlight-yellow, #fcee0a)";
        else bar.style.background = "var(--accent-neon-pink, #ff2a6d)";
      } else {
        bar.style.background = "rgba(0,255,255,0.04)";
      }
    });
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

function addXpWithLevelCheck(amount) {
  userState.xp += amount;
  const xpNeeded = userState.level * 100;
  if (userState.xp >= xpNeeded) {
    userState.xp -= xpNeeded;
    userState.level++;
    pushLog(`🏆 LEVEL UP! NEW RANK ACHIEVED: OPERATOR LV.${userState.level} 🏆`, "success");
    playAlarmFailsafe();
    saveUserDataToCloud();
  }
  updateStatusUI();
}

function updateStatusUI() {
  safeSetText('hud-level', `LV.${userState.level}`);
  const xpNeeded = userState.level * 100;
  const pct = Math.min(100, (userState.xp / xpNeeded) * 100);
  safeSetStyle('xp-bar-fill', 'width', `${pct}%`);
  safeSetText('stat-total-work', (totalWorkTime / (60 * 1000)).toFixed(1));
  safeSetText('stat-total-rest', (totalRestTime / (60 * 1000)).toFixed(1));
}

// 🟢 削られていた タコメーター（.rpm-bar）クラス操作の進捗メーター同期回路の完全復元
function updateProgressMeter(progress) {
  if(!rpmIndicator) return;
  const bars = rpmIndicator.querySelectorAll('.rpm-bar');
  if (bars.length === 0) return; 
  
  const activeCount = Math.floor(progress * bars.length);
  bars.forEach((bar, idx) => {
    if (idx < activeCount) {
      bar.classList.add('active');
    } else {
      bar.classList.remove('active');
    }
  });
}

// =======================================================
// 🎛️ INTERFACE LISTENERS (CONTROL BUTTONS)
// =======================================================
if (startBtn) {
  startBtn.addEventListener('click', () => {
    initAudioContext();
    isRunning = !isRunning;
    playRadioChirpFailsafe();

    if (isRunning) {
      timerWorker.postMessage('START');
      startBtn.innerText = "BOX_IN";
      startBtn.style.borderColor = "var(--accent-neon-pink)";
      startBtn.style.color = "var(--accent-neon-pink)";
      pushLog("> TELEMETRY: ENGINE IGNITION. GREEN LIGHT CONFIRMED.", "success");
    } else {
      timerWorker.postMessage('STOP');
      startBtn.innerText = "ENGAGE";
      startBtn.style.borderColor = "var(--accent-neon-cyan)";
      startBtn.style.color = "var(--accent-neon-cyan)";
      pushLog("> TELEMETRY: COCKPIT SHUTDOWN. CAR IN PIT-LANE.", "system");
      saveUserDataToCloud();
    }
    manageBgmPlayback();
  });
}

// 🟢 【完全復活】スキップボタン（オーバーテイク・ショートカット機能）
if (skipBtn) {
  skipBtn.addEventListener('click', () => {
    if (!isRunning) return;
    playRadioChirpFailsafe();
    
    if (currentMode === "POMODORO") {
      if (pomoState === "WORK") {
        pomoState = "REST";
        timeLeft = pomoRestDuration;
        if (mapService) mapService.resetCheckpoints();
        if(pomoIndicator) {
          pomoIndicator.innerText = `[[ PIT_STOP ${currentPomoCycle}: RECHARGING ]]`;
          pomoIndicator.style.color = "var(--success-green)";
        }
        pushLog(`> RACE_CONTROL: SKIPPED STINT. FORCED BOX FOR TYRES [CYCLE ${currentPomoCycle}]`, "system");
        manageBgmPlayback();
      } else {
        triggerBoxOut();
      }
    } else if (currentMode === "SPRINT") {
      timeLeft = 0; 
      pushLog(`> RACE_CONTROL: SPRINT STINT ABORTED VIA SKIPPED SECTOR`, "radio-gp");
    } else {
      timeLeft = 0; 
      pushLog(`> RACE_CONTROL: ENDURANCE LAP SKIPPED BY DRIVER INTERVENTION`, "radio-gp");
    }
    updateLiveTelemetry();
  });
}

// 🟢 【完全復活】元のリセットボタンと完全に連動する DNF 警告 & 全リセットシーケンス
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    playRadioChirpFailsafe();
    completelyResetMachine();
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
  if (mapService) mapService.reset();
  if(startBtn) startBtn.innerText = "ENGAGE";
  safeSetText('status-sub', "[ SYSTEM: STANDBY ]");
  pushLog(">> ALERT: RACING LINE RESET TO ORIGINAL GRID.", "change");
  manageBgmPlayback();
  saveUserDataToCloud();
}

// =======================================================
// 🗺️ OSRM NAVIGATION & GEOLOCATION (CUSTOM ROUTE)
// =======================================================
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
    const startInput = document.getElementById('custom-start').value || "Start Grid";
    const endInput = document.getElementById('custom-end').value || "Destination";
    trackName = `${startInput.toUpperCase()} ➔ ${endInput.toUpperCase()}`;
  } else {
    const preset = ROUTE_PRESETS[presetKey] || ROUTE_PRESETS['shibuya_shinjuku'];
    start = preset.start;
    end = preset.end;
    trackName = preset.name;
  }

  safeSetText('current-track-name', `ROUTE: ${trackName}`);
  if (mapService) {
    const result = await mapService.fetchOSRMRoute(start, end);
    if (result.success) {
      pushLog(`> ROUTE_DATA: NEW MAP LOCKED IN. DISTANCE: ${result.distance.toFixed(2)} km`, "success");
      updateLiveTelemetry();
    }
  }
}

// 🟢 【完全復活】カスタム入力ワードから緯度経度をフェッチする非同期サーチロジック
const btnSearchCustom = document.getElementById('btn-search-custom');
if (btnSearchCustom) {
  btnSearchCustom.addEventListener('click', async () => {
    const startName = document.getElementById('custom-start').value.trim();
    const endName = document.getElementById('custom-end').value.trim();

    if (!startName || !endName) {
      pushLog("> ERROR: BOTH START AND DESTINATION FIELDS ARE REQUIRED.", "radio-gp");
      return;
    }

    pushLog("> TELEMETRY_SERVER: GEOLOCATING ROUTE NODES...");
    const fetchCoords = async (query) => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        return null;
      } catch (err) { return null; }
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
    loadSelectedRoute();
  });
}

// 🟢 【完全復活】スタンドバイ中のマップ直接クリック座標キャプチャーリスナー
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
    const startInput = document.getElementById('custom-start');
    const endInput = document.getElementById('custom-end');

    if (mapClickCount === 0) {
      customStartCoords = [latlng.lat, latlng.lng];
      if(startInput) startInput.value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
      pushLog(`> MAP_INPUT: START GRID COORDS CAPTURED [${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}]`, "system");
      mapClickCount = 1;
    } else {
      customEndCoords = [latlng.lat, latlng.lng];
      if(endInput) endInput.value = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
      pushLog(`> MAP_INPUT: DESTINATION GRID COORDS CAPTURED [${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}]`, "system");
      mapClickCount = 0;
      
      safeSetText('current-track-name', "ROUTE: CUSTOM CLICKED TRACK");
      loadSelectedRoute();
    }
  });
}, 1000);

const audioRouteSelect = document.getElementById('audio-route-select');
if (audioRouteSelect) {
  audioRouteSelect.addEventListener('change', () => {
    initAudioContext();
    playRadioChirpFailsafe(); 
    manageBgmPlayback();      
  });
}

// 🟢 【完全復活】Picture-in-Picture 起動ボタンと F1ステアリングHUDのインジェクション
const pipBtn = document.getElementById('pip-btn'); 
if (pipBtn) {
  pipBtn.addEventListener('click', async () => {
    if (!('documentPictureInPicture' in window)) {
      pushLog("> ERROR: DOCUMENT PIP IS NOT SUPPORTED ON THIS BROWSER ENGINE.", "radio-gp");
      return;
    }
    if (pipWindow) {
      pipWindow.close();
      return;
    }

    try {
      pipWindow = await window.documentPictureInPicture.requestWindow({ width: 280, height: 120 });
      
      const style = pipWindow.document.createElement('style');
      style.textContent = `
        body { background: #06020f; color: #00ffff; font-family: sans-serif; text-align: center; margin: 0; padding: 10px; overflow: hidden; }
        #pip-timer { font-size: 2.2rem; font-weight: bold; font-family: monospace; color: #fff; text-shadow: 0 0 15px var(--accent-neon-cyan); letter-spacing: 2px; line-height: 1; margin-bottom: 10px; }
        #pip-mode { font-size: 0.9rem; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
        .pip-rpm-container { display: flex; gap: 4px; width: 100%; height: 12px; }
        .pip-rpm-bar { height: 100%; flex: 1; background: rgba(0,255,255,0.04); border: 1px solid rgba(0,255,255,0.1); transition: background 0.1s; }
      `;
      pipWindow.document.head.appendChild(style);

      pipWindow.document.body.innerHTML = `
        <div id="pip-mode">STANDBY</div>
        <div id="pip-timer">00:00</div>
        <div class="pip-rpm-container">
          ${Array(10).fill().map(() => `<div class="pip-rpm-bar"></div>`).join('')}
        </div>
      `;

      pushLog("> AUDIO_SYSTEM: STEERING HUD MODE ENGAGED. POPUP LINK ACTIVE.", "success");
      updateLiveTelemetry();

      pipWindow.addEventListener('unload', () => {
        pipWindow = null;
        pushLog("> AUDIO_SYSTEM: HUD MODE DEACTIVATED. RETURN TO COCKPIT MAIN MONITOR.", "system");
      });
    } catch (err) {
      console.error(err);
      pushLog("> ERROR: PIP HUD ENGAGEMENT CRITICAL FAILURE.", "radio-gp");
    }
  });
}

async function initApp() {
  pushLog("> TRACK_SYSTEM: CONNECTING TO TELEMETRY NETWORK...");
  await loadSelectedRoute();
  resetTimeState();
  updateStatusUI();
  
  // 1秒ごとの内部メトリック更新（システム時計、タイヤ温度、ERS自動回復のクロックサイクル）
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
  pushLog("> CYBER_OS // ENGINE MAP LEVEL 1 ENGAGED. SYSTEM IS ONLINE.", "success");
}

// 🏎️ シグナル・オールグリーン！ローンチコントロール、作動！！
window.addEventListener('DOMContentLoaded', initApp);