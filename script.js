// 1. Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('PWA Ready!'));
}

// 2. Pro Map Setup
var map = L.map('map').setView([11.0, 77.0], 8);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
}).addTo(map);

// 3. Pro Layer Groups
const layers = {
    fires: L.layerGroup().addTo(map),
    risks: L.layerGroup().addTo(map),
    wind: L.layerGroup().addTo(map),
    evac: L.layerGroup().addTo(map)
};

// 4. Intelligence: Distance & Spread Logic
function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(2);
}

function addFireBuffer(lat, lng, brightness) {
    let radius = (brightness > 400) ? 5000 : 2000;
    L.circle([lat, lng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.3,
        radius: radius
    }).addTo(layers.fires).bindPopup("Spread Prediction: " + (radius/1000) + "km");
}

// 5. Connectivity & Live Refresh Engine
function checkConnectivity() {
    const status = navigator.onLine ? "Online (Live Sync)" : "Offline (Cached Mode)";
    console.log("System Status: " + status);
}

// Live Update Logic (Every 60 seconds)
setInterval(() => {
    console.log("Refreshing Live Data from NASA FIRMS...");
    fetchLiveFireData(); 
    checkConnectivity();
    addAlert("Dashboard Data Synchronized", "INFO");
}, 60000); 

// 6. NASA FIRMS Integration
async function fetchLiveFireData() {
    const apiKey = '6a98d3393046757b85671542f7c0411a';
    const url = `https://cors-anywhere.herokuapp.com/https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/world/1`;
    
    try {
        const response = await fetch(url);
        const csv = await response.text();
        plotFireMarkers(csv);
        // Note: Stats update logic should be here
        addAlert("Satellite Data Synchronized", "SUCCESS");
    } catch (e) { 
        addAlert("Data Fetch Failed", "ERROR"); 
    }
}

function plotFireMarkers(csv) {
    layers.fires.clearLayers();
    const lines = csv.split('\n').slice(1);
    lines.forEach(line => {
        const [lat, lon, brightness] = line.split(',');
        if(lat) {
            L.circleMarker([lat, lon], {
                color: brightness > 350 ? 'red' : 'orange', 
                radius: 3
            }).addTo(layers.fires).bindPopup(`Live Fire Detected! Brightness: ${brightness}`);
            addFireBuffer(lat, lon, brightness);
        }
    });
}

// 7. Alert & UI Management
function updateAlerts(newAlert) {
    addAlert(newAlert.message, newAlert.type);
}

function addAlert(message, type) {
    var container = document.getElementById('alerts-container');
    var alertDiv = document.createElement('div');
    alertDiv.className = 'alert-' + type.toLowerCase();
    alertDiv.innerHTML = `<strong>${type}:</strong> ${message}`;
    container.prepend(alertDiv);
}

function toggleLayer(layerName, isVisible) {
    isVisible ? map.addLayer(layers[layerName]) : map.removeLayer(layers[layerName]);
}

// 8. Initialization
fetchLiveFireData();
checkConnectivity();