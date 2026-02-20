// State
let locale = "en";
let hoveredContinent = null;
let continentData = [];

// Quiz state
let quizActive = false;
let quizMode = 'country'; // 'country', 'capital', or 'state'
let currentCountry = null; // For state quiz - which country's states to show
let stateData = []; // Loaded state boundaries
let currentContinent = null;
let continentCountries = [];
let remainingCountries = [];
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
    
    if (quizActive) {
        // During quiz, only change cursor
        document.body.style.cursor = polygon && polygon.properties.continent === currentContinent ? 'pointer' : 'default';
        return;
    }

    // While the quiz chooser popup is open, keep the selected continent raised
    if (!document.getElementById('quizChooser').classList.contains('hidden')) {
        return;
    }
    
    if (polygon) {
        document.body.style.cursor = 'pointer';
        
        // Update all polygons for the same continent
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
    
    // Show/hide state quiz button based on continent
    const stateQuizBtn = document.getElementById('chooseStateQuiz');
    if (continentCode === 'na') {
        stateQuizBtn.style.display = 'block';
    } else {
        stateQuizBtn.style.display = 'none';
    }
    
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

// Show country selection for state quiz
function showCountrySelection(continentCode) {
    // Hide quiz chooser
    document.getElementById('quizChooser').classList.add('hidden');
    
    // Show country chooser
    const countryChooser = document.getElementById('countryChooser');
    const countryButtons = document.getElementById('countryButtons');
    
    // Clear existing buttons
    countryButtons.innerHTML = '';
    
    // For now, only support USA, Canada, and Mexico in North America
    if (continentCode === 'na') {
        const countries = [
            { code: 'usa', name: 'United States' },
            { code: 'canada', name: 'Canada' },
            { code: 'mexico', name: 'Mexico' }
        ];
        
        countries.forEach(country => {
            const button = document.createElement('button');
            button.className = 'chooser-btn';
            button.textContent = country.name;
            button.addEventListener('click', () => {
                startStateQuiz(country.code);
            });
            countryButtons.appendChild(button);
        });
    }
    
    countryChooser.classList.remove('hidden');
}

// Hide country chooser
function hideCountryChooser() {
    document.getElementById('countryChooser').classList.add('hidden');
    document.getElementById('quizChooserOverlay').classList.add('hidden');
    currentContinent = null;
    globe.controls().autoRotate = true;
    const currentLng = globe.pointOfView().lng;
    globe.pointOfView({ lat: 20, lng: currentLng, altitude: 1.8 }, 1000);
}

// Start state quiz for a country
async function startStateQuiz(countryCode) {
    quizActive = true;
    quizMode = 'state';
    currentCountry = countryCode;
    
    // Hide country chooser
    document.getElementById('countryChooser').classList.add('hidden');
    document.getElementById('quizChooserOverlay').classList.add('hidden');
    
    // Stop auto-rotation and disable manual rotation
    globe.controls().autoRotate = false;
    globe.controls().enableRotate = false;
    
    try {
        // Load state/province data based on country
        if (countryCode === 'usa') {
            await loadStatesData('usa', 'United States – States');
        } else if (countryCode === 'canada') {
            await loadStatesData('canada', 'Canada – Provinces');
        } else if (countryCode === 'mexico') {
            await loadStatesData('mexico', 'Mexico – States');
        }
        
        // Show quiz panel
        document.getElementById('quizPanel').classList.remove('hidden');
        document.getElementById('score').textContent = score;
        document.getElementById('questionCount').textContent = questionCount;
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback';
        
        // Reset quiz state
        answeredCountries.clear();
        wrongCountries.clear();
        score = 0;
        questionCount = 0;
        
        // Start first question
        setTimeout(() => pickNextState(), 1000);
        
    } catch (error) {
        console.error('Error starting state quiz:', error);
        hideCountryChooser();
    }
}

// Load US states boundaries and data
// Load states/provinces data for a country
async function loadStatesData(countryCode, title) {
    try {
        let statesDataFromFile, topology, statesGeoJSON, countryConfigData = null;
        
        if (countryCode === 'usa') {
            // Load US state data and TopoJSON
            const [statesDataResponse, topoResponse] = await Promise.all([
                fetch('data/us-states.json'),
                fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
            ]);
            
            statesDataFromFile = await statesDataResponse.json();
            topology = await topoResponse.json();
            statesGeoJSON = topojson.feature(topology, topology.objects.states);
            
            // Add state names and capitals to features
            stateData = statesGeoJSON.features.map(feat => {
                const fips = String(feat.id).padStart(2, '0');
                const stateName = statesDataFromFile.fipsToName[fips] || 'Unknown';
                const capitalInfo = statesDataFromFile.capitals[stateName];
                
                return {
                    ...feat,
                    properties: {
                        ...feat.properties,
                        name: stateName,
                        capital: capitalInfo?.capital || null,
                        capitalCoords: capitalInfo ? [capitalInfo.lon, capitalInfo.lat] : null
                    }
                };
            }).filter(feat => feat.properties.name !== 'Unknown');
            
        } else if (countryCode === 'canada') {
            // Load Canada provinces data and TopoJSON in parallel
            const [canadaDataResponse, topoResponse] = await Promise.all([
                fetch('data/country_canada.json'),
                fetch('./data/country_canada_TopoJSON.json')
            ]);
            
            countryConfigData = await canadaDataResponse.json();
            const topology = await topoResponse.json();
            statesGeoJSON = topojson.feature(topology, topology.objects.provinces || topology.objects.canada || topology.objects[Object.keys(topology.objects)[0]]);
            
            // Extract province names from properties and add capital data
            stateData = statesGeoJSON.features.map(feat => {
                // Try common property names for province names
                const props = feat.properties || {};
                const provinceName = props.NAME || props.PRENAME || props.PROVINCE || 
                                   props.name || props.Province || props.province ||
                                   props.NAME_EN || props.NAME_1 || 'Unknown';
                
                // Get capital info from countryConfigData
                const capitalInfo = countryConfigData.capitals[provinceName];
                
                return {
                    ...feat,
                    properties: {
                        ...props,
                        name: provinceName,
                        capital: capitalInfo?.capital || null,
                        capitalCoords: capitalInfo ? [capitalInfo.lon, capitalInfo.lat] : null
                    }
                };
            }).filter(feat => feat.properties.name !== 'Unknown');
            
        } else if (countryCode === 'mexico') {
            // Load Mexico states data and TopoJSON in parallel
            const [mexicoDataResponse, topoResponse] = await Promise.all([
                fetch('data/country_mexico.json'),
                fetch('./data/country_mexico_TopoJSON.json')
            ]);
            
            countryConfigData = await mexicoDataResponse.json();
            const topology = await topoResponse.json();
            statesGeoJSON = topojson.feature(topology, topology.objects.states || topology.objects.mexico || topology.objects[Object.keys(topology.objects)[0]]);
            
            // Extract state names from properties and add capital data
            stateData = statesGeoJSON.features.map(feat => {
                // Try common property names for state names
                const props = feat.properties || {};
                const stateName = props.state_name || props.NAME || props.NAME_1 || props.ESTADO || 
                               props.name || props.State || props.state ||
                               props.NAME_EN || props.NOM_ENT || 'Unknown';
                
                // Get capital info from countryConfigData
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
            }).filter(feat => feat.properties.name !== 'Unknown');
        }
        
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
        
        if ((countryCode === 'canada' || countryCode === 'mexico') && countryConfigData) {
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
        
    } catch (error) {
        console.error(`Error loading ${countryCode} data:`, error);
        throw error;
    }
}

// Handle state polygon hover
function handleStateHover(polygon) {
    if (!quizActive || quizMode !== 'state') return;
    
    document.body.style.cursor = polygon ? 'pointer' : 'default';
}

// Handle state polygon click
function handleStateClick(polygon) {
    if (!quizActive || quizMode !== 'state' || !polygon) return;
    
    checkStateAnswer(polygon);
}

// Pick next state to quiz
function pickNextState() {
    if (!stateData.length) return;
    
    const eligibleStates = stateData.filter(state => 
        !answeredCountries.has(state.properties.name) && 
        !wrongCountries.has(state.properties.name)
    );
    
    if (!eligibleStates.length) {
        document.getElementById('countryName').textContent = 'Quiz Complete!';
        document.getElementById('quizPrompt').textContent = `Final Score: ${score}/${questionCount}`;
        document.getElementById('feedback').textContent = '';
        return;
    }
    
    const index = Math.floor(Math.random() * eligibleStates.length);
    currentCountry = eligibleStates[index]; // Reusing currentCountry for currentState
    
    questionCount++;
    document.getElementById('questionCount').textContent = questionCount;
    document.getElementById('quizPrompt').textContent = '';
    document.getElementById('countryName').textContent = currentCountry.properties.name;
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
}

// Check state answer
function checkStateAnswer(clickedState) {
    if (!currentCountry) return;
    
    const feedbackEl = document.getElementById('feedback');
    
    if (clickedState.properties.name === currentCountry.properties.name) {
        // Correct answer
        score++;
        document.getElementById('score').textContent = score;
        feedbackEl.textContent = '✓ Correct!';
        feedbackEl.className = 'feedback correct';
        
        // Mark as answered
        answeredCountries.add(currentCountry.properties.name);
        
        // Update globe colors
        updateStateColors();
        
        // Next question after delay
        setTimeout(() => pickNextState(), 1000);
    } else {
        // Wrong answer
        feedbackEl.textContent = `✗ Wrong! That was ${clickedState.properties.name}`;
        feedbackEl.className = 'feedback wrong';
        
        // Mark as wrong
        wrongCountries.add(currentCountry.properties.name);
        
        // Update globe colors
        updateStateColors();
        
        // Next question after delay
        setTimeout(() => pickNextState(), 3000);
    }
}

// Update state colors based on quiz state
function updateStateColors() {
    globe.polygonAltitude(d => {
        // Show answered states at answered height
        if (answeredCountries.has(d.properties.name)) {
            return altitudes.answered;
        }
        
        // Show wrong states at answered height
        if (wrongCountries.has(d.properties.name)) {
            return altitudes.answered;
        }
        
        // Default selected height for active states
        return altitudes.selected;
    }).polygonCapColor(d => {
        // Show answered states in green
        if (answeredCountries.has(d.properties.name)) {
            return countryQuizColors.correct;
        }
        
        // Show wrong states in red
        if (wrongCountries.has(d.properties.name)) {
            return countryQuizColors.wrong;
        }
        
        // Default state color
        return 'rgba(74, 222, 128, 0.7)';
    });
}
async function startQuiz(continentCode, mode) {
    quizActive = true;
    quizMode = mode;
    currentContinent = continentCode;
    
    // Hide chooser
    document.getElementById('quizChooser').classList.add('hidden');
    document.getElementById('quizChooserOverlay').classList.add('hidden');
    
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
            altitude: continentZoom[continentCode] ?? defaultZoom
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
            .pointAltitude(d => {
                // Find current altitude for the country this capital belongs to
                const countryName = d.country;
                let countryAltitude = altitudes.selected; // Default for active continent
                
                if (answeredCountries.has(countryName)) {
                    countryAltitude = altitudes.answered;
                } else if (wrongCountries.has(countryName)) {
                    countryAltitude = altitudes.answered;
                }
                
                return countryAltitude + altitudes.capitalOffset;
            })
            .pointRadius('size')
            .pointColor('color')
            .pointLabel(() => '')
            .pointsTransitionDuration(300)
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
        document.getElementById('quizPrompt').textContent = '';
        document.getElementById('countryName').textContent = cap ? cap.capital : currentCountry.properties.name;
    } else {
        document.getElementById('quizPrompt').textContent = '';
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
        if (!d || !d.properties.continent) return altitudes.normal;
        if (quizActive && d.properties.continent !== currentContinent) return altitudes.normal;
        if (answeredCountries.has(d.properties.name)) return altitudes.answered; // Lower for correct
        if (wrongCountries.has(d.properties.name)) return altitudes.answered; // Lower for wrong
        if (quizActive && d.properties.continent === currentContinent) return altitudes.selected; // Keep continent raised
        return altitudes.normal;
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
                return countryQuizColors.correct;
            }
            
            // Show wrong countries in red
            if (wrongCountries.has(d.properties.name)) {
                return countryQuizColors.wrong;
            }
            
            // Active continent countries
            return continentColors[continent].normal;
        }
        
        return continentColors[continent].normal;
    });
    
    // Update capital point altitudes and colors if in capital mode
    if (quizActive && quizMode === 'capital') {
        globe.pointAltitude(d => {
            const countryName = d.country;
            let countryAltitude = altitudes.selected; // Default for active continent
            
            if (answeredCountries.has(countryName)) {
                countryAltitude = altitudes.answered;
            } else if (wrongCountries.has(countryName)) {
                countryAltitude = altitudes.answered;
            }
            
            return countryAltitude + altitudes.capitalOffset;
        }).pointColor(d => {
            const countryName = d.country;
            
            // Show answered capitals in darker green
            if (answeredCountries.has(countryName)) {
                return capitalColors.correct;
            }
            
            // Show wrong capitals in darker red
            if (wrongCountries.has(countryName)) {
                return capitalColors.wrong;
            }
            
            // Default white for active capitals
            return capitalColors.normal;
        });
    }
}

// Exit quiz
function exitQuiz() {
    quizActive = false;
    const wasStateMode = quizMode === 'state';
    
    currentContinent = null;
    currentCountry = null;
    continentCountries = [];
    remainingCountries = [];
    answeredCountries.clear();
    wrongCountries.clear();
    quizMode = 'country'; // Reset to default
    
    document.getElementById('quizPanel').classList.add('hidden');
    
    // Reset globe
    globe.controls().autoRotate = true;
    globe.controls().enableRotate = true;
    globe.pointOfView({ lat: 20, lng: 0, altitude: 1.8 }, 1000);
    globe.pointsData([]);
    
    // If exiting from state mode, reload continent data
    if (wasStateMode) {
        // Restore continent polygons
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
        
        stateData = []; // Clear state data
    } else {
        updateGlobeColors();
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
    showCountrySelection(currentContinent);
});

document.getElementById('cancelChooser').addEventListener('click', () => {
    hideQuizChooser();
});

document.getElementById('quizChooserOverlay').addEventListener('click', () => {
    hideQuizChooser();
});

document.getElementById('cancelCountryChooser').addEventListener('click', () => {
    hideCountryChooser();
});