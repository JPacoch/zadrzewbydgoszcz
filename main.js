const supabaseUrl = 'SUPABASE_URL';
const supabaseKey = 'SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const BYDGOSZCZ_CENTER = [53.1235, 18.0084];
const DEFAULT_ZOOM = 13;

const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView(BYDGOSZCZ_CENTER, DEFAULT_ZOOM);


const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
});


const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 20
});

darkLayer.addTo(map);
let currentLayer = 'dark';

L.control.attribution({ position: 'bottomright' }).addTo(map);

const markerStyle = {
    radius: 4,
    fillColor: "#10b981",
    color: "#ffffff",
    weight: 1,
    opacity: 1,
    fillOpacity: 1
};

const bounds = L.latLngBounds();
let hasPoints = false;

const markersLayer = L.layerGroup().addTo(map);
const heatmapData = [];
let heatmapLayer = null;
let currentView = 'points';

async function loadPlantingLocations() {
    try {
        const { data, error } = await supabase
            .from('geoankieta')
            .select('planting_locations');

        if (error) {
            console.error('Error fetching data:', error);
            return;
        }

        if (!data || data.length === 0) {
            console.log('No data found in geoankieta');
            return;
        }

        console.log(`[DrzewMap] Fetched ${data.length} rows from geoankieta`);

        // Process rows
        data.forEach((row, rowIndex) => {
            if (row.planting_locations) {
                let locations = row.planting_locations;
                if (typeof locations === 'string') {
                    try {
                        locations = JSON.parse(locations);
                    } catch (e) {
                        console.error(`[DrzewMap] Row ${rowIndex}: Error parsing JSON:`, e);
                        return;
                    }
                }

                console.log(`[DrzewMap] Row ${rowIndex}: locations =`, locations);

                if (Array.isArray(locations)) {
                    locations.forEach(loc => {
                        if (loc.lat !== undefined && loc.lng !== undefined) {
                            const latLng = [loc.lat, loc.lng];
                            L.circleMarker(latLng, markerStyle)
                                .bindPopup(`
                                <div style="font-family: 'Inter', sans-serif; text-align: center;">
                                    <strong>Planting Location</strong><br>
                                    Lat: ${loc.lat.toFixed(5)}<br>
                                    Lng: ${loc.lng.toFixed(5)}
                                </div>
                             `)
                                .addTo(markersLayer);
                            heatmapData.push(latLng);
                            bounds.extend(latLng);
                            hasPoints = true;
                        } else {
                            console.warn(`[DrzewMap] Row ${rowIndex}: Skipping loc with missing lat/lng:`, loc);
                        }
                    });
                } else {
                    console.warn(`[DrzewMap] Row ${rowIndex}: planting_locations is not an array:`, locations);
                }
            } else {
                console.log(`[DrzewMap] Row ${rowIndex}: planting_locations is null/empty`);
            }
        });

        if (hasPoints) {
            heatmapLayer = L.heatLayer(heatmapData, {
                radius: 20,
                blur: 15,
                maxZoom: 17,
                gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
            });
            map.fitBounds(bounds, { padding: [50, 50] });
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

document.getElementById('btn-zoom-in').addEventListener('click', () => {
    map.zoomIn();
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
    map.zoomOut();
});

document.getElementById('btn-center').addEventListener('click', () => {
    if (hasPoints) {
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    } else {
        map.flyTo(BYDGOSZCZ_CENTER, DEFAULT_ZOOM, { duration: 1.5 });
    }
});

document.getElementById('btn-layer').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const span = btn.querySelector('span');

    if (currentLayer === 'dark') {
        map.removeLayer(darkLayer);
        satelliteLayer.addTo(map);
        currentLayer = 'satellite';
        span.textContent = 'Mapa';
    } else {
        map.removeLayer(satelliteLayer);
        darkLayer.addTo(map);
        currentLayer = 'dark';
        span.textContent = 'Satelita';
    }
});

document.getElementById('btn-heatmap').addEventListener('click', (e) => {
    const span = e.currentTarget.querySelector('span');
    if (!hasPoints || !heatmapLayer) return;

    if (currentView === 'points') {
        map.removeLayer(markersLayer);
        heatmapLayer.addTo(map);
        currentView = 'heatmap';
        span.textContent = 'Punkty';
    } else {
        map.removeLayer(heatmapLayer);
        markersLayer.addTo(map);
        currentView = 'points';
        span.textContent = 'Heatmapa';
    }
});

loadPlantingLocations();
