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

// Map country names to continents
const countryToContinentMap = {
    // North America
    "United States of America": "us",
    "Canada": "us",
    "Mexico": "us",
    "Greenland": "us",
    
    // Central America & Caribbean
    "Guatemala": "ca",
    "Belize": "ca",
    "Honduras": "ca",
    "El Salvador": "ca",
    "Nicaragua": "ca",
    "Costa Rica": "ca",
    "Panama": "ca",
    "Cuba": "ca",
    "Jamaica": "ca",
    "Haiti": "ca",
    "Dominican Republic": "ca",
    "Dominican Rep.": "ca",
    "Puerto Rico": "ca",
    "Bahamas": "ca",
    "Barbados": "ca",
    "Saint Lucia": "ca",
    "St. Lucia": "ca",
    "Grenada": "ca",
    "Saint Vincent and the Grenadines": "ca",
    "St. Vincent and the Grenadines": "ca",
    "Antigua and Barbuda": "ca",
    "Dominica": "ca",
    "Saint Kitts and Nevis": "ca",
    "St. Kitts and Nevis": "ca",
    "Trinidad and Tobago": "ca",
    
    // South America
    "Brazil": "sa",
    "Argentina": "sa",
    "Chile": "sa",
    "Colombia": "sa",
    "Peru": "sa",
    "Venezuela": "sa",
    "Ecuador": "sa",
    "Bolivia": "sa",
    "Paraguay": "sa",
    "Uruguay": "sa",
    "Guyana": "sa",
    "Suriname": "sa",
    "French Guiana": "sa",
    
    // Europe
    "United Kingdom": "eu",
    "France": "eu",
    "Germany": "eu",
    "Spain": "eu",
    "Italy": "eu",
    "Poland": "eu",
    "Ukraine": "eu",
    "Romania": "eu",
    "Netherlands": "eu",
    "Belgium": "eu",
    "Greece": "eu",
    "Portugal": "eu",
    "Sweden": "eu",
    "Austria": "eu",
    "Switzerland": "eu",
    "Norway": "eu",
    "Denmark": "eu",
    "Finland": "eu",
    "Ireland": "eu",
    "Russia": "eu",
    "Iceland": "eu",
    "Czech Republic": "eu",
    "Czechia": "eu",
    "Hungary": "eu",
    "Slovakia": "eu",
    "Bulgaria": "eu",
    "Serbia": "eu",
    "Croatia": "eu",
    "Bosnia and Herzegovina": "eu",
    "Bosnia and Herz.": "eu",
    "Slovenia": "eu",
    "Lithuania": "eu",
    "Latvia": "eu",
    "Estonia": "eu",
    "North Macedonia": "eu",
    "Macedonia": "eu",
    "Albania": "eu",
    "Montenegro": "eu",
    "Kosovo": "eu",
    "Moldova": "eu",
    "Belarus": "eu",
    "Luxembourg": "eu",
    "Malta": "eu",
    "Cyprus": "eu",
    "Andorra": "eu",
    "Monaco": "eu",
    "Liechtenstein": "eu",
    "San Marino": "eu",
    "Vatican": "eu",
    "Vatican City": "eu",
    
    // Africa
    "South Africa": "af",
    "Egypt": "af",
    "Nigeria": "af",
    "Ethiopia": "af",
    "Kenya": "af",
    "Tanzania": "af",
    "Algeria": "af",
    "Morocco": "af",
    "Ghana": "af",
    "Mozambique": "af",
    "Madagascar": "af",
    "Cameroon": "af",
    "Angola": "af",
    "Sudan": "af",
    "Uganda": "af",
    "Libya": "af",
    "Tunisia": "af",
    "Zimbabwe": "af",
    "Zambia": "af",
    "Mali": "af",
    "Niger": "af",
    "Chad": "af",
    "Somalia": "af",
    "Somaliland": "af",
    "Senegal": "af",
    "Guinea": "af",
    "Rwanda": "af",
    "Benin": "af",
    "Burundi": "af",
    "Tunisia": "af",
    "South Sudan": "af",
    "Togo": "af",
    "Sierra Leone": "af",
    "Libya": "af",
    "Liberia": "af",
    "Mauritania": "af",
    "Eritrea": "af",
    "Namibia": "af",
    "Botswana": "af",
    "Gabon": "af",
    "Lesotho": "af",
    "Guinea-Bissau": "af",
    "Equatorial Guinea": "af",
    "Eq. Guinea": "af",
    "Mauritius": "af",
    "Eswatini": "af",
    "Djibouti": "af",
    "Comoros": "af",
    "Cape Verde": "af",
    "Sao Tome and Principe": "af",
    "Seychelles": "af",
    "Burkina Faso": "af",
    "Central African Republic": "af",
    "Central African Rep.": "af",
    "Congo": "af",
    "Dem. Rep. Congo": "af",
    "Democratic Republic of the Congo": "af",
    "Ivory Coast": "af",
    "Côte d'Ivoire": "af",
    "Malawi": "af",
    "South Sudan": "af",
    "S. Sudan": "af",
    
    // Asia
    "China": "asia",
    "India": "asia",
    "Indonesia": "asia",
    "Pakistan": "asia",
    "Bangladesh": "asia",
    "Japan": "asia",
    "Philippines": "asia",
    "Vietnam": "asia",
    "Turkey": "asia",
    "Iran": "asia",
    "Thailand": "asia",
    "Myanmar": "asia",
    "South Korea": "asia",
    "Afghanistan": "asia",
    "Saudi Arabia": "asia",
    "Malaysia": "asia",
    "Nepal": "asia",
    "Sri Lanka": "asia",
    "Mongolia": "asia",
    "Iraq": "asia",
    "Syria": "asia",
    "Lebanon": "asia",
    "Jordan": "asia",
    "Israel": "asia",
    "Palestine": "asia",
    "Yemen": "asia",
    "Oman": "asia",
    "United Arab Emirates": "asia",
    "Kuwait": "asia",
    "Bahrain": "asia",
    "Qatar": "asia",
    "Azerbaijan": "asia",
    "Armenia": "asia",
    "Georgia": "asia",
    "Kazakhstan": "asia",
    "Uzbekistan": "asia",
    "Turkmenistan": "asia",
    "Tajikistan": "asia",
    "Kyrgyzstan": "asia",
    "North Korea": "asia",
    "Cambodia": "asia",
    "Laos": "asia",
    "Singapore": "asia",
    "Brunei": "asia",
    "Timor-Leste": "asia",
    "East Timor": "asia",
    "Bhutan": "asia",
    "Maldives": "asia",
    
    // Oceania
    "Australia": "oceania",
    "Papua New Guinea": "oceania",
    "New Zealand": "oceania",
    "Fiji": "oceania",
    "Solomon Islands": "oceania"
};

