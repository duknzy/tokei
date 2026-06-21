class MapService {
  constructor() {
    // 地図の初期セットアップ
    this.map = L.map('map', { zoomControl: true }).setView([35.6580, 139.7016], 15);
    
    // 【復活】最高にシブい漆黒のサイバーパンク専用マップスタイル（CartoDB Dark Matter）
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap & CartoDB'
    }).addTo(this.map);

    // 漆黒の闇に映えるネオンカラーライン
    this.basePolyline = L.polyline([], { color: '#00f0ff', weight: 4, opacity: 0.35 }).addTo(this.map);
    this.traveledPolyline = L.polyline([], { color: '#ff2a6d', weight: 5, opacity: 0.95 }).addTo(this.map);

    // 自機マーカー
    const cyberIcon = L.divIcon({ className: 'cyber-marker', iconSize: [12, 12], iconAnchor: [6, 6] });
    this.marker = L.marker([35.6580, 139.7016], { icon: cyberIcon }).addTo(this.map);

    this.routeCoords = [];
    this.totalDistance = 0;

    // GPSリアルタイム検知用のチェックポイント定義
    this.checkpoints = [
      { name: "宮下公園北セクター", lat: 35.6635, lon: 139.7024, passed: false },
      { name: "原宿・神宮前交差点ノード", lat: 35.6702, lon: 139.7028, passed: false },
      { name: "北参道サイバーグリッド交差点", lat: 35.6765, lon: 139.7021, passed: false },
      { name: "代々木駅東口ネットワーク境界", lat: 35.6845, lon: 139.7010, passed: false },
      { name: "新宿四丁目大動脈交差点", lat: 35.6896, lon: 139.7005, passed: false }
    ];
  }

  // OSRM APIから道路データを取得（吸い付き用）
  async fetchOSRMRoute(startLatLng, endLatLng) {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng[1]},${startLatLng[0]};${endLatLng[1]},${endLatLng[0]}?overview=full&geometries=geojson`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        this.routeCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        this.totalDistance = data.routes[0].distance / 1000;
        
        this.basePolyline.setLatLngs(this.routeCoords);
        this.map.fitBounds(this.basePolyline.getBounds());
        
        return { success: true, distance: this.totalDistance };
      }
    } catch (error) {
      console.error("OSRM APIデータ取得失敗:", error);
    }
    return { success: false, distance: 0 };
  }

  // 進行度に応じて、漆黒のグリッドマップ上を滑らかにトレース移動
  updatePosition(progress, onCheckpointPassed) {
    if (this.routeCoords.length === 0) return;

    const totalSegments = this.routeCoords.length - 1;
    const currentFloat = progress * totalSegments;
    const idx = Math.floor(currentFloat);
    const part = currentFloat - idx;

    let currentLatLng;

    if (idx >= totalSegments) {
      currentLatLng = this.routeCoords[this.routeCoords.length - 1];
    } else {
      const p1 = this.routeCoords[idx];
      const p2 = this.routeCoords[idx + 1];
      currentLatLng = [
        p1[0] + (p2[0] - p1[0]) * part,
        p1[1] + (p2[1] - p1[1]) * part
      ];
    }

    this.marker.setLatLng(currentLatLng);

    const traveledPoints = this.routeCoords.slice(0, idx + 1);
    traveledPoints.push(currentLatLng);
    this.traveledPolyline.setLatLngs(traveledPoints);

    this.map.panTo(currentLatLng, { animate: true, duration: 0.1 });

    // GPS接近計算
    this.checkpoints.forEach(cp => {
      if (!cp.passed) {
        const dLat = currentLatLng[0] - cp.lat;
        const dLon = currentLatLng[1] - cp.lon;
        const distanceThreshold = 0.0006;
        
        if (Math.sqrt(dLat * dLat + dLon * dLon) < distanceThreshold) {
          cp.passed = true;
          if (onCheckpointPassed) {
            onCheckpointPassed(cp.name);
          }
        }
      }
    });

    document.getElementById('map-pos').innerText = `POS: LAT ${currentLatLng[0].toFixed(4)} / LON ${currentLatLng[1].toFixed(4)}`;
    document.getElementById('map-pct').innerText = (progress * 100).toFixed(1);
    document.getElementById('map-rem').innerText = (this.totalDistance * (1 - progress)).toFixed(2);
  }

  reset() {
    this.traveledPolyline.setLatLngs([]);
    this.checkpoints.forEach(cp => cp.passed = false);
    if (this.routeCoords.length > 0) {
      this.marker.setLatLng(this.routeCoords[0]);
      this.map.setView(this.routeCoords[0], 15);
    }
  }
}