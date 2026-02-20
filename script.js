const mapSvg = d3.select("#map");
const promptEl = document.getElementById("prompt");
const stateLabelEl = document.getElementById("state-label");
const stateLabelButton = stateLabelEl.querySelector("button");
const choicesEl = document.getElementById("choices");
const titleEl = document.getElementById("title");
const scoreLabelEl = document.getElementById("score-label");
const questionLabelEl = document.getElementById("question-label");
const langEnBtn = document.getElementById("lang-en");
const langNlBtn = document.getElementById("lang-nl");
const regionUsBtn = document.getElementById("region-us");
const regionEuBtn = document.getElementById("region-eu");
const regionSaBtn = document.getElementById("region-sa");
const regionCaBtn = document.getElementById("region-ca");
const regionAfBtn = document.getElementById("region-af");
const regionNlBtn = document.getElementById("region-nl");
const quizStateBtn = document.getElementById("quiz-state");
const quizCapitalBtn = document.getElementById("quiz-capital");
const modeChoiceBtn = document.getElementById("mode-choice");
const modeClickBtn = document.getElementById("mode-click");
const feedbackEl = document.getElementById("feedback");
const scoreEl = document.getElementById("score");
const questionCountEl = document.getElementById("question-count");

let fipsToName = {};
let capitalByState = {};
let usMicroStates = new Set();
let netherlandsCapitalByProvince = {};
let netherlandsCapitalByProvinceNormalized = new Map();
let europeCapitalByCountry = {};
let europeCountryNames = new Set();
let southAmericaCapitalByCountry = {};
let southAmericaCountryNames = new Set();
let centralAmericaCapitalByCountry = {};
let centralAmericaCountryNames = new Set();
let africaCapitalByCountry = {};
let africaCountryNames = new Set();
let i18nData = {};
let locale = "en";

let states = [];
let remainingStates = [];
let currentState = null;
let score = 0;
let questionCount = 0;
let isLocked = false;
let mode = "choice";
let quizType = "state";
let capitalsLayer = null;
let region = "us";
let microMarkersLayer = null;

const normalize = (value) =>
	String(value)
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/\u00a0/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const getCapitalOffset = (name) => {
	const normalized = normalize(name || "");
	if (normalized.includes("vatican") || normalized.includes("holy see")) {
		return [8, -6];
	}
	return [0, 0];
};

const formatText = (text, vars = {}) =>
	Object.entries(vars).reduce(
		(result, [key, value]) =>
			result.replaceAll(`{${key}}`, String(value)),
		text
	);

const t = (path, vars) => {
	const parts = path.split(".");
	const getValue = (obj) =>
		parts.reduce((acc, key) => (acc ? acc[key] : undefined), obj);
	const value =
		getValue(i18nData[locale]) ?? getValue(i18nData.en) ?? path;
	return typeof value === "string" ? formatText(value, vars) : value;
};

const regionLabel = () => {
	switch (region) {
		case "us":
			return t("ui.state");
		case "nl":
			return t("ui.province");
		default:
			return t("ui.country");
	}
};

const localizeState = (name) => {
	const dict =
		region === "us"
			? "states"
			: region === "nl"
				? "provinces"
				: "countries";
	return (
		i18nData[locale]?.[dict]?.[name] ||
		i18nData.en?.[dict]?.[name] ||
		name
	);
};

const localizeCapital = (name) =>
	name
		? i18nData[locale]?.capitals?.[name] ||
			i18nData.en?.capitals?.[name] ||
			name
		: "";

const isEuropeCountry = (name) => {
	const normalized = normalize(name);
	return (
		europeCountryNames.has(normalized) ||
		normalized.includes("russia")
	);
};

const isSouthAmericaCountry = (name) => {
	const normalized = normalize(name);
	return southAmericaCountryNames.has(normalized);
};

const isCentralAmericaCountry = (name) => {
	const normalized = normalize(name);
	return centralAmericaCountryNames.has(normalized);
};

const isAfricaCountry = (name) => {
	const normalized = normalize(name);
	return africaCountryNames.has(normalized);
};

