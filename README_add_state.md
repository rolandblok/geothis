# How to Add a New Country to the State/Region Quiz

## Overview

Each country quiz needs three things:
1. A **TopoJSON file** with the regional boundaries (`data/country_<code>_TopoJSON.json`)
2. A **config JSON file** with metadata and capitals (`data/country_<code>.json`)
3. **Three additions** in `intro.js`

---

## Step 1 — Verify the TopoJSON file

The TopoJSON file must have `"type":"Topology"` at the root (not `"type":"FeatureCollection"` — that is GeoJSON and won't work).

Check the object name and property names used in the file:

```powershell
$t = Get-Content "data/country_XX_TopoJSON.json" -Raw | ConvertFrom-Json
$t.objects.PSObject.Properties.Name          # → object name, e.g. "country_spain_TopoJSON"
$t.objects.<objectName>.geometries[0].properties  # → available property names
$t.objects.<objectName>.geometries | ForEach-Object { $_.properties.name } | Sort-Object
```

Note which property holds the region name (commonly `name`, `NAME`, `name_nl`, etc.) and any regions with `"geometry":null` — these are filtered out automatically.

---

## Step 2 — Create `data/country_<code>.json`

Copy the structure below and fill in the values:

```json
{
    "bounds": {
        "minLon": <west>,
        "maxLon": <east>,
        "minLat": <south>,
        "maxLat": <north>
    },
    "center": {
        "lat": <center lat>,
        "lon": <center lon>
    },
    "zoom": 0.18,
    "topoObjects": ["<objectName from TopoJSON>"],
    "nameProps": ["name"],
    "capitals": {
        "<ExactRegionName>": { "capital": "<City>", "lat": 0.0, "lon": 0.0 },
        ...
    }
}
```

**Notes:**
- `topoObjects` must match the key inside `topology.objects` exactly.
- `nameProps` lists property names to try in order; first non-empty match wins.
- `capitals` keys must match the region names exactly as they appear in the TopoJSON properties (including accented characters like `ñ`, `é`, etc.). Use `[System.IO.File]::ReadAllBytes()` with UTF-8 decoding to read the exact strings.
- `zoom` is the globe altitude: `~0.08` for small countries (Netherlands, Belgium), `~0.17` for medium (Germany, Spain), `~0.92` for large (USA).
- Regions with `null` geometry (e.g. Ceuta, Melilla for Spain) are filtered out automatically — no need to exclude them in an allowList.
- Optionally add a `"states"` or `"provinces"` array (lowercase names) to restrict which regions appear in the quiz. Useful when the TopoJSON contains unwanted features.

**Reference zoom values:**

| Country     | zoom |
|-------------|------|
| Belgium/NL  | 0.08 |
| UK / France | 0.12 |
| Germany/Spain | 0.17–0.18 |
| Canada      | 0.70 |
| USA         | 0.92 |

---

## Step 3 — Add Spain to `intro.js` (3 places)

### 3a. `stateQuizCountryMap` (makes clicking the country on the globe open the quiz picker)

```js
const stateQuizCountryMap = {
    ...
    'Spain': 'spain'   // key = WorldAtlas country name, value = country code
};
```

The key must match the `name` property used in the world atlas GeoJSON that globe.gl renders. Check `data/europe_countries.json` (or the relevant continent file) to find the exact name.

### 3b. Titles in `startStateQuiz`

```js
const titles = {
    ...
    spain: { state: 'Spain – Autonomous Communities', 'state-capital': 'Spain – Community Capitals' }
};
```

### 3c. `countryConfigs`

```js
const countryConfigs = {
    ...
    spain: { configFile: 'data/country_spain.json', topoFile: './data/country_spain_TopoJSON.json' }
};
```

---

## Checklist

- [ ] TopoJSON file is `"type":"Topology"` (not GeoJSON FeatureCollection)
- [ ] `data/country_<code>.json` created with correct `topoObjects`, `nameProps`, and all `capitals` keys matching exact region names
- [ ] Country added to `stateQuizCountryMap` with correct WorldAtlas name as key
- [ ] Country added to `titles` in `startStateQuiz`
- [ ] Country added to `countryConfigs`

---

## Countries already implemented

| Code    | WorldAtlas name          | Regions              |
|---------|--------------------------|----------------------|
| usa     | United States of America | States               |
| canada  | Canada                   | Provinces            |
| mexico  | Mexico                   | States               |
| nl      | Netherlands              | Provinces            |
| germany | Germany                  | States               |
| france  | France                   | Départements         |
| belgium | Belgium                  | Provinces            |
| uk      | United Kingdom           | Counties & Councils  |
| spain   | Spain                    | Autonomous Communities |
