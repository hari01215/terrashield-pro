// 1. Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('PWA Ready!'));
}

// 2. Pro Map Setup (Google Maps Style)
var googleStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

var googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

var map = L.map('map', {
    layers: [googleStreets]
}).setView([11.0, 77.0], 8);

L.control.layers({
    "Streets": googleStreets,
    "Satellite": googleSat
}).addTo(map);

// 3. Pro Layer Groups
const layers = {
    fires: L.layerGroup().addTo(map),
    risks: L.layerGroup().addTo(map),
    wind: L.layerGroup().addTo(map),
    evac: L.layerGroup().addTo(map)
};

const openWeatherApiKey = '7f5de03eda49504ef090621895b9e5be';
const THRESHOLDS = { WIND: 50, SNOW: 10 };

// 4. Navigation & User Location Logic
function showSection(sectionId) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    const target = document.querySelector('.' + sectionId + '-section') || document.getElementById(sectionId);
    if(target) target.style.display = 'block';
}

map.locate({setView: true, maxZoom: 10});
function onLocationFound(e) {
    L.marker(e.latlng).addTo(map).bindPopup("You are here!").openPopup();
    L.circle(e.latlng, e.accuracy / 2).addTo(map);
}
map.on('locationfound', onLocationFound);
map.on('locationerror', (e) => console.log("Location access denied."));

// 5. Local Intelligence Engine
async function fetchLocalIntelligence(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${openWeatherApiKey}`;
    const weatherBox = document.getElementById('weather-box');
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("API Connection Failed");
        const data = await res.json();
        
        const visibility = data.visibility ? (data.visibility / 1000).toFixed(1) : "N/A";
        const snow = data.snow ? data.snow['1h'] : 0;
        
        weatherBox.innerHTML = `
            <h3>${data.name} Intelligence</h3>
            <div class="accu-card">
                <i class="fas fa-wind" title="Wind"></i> <p>${data.wind.speed} km/h</p>
                <i class="fas fa-snowflake" title="Snow"></i> <p>${snow} mm</p>
                <i class="fas fa-smog" title="Visibility"></i> <p>${visibility} km</p>
            </div>
        `;
        return true; 
    } catch (e) {
        weatherBox.innerHTML = `<h3>Data Hub</h3><p>Error: ${e.message}</p>`;
        return false;
    }
}

// Fixed Click Logic
map.on('click', async function(e) {
    let popup = L.popup({closeOnClick: true, autoClose: true})
                 .setLatLng(e.latlng)
                 .setContent("Loading Data...")
                 .openOn(map);
    
    await fetchLocalIntelligence(e.latlng.lat, e.latlng.lng);
    map.closePopup(); // Data vandha odanae popup close aagum
});

// 6. NASA FIRMS Integration
async function fetchLiveFireData() {
    const apiKey = '6a98d3393046757b85671542f7c0411a';
    const url = `https://cors-anywhere.herokuapp.com/https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/world/1`;
    try {
        const response = await fetch(url);
        const csv = await response.text();
        plotFireMarkers(csv);
    } catch (e) { console.error("Fire data fetch failed"); }
}

function plotFireMarkers(csv) {
    layers.fires.clearLayers();
    csv.split('\n').slice(1).filter(line => line.trim() !== "").forEach(line => {
        const [lat, lon, brightness] = line.split(',');
        if (lat) {
            let color = brightness > 450 ? 'red' : (brightness > 350 ? 'orange' : 'yellow');
            L.circleMarker([lat, lon], { color: color, radius: 5 }).addTo(layers.fires)
             .bindPopup(`Intensity: ${brightness}<br>Status: ${color.toUpperCase()}`);
        }
    });
}

// 7. Wind Engine
async function fetchWindData() {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=11.0&lon=77.0&appid=${openWeatherApiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        updateWindArrows(data.wind.deg, data.wind.speed);
    } catch (err) { console.error("Wind fetch failed"); }
}

function updateWindArrows(deg, speed) {
    layers.wind.clearLayers();
    let bounds = map.getBounds();
    let color = speed < 5 ? '#a2d2ff' : (speed < 15 ? '#7496c0' : '#ff4d4d');
    let latStep = (bounds.getNorth() - bounds.getSouth()) / 15;
    let lonStep = (bounds.getEast() - bounds.getWest()) / 15;

    for (let lat = bounds.getSouth(); lat < bounds.getNorth(); lat += latStep) {
        for (let lon = bounds.getWest(); lon < bounds.getEast(); lon += lonStep) {
            let icon = L.divIcon({
                className: 'wind-arrow-particle',
                html: `<div style="transform: rotate(${deg + (Math.random()*10-5)}deg); font-size: 1.5rem; color: ${color}; opacity: 0.7;">➔</div>`,
                iconSize: [20, 20]
            });
            L.marker([lat, lon], { icon: icon, interactive: false }).addTo(layers.wind);
        }
    }
}

// 8. Alerts
function addAlert(message, type) {
    var container = document.getElementById('alerts-container');
    if(container) {
        var alertDiv = document.createElement('div');
        alertDiv.className = 'alert-' + type.toLowerCase();
        alertDiv.innerHTML = `<strong>${type}:</strong> ${message}`;
        container.prepend(alertDiv);
    }
}

setInterval(() => { fetchLiveFireData(); fetchWindData(); }, 5000); 
fetchLiveFireData();
fetchWindData();