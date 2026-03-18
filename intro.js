// State
let locale = "en";
let hoveredContinent = null;
let continentData = [];

// Unified Quiz State
let quizActive = false;
let quizMode = 'country';    // 'country', 'capital', 'state', or 'state-capital'
let currentContinent = null; // active continent code (country/capital quiz)
let stateData = [];          // loaded state boundaries (state quiz)
let quizItems = [];          // all items for current quiz (countries or states)
let currentQuestion = null;  // item currently being asked
let answeredItems = new Set();
let wrongItems = new Set();
let score = 0;
let questionCount = 0;
let capitalData = {};
let pickingCountry = false;  // true when waiting for user to click a country on the globe
let pickingCountryMode = 'state';

// Countries available for state/province quiz, keyed by their WorldAtlas name
const stateQuizCountryMap = {
    'United States of America': 'usa',
    'Canada': 'canada',
    'Mexico': 'mexico',
    'Netherlands': 'nl'
};

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

// Continent colors – loaded from data/settings.json
let continentColors = {};
let borders = { strokeColor: 'rgba(255,255,255,1)', sideColor: 'rgba(0,100,200,0.15)' };
let backgroundColor = 'rgba(15, 23, 42, 1)';
let altitudes = { normal: 0.01, selected: 0.09, answered: 0.005 };
let capitalColors = { normal: 'rgba(255, 255, 255, 0.9)', correct: 'rgba(22, 163, 74, 0.9)', wrong: 'rgba(185, 28, 28, 0.9)' };
let countryQuizColors = { correct: 'rgba(34, 197, 94, 0.7)', wrong: 'rgba(239, 68, 68, 0.7)' };

fetch('data/settings.json')
    .then(res => res.json())
    .then(data => {
        continentColors = data.continentColors;
        if (data.borders) borders = data.borders;
        if (data.backgroundColor) backgroundColor = data.backgroundColor;
        if (data.altitudes) altitudes = data.altitudes;
        if (data.capitalColors) capitalColors = data.capitalColors;
        if (data.countryQuizColors) countryQuizColors = data.countryQuizColors;
    })
    .catch(error => console.error('Error loading settings:', error));

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

// Zoom levels per continent, loaded from JSON
const continentZoom = {};
const defaultZoom = 1.5;

// Pre-load center and zoom levels from all continent data files
Promise.all(
    Object.entries(continentDataFiles).map(([code, file]) =>
        fetch(file)
            .then(res => res.json())
            .then(data => {
                if (data.center !== undefined) defaultCenters[code] = { lat: data.center.lat, lon: data.center.lon };
                if (data.zoom !== undefined) continentZoom[code] = data.zoom;
            })
            .catch(() => {})
    )
);

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
    .backgroundColor(backgroundColor)
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
            .polygonAltitude(d => d === hoveredContinent ? altitudes.selected : altitudes.normal)
            .polygonCapColor(d => {
                const continent = d.properties.continent;
                if (!continent) return 'rgba(100, 100, 100, 0.3)';
                
                const isHovered = hoveredContinent && hoveredContinent.properties.continent === continent;
                return isHovered ? continentColors[continent].hover : continentColors[continent].normal;
            })
            .polygonSideColor(() => borders.sideColor)
            .polygonStrokeColor(() => borders.strokeColor)
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
        globe.controls().enableZoom = true;
        
        // Initial camera position (lower altitude = bigger earth)
        globe.pointOfView({ lat: 20, lng: 0, altitude: 1.8 }, 0);
    });

