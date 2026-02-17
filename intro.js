// State
let locale = "en";
let hoveredContinent = null;
let continentData = [];

// Translations
const translations = {
    en: {
        title: "GeoThis",
        subtitle: "Click on a continent to start learning",
        hover: "Hover over a continent to see its name",
        "North America": "North America",
        "South America": "South America",
        "Central America": "Central America",
        Europe: "Europe",
        Africa: "Africa",
        Asia: "Asia",
        Oceania: "Oceania"
    },
    nl: {
        title: "GeoThis",
        subtitle: "Klik op een continent om te beginnen",
        hover: "Beweeg over een continent om de naam te zien",
        "North America": "Noord-Amerika",
        "South America": "Zuid-Amerika",
        "Central America": "Midden-Amerika",
        Europe: "Europa",
        Africa: "Afrika",
        Asia: "Azië",
        Oceania: "Oceanië"
    }
};

// Translation function
const t = (key) => translations[locale][key] || translations.en[key] || key;

// Map country names to continents (loaded from JSON)
let countryToContinentMap = {};
let continentNames = {};

const continentColors = {
    us: { normal: "rgba(74, 222, 128, 0.7)", hover: "rgba(34, 197, 94, 0.9)" },
    ca: { normal: "rgba(251, 146, 60, 0.7)", hover: "rgba(249, 115, 22, 0.9)" },
    sa: { normal: "rgba(168, 85, 247, 0.7)", hover: "rgba(147, 51, 234, 0.9)" },
    eu: { normal: "rgba(96, 165, 250, 0.7)", hover: "rgba(59, 130, 246, 0.9)" },
    af: { normal: "rgba(251, 191, 36, 0.7)", hover: "rgba(245, 158, 11, 0.9)" },
    asia: { normal: "rgba(244, 114, 182, 0.7)", hover: "rgba(236, 72, 153, 0.9)" },
    oceania: { normal: "rgba(34, 211, 238, 0.7)", hover: "rgba(6, 182, 212, 0.9)" }
};

// Map continent codes to JSON data files
const continentDataFiles = {
    us: "data/north_america_countries.json",
    ca: "data/central_america_countries.json",
    sa: "data/south_america_countries.json",
    eu: "data/europe_countries.json",
    af: "data/africa_countries.json",
    asia: "data/asia_countries.json",
    oceania: "data/oceania_countries.json"
};

// Texture options
const textures = [
    '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    '//unpkg.com/three-globe/example/img/earth-night.jpg',
    '//unpkg.com/three-globe/example/img/earth-day.jpg',
    '//unpkg.com/three-globe/example/img/earth-topology.png',
    '//unpkg.com/three-globe/example/img/earth-dark.jpg'
];
let currentTextureIndex = 2; // Start with earth-day

// Initialize Globe
const globe = Globe()
    (document.getElementById('globeViz'))
    .globeImageUrl(textures[currentTextureIndex])
    .backgroundColor('#0f172a')
    .atmosphereColor('#3b82f6')
    .atmosphereAltitude(0.15)
    .width(window.innerWidth)
    .height(window.innerHeight);

// Load country to continent mapping and continent names
fetch('data/country_continent_map.json')
    .then(res => res.json())
    .then(data => {
        countryToContinentMap = data.countryToContinentMap;
        continentNames = data.continentNames;
        console.log('Country to continent mapping and continent names loaded');
    })
    .catch(error => console.error('Error loading country mapping:', error));