const loadStaticData = async () => {
	const [
		usData,
		nlCapitals,
		euData,
		saData,
		caData,
		afData,
		enTranslations,
		nlTranslations
	] = await Promise.all([
		fetch("data/us-states.json").then((response) => response.json()),
		fetch("data/netherlands-capitals.json").then((response) => response.json()),
		fetch("data/europe_countries.json").then((response) => response.json()),
		fetch("data/south_america_countries.json").then((response) => response.json()),
		fetch("data/central_america_countries.json").then((response) => response.json()),
		fetch("data/africa_countries.json").then((response) => response.json()),
		fetch("data/i18n/en.json").then((response) => response.json()),
		fetch("data/i18n/nl.json").then((response) => response.json())
	]);

	fipsToName = usData.fipsToName || {};
	capitalByState = usData.capitals || {};
	usMicroStates = new Set(
		(usData.microStates || []).map((name) => normalize(name))
	);
	netherlandsCapitalByProvince = nlCapitals || {};
	netherlandsCapitalByProvinceNormalized = new Map(
		Object.entries(netherlandsCapitalByProvince).map(([name, info]) => [
			normalize(name),
			info
		])
	);
	europeCapitalByCountry = euData?.capitals || {};
	const countriesList = euData?.countries || [];
	const microList = euData?.microCountries || [];

	europeCountryNames = new Set(
		(countriesList || []).map((name) => normalize(name))
	);
	microCountries = new Set(
		(microList || []).map((name) => normalize(name))
	);

	southAmericaCapitalByCountry = saData?.capitals || {};
	const saCountriesList = saData?.countries || [];
	const saMicroList = saData?.microCountries || [];

	southAmericaCountryNames = new Set(
		(saCountriesList || []).map((name) => normalize(name))
	);
	const saMicroSet = new Set(
		(saMicroList || []).map((name) => normalize(name))
	);

	centralAmericaCapitalByCountry = caData?.capitals || {};
	const caCountriesList = caData?.countries || [];
	const caMicroList = caData?.microCountries || [];

	centralAmericaCountryNames = new Set(
		(caCountriesList || []).map((name) => normalize(name))
	);
	const caMicroSet = new Set(
		(caMicroList || []).map((name) => normalize(name))
	);

	africaCapitalByCountry = afData?.capitals || {};
	const afCountriesList = afData?.countries || [];
	const afMicroList = afData?.microCountries || [];

	africaCountryNames = new Set(
		(afCountriesList || []).map((name) => normalize(name))
	);
	const afMicroSet = new Set(
		(afMicroList || []).map((name) => normalize(name))
	);

	regionBounds = {
		...regionBounds,
		eu: euData?.bounds || null,
		sa: saData?.bounds || null,
		ca: caData?.bounds || null,
		af: afData?.bounds || null
	};
	microCountries = new Set([...microCountries, ...saMicroSet, ...caMicroSet, ...afMicroSet]);
	i18nData = {
		en: enTranslations || {},
		nl: nlTranslations || {}
	};
	applyLanguage();
};

let regionBounds = {};
let microCountries = new Set();

const splitLonRanges = (minLon, maxLon) =>
	minLon <= maxLon
		? [[minLon, maxLon]]
		: [
				[minLon, 180],
				[-180, maxLon]
			];

const rangesOverlap = (rangeA, rangeB) =>
	rangeA[0] <= rangeB[1] && rangeB[0] <= rangeA[1];

const isInBounds = (bounds, [lon, lat]) =>
	lon >= bounds.minLon &&
	lon <= bounds.maxLon &&
	lat >= bounds.minLat &&
	lat <= bounds.maxLat;

const intersectsBounds = (bounds, featureBounds) => {
	if (!featureBounds) return false;
	const [[minLon, minLat], [maxLon, maxLat]] = featureBounds;
	if (maxLat < bounds.minLat || minLat > bounds.maxLat) return false;
	const boundsRanges = splitLonRanges(bounds.minLon, bounds.maxLon);
	const featureRanges = splitLonRanges(minLon, maxLon);
	return boundsRanges.some((boundsRange) =>
		featureRanges.some((featureRange) =>
			rangesOverlap(boundsRange, featureRange)
		)
	);
};

