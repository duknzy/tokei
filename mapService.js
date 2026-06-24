class MapService {
  constructor() {
    this.map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([35.6580, 139.7016], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    this.routeLine = null;
    this.traveledLine = null; // 🟢 走行済みの軌跡（赤線）回路を再配備
    this.routeCoordinates = [];
    this.checkpoints = [];
    this.marker = null;
    this.hasZoomedIn = false; // 走行開始時の自動クローズアップ制御用フラグ
  }

  async fetchOSRMRoute(start, end) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) return { success: false };

      this.routeCoordinates = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      const distanceKm = data.routes[0].distance / 1000;

      // 旧レイヤーの残像を完全消去
      if (this.routeLine) this.map.removeLayer(this.routeLine);
      if (this.traveledLine) this.map.removeLayer(this.traveledLine);

      // 未走行ルート（サイバーシアン）
      this.routeLine = L.geoJSON({
        type: "Feature",
        geometry: data.routes[0].geometry
      }, {
        style: { color: "#00ffff", weight: 4, opacity: 0.5 }
      }).addTo(this.map);

      // 走行済みルート（ネオンピンク/レッド）の初期化
      this.traveledLine = L.polyline([], {
        color: "#ff2a6d",
        weight: 6,
        opacity: 0.9
      }).addTo(this.map);

      // スタンドバイ時はルート全体が綺麗に収まるように自動フィッティング
      this.map.fitBounds(this.routeLine.getBounds(), { padding: [15, 15] });
      this.generateCheckpoints(distanceKm);

      if (this.marker) this.map.removeLayer(this.marker);
      this.marker = L.marker(this.routeCoordinates[0], {
        icon: L.divIcon({ className: 'cyber-marker', iconSize: [12, 12] })
      }).addTo(this.map);

      this.hasZoomedIn = false; // ルート生成時にフラグを初期化
      return { success: true, distance: distanceKm };
    } catch (e) {
      console.error(e);
      return { success: false };
    }
  }

  generateCheckpoints(totalDistance) {
    this.checkpoints = [];
    const count = 3;
    const step = Math.floor(this.routeCoordinates.length / (count + 1));
    for (let i = 1; i <= count; i++) {
      const idx = step * i;
      if (this.routeCoordinates[idx]) {
        this.checkpoints.push({
          index: idx,
          name: `SECTOR_CHIP_${i}`,
          passed: false
        });
      }
    }
  }

  resetCheckpoints() {
    this.checkpoints.forEach(c => c.passed = false);
  }

  reset() {
    this.resetCheckpoints();
    if (this.traveledLine) this.traveledLine.setLatLngs([]);
    if (this.routeCoordinates.length > 0 && this.marker) {
      this.marker.setLatLng(this.routeCoordinates[0]);
      this.map.setView(this.routeCoordinates[0], 14);
    }
    this.hasZoomedIn = false;
  }

  updatePosition(progress, onCheckpointPassed) {
    if (this.routeCoordinates.length === 0 || !this.marker) return;

    const targetIdx = Math.min(
      this.routeCoordinates.length - 1,
      Math.floor(progress * (this.routeCoordinates.length - 1))
    );

    const currentPos = this.routeCoordinates[targetIdx];
    this.marker.setLatLng(currentPos);

    // 🟢 1. 走行済みルートをスライスしてネオンレッドに染め上げる
    const traveledCoords = this.routeCoordinates.slice(0, targetIdx + 1);
    if (this.traveledLine) {
      this.traveledLine.setLatLngs(traveledCoords);
    }

    // 🟢 2. 自動追跡（Auto-Tracking）＆ 走行開始時の自動クローズアップズーム
    if (progress > 0) {
      if (!this.hasZoomedIn) {
        // スタートした瞬間にズームレベルを16に引き上げ、マーカーを巨大化・ハッキリ見せる！
        this.map.setView(currentPos, 16, { animate: true });
        this.hasZoomedIn = true;
      } else {
        // 以降は現在地が常に中央になるように自動パニング追跡
        this.map.panTo(currentPos);
      }
    } else {
      // 停止（待機）時は現在地に視点を戻す
      this.map.panTo(currentPos);
    }

    const posEl = document.getElementById('map-pos');
    if (posEl) posEl.innerText = `POS: LAT ${currentPos[0].toFixed(4)} / LON ${currentPos[1].toFixed(4)}`;

    const pctEl = document.getElementById('map-pct');
    if (pctEl) pctEl.innerText = (progress * 100).toFixed(1);

    this.checkpoints.forEach(c => {
      if (targetIdx >= c.index && !c.passed) {
        c.passed = true;
        if (onCheckpointPassed) onCheckpointPassed(c.name);
      }
    });
  }
}