const continentColors = {
    us: { normal: "rgba(74, 222, 128, 0.7)", hover: "rgba(34, 197, 94, 0.9)" },
    ca: { normal: "rgba(251, 146, 60, 0.7)", hover: "rgba(249, 115, 22, 0.9)" },
    sa: { normal: "rgba(168, 85, 247, 0.7)", hover: "rgba(147, 51, 234, 0.9)" },
    eu: { normal: "rgba(96, 165, 250, 0.7)", hover: "rgba(59, 130, 246, 0.9)" },
    af: { normal: "rgba(251, 191, 36, 0.7)", hover: "rgba(245, 158, 11, 0.9)" },
    asia: { normal: "rgba(244, 114, 182, 0.7)", hover: "rgba(236, 72, 153, 0.9)" },
    oceania: { normal: "rgba(34, 211, 238, 0.7)", hover: "rgba(6, 182, 212, 0.9)" }
};

const continentNames = {
    us: "North America",
    ca: "Central America",
    sa: "South America",
    eu: "Europe",
    af: "Africa",
    asia: "Asia",
    oceania: "Oceania"
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
function handlePolygonClick(polygon) {
    if (polygon && polygon.properties.continent) {
        const region = polygon.properties.continent;
        
        // Add transition effect
        document.body.style.transition = "opacity 0.5s ease";
        document.body.style.opacity = "0";
        
        setTimeout(() => {
            window.location.href = `index.html?region=${region}`;
        }, 500);
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