const filterToBounds = (feature, bounds) => {
	if (!bounds || !feature?.geometry) return feature;
	const normalizedName = normalize(feature.properties?.name || "");
	const useCentroid = normalizedName.includes("russia");
	if (feature.geometry.type === "Polygon") {
		if (useCentroid) {
			const centroid = d3.geoCentroid(feature);
			return isInBounds(bounds, centroid) ? feature : null;
		}
		const boundsForFeature = d3.geoBounds(feature);
		return intersectsBounds(bounds, boundsForFeature) ? feature : null;
	}
	if (feature.geometry.type === "MultiPolygon") {
		const filteredPolygons = feature.geometry.coordinates.filter((polygon) => {
			const polygonFeature = {
				type: "Feature",
				properties: feature.properties,
				geometry: {
					type: "Polygon",
					coordinates: polygon
				}
			};
			if (useCentroid) {
				const centroid = d3.geoCentroid(polygonFeature);
				return isInBounds(bounds, centroid);
			}
			const boundsForFeature = d3.geoBounds(polygonFeature);
			return intersectsBounds(bounds, boundsForFeature);
		});
		if (!filteredPolygons.length) return null;
		return {
			...feature,
			geometry: {
				type: "MultiPolygon",
				coordinates: filteredPolygons
			}
		};
	}
	return feature;
};

const shuffle = (array) => {
	for (let index = array.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[array[index], array[swapIndex]] = [array[swapIndex], array[index]];
	}
	return array;
};

const getAnswerKey = (state) =>
	quizType === "capital"
		? state.properties.capital
		: state.properties.name;

const getAnswerLabel = (state) =>
	quizType === "capital"
		? localizeCapital(state.properties.capital)
		: localizeState(state.properties.name);

const hasCapital = (state) =>
	Boolean(state?.properties?.capital);

const getEligibleStates = (list) =>
	quizType === "capital" ? list.filter(hasCapital) : list;

const buildChoices = () => {
	if (!currentState) return [];
	const correctKey = getAnswerKey(currentState);
	const correctLabel = getAnswerLabel(currentState);
	if (!correctKey || !correctLabel) return [];

	const pool = getEligibleStates(states)
		.filter((state) => state !== currentState)
		.map((state) => ({
			key: getAnswerKey(state),
			label: getAnswerLabel(state)
		}))
		.filter((option) => option.key && option.label);

	const uniquePool = Array.from(
		new Map(pool.map((option) => [option.key, option])).values()
	);
	shuffle(uniquePool);
	const options = [
		{ key: correctKey, label: correctLabel },
		...uniquePool.slice(0, 4)
	];
	return shuffle(options);
};

const renderChoices = () => {
	if (mode !== "choice") {
		choicesEl.innerHTML = "";
		choicesEl.style.display = "none";
		return;
	}
	choicesEl.style.display = "grid";
	choicesEl.innerHTML = "";
	const options = buildChoices();
	options.forEach((option) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "choice";
		button.textContent = option.label;
		button.addEventListener("click", () => checkAnswer(option.key));
		choicesEl.appendChild(button);
	});
};

const setInteraction = (enabled) => {
	choicesEl.querySelectorAll("button").forEach((button) => {
		button.disabled = !enabled;
	});
	mapSvg.style("pointer-events", enabled ? "auto" : "none");
	isLocked = !enabled;
};

const setMode = (nextMode) => {
	mode = nextMode;
	modeChoiceBtn.classList.toggle("active", mode === "choice");
	modeClickBtn.classList.toggle("active", mode === "click");
	resetGame();
};

const setQuizType = (nextType) => {
	quizType = nextType;
	quizStateBtn.classList.toggle("active", quizType === "state");
	quizCapitalBtn.classList.toggle("active", quizType === "capital");
	resetGame();
};

const setRegion = (nextRegion) => {
	region = nextRegion;
	regionUsBtn.classList.toggle("active", region === "us");
	regionEuBtn.classList.toggle("active", region === "eu");
	regionSaBtn.classList.toggle("active", region === "sa");
	regionCaBtn.classList.toggle("active", region === "ca");
	regionAfBtn.classList.toggle("active", region === "af");
	regionNlBtn.classList.toggle("active", region === "nl");
	quizCapitalBtn.disabled = false;
	loadRegionData();
};

