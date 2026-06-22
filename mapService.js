class MapService {
  constructor() {
    this.map = L.map('map', { zoomControl: true }).setView([35.6580, 139.7016], 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap & CartoDB'
    }).addTo(this.map);

    this.basePolyline = L.polyline([], { color: '#00f0ff', weight: 4, opacity: 0.35 }).addTo(this.map);
    this.traveledPolyline = L.polyline([], { color: '#ff2a6d', weight: 5, opacity: 0.95 }).addTo(this.map);

    const cyberIcon = L.divIcon({ className: 'cyber-marker', iconSize: [12, 12], iconAnchor: [6, 6] });
    this.marker = L.marker([35.6580, 139.7016], { icon: cyberIcon }).addTo(this.map);

    this.routeCoords = [];
    this.totalDistance = 0;
    this.checkpoints = []; // 動的生成用に初期は空
  }

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
        
        // 【動的セクター生成】ルートの座標数から、等間隔に5箇所のチェックポイントを自動抽出
        this.generateDynamicCheckpoints();
        
        return { success: true, distance: this.totalDistance };
      }
    } catch (error) {
      console.error("OSRM APIデータ取得失敗:", error);
    }
    return { success: false, distance: 0 };
  }

  generateDynamicCheckpoints() {
    this.checkpoints = [];
    if (this.routeCoords.length < 6) return;

    const step = Math.floor(this.routeCoords.length / 5);
    for (let i = 1; i <= 5; i++) {
      const targetIdx = Math.min(i * step, this.routeCoords.length - 1);
      const coord = this.routeCoords[targetIdx];
      this.checkpoints.push({
        name: `SECTOR_0${i}_NODE`,
        lat: coord[0],
        lon: coord[1],
        passed: false
      });
    }
  }

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
        const distanceThreshold = 0.0008; // 判定閾値
        
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

  resetCheckpoints() {
    this.checkpoints.forEach(cp => cp.passed = false);
  }

  reset() {
    this.traveledPolyline.setLatLngs([]);
    this.resetCheckpoints();
    if (this.routeCoords.length > 0) {
      this.marker.setLatLng(this.routeCoords[0]);
      this.map.setView(this.routeCoords[0], 15);
    }
  }
}