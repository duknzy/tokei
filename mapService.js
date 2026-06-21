class MapService {
  constructor() {
    // 地図の初期セットアップ（最初は世界地図、ロード後に自動フィット）
    this.map = L.map('map', { zoomControl: true }).setView([35.6580, 139.7016], 15);
    
    // 漆黒スタイル
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap & CartoDB'
    }).addTo(this.map);

    // ルート表示用ライン
    this.basePolyline = L.polyline([], { color: 'var(--accent-cyan)', weight: 4, opacity: 0.3 }).addTo(this.map);
    this.traveledPolyline = L.polyline([], { color: 'var(--accent-magenta)', weight: 5, opacity: 0.95 }).addTo(this.map);

    // 自機マーカー
    const cyberIcon = L.divIcon({ className: 'cyber-marker', iconSize: [12, 12], iconAnchor: [6, 6] });
    this.marker = L.marker([35.6580, 139.7016], { icon: cyberIcon }).addTo(this.map);

    this.routeCoords = [];
    this.totalDistance = 0;
  }

  // 出発地と目的地の緯度経度を受け取り、OSRM APIから本物の道路網を引っ張ってくる非同期関数
  async fetchOSRMRoute(startLatLng, endLatLng) {
    // OSRMは [経度, 緯度] の順序でURLを作る規則があります
    const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng[1]},${startLatLng[0]};${endLatLng[1]},${endLatLng[0]}?overview=full&geometries=geojson`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        // OSRMから返ってくる[経度, 緯度]を、Leaflet用の[緯度, 経度]に反転して格納
        this.routeCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        this.totalDistance = data.routes[0].distance / 1000; // メートルをキロに変換
        
        // 地図上に本物の道路ラインを投影
        this.basePolyline.setLatLngs(this.routeCoords);
        this.map.fitBounds(this.basePolyline.getBounds());
        
        return { success: true, distance: this.totalDistance };
      }
    } catch (error) {
      console.error("OSRM APIのデータ取得に失敗:", error);
    }
    return { success: false, distance: 0 };
  }

  // 進行度 (0.0 〜 1.0) に応じて、本物の道の上を1ミリの狂いもなく進める処理
  updatePosition(progress) {
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
      // 道路の微小なカーブ同士の間を補間
      currentLatLng = [
        p1[0] + (p2[0] - p1[0]) * part,
        p1[1] + (p2[1] - p1[1]) * part
      ];
    }

    // マーカーの位置を更新
    this.marker.setLatLng(currentLatLng);

    // 走破した道だけをマゼンタ色に染める
    const traveledPoints = this.routeCoords.slice(0, idx + 1);
    traveledPoints.push(currentLatLng);
    this.traveledPolyline.setLatLngs(traveledPoints);

    // 地図のカメラを滑らかに追従スクロール
    this.map.panTo(currentLatLng, { animate: true, duration: 0.1 });

    // UIメーターの文字情報を更新
    document.getElementById('map-pos').innerText = `POS: LAT ${currentLatLng[0].toFixed(4)} / LON ${currentLatLng[1].toFixed(4)}`;
    document.getElementById('map-pct').innerText = (progress * 100).toFixed(1);
    document.getElementById('map-rem').innerText = (this.totalDistance * (1 - progress)).toFixed(2);
  }

  reset() {
    this.traveledPolyline.setLatLngs([]);
    if (this.routeCoords.length > 0) {
      this.marker.setLatLng(this.routeCoords[0]);
      this.map.setView(this.routeCoords[0], 15);
    }
  }
}