const applyLanguage = () => {
	titleEl.textContent = t("ui.title");
	scoreLabelEl.textContent = t("ui.score");
	questionLabelEl.textContent = t("ui.question");
	regionUsBtn.textContent = t("ui.regionUs");
	regionEuBtn.textContent = t("ui.regionEu");
	regionNlBtn.textContent = t("ui.regionNl");
	quizStateBtn.textContent = t("ui.quizState");
	quizCapitalBtn.textContent = t("ui.quizCapital");
	modeChoiceBtn.textContent = t("ui.modeChoice");
	modeClickBtn.textContent = t("ui.modeClick");
	langEnBtn.classList.toggle("active", locale === "en");
	langNlBtn.classList.toggle("active", locale === "nl");
	feedbackEl.textContent = "";
	updateQuestionUI();
	renderChoices();
};

const updateQuestionUI = () => {
	if (!currentState) {
		promptEl.textContent = t("ui.loading");
		return;
	}
	if (mode === "choice") {
		promptEl.textContent =
			quizType === "capital"
				? t("ui.promptCapital")
				: t("ui.promptState", { thing: regionLabel() });
		stateLabelEl.hidden = true;
		stateLabelEl.style.display = "none";
		stateLabelButton.textContent = "";
	} else {
		promptEl.textContent = "";
		stateLabelButton.textContent =
			quizType === "capital"
				? localizeCapital(currentState.properties.capital)
				: localizeState(currentState.properties.name);
		stateLabelEl.hidden = false;
		stateLabelEl.style.display = "flex";
	}
};

const resetGame = () => {
	score = 0;
	questionCount = 0;
	scoreEl.textContent = score;
	questionCountEl.textContent = questionCount;
	feedbackEl.textContent = "";
	stateLabelEl.hidden = mode !== "click";
	stateLabelEl.style.display = mode === "click" ? "flex" : "none";
	if (mode !== "click") {
		stateLabelButton.textContent = "";
	}
	remainingStates = getEligibleStates(states);
	mapSvg
		.selectAll("path")
		.classed("correct", false)
		.classed("wrong", false)
		.classed("highlight", false);
	if (capitalsLayer) {
		capitalsLayer
			.style(
				"display",
				quizType === "capital" ? "block" : "none"
			)
			.selectAll("circle")
			.classed("active", false);
	}
	if (microMarkersLayer) {
		microMarkersLayer
			.selectAll("circle")
			.classed("correct", false)
			.classed("wrong", false);
	}
	pickNextState();
};

const pickNextState = () => {
	if (!states.length) return;
	const eligibleRemaining = getEligibleStates(remainingStates);
	if (!eligibleRemaining.length) {
		promptEl.textContent = t("ui.allAnswered");
		setInteraction(false);
		return;
	}
	const index = Math.floor(Math.random() * eligibleRemaining.length);
	const next = eligibleRemaining.splice(index, 1)[0];
	remainingStates = eligibleRemaining;
	currentState = next;
	questionCount += 1;
	questionCountEl.textContent = questionCount;
	updateQuestionUI();
	renderChoices();
	setInteraction(true);

	mapSvg
		.selectAll("path")
		.classed(
			"highlight",
			(d) => mode === "choice" && quizType === "state" && d === currentState
		);

	if (capitalsLayer) {
		capitalsLayer.style(
			"display",
			quizType === "capital" ? "block" : "none"
		);
		capitalsLayer
			.selectAll("circle")
			.classed(
				"active",
				(d) =>
					quizType === "capital" &&
					mode === "choice" &&
					d.state === currentState
			);
	}
	if (microMarkersLayer) {
		microMarkersLayer
			.selectAll("circle")
			.classed(
				"highlight",
				(d) => mode === "choice" && quizType === "state" && d.state === currentState
			);
	}
};

