// State
let locale = "en";
let hoveredContinent = null;
let continentData = [];

// Quiz state
let quizActive = false;
let quizMode = 'country'; // 'country' or 'capital'
let currentContinent = null;
let continentCountries = [];
let remainingCountries = [];
let currentCountry = null;
let score = 0;
let questionCount = 0;
let answeredCountries = new Set();
let wrongCountries = new Set();
let capitalData = {}; // Loaded from continent data files

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
        "Middle East": "Middle East",
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
        "Middle East": "Midden-Oosten",
        Oceania: "Oceanië"
    }
};

// Translation function
const t = (key) => translations[locale][key] || translations.en[key] || key;

// Map country names to continents (loaded from JSON)
let countryToContinentMap = {};
let continentNames = {};

const continentColors = {
    na: { normal: "rgba(74, 222, 128, 0.7)", hover: "rgba(34, 197, 94, 0.9)" },
    ca: { normal: "rgba(251, 146, 60, 0.7)", hover: "rgba(249, 115, 22, 0.9)" },
    sa: { normal: "rgba(168, 85, 247, 0.7)", hover: "rgba(147, 51, 234, 0.9)" },
    eu: { normal: "rgba(96, 165, 250, 0.7)", hover: "rgba(59, 130, 246, 0.9)" },
    af: { normal: "rgba(251, 191, 36, 0.7)", hover: "rgba(245, 158, 11, 0.9)" },
    asia: { normal: "rgba(244, 114, 182, 0.7)", hover: "rgba(236, 72, 153, 0.9)" },
    middleeast: { normal: "rgba(217, 119, 6, 0.7)", hover: "rgba(180, 83, 9, 0.9)" },
    oceania: { normal: "rgba(34, 211, 238, 0.7)", hover: "rgba(6, 182, 212, 0.9)" }
};

// Map continent codes to JSON data files
const continentDataFiles = {
    na: "data/north_america_countries.json",
    ca: "data/central_america_countries.json",
    sa: "data/south_america_countries.json",
    eu: "data/europe_countries.json",
    af: "data/africa_countries.json",
    asia: "data/asia_countries.json",
    middleeast: "data/middleeast_countries.json",
    oceania: "data/oceania_countries.json"
};

// Default centers for continents
const defaultCenters = {
    na: { lat: 40, lon: -100 },
    ca: { lat: 15, lon: -85 },
    sa: { lat: -15, lon: -60 },
    eu: { lat: 50, lon: 15 },
    af: { lat: 0, lon: 20 },
    asia: { lat: 30, lon: 100 },
    middleeast: { lat: 30, lon: 45 },
    oceania: { lat: -25, lon: 135 }
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
    
    if (quizActive) {
        // During quiz, only change cursor
        document.body.style.cursor = polygon && polygon.properties.continent === currentContinent ? 'pointer' : 'default';
        return;
    }
    
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
    if (quizActive && polygon && polygon.properties.continent === currentContinent) {
        // Quiz mode - check answer
        checkAnswer(polygon);
        return;
    }
    
    if (!quizActive && polygon && polygon.properties.continent) {
        // Show quiz type chooser
        showQuizChooser(polygon.properties.continent);
    }
}

// Show quiz type chooser
function showQuizChooser(continentCode) {
    currentContinent = continentCode;
    const chooser = document.getElementById('quizChooser');
    document.getElementById('chooserTitle').textContent = continentNames[continentCode];
    chooser.classList.remove('hidden');
    
    // Stop auto-rotation
    globe.controls().autoRotate = false;
    
    // Center on continent
    if (defaultCenters[continentCode]) {
        globe.pointOfView({
            lat: defaultCenters[continentCode].lat,
            lng: defaultCenters[continentCode].lon,
            altitude: 1.5
        }, 1000);
    }
}