// Handle polygon hover
function handlePolygonHover(polygon) {
    hoveredContinent = polygon;

    if (pickingCountry) {
        const isPickable = polygon && stateQuizCountryMap[polygon.properties.name];
        document.body.style.cursor = isPickable ? 'pointer' : 'default';
        globe
            .polygonAltitude(d => {
                if (stateQuizCountryMap[d.properties.name]) {
                    return d === polygon ? altitudes.selected * 1.5 : altitudes.selected;
                }
                return altitudes.normal;
            })
            .polygonCapColor(d => {
                if (!stateQuizCountryMap[d.properties.name]) return 'rgba(100, 100, 100, 0.15)';
                const continent = d.properties.continent;
                if (d === polygon) return continentColors[continent]?.hover || 'rgba(147, 197, 253, 1)';
                return continentColors[continent]?.normal || 'rgba(74, 222, 128, 0.7)';
            });
        return;
    }

    if (quizActive) {
        document.body.style.cursor = polygon && polygon.properties.continent === currentContinent ? 'pointer' : 'default';
        return;
    }

    if (!document.getElementById('quizChooser').classList.contains('hidden')) return;

    if (polygon) {
        document.body.style.cursor = 'pointer';
        globe
            .polygonAltitude(d => {
                if (!d || !polygon) return altitudes.normal;
                return d.properties.continent === polygon.properties.continent ? altitudes.selected : altitudes.normal;
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
            .polygonAltitude(altitudes.normal)
            .polygonCapColor(d => {
                const continent = d.properties.continent;
                if (!continent) return 'rgba(100, 100, 100, 0.3)';
                return continentColors[continent].normal;
            });
    }
}

// Handle polygon click (country quiz)
function handlePolygonClick(polygon) {
    if (pickingCountry) {
        if (polygon && stateQuizCountryMap[polygon.properties.name]) {
            cancelPickCountry();
            startStateQuiz(stateQuizCountryMap[polygon.properties.name], pickingCountryMode);
        }
        return;
    }
    if (quizActive && polygon && polygon.properties.continent === currentContinent) {
        checkQuizAnswer(polygon);
        return;
    }
    if (!quizActive && polygon && polygon.properties.continent) {
        showQuizChooser(polygon.properties.continent);
    }
}

// Handle state polygon hover
function handleStateHover(polygon) {
    document.body.style.cursor = polygon ? 'pointer' : 'default';
}

// Handle state polygon click
function handleStateClick(polygon) {
    if (!quizActive || (quizMode !== 'state' && quizMode !== 'state-capital') || !polygon) return;
    checkQuizAnswer(polygon);
}

// Show quiz type chooser
function showQuizChooser(continentCode) {
    currentContinent = continentCode;
    const chooser = document.getElementById('quizChooser');
    document.getElementById('chooserTitle').textContent = continentNames[continentCode];
    
    // Show/hide state quiz buttons based on continent
    const hasStateQuiz = continentCode === 'na' || continentCode === 'eu';
    document.getElementById('chooseStateQuiz').style.display = hasStateQuiz ? 'block' : 'none';
    document.getElementById('chooseStateCapitalQuiz').style.display = hasStateQuiz ? 'block' : 'none';
    
    chooser.classList.remove('hidden');
    document.getElementById('quizChooserOverlay').classList.remove('hidden');
    
    // Stop auto-rotation
    globe.controls().autoRotate = false;
    
    // Center on continent
    if (defaultCenters[continentCode]) {
        globe.pointOfView({
            lat: defaultCenters[continentCode].lat,
            lng: defaultCenters[continentCode].lon,
            altitude: continentZoom[continentCode] ?? defaultZoom
        }, 1000);
    }
}

// Hide quiz chooser
function hideQuizChooser() {
    document.getElementById('quizChooser').classList.add('hidden');
    document.getElementById('quizChooserOverlay').classList.add('hidden');
    currentContinent = null;
    globe.controls().autoRotate = true;
    const currentLng = globe.pointOfView().lng;
    globe.pointOfView({ lat: 20, lng: currentLng, altitude: 1.8 }, 1000);
}

// Enter globe-click mode for picking a country to start a state quiz
function showCountrySelection(continentCode, mode = 'state') {
    document.getElementById('quizChooser').classList.add('hidden');
    document.getElementById('quizChooserOverlay').classList.add('hidden');
    pickingCountry = true;
    pickingCountryMode = mode;
    document.getElementById('pickCountryHint').classList.remove('hidden');
    globe.controls().autoRotate = false;
    globe.controls().enableRotate = false;
    // Highlight pickable countries, dim the rest
    globe
        .polygonCapColor(d => {
            if (!stateQuizCountryMap[d.properties.name]) return 'rgba(100, 100, 100, 0.15)';
            const continent = d.properties.continent;
            return continentColors[continent]?.normal || 'rgba(74, 222, 128, 0.7)';
        })
        .polygonAltitude(d => stateQuizCountryMap[d.properties.name]
            ? altitudes.selected
            : altitudes.normal)
        .polygonLabel(d => stateQuizCountryMap[d.properties.name]
            ? `<div style="background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 4px; color: white; font-family: sans-serif;">${d.properties.name}</div>`
            : '');
}

// Cancel country-picking mode and restore globe
function cancelPickCountry() {
    pickingCountry = false;
    currentContinent = null;
    document.getElementById('pickCountryHint').classList.add('hidden');
    globe.controls().autoRotate = true;
    globe
        .polygonAltitude(altitudes.normal)
        .polygonCapColor(d => {
            const continent = d.properties.continent;
            if (!continent) return 'rgba(100, 100, 100, 0.3)';
            return continentColors[continent].normal;
        })
        .polygonLabel(d => {
            const continent = d.properties.continent;
            if (!continent) return '';
            return `<div style="background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 4px; color: white; font-family: sans-serif;">${t(continentNames[continent])}</div>`;
        });
    const currentLng = globe.pointOfView().lng;
    globe.pointOfView({ lat: 20, lng: currentLng, altitude: 1.8 }, 1000);
}

// Start state quiz for a country (delegates to unified startQuiz)
async function startStateQuiz(countryCode, mode = 'state') {
    globe.controls().autoRotate = false;
    globe.controls().enableRotate = false;
    const titles = {
        usa:    { state: 'United States – States',      'state-capital': 'United States – State Capitals' },
        canada: { state: 'Canada – Provinces',          'state-capital': 'Canada – Province Capitals' },
        mexico: { state: 'Mexico – States',             'state-capital': 'Mexico – State Capitals' },
        nl:     { state: 'Netherlands – Provinces',     'state-capital': 'Netherlands – Province Capitals' }
    };
    try {
        await loadStatesData(countryCode, titles[countryCode]?.[mode] || countryCode);
        startQuiz(null, mode, stateData);
    } catch (error) {
        console.error('Error starting state quiz:', error);
        cancelPickCountry();
    }
}

// Country configurations for state/province loading
const countryConfigs = {
    usa:    { configFile: 'data/country_usa.json',    topoFile: './data/country_usa_TopoJSON.json' },
    canada: { configFile: 'data/country_canada.json', topoFile: './data/country_canada_TopoJSON.json' },
    mexico: { configFile: 'data/country_mexico.json', topoFile: './data/country_mexico_TopoJSON.json' },
    nl:     { configFile: 'data/country_nl.json',     topoFile: './data/country_nl_TopoJSON.json' }
};

// Load states/provinces data for a country
async function loadStatesData(countryCode, title) {
    try {
        const config = countryConfigs[countryCode];
        if (!config) {
            throw new Error(`No configuration found for country: ${countryCode}`);
        }
        
        // Load country data and TopoJSON in parallel
        const [configDataResponse, topoResponse] = await Promise.all([
            fetch(config.configFile),
            fetch(config.topoFile)
        ]);
        
        const countryConfigData = await configDataResponse.json();
        const topology = await topoResponse.json();
        
        // Find the correct TopoJSON object
        const topoObjects = countryConfigData.topoObjects || [];
        const nameProps = countryConfigData.nameProps || ['NAME', 'name'];
        const allowList = countryConfigData.states || countryConfigData.provinces || null;

        let topoObject = null;
        for (const objName of topoObjects) {
            if (topology.objects[objName]) {
                topoObject = topology.objects[objName];
                break;
            }
        }
        
        // Fallback to first available object
        if (!topoObject) {
            const firstKey = Object.keys(topology.objects)[0];
            topoObject = topology.objects[firstKey];
        }
        
        const statesGeoJSON = topojson.feature(topology, topoObject);
        
        // Extract names from properties and add capital data
        stateData = statesGeoJSON.features.map(feat => {
            const props = feat.properties || {};
            
            // Try property names in order of preference
            let stateName = 'Unknown';
            for (const propName of nameProps) {
                if (props[propName]) {
                    stateName = props[propName];
                    break;
                }
            }
            
            // Get capital info from config data
            const capitalInfo = countryConfigData.capitals[stateName];
            
            return {
                ...feat,
                properties: {
                    ...props,
                    name: stateName,
                    capital: capitalInfo?.capital || null,
                    capitalCoords: capitalInfo ? [capitalInfo.lon, capitalInfo.lat] : null
                }
            };
        }).filter(feat =>
            feat.properties.name !== 'Unknown' &&
            feat.geometry && feat.geometry.type &&
            (!allowList || allowList.includes(feat.properties.name.toLowerCase()))
        );
        
        // Set the quiz title
        document.getElementById('continentTitle').textContent = title;
        
        // Configure globe with state polygons
        globe
            .polygonsData(stateData)
            .polygonAltitude(d => altitudes.selected)
            .polygonCapColor(d => 'rgba(74, 222, 128, 0.7)')
            .polygonSideColor(() => borders.sideColor)
            .polygonStrokeColor(() => borders.strokeColor)
            .polygonLabel(() => '') // No tooltip during state quiz
            .onPolygonHover(handleStateHover)
            .onPolygonClick(handleStateClick)
            .polygonsTransitionDuration(300);
            
        // Remove country polygons points
        globe.pointsData([]);
        
        // Center on country using config data
        let view = { lat: 40, lng: -100, altitude: 1.5 }; // default
        
        if (countryConfigData && countryConfigData.center && countryConfigData.zoom) {
            view = {
                lat: countryConfigData.center.lat,
                lng: countryConfigData.center.lon,
                altitude: countryConfigData.zoom
            };
        } else {
            const countryViews = {
                usa: { lat: 40, lng: -100, altitude: 1.5 },
                canada: { lat: 60, lng: -105, altitude: 1.8 },
                mexico: { lat: 23, lng: -102, altitude: 1.4 }
            };
            view = countryViews[countryCode] || view;
        }
        globe.pointOfView(view, 1000);
        
        console.log(`${countryCode.toUpperCase()} states/provinces loaded:`, stateData.length);
        console.log('States:', stateData.map(s => s.properties.name).join(', '));
        
    } catch (error) {
        console.error(`Error loading ${countryCode} data:`, error);
        throw error;
    }
}


// Start quiz - unified entry point for country, capital and state quizzes.
// continentCode is set for country/capital quizzes; items is already loaded for state quiz.
async function startQuiz(continentCode, mode, items = null) {
    quizActive = true;
    quizMode = mode;
    currentContinent = continentCode;
    answeredItems.clear();
    wrongItems.clear();
    score = 0;
    questionCount = 0;

    if (mode !== 'state' && mode !== 'state-capital') {
        // Hide continent chooser
        document.getElementById('quizChooser').classList.add('hidden');
        document.getElementById('quizChooserOverlay').classList.add('hidden');
        globe.controls().autoRotate = false;
        globe.controls().enableRotate = false;
    }

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

    // Build quiz items list
    if (mode === 'state') {
        quizItems = items || stateData;
    } else if (mode === 'state-capital') {
        quizItems = (items || stateData).filter(d => d.properties.capitalCoords);
    } else {
        quizItems = continentData.filter(d => d.properties.continent === continentCode);
        if (mode === 'capital') {
            quizItems = quizItems.filter(d => capitalData[d.properties.name]);
        }
    }

    // Set quiz title
    if (mode === 'state' || mode === 'state-capital') {
        // Title already set by loadStatesData
    } else {
        const modeLabel = mode === 'capital' ? ' – Capitals' : ' – Countries';
        document.getElementById('continentTitle').textContent = continentNames[continentCode] + modeLabel;
    }

    // Show quiz panel and reset UI
    document.getElementById('quizPanel').classList.remove('hidden');
    document.getElementById('score').textContent = score;
    document.getElementById('questionCount').textContent = questionCount;
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';

    // Center view
    if (mode !== 'state' && mode !== 'state-capital' && defaultCenters[continentCode]) {
        globe.pointOfView({
            lat: defaultCenters[continentCode].lat,
            lng: defaultCenters[continentCode].lon,
            altitude: continentZoom[continentCode] ?? defaultZoom
        }, 1000);
    }

    // Configure globe polygons
    if (mode === 'state' || mode === 'state-capital') {
        // Globe already configured with state polygons in loadStatesData
    } else {
        updateQuizColors();
    }

    // Show capital dots for capital and state-capital quizzes
    if (mode === 'capital' || mode === 'state-capital') {
        const capitalPoints = quizItems.map(d => {
            const isState = mode === 'state-capital';
            const lat  = isState ? d.properties.capitalCoords[1] : capitalData[d.properties.name].lat;
            const lng  = isState ? d.properties.capitalCoords[0] : capitalData[d.properties.name].lon;
            const name = isState ? d.properties.capital          : capitalData[d.properties.name].capital;
            return { lat, lng, name, key: d.properties.name, color: capitalColors.normal };
        });
        globe
            .pointsData(capitalPoints)
            .pointAltitude(d => {
                const base = answeredItems.has(d.key) || wrongItems.has(d.key) ? altitudes.answered : altitudes.selected;
                return base + (altitudes.capitalOffset || 0);
            })
            .pointRadius(() => globe.pointOfView().altitude * 0.2)
            .pointColor('color')
            .pointLabel(() => '')
            .pointsTransitionDuration(300)
            .onPointClick(point => {
                const item = quizItems.find(d => d.properties.name === point.key);
                if (item) checkQuizAnswer(item);
            });
    } else {
        globe.pointsData([]);
    }

    setTimeout(() => pickNextQuestion(), 1000);
}

// Pick next question (unified for country, capital and state quizzes)
function pickNextQuestion() {
    const eligible = quizItems.filter(item =>
        !answeredItems.has(item.properties.name) &&
        !wrongItems.has(item.properties.name)
    );

    if (!eligible.length) {
        document.getElementById('countryName').textContent = 'Quiz Complete!';
        document.getElementById('quizPrompt').textContent = `Final Score: ${score}/${questionCount}`;
        document.getElementById('feedback').textContent = '';
        return;
    }

    currentQuestion = eligible[Math.floor(Math.random() * eligible.length)];
    questionCount++;
    document.getElementById('questionCount').textContent = questionCount;
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';

    if (quizMode === 'capital' || quizMode === 'state-capital') {
        const capName = quizMode === 'capital'
            ? capitalData[currentQuestion.properties.name]?.capital
            : currentQuestion.properties.capital;
        document.getElementById('quizPrompt').textContent = '';
        document.getElementById('countryName').textContent = capName || currentQuestion.properties.name;
    } else {
        document.getElementById('quizPrompt').textContent = '';
        document.getElementById('countryName').textContent = currentQuestion.properties.name;
    }
}

// Check quiz answer (unified for country, capital and state quizzes)
function checkQuizAnswer(clickedItem) {
    if (!currentQuestion) return;
    const feedbackEl = document.getElementById('feedback');
    const correct = clickedItem.properties.name === currentQuestion.properties.name;

    if (correct) {
        score++;
        document.getElementById('score').textContent = score;
        feedbackEl.textContent = '✓ Correct!';
        feedbackEl.className = 'feedback correct';
        answeredItems.add(currentQuestion.properties.name);
        updateQuizColors();
        setTimeout(() => pickNextQuestion(), 1000);
    } else {
        if (quizMode === 'capital' || quizMode === 'state-capital') {
            const capName = quizMode === 'capital'
                ? capitalData[currentQuestion.properties.name]?.capital || ''
                : currentQuestion.properties.capital;
            feedbackEl.textContent = `✗ Wrong! ${capName} is the capital of ${currentQuestion.properties.name}`;
        } else {
            feedbackEl.textContent = `✗ Wrong! That was ${clickedItem.properties.name}`;
        }
        feedbackEl.className = 'feedback wrong';
        wrongItems.add(currentQuestion.properties.name);
        updateQuizColors();
        setTimeout(() => pickNextQuestion(), 3000);
    }
}

// Update polygon (and point) colors based on current quiz state
function updateQuizColors() {
    if (quizMode === 'state' || quizMode === 'state-capital') {
        globe.polygonAltitude(d => {
            if (answeredItems.has(d.properties.name) || wrongItems.has(d.properties.name)) return altitudes.answered;
            return altitudes.selected;
        }).polygonCapColor(d => {
            if (answeredItems.has(d.properties.name)) return countryQuizColors.correct;
            if (wrongItems.has(d.properties.name)) return countryQuizColors.wrong;
            return 'rgba(74, 222, 128, 0.7)';
        });
    } else {
        globe.polygonAltitude(d => {
            if (!d || !d.properties.continent) return altitudes.normal;
            if (quizActive && d.properties.continent !== currentContinent) return altitudes.normal;
            if (answeredItems.has(d.properties.name) || wrongItems.has(d.properties.name)) return altitudes.answered;
            if (quizActive && d.properties.continent === currentContinent) return altitudes.selected;
            return altitudes.normal;
        }).polygonCapColor(d => {
            const continent = d.properties.continent;
            if (!continent) return 'rgba(100, 100, 100, 0.3)';
            if (quizActive) {
                if (continent !== currentContinent) return 'rgba(100, 100, 100, 0.2)';
                if (answeredItems.has(d.properties.name)) return countryQuizColors.correct;
                if (wrongItems.has(d.properties.name)) return countryQuizColors.wrong;
                return continentColors[continent].normal;
            }
            return continentColors[continent].normal;
        });
    }

    // Update capital dot colors for capital and state-capital quizzes
    if (quizActive && (quizMode === 'capital' || quizMode === 'state-capital')) {
        globe.pointAltitude(d => {
            const base = answeredItems.has(d.key) || wrongItems.has(d.key) ? altitudes.answered : altitudes.selected;
            return base + (altitudes.capitalOffset || 0);
        }).pointColor(d => {
            if (answeredItems.has(d.key)) return capitalColors.correct;
            if (wrongItems.has(d.key)) return capitalColors.wrong;
            return capitalColors.normal;
        });
    }
}

// Exit quiz
function exitQuiz() {
    quizActive = false;
    const wasStateMode = quizMode === 'state' || quizMode === 'state-capital';

    currentContinent = null;
    currentQuestion = null;
    quizItems = [];
    answeredItems.clear();
    wrongItems.clear();
    quizMode = 'country';

    document.getElementById('quizPanel').classList.add('hidden');

    // Reset globe
    globe.controls().autoRotate = true;
    globe.controls().enableRotate = true;
    globe.pointOfView({ lat: 20, lng: 0, altitude: 1.8 }, 1000);
    globe.pointsData([]);

    if (wasStateMode) {
        // Restore continent polygons
        stateData = [];
        globe
            .polygonsData(continentData)
            .polygonAltitude(d => d === hoveredContinent ? altitudes.selected : altitudes.normal)
            .polygonCapColor(d => {
                const continent = d.properties.continent;
                if (!continent) return 'rgba(100, 100, 100, 0.3)';
                const isHovered = hoveredContinent && hoveredContinent.properties.continent === continent;
                return isHovered ? continentColors[continent].hover : continentColors[continent].normal;
            })
            .polygonSideColor(() => borders.sideColor)
            .polygonStrokeColor(() => borders.strokeColor)
            .polygonLabel(d => {
                const continent = d.properties.continent;
                if (!continent) return '';
                return `<div style="background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 4px; color: white; font-family: sans-serif;">${t(continentNames[continent])}</div>`;
            })
            .onPolygonHover(handlePolygonHover)
            .onPolygonClick(handlePolygonClick)
            .polygonsTransitionDuration(300);
    } else {
        updateQuizColors();
    }
}

// Camera info overlay
const cameraInfoEl = document.getElementById('cameraInfo');
function updateCameraInfo() {
    const pov = globe.pointOfView();
    if (pov && cameraInfoEl) {
        cameraInfoEl.textContent =
            `lat  ${pov.lat.toFixed(2)}\n` +
            `lon  ${pov.lng.toFixed(2)}\n` +
            `zoom ${pov.altitude.toFixed(2)}`;
    }
    requestAnimationFrame(updateCameraInfo);
}
requestAnimationFrame(updateCameraInfo);

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

document.getElementById('chooseStateQuiz').addEventListener('click', () => {
    showCountrySelection(currentContinent, 'state');
});

document.getElementById('chooseStateCapitalQuiz').addEventListener('click', () => {
    showCountrySelection(currentContinent, 'state-capital');
});

document.getElementById('cancelChooser').addEventListener('click', () => {
    hideQuizChooser();
});

document.getElementById('quizChooserOverlay').addEventListener('click', () => {
    hideQuizChooser();
});

document.getElementById('cancelPickCountry').addEventListener('click', () => {
    cancelPickCountry();
});