const checkAnswer = (selected) => {
	if (!currentState) return;
	if (isLocked) return;
	setInteraction(false);
	const userAnswer = selected || "";
	const correctAnswer = getAnswerKey(currentState);
	const targetPath = mapSvg
		.selectAll("path")
		.filter((d) => d === currentState);
	const targetCapital =
		quizType === "capital"
			? capitalsLayer
				?.selectAll("circle")
				.filter((d) => d.state === currentState)
			: null;
	const targetMicro =
		microMarkersLayer
			?.selectAll("circle")
			.filter((d) => d.state === currentState) || null;

	if (userAnswer === correctAnswer) {
		score += 1;
		scoreEl.textContent = score;
		feedbackEl.textContent = t("ui.correct");
		targetPath.classed("correct", true).classed("wrong", false);
		targetCapital?.classed("correct", true).classed("wrong", false);
		targetMicro?.classed("correct", true).classed("wrong", false);
		setTimeout(() => pickNextState(), 700);
	} else {
		const displayState = localizeState(currentState.properties.name);
		const displayCapital = localizeCapital(currentState.properties.capital);
		feedbackEl.textContent =
			quizType === "capital"
				? t("ui.notQuiteCapital", {
					capital: displayCapital,
					state: displayState
				})
				: t("ui.notQuiteState", { state: displayState });
		targetPath.classed("wrong", true).classed("correct", false);
		targetCapital?.classed("wrong", true).classed("correct", false);
		targetMicro?.classed("wrong", true).classed("correct", false);
		setTimeout(() => pickNextState(), 900);
	}
};

const checkMapAnswer = (clickedState) => {
	if (!currentState) return;
	if (isLocked || mode !== "click") return;
	setInteraction(false);
	const clickedName = clickedState.properties.name;
	const correctName = currentState.properties.name;
	const targetPath = mapSvg
		.selectAll("path")
		.filter((d) => d === currentState);
	const targetCapital =
		quizType === "capital"
			? capitalsLayer
				?.selectAll("circle")
				.filter((d) => d.state === currentState)
			: null;
	const targetMicro =
		microMarkersLayer
			?.selectAll("circle")
			.filter((d) => d.state === currentState) || null;

	if (clickedState === currentState) {
		score += 1;
		scoreEl.textContent = score;
		feedbackEl.textContent = t("ui.correct");
		targetPath.classed("correct", true).classed("wrong", false);
		targetCapital?.classed("correct", true).classed("wrong", false);
		targetMicro?.classed("correct", true).classed("wrong", false);
		setTimeout(() => pickNextState(), 700);
	} else {
		const displayClicked = localizeState(clickedName);
		const displayCorrect = localizeState(correctName);
		const displayCapital = localizeCapital(currentState.properties.capital);
		feedbackEl.textContent =
			quizType === "capital"
				? t("ui.wrongClickCapital", {
					clicked: displayClicked,
					state: displayCorrect,
					capital: displayCapital
				})
				: t("ui.wrongClickState", {
					clicked: displayClicked,
					state: displayCorrect
				});
		targetPath.classed("wrong", true).classed("correct", false);
		targetCapital?.classed("wrong", true).classed("correct", false);
		targetMicro?.classed("wrong", true).classed("correct", false);
		setTimeout(() => pickNextState(), 900);
	}
};