// Hide quiz chooser
function hideQuizChooser() {
    document.getElementById('quizChooser').classList.add('hidden');
    currentContinent = null;
    globe.controls().autoRotate = true;
    globe.pointOfView({ lat: 20, lng: 0, altitude: 1.8 }, 1000);
}

// Start quiz for a continent
async function startQuiz(continentCode, mode) {
    quizActive = true;
    quizMode = mode;
    currentContinent = continentCode;
    
    // Hide chooser
    document.getElementById('quizChooser').classList.add('hidden');
    
    // Stop auto-rotation and disable manual rotation
    globe.controls().autoRotate = false;
    globe.controls().enableRotate = false;
    
    // Load capital data if needed
    if (mode === 'capital' && continentDataFiles[continentCode]) {
        try {
            const response = await fetch(continentDataFiles[continentCode]);
            const data = await response.json();
            capitalData = data.capitals || {};
        } catch (error) {
            console.error('Error loading capital data:', error);
            capitalData = {};
        }
    }
    
    // Get all countries for this continent
    continentCountries = continentData.filter(d => d.properties.continent === continentCode);
    
    // For capital quiz, only include countries that have capitals in the data
    if (mode === 'capital') {
        continentCountries = continentCountries.filter(d => capitalData[d.properties.name]);
    }
    
    remainingCountries = [...continentCountries];
    answeredCountries.clear();
    wrongCountries.clear();
    score = 0;
    questionCount = 0;
    
    // Show quiz panel
    document.getElementById('quizPanel').classList.remove('hidden');
    const modeLabel = mode === 'capital' ? ' – Capitals' : ' – Countries';
    document.getElementById('continentTitle').textContent = continentNames[continentCode] + modeLabel;
    document.getElementById('score').textContent = score;
    document.getElementById('questionCount').textContent = questionCount;
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
    
    // Center on continent
    if (defaultCenters[continentCode]) {
        globe.pointOfView({
            lat: defaultCenters[continentCode].lat,
            lng: defaultCenters[continentCode].lon,
            altitude: 1.5
        }, 1000);
    }
    
    // Reset all countries to normal state
    updateGlobeColors();
    
    // Show capital dots for capital quiz
    if (mode === 'capital') {
        const capitalPoints = continentCountries
            .filter(d => capitalData[d.properties.name])
            .map(d => {
                const cap = capitalData[d.properties.name];
                return {
                    lat: cap.lat,
                    lng: cap.lon,
                    name: cap.capital,
                    country: d.properties.name,
                    size: 0.3,
                    color: 'rgba(255, 255, 255, 0.9)'
                };
            });
        globe
            .pointsData(capitalPoints)
            .pointAltitude(0.02)
            .pointRadius('size')
            .pointColor('color')
            .pointLabel(() => '')
            .onPointClick(point => {
                // Find the polygon for this capital's country
                const polygon = continentCountries.find(d => d.properties.name === point.country);
                if (polygon) {
                    checkAnswer(polygon);
                }
            });
    } else {
        globe.pointsData([]);
    }
    
    // Start first question
    setTimeout(() => pickNextCountry(), 1000);
}

// Pick next country to quiz
function pickNextCountry() {
    if (remainingCountries.length === 0) {
        document.getElementById('countryName').textContent = 'Quiz Complete!';
        document.getElementById('quizPrompt').textContent = `Final Score: ${score}/${questionCount}`;
        document.getElementById('feedback').textContent = '';
        return;
    }
    
    const index = Math.floor(Math.random() * remainingCountries.length);
    currentCountry = remainingCountries[index];
    
    questionCount++;
    document.getElementById('questionCount').textContent = questionCount;
    
    if (quizMode === 'capital') {
        const cap = capitalData[currentCountry.properties.name];
        document.getElementById('quizPrompt').textContent = 'Which country has the capital:';
        document.getElementById('countryName').textContent = cap ? cap.capital : currentCountry.properties.name;
    } else {
        document.getElementById('quizPrompt').textContent = 'Click on:';
        document.getElementById('countryName').textContent = currentCountry.properties.name;
    }
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
}

// Check answer
function checkAnswer(clickedPolygon) {
    if (!currentCountry) return;
    
    const feedbackEl = document.getElementById('feedback');
    
    if (clickedPolygon.properties.name === currentCountry.properties.name) {
        // Correct answer
        score++;
        document.getElementById('score').textContent = score;
        feedbackEl.textContent = '✓ Correct!';
        feedbackEl.className = 'feedback correct';
        
        // Mark as answered
        answeredCountries.add(currentCountry.properties.name);
        
        // Remove from remaining
        remainingCountries = remainingCountries.filter(c => c !== currentCountry);
        
        // Update globe to show answered country
        updateGlobeColors();
        
        // Next question after delay
        setTimeout(() => pickNextCountry(), 1000);
    } else {
        // Wrong answer
        if (quizMode === 'capital') {
            const cap = capitalData[currentCountry.properties.name];
            feedbackEl.textContent = `✗ Wrong! ${cap ? cap.capital : ''} is the capital of ${currentCountry.properties.name}`;
        } else {
            feedbackEl.textContent = `✗ Wrong! That was ${clickedPolygon.properties.name}`;
        }
        feedbackEl.className = 'feedback wrong';
        
        // Mark current country as wrong
        wrongCountries.add(currentCountry.properties.name);
        
        // Remove from remaining
        remainingCountries = remainingCountries.filter(c => c !== currentCountry);
        
        // Update globe to show wrong country dropped and red
        updateGlobeColors();
        
        // Next question after delay
        setTimeout(() => pickNextCountry(), 3000);
    }
}

// Update globe colors based on quiz state
function updateGlobeColors() {
    globe.polygonAltitude(d => {
        if (!d || !d.properties.continent) return 0.01;
        if (quizActive && d.properties.continent !== currentContinent) return 0.01;
        if (answeredCountries.has(d.properties.name)) return 0.005; // Lower for correct
        if (wrongCountries.has(d.properties.name)) return 0.005; // Lower for wrong
        return 0.01;
    }).polygonCapColor(d => {
        const continent = d.properties.continent;
        if (!continent) return 'rgba(100, 100, 100, 0.3)';
        
        if (quizActive) {
            if (continent !== currentContinent) {
                // Dim other continents during quiz
                return 'rgba(100, 100, 100, 0.2)';
            }
            
            // Show answered countries in green
            if (answeredCountries.has(d.properties.name)) {
                return 'rgba(34, 197, 94, 0.7)';
            }
            
            // Show wrong countries in red
            if (wrongCountries.has(d.properties.name)) {
                return 'rgba(239, 68, 68, 0.7)';
            }
            
            // Active continent countries
            return continentColors[continent].normal;
        }
        
        return continentColors[continent].normal;
    });
}

// Exit quiz
function exitQuiz() {
    quizActive = false;
    currentContinent = null;
    currentCountry = null;
    continentCountries = [];
    remainingCountries = [];
    answeredCountries.clear();
    wrongCountries.clear();
    
    document.getElementById('quizPanel').classList.add('hidden');
    
    // Reset globe
    globe.controls().autoRotate = true;
    globe.controls().enableRotate = true;
    globe.pointOfView({ lat: 20, lng: 0, altitude: 1.8 }, 1000);
    globe.pointsData([]);
    updateGlobeColors();
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

// Exit quiz button
document.getElementById('exitQuizBtn').addEventListener('click', () => {
    exitQuiz();
});

// Quiz chooser buttons
document.getElementById('chooseCountryQuiz').addEventListener('click', () => {
    startQuiz(currentContinent, 'country');
});

document.getElementById('chooseCapitalQuiz').addEventListener('click', () => {
    startQuiz(currentContinent, 'capital');
});

document.getElementById('cancelChooser').addEventListener('click', () => {
    hideQuizChooser();
});