// Fetch country data
fetch('//cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(res => res.json())
    .then(data => {
        // Convert TopoJSON to GeoJSON
        const countries = topojson.feature(data, data.objects.countries);
        
        // Add continent info to each country
        continentData = countries.features.map(feat => {
            const countryName = feat.properties.name;
            const continent = countryToContinentMap[countryName];
            
            return {
                ...feat,
                properties: {
                    ...feat.properties,
                    continent: continent,
                    continentName: continent ? continentNames[continent] : null
                }
            };
        }).filter(feat => feat.properties.continent); // Only keep countries we've mapped
        
        // Configure globe with country polygons
        globe
            .polygonsData(continentData)
            .polygonAltitude(d => d === hoveredContinent ? 0.09 : 0.01)
            .polygonCapColor(d => {
                const continent = d.properties.continent;
                if (!continent) return 'rgba(100, 100, 100, 0.3)';
                
                const isHovered = hoveredContinent && hoveredContinent.properties.continent === continent;
                return isHovered ? continentColors[continent].hover : continentColors[continent].normal;
            })
            .polygonSideColor(() => 'rgba(0, 100, 200, 0.15)')
            .polygonStrokeColor(() => 'rgba(50, 50, 50, 0.8)')
            .polygonLabel(d => {
                const continent = d.properties.continent;
                if (!continent) return '';
                return `<div style="background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 4px; color: white; font-family: sans-serif;">${t(continentNames[continent])}</div>`;
            })
            .onPolygonHover(handlePolygonHover)
            .onPolygonClick(handlePolygonClick)
            .polygonsTransitionDuration(300);
        
        // Auto-rotate
        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 0.5;
        globe.controls().enableZoom = false;
        
        // Initial camera position (lower altitude = bigger earth)
        globe.pointOfView({ lat: 20, lng: 0, altitude: 1.8 }, 0);
    });

// Handle polygon hover
function handlePolygonHover(polygon) {
    hoveredContinent = polygon;
    
    if (polygon) {
        document.body.style.cursor = 'pointer';
        
        // Update all polygons for the same continent
        globe
            .polygonAltitude(d => {
                if (!d || !polygon) return 0.01;
                return d.properties.continent === polygon.properties.continent ? 0.09 : 0.01;
            })
            .polygonCapColor(d => {
                const continent = d.properties.continent;
                if (!continent) return 'rgba(100, 100, 100, 0.3)';
                
                const isHovered = polygon && polygon.properties.continent === continent;
                return isHovered ? continentColors[continent].hover : continentColors[continent].normal;
            });
    } else {
        document.body.style.cursor = 'default';
        
        globe
            .polygonAltitude(0.01)
            .polygonCapColor(d => {
                const continent = d.properties.continent;
                if (!continent) return 'rgba(100, 100, 100, 0.3)';
                return continentColors[continent].normal;
            });
    }
}

// Handle polygon click
async function handlePolygonClick(polygon) {
    if (polygon && polygon.properties.continent) {
        const continentCode = polygon.properties.continent;
        
        // Stop auto-rotation
        globe.controls().autoRotate = false;
        
        let lat, lng;
        
        // Try to load center from JSON data file
        if (continentDataFiles[continentCode]) {
            try {
                const response = await fetch(continentDataFiles[continentCode]);
                const data = await response.json();
                
                if (data.center) {
                    lat = data.center.lat;
                    lng = data.center.lon;
                }
            } catch (error) {
                console.warn(`Could not load center for ${continentCode}, using default`);
            }
        }
        
        // Fall back to default centers if not loaded from file
        if (lat === undefined || lng === undefined) {
            if (defaultCenters[continentCode]) {
                lat = defaultCenters[continentCode].lat;
                lng = defaultCenters[continentCode].lon;
            } else {
                // Last resort: calculate from polygon
                const coords = polygon.geometry.coordinates;
                if (polygon.geometry.type === 'Polygon') {
                    const points = coords[0];
                    lng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
                    lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
                } else if (polygon.geometry.type === 'MultiPolygon') {
                    const allPoints = coords.flat(2);
                    lng = allPoints.filter((_, i) => i % 2 === 0).reduce((sum, p) => sum + p, 0) / (allPoints.length / 2);
                    lat = allPoints.filter((_, i) => i % 2 === 1).reduce((sum, p) => sum + p, 0) / (allPoints.length / 2);
                }
            }
        }
        
        // Center the globe on the clicked continent
        globe.pointOfView({ lat, lng, altitude: 1.8 }, 1000);
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    globe.width(window.innerWidth).height(window.innerHeight);
});

// Texture switcher
document.getElementById('textureBtn').addEventListener('click', () => {
    currentTextureIndex = (currentTextureIndex + 1) % textures.length;
    globe.globeImageUrl(textures[currentTextureIndex]);
    console.log('Active texture:', textures[currentTextureIndex]);
});