const buildMap = (features, projection) => {
	const path = d3.geoPath(projection);

	mapSvg.selectAll("*").remove();
	capitalsLayer = null;
	microMarkersLayer = null;

	remainingStates = [...features];
	states = features;

	mapSvg
		.append("g")
		.attr("class", "states")
		.selectAll("path")
		.data(states)
		.join("path")
		.attr("d", path)
		.attr("aria-label", (d) => d.properties.name)
		.on("click", (event, d) => checkMapAnswer(d));

	const capitalPoints = states
		.map((state) => {
			if (!state.properties.capitalCoords) return null;
			const projected = projection(state.properties.capitalCoords);
			if (!projected) return null;
			const [dx, dy] = getCapitalOffset(state.properties.name);
			return { state, coords: [projected[0] + dx, projected[1] + dy] };
		})
		.filter(Boolean);

	if (region === "us") {
	}

	const microSet =
		region === "eu" || region === "sa" || region === "ca" || region === "af"
			? microCountries
			: region === "us"
				? usMicroStates
				: null;
	if (microSet && microSet.size) {
		const microPoints = capitalPoints.filter((point) =>
			microSet.has(normalize(point.state.properties.name))
		);

		if (microPoints.length) {
			microMarkersLayer = mapSvg
				.append("g")
				.attr("class", "micro-markers");
			microMarkersLayer
				.selectAll("circle")
				.data(microPoints)
				.join("circle")
				.attr("r", 7)
				.attr("cx", (d) => d.coords[0])
				.attr("cy", (d) => d.coords[1])
				.on("click", (event, d) => checkMapAnswer(d.state));
		}
	}

	if (capitalPoints.length) {
		capitalsLayer = mapSvg.append("g")
			.attr("class", "capitals")
			.style("pointer-events", "auto")
			.style("z-index", "1000");
		capitalsLayer
			.selectAll("circle")
			.data(capitalPoints.filter((point) => !point.hideInCapitalsLayer))
			.join("circle")
			.attr("r", 6)
			.attr("cx", (d) => d.coords[0])
			.attr("cy", (d) => d.coords[1])
			.attr("fill", "red")
			.attr("stroke", "white")
			.attr("stroke-width", 3)
			.style("cursor", "pointer")
			.style("pointer-events", "all")
			.raise()
			.on("click", (event, d) => {
				event.stopPropagation();
				checkMapAnswer(d.state);
			});
	}

	pickNextState();
};

const fetchJson = async (url) => {
	const response = await fetch(url);
	return response.json();
};

