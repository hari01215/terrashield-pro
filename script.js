// 1. Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('PWA Ready!'));
}

// 2. Pro Map Setup
var map = L.map('map').setView([11.0, 77.0], 8);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri'
}).addTo(map);

// 3. Pro Layer Groups
const layers = {
    fires: L.layerGroup().addTo(map),
    risks: L.layerGroup().addTo(map),
    wind: L.layerGroup().addTo(map),
    evac: L.layerGroup().addTo(map)
};

// 4. Intelligence & Prediction Logic
let lastWindData = { deg: 0, speed: 5 }; 
function updateWindData(deg, speed) { lastWindData = { deg, speed }; }

function isCriticalZone(lat, lon) {
    const latMin = 8.0, latMax = 13.5;
    const lonMin = 76.0, lonMax = 80.5;
    return (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax);
}

function addFireBuffer(lat, lng, brightness) {
    let radius = (brightness > 400) ? 5000 : 2000;
    L.circle([lat, lng], { color: 'red', fillColor: '#f03', fillOpacity: 0.3, radius: radius })
     .addTo(layers.fires).bindPopup("Spread Prediction: " + (radius/1000) + "km");
}

function drawPredictionPath(lat, lon, brightness) {
    let intensityFactor = brightness / 200; 
    let windRad = (lastWindData.deg * Math.PI) / 180;
    let futureLat = lat + (Math.cos(windRad) * intensityFactor * 0.05);
    let futureLon = lon + (Math.sin(windRad) * intensityFactor * 0.05);
    L.polyline([[lat, lon], [futureLat, futureLon]], { color: 'red', weight: 3, dashArray: '5, 10' })
     .addTo(layers.risks).bindPopup("Potential Spread Path");
}

// 5. Chart Engine
const ctx = document.getElementById('fireChart')?.getContext('2d');
const fireChart = ctx ? new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['1hr', '2hr', '3hr', '4hr'],
        datasets: [{
            label: 'Fires Detected', data: [0, 0, 0, 0], borderColor: '#ff4d4d',
            tension: 0.4, fill: true, backgroundColor: 'rgba(255, 77, 77, 0.1)'
        }]
    },
    options: { responsive: true, maintainAspectRatio: false }
}) : null;

function updateChart(newData) {
    if(fireChart) {
        fireChart.data.datasets[0].data.push(newData);
        fireChart.data.datasets[0].data.shift();
        fireChart.update();
    }
}

// 6. NASA FIRMS Integration
async function fetchLiveFireData() {
    const apiKey = '6a98d3393046757b85671542f7c0411a';
    const url = `https://cors-anywhere.herokuapp.com/https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/world/1`;
    try {
        const response = await fetch(url);
        const csv = await response.text();
        plotFireMarkers(csv);
    } catch (e) { addAlert("Data Fetch Failed", "ERROR"); }
}

function plotFireMarkers(csv) {
    layers.fires.clearLayers();
    layers.risks.clearLayers();
    
    const lines = csv.split('\n').slice(1).filter(line => line.trim() !== "");
    updateChart(lines.length);
    
    lines.forEach(line => {
        const [lat, lon, brightness] = line.split(',');
        if(lat) {
            const latF = parseFloat(lat); 
            const lonF = parseFloat(lon);
            
            // Check Critical Zone
            if(isCriticalZone(latF, lonF)) {
                addAlert("CRITICAL: Fire in High Risk Zone at " + latF + ", " + lonF, "CRITICAL");
            }
            
            // Marker with Interactive Google Maps Link
            let marker = L.circleMarker([latF, lonF], { 
                color: 'red', 
                radius: 4,
                interactive: true 
            }).addTo(layers.fires);
            
            let googleMapsUrl = `http://www.google.com/maps/search/?api=1&query=${latF},${lonF}&layer=s`;
            marker.bindPopup(`<strong>Area: ${latF}, ${lonF}</strong><br><a href="${googleMapsUrl}" target="_blank">View Satellite Map</a>`);
            
            addFireBuffer(latF, lonF, parseFloat(brightness));
            drawPredictionPath(latF, lonF, parseFloat(brightness));
        }
    });
}

// 7. Wind Engine
async function fetchWindData() {
    const apiKey = '7f5de03eda49504ef090621895b9e5be';
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=11.0&lon=77.0&appid=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        updateWindData(data.wind.deg, data.wind.speed);
        updateWindArrows(data.wind.deg, data.wind.speed);
    } catch (err) { console.error("Wind fetch failed"); }
}

function updateWindArrows(deg, speed) {
    layers.wind.clearLayers();
    let duration = Math.max(0.5, 3 - (speed / 10));
    for (let i = 0; i < 10; i++) {
        let icon = L.divIcon({ className: 'wind-arrow-particle', html: `<div style="transform: rotate(${deg}deg); animation-duration: ${duration}s;">➔</div>`, iconSize: [20, 20] });
        L.marker([11.0 + (i*0.05), 77.0 + (i*0.05)], { icon: icon }).addTo(layers.wind);
    }
}

// 8. Alerts & Utilities
function addAlert(message, type) {
    var container = document.getElementById('alerts-container');
    if(container) {
        var alertDiv = document.createElement('div');
        alertDiv.className = 'alert-' + type.toLowerCase();
        alertDiv.innerHTML = `<strong>${type}:</strong> ${message}`;
        container.prepend(alertDiv);
    }
}

// 9. Initialization
setInterval(() => {
    fetchLiveFireData();
    fetchWindData();
}, 5000); 

fetchLiveFireData();
fetchWindData();