const loadRegionData = async () => {
	promptEl.textContent = t("ui.loading");
	const configByRegion = {
		us: {
			url: "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
			objectName: "states",
			projectionFactory: (featureCollection) =>
				d3.geoAlbersUsa().fitSize([975, 610], featureCollection),
			transformFeatures: (features) =>
				features
					.map((feature) => {
						const fips = String(feature.id).padStart(2, "0");
						const stateName = fipsToName[fips] || "Unknown";
						const capitalInfo = capitalByState[stateName];
						return {
							...feature,
							properties: {
								...feature.properties,
								name: stateName,
								capital: capitalInfo?.capital || null,
								capitalCoords: capitalInfo
									? [capitalInfo.lon, capitalInfo.lat]
									: null
							}
						};
					})
					.filter((feature) => feature.properties.name !== "Unknown")
		},
		nl: {
			url: "https://cartomap.github.io/nl/wgs84/provincie_2023.topojson",
			objectName: "provincie_2023",
			projectionFactory: (featureCollection) =>
				d3.geoMercator().fitSize([975, 610], featureCollection),
			transformFeatures: (features) =>
				features.map((feature) => {
					const name =
						feature.properties?.statnaam ||
						feature.properties?.name ||
						feature.properties?.NAME_1 ||
						feature.properties?.name_1 ||
						"";
					const capitalInfo =
						netherlandsCapitalByProvinceNormalized.get(normalize(name)) ||
						netherlandsCapitalByProvince[name];
					return {
						...feature,
						properties: {
							...feature.properties,
							name,
							capital: capitalInfo?.capital || null,
							capitalCoords: capitalInfo
								? [capitalInfo.lon, capitalInfo.lat]
								: null
						}
					};
				})
		},
		eu: {
			url: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
			objectName: "countries",
			projectionFactory: (featureCollection) =>
				d3.geoMercator().fitSize([975, 610], featureCollection),
			bounds: regionBounds.eu,
			transformFeatures: (features) => {
				const mapped = features
					.map((feature) => {
						const name = feature.properties?.name || "";
						const capitalInfo = europeCapitalByCountry[name];
						return {
							...feature,
							properties: {
								...feature.properties,
								name,
								capital: capitalInfo?.capital || null,
								capitalCoords: capitalInfo
									? [capitalInfo.lon, capitalInfo.lat]
									: null
							}
						};
					})
					.filter((feature) => isEuropeCountry(feature.properties.name));
				return mapped;
			}
		},
		sa: {
			url: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
			objectName: "countries",
			projectionFactory: (featureCollection) =>
				d3.geoMercator().fitSize([975, 610], featureCollection),
			bounds: regionBounds.sa,
			transformFeatures: (features) => {
				const mapped = features
					.map((feature) => {
						const name = feature.properties?.name || "";
						const capitalInfo = southAmericaCapitalByCountry[name];
						return {
							...feature,
							properties: {
								...feature.properties,
								name,
								capital: capitalInfo?.capital || null,
								capitalCoords: capitalInfo
									? [capitalInfo.lon, capitalInfo.lat]
									: null
							}
						};
					})
					.filter((feature) => isSouthAmericaCountry(feature.properties.name));
				return mapped;
			}
		},
		ca: {
			url: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
			objectName: "countries",
			projectionFactory: (featureCollection) =>
				d3.geoMercator().fitSize([975, 610], featureCollection),
			bounds: regionBounds.ca,
			transformFeatures: (features) => {
				const mapped = features
					.map((feature) => {
						const name = feature.properties?.name || "";
						const capitalInfo = centralAmericaCapitalByCountry[name];
						return {
							...feature,
							properties: {
								...feature.properties,
								name,
								capital: capitalInfo?.capital || null,
								capitalCoords: capitalInfo
									? [capitalInfo.lon, capitalInfo.lat]
									: null
							}
						};
					})
					.filter((feature) => isCentralAmericaCountry(feature.properties.name));
				return mapped;
			}
		},
		af: {
			url: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
			objectName: "countries",
			projectionFactory: (featureCollection) =>
				d3.geoMercator().fitSize([975, 610], featureCollection),
			bounds: regionBounds.af,
			transformFeatures: (features) => {
				const mapped = features
					.map((feature) => {
						const name = feature.properties?.name || "";
						const capitalInfo = africaCapitalByCountry[name];
						return {
							...feature,
							properties: {
								...feature.properties,
								name,
								capital: capitalInfo?.capital || null,
								capitalCoords: capitalInfo
									? [capitalInfo.lon, capitalInfo.lat]
									: null
							}
						};
					})
					.filter((feature) => isAfricaCountry(feature.properties.name));
				return mapped;
			}
		}
	};

	const config = configByRegion[region];
	if (!config) return;
	try {
		const topology = await fetchJson(config.url);
		const geoData = topojson.feature(
			topology,
			topology.objects[config.objectName]
		);
		const features = config.transformFeatures(geoData.features || []);
		const boundedFeatures = config.bounds
			? features
					.map((feature) => filterToBounds(feature, config.bounds))
					.filter(Boolean)
			: features;
		const fitCollection = {
			type: "FeatureCollection",
			features: boundedFeatures
		};
		const projection = config.projectionFactory(fitCollection);
		buildMap(boundedFeatures, projection);
	} catch (error) {
		promptEl.textContent = t("ui.loadFail");
	}
};

quizStateBtn.addEventListener("click", () => setQuizType("state"));
quizCapitalBtn.addEventListener("click", () => setQuizType("capital"));
modeChoiceBtn.addEventListener("click", () => setMode("choice"));
modeClickBtn.addEventListener("click", () => setMode("click"));
regionUsBtn.addEventListener("click", () => setRegion("us"));
regionEuBtn.addEventListener("click", () => setRegion("eu"));
regionSaBtn.addEventListener("click", () => setRegion("sa"));
regionCaBtn.addEventListener("click", () => setRegion("ca"));
regionAfBtn.addEventListener("click", () => setRegion("af"));
regionNlBtn.addEventListener("click", () => setRegion("nl"));
langEnBtn.addEventListener("click", () => {
	locale = "en";
	applyLanguage();
});
langNlBtn.addEventListener("click", () => {
	locale = "nl";
	applyLanguage();
});

// Handle URL parameters for region selection from intro page
const urlParams = new URLSearchParams(window.location.search);
const urlRegion = urlParams.get("region");
if (urlRegion && ["na", "us", "eu", "sa", "ca", "af", "nl", "asia", "middleeast", "oceania"].includes(urlRegion)) {
	region = urlRegion === "na" ? "us" : urlRegion;
}

loadStaticData()
	.then(() => loadRegionData())
	.catch(() => {
		promptEl.textContent = t("ui.loadLocalFail");
	});
