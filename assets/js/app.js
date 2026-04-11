const APP_CONFIG = window.APP_CONFIG || {};

let map;
let infoWindow;
let geocoder;
let markers = {
  hospital: [],
  urgent: [],
  pharmacy: [],
};
let allResults = [];
let activeFilters = new Set(["hospital", "pharmacy", "urgent_care"]);
let openOnly = false;
let userLocation = null;
let radiusKm = 5;
let waEdWaitLookup = new Map();
let waEdSnapshot = null;

const TYPE_CONFIG = {
  hospital: {
    label: "Hospital",
    icon: "🏥",
    color: "#e63946",
    bg: "#fff0f0",
  },
  pharmacy: {
    label: "Pharmacy",
    icon: "💊",
    color: "#f4a261",
    bg: "#fff8f0",
  },
  urgent_care: {
    label: "Urgent Care",
    icon: "🚑",
    color: "#7209b7",
    bg: "#f8f0ff",
  },
};

window.initMap = function () {
  const defaultCenter = { lat: -31.9505, lng: 115.8605 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 13,
    disableDefaultUI: false,
    styles: mapStyle,
    mapTypeControl: false,
  });

  infoWindow = new google.maps.InfoWindow();
  geocoder = new google.maps.Geocoder();

  loadMarkers(defaultCenter);
  setInterval(() => {
    updateAllPopups();
    updateRecommendation(defaultCenter);
  }, 5000);

  document.getElementById("loading").style.display = "none";
};

function loadGoogleMapsScript() {
  const key = APP_CONFIG.googleMapsApiKey;
  const normalizedKey = String(key || "").trim();
  const looksLikePlaceholder =
    !normalizedKey ||
    normalizedKey === "your_google_maps_api_key" ||
    /YOUR_API_KEY/i.test(normalizedKey);

  if (looksLikePlaceholder) {
    document.getElementById("loading").style.display = "none";
    showToast(
      "Google Maps key is missing. Set GOOGLE_MAPS_API_KEY in .env and restart.",
    );
    return;
  }

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(normalizedKey)}&libraries=places&callback=initMap`;
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);
}

function loadMarkers(center, radius = 5000) {
  clearMarkers();
  allResults = [];
  renderList([]);
  document.getElementById("loading").style.display = "flex";

  fetchWaEdLiveWaits()
    .then(() => {
      applyLiveWaitsToResults();
      sortAndRender();
    })
    .catch(() => {
      // Keep simulated waits when live feed is unavailable.
    });

  const service = new google.maps.places.PlacesService(map);
  let pending = 3;

  service.nearbySearch(
    {
      location: center,
      radius,
      keyword: "hospital",
    },
    (results, status) => {
      addMarkers(results, status, "red", "hospital");
      pending--;
      if (pending === 0) {
        document.getElementById("loading").style.display = "none";
        sortAndRender();
      }
    },
  );

  service.nearbySearch(
    {
      location: center,
      radius,
      keyword: "urgent care",
    },
    (results, status) => {
      addMarkers(results, status, "orange", "urgent");
      pending--;
      if (pending === 0) {
        document.getElementById("loading").style.display = "none";
        sortAndRender();
      }
    },
  );

  service.nearbySearch(
    {
      location: center,
      radius,
      keyword: "pharmacy",
    },
    (results, status) => {
      addMarkers(results, status, "green", "pharmacy");
      pending--;
      if (pending === 0) {
        document.getElementById("loading").style.display = "none";
        sortAndRender();
      }
    },
  );

  setTimeout(() => updateRecommendation(center), 1000);
}

function generateWaitTime(category) {
  if (category === "hospital") return Math.floor(Math.random() * 90 + 30);
  if (category === "urgent") return Math.floor(Math.random() * 35 + 10);
  if (category === "pharmacy") return Math.floor(Math.random() * 10);
  return 0;
}

function normalizeHospitalName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLiveWaitForPlace(place) {
  if (!place || !place.name || waEdWaitLookup.size === 0) return null;

  const normalizedPlaceName = normalizeHospitalName(place.name);
  if (!normalizedPlaceName) return null;

  if (waEdWaitLookup.has(normalizedPlaceName)) {
    return waEdWaitLookup.get(normalizedPlaceName);
  }

  for (const [hospitalName, waitMins] of waEdWaitLookup.entries()) {
    if (
      normalizedPlaceName.includes(hospitalName) ||
      hospitalName.includes(normalizedPlaceName)
    ) {
      return waitMins;
    }
  }

  return null;
}

async function fetchWaEdLiveWaits() {
  const response = await fetch("/api/wa-ed-live");
  if (!response.ok) return;

  const payload = await response.json();
  if (!Array.isArray(payload.hospitals)) return;

  waEdWaitLookup = new Map(
    payload.hospitals
      .map((row) => [normalizeHospitalName(row.hospital), row.waitMins])
      .filter(([name, waitMins]) => name && Number.isFinite(waitMins)),
  );
  waEdSnapshot = payload.snapshot || null;
}

function applyLiveWaitsToResults() {
  allResults.forEach((place) => {
    const liveWait = getLiveWaitForPlace(place);
    if (liveWait === null) return;

    place._waitTime = liveWait;
    place._waitSource = "wa_ed_live";
  });

  Object.keys(markers).forEach((cat) => {
    markers[cat].forEach((marker) => {
      const liveWait = getLiveWaitForPlace(marker.place);
      if (liveWait === null) return;

      marker.waitTime = liveWait;
    });
  });
}

function addMarkers(results, status, color, category) {
  if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return;

  results.forEach((place) => {
    if (!place.geometry || !place.geometry.location) return;

    if (!allResults.find((r) => r.place_id === place.place_id)) {
      let type;
      if (category === "hospital") type = "hospital";
      else if (category === "urgent") type = "urgent_care";
      else if (category === "pharmacy") type = "pharmacy";
      const waitTime = generateWaitTime(category);
      allResults.push({ ...place, _type: type, _waitTime: waitTime });
    }

    const marker = new google.maps.Marker({
      position: place.geometry.location,
      map,
      title: place.name,
      icon: {
        url: `https://maps.google.com/mapfiles/ms/icons/${color}-dot.png`,
      },
    });

    marker.waitTime = generateWaitTime(category);
    marker.category = category;
    marker.place = place;
    marker.addListener("click", () => showPopup(marker));
    markers[category].push(marker);
  });
}

function showPopup(marker) {
  const place = marker.place;
  const lat = place.geometry.location.lat();
  const lng = place.geometry.location.lng();
  const categoryLabel =
    marker.category === "hospital"
      ? "Hospital"
      : marker.category === "urgent"
        ? "Urgent Care"
        : "Pharmacy";
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  // Show loading popup first
  const loadingContent = `
    <div class="info-box">
      <h3 class="info-title">${escHtml(place.name)}</h3>
      <p class="info-address">${escHtml(place.vicinity || "No address available")}</p>
      <div class="info-meta">
        <span class="info-chip info-chip-wait">⏱ Wait: ${marker.waitTime} mins</span>
        <span class="info-chip info-chip-type">${categoryLabel}</span>
      </div>
      <div class="info-hours">
        <div class="info-hours-status loading">⏳ Loading hours...</div>
      </div>
      <a class="info-directions" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">
        Get Directions
      </a>
    </div>
  `;

  infoWindow.setContent(loadingContent);
  infoWindow.open(map, marker);

  // Fetch detailed place information including opening hours
  const service = new google.maps.places.PlacesService(map);
  service.getDetails(
    {
      placeId: place.place_id,
      fields: [
        "opening_hours",
        "formatted_address",
        "website",
        "formatted_phone_number",
      ],
    },
    (placeDetails, status) => {
      if (
        status === google.maps.places.PlacesServiceStatus.OK &&
        placeDetails
      ) {
        // Update place with detailed information
        Object.assign(place, placeDetails);

        // Format opening hours with detailed information
        let hoursDisplay = "";
        if (placeDetails.opening_hours) {
          const hours = placeDetails.opening_hours;

          // Current status
          if (hours.open_now !== undefined) {
            hoursDisplay += `<div class="info-hours-status ${hours.open_now ? "open" : "closed"}">
              ${hours.open_now ? "🟢 Open Now" : "🔴 Closed"}
            </div>`;
          }

          // Get today's hours
          if (hours.weekday_text && hours.weekday_text.length > 0) {
            const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
            // Google Maps weekday_text starts with Sunday (index 0)
            const todayIndex = today === 0 ? 6 : today - 1; // Convert to Google format (Monday = 0)
            const todayHours =
              hours.weekday_text[todayIndex] || "Hours not available";

            hoursDisplay += `<div class="info-hours-today">${escHtml(todayHours)}</div>`;
          }

          // Special hours or additional info
          if (hours.special_days) {
            hoursDisplay += '<div class="info-hours-special">';
            hours.special_days.forEach((special) => {
              const date = new Date(special.date);
              hoursDisplay += `<div class="info-hours-day">📅 ${date.toLocaleDateString()}: ${special.opening_hours ? special.opening_hours : "Closed"}</div>`;
            });
            hoursDisplay += "</div>";
          }
        } else {
          hoursDisplay =
            '<div class="info-hours-status unknown">🕒 Hours not available</div>';
        }

        const isClosed =
          placeDetails.opening_hours &&
          placeDetails.opening_hours.open_now === false;
        const waitChip =
          marker.waitTime > 0 && !isClosed
            ? `<span class="info-chip info-chip-wait">⏱ Wait: ${marker.waitTime} mins</span>`
            : "";

        // Build detailed content
        let content = `
          <div class="info-box">
            <h3 class="info-title">${escHtml(place.name)}</h3>
            <p class="info-address">${escHtml(placeDetails.formatted_address || place.vicinity || "No address available")}</p>
            <div class="info-meta">
              ${waitChip}
              <span class="info-chip info-chip-type">${categoryLabel}</span>
            </div>
            <div class="info-hours">
              ${hoursDisplay}
            </div>
        `;

        // Add phone number if available
        if (placeDetails.formatted_phone_number) {
          content += `<div class="info-contact">
            <a href="tel:${placeDetails.formatted_phone_number}" class="info-phone">📞 ${escHtml(placeDetails.formatted_phone_number)}</a>
          </div>`;
        }

        content += `
            <a class="info-directions" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">
              Get Directions
            </a>
          </div>
        `;

        infoWindow.setContent(content);
      } else {
        // Fallback to basic info if details fetch fails
        const fallbackHoursDisplay = place.opening_hours
          ? place.opening_hours.open_now !== undefined
            ? `<div class="info-hours-status ${place.opening_hours.open_now ? "open" : "closed"}">
              ${place.opening_hours.open_now ? "🟢 Open Now" : "🔴 Closed"}
            </div>`
            : '<div class="info-hours-status unknown">🕒 Hours not available</div>'
          : '<div class="info-hours-status unknown">🕒 Hours not available</div>';

        const closedFallback =
          place.opening_hours && place.opening_hours.open_now === false;
        const fallbackWait =
          marker.waitTime > 0 && !closedFallback
            ? `<span class="info-chip info-chip-wait">⏱ Wait: ${marker.waitTime} mins</span>`
            : "";

        const content = `
          <div class="info-box">
            <h3 class="info-title">${escHtml(place.name)}</h3>
            <p class="info-address">${escHtml(place.vicinity || "No address available")}</p>
            <div class="info-meta">
              ${fallbackWait}
              <span class="info-chip info-chip-type">${categoryLabel}</span>
            </div>
            <div class="info-hours">
              ${fallbackHoursDisplay}
            </div>
            <a class="info-directions" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">
              Get Directions
            </a>
          </div>
        `;

        infoWindow.setContent(content);
      }
    },
  );
}

function updateAllPopups() {
  Object.keys(markers).forEach((cat) => {
    markers[cat].forEach((m) => {
      const liveWait = getLiveWaitForPlace(m.place);
      m.waitTime = liveWait === null ? generateWaitTime(cat) : liveWait;

      // Also update wait time in allResults
      const result = allResults.find((r) => r.place_id === m.place.place_id);
      if (result) {
        result._waitTime = m.waitTime;
        result._waitSource = liveWait === null ? "simulated" : "wa_ed_live";
      }
    });
  });

  if (waEdSnapshot) {
    const recText = document.getElementById("recText");
    if (recText && !recText.dataset.snapshotHintShown) {
      recText.dataset.snapshotHintShown = "true";
      recText.title = `WA ED snapshot: ${waEdSnapshot}`;
    }
  }
}

function updateRecommendation(center) {
  if (!markers.urgent.length) return;

  let best = null;
  let bestScore = Infinity;

  markers.urgent.forEach((m) => {
    const place = m.place;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();

    const distance =
      Math.sqrt(Math.pow(center.lat - lat, 2) + Math.pow(center.lng - lng, 2)) *
      111;

    const wait = m.waitTime || 999;
    const score = wait + distance * 5;

    if (score < bestScore) {
      bestScore = score;
      best = { place, wait, distance };
    }
  });

  if (best) {
    document.getElementById("recText").innerHTML =
      `<b>${best.place.name}</b> • ⏱ ${best.wait} mins • 📍 ${best.distance.toFixed(2)} km`;

    const banner = document.querySelector(".recommendation-banner");
    banner.onclick = () => selectPlace(best.place.place_id);
    banner.style.cursor = "pointer";
  }
}

function toggleMarkers(category, show) {
  markers[category].forEach((marker) => marker.setMap(show ? map : null));
}

function clearMarkers() {
  Object.keys(markers).forEach((cat) => {
    markers[cat].forEach((m) => m.setMap(null));
  });
  markers = {
    hospital: [],
    urgent: [],
    pharmacy: [],
  };
}

function searchNear(location) {
  userLocation = location;
  map.setCenter(location);
  loadMarkers(location, radiusKm * 1000);
}

function sortAndRender() {
  const sort = document.getElementById("sortSelect").value;
  const sorted = [...allResults]
    .filter((place) => activeFilters.has(place._type))
    .filter((place) => {
      if (!openOnly) return true;
      return place.opening_hours && place.opening_hours.open_now === true;
    });

  if (sort === "distance" && userLocation) {
    sorted.sort((a, b) => {
      const da = distanceKm(userLocation, {
        lat: a.geometry.location.lat(),
        lng: a.geometry.location.lng(),
      });
      const db = distanceKm(userLocation, {
        lat: b.geometry.location.lat(),
        lng: b.geometry.location.lng(),
      });
      return da - db;
    });
  } else if (sort === "wait") {
    sorted.sort((a, b) => (a._waitTime || 999) - (b._waitTime || 999));
  }

  renderList(sorted);
  renderMarkers(sorted);
}

function renderList(places) {
  const list = document.getElementById("resultsList");
  document.getElementById("resultCount").textContent = `${places.length} found`;

  if (places.length === 0) {
    list.innerHTML =
      '<div class="empty-state"><div class="big-icon">🔍</div><p>No results found. Try a larger radius or different filters.</p></div>';
    return;
  }

  list.innerHTML = places
    .map((place) => {
      const cfg = TYPE_CONFIG[place._type] || TYPE_CONFIG.hospital;
      const openNow = place.opening_hours
        ? place.opening_hours.open_now
          ? '<span class="open-badge open">Open Now</span>'
          : '<span class="open-badge closed">Closed</span>'
        : '<span class="open-badge unknown">Hours N/A</span>';

      const waitTime = place._waitTime || 0;
      const isOpen = place.opening_hours && place.opening_hours.open_now;
      const waitDisplay =
        waitTime > 0 && isOpen
          ? `<span class="wait-badge">⏱ ${waitTime} mins</span>`
          : "";

      let dist = "";
      if (userLocation && place.geometry) {
        const km = distanceKm(userLocation, {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
        dist = `<span class="distance-badge">${km.toFixed(1)} km away</span>`;
      }

      return `
        <div class="result-item" data-id="${place.place_id}" onclick="selectPlace('${place.place_id}')">
          <div class="result-top">
            <div class="type-badge" style="background:${cfg.bg}; font-size:18px">${cfg.icon}</div>
            <div>
              <div class="result-name">${escHtml(place.name)}</div>
              <div class="result-addr">${escHtml(place.vicinity || "")}</div>
            </div>
          </div>
          <div class="result-meta">
            ${waitDisplay}
            ${openNow}
            ${dist}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMarkers(places) {
  clearMarkers();
  places.forEach((place) => {
    let category;
    let typeConfig;

    if (place._type === "hospital") {
      category = "hospital";
      typeConfig = TYPE_CONFIG.hospital;
    } else if (place._type === "urgent_care") {
      category = "urgent";
      typeConfig = TYPE_CONFIG.urgent_care;
    } else if (place._type === "pharmacy") {
      category = "pharmacy";
      typeConfig = TYPE_CONFIG.pharmacy;
    } else {
      return;
    }

    // Create SVG icon with matching color
    const color = typeConfig.color;
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="32" height="48">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 9.6 16 32 16 32s16-22.4 16-32c0-8.8-7.2-16-16-16z" fill="${color}" stroke="black" stroke-width="1.5"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>`;

    const markerIcon = {
      url: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
      scaledSize: new google.maps.Size(24, 36),
      anchor: new google.maps.Point(12, 36),
    };

    const marker = new google.maps.Marker({
      map,
      position: place.geometry.location,
      title: place.name,
      icon: markerIcon,
    });

    marker.waitTime = generateWaitTime(category);
    if (Number.isFinite(place._waitTime)) {
      marker.waitTime = place._waitTime;
    }
    marker.category = category;
    marker.place = place;

    marker.addListener("click", () => {
      showPopup(marker);
    });

    markers[category].push(marker);
  });
}

function selectPlace(placeId, scroll = true) {
  document.querySelectorAll(".result-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === placeId);
  });

  if (scroll) {
    const el = document.querySelector(`.result-item[data-id="${placeId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  let foundMarker = null;
  Object.keys(markers).forEach((cat) => {
    markers[cat].forEach((m) => {
      if (m.place.place_id === placeId) foundMarker = m;
    });
  });

  if (foundMarker) {
    map.panTo(foundMarker.getPosition());
    map.setZoom(15);
    showPopup(foundMarker);
  }
}

window.selectPlace = selectPlace;

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function initLandbot() {
  const landbotConfigUrl = APP_CONFIG.landbotConfigUrl;
  if (!landbotConfigUrl) return;

  if (window.__landbotLoaded) return;
  window.__landbotLoaded = true;

  const script = document.createElement("script");
  script.src = "https://static.landbot.io/landbot-3/landbot-3.0.0.js";
  script.async = true;
  script.onload = () => {
    if (window.Landbot) {
      new window.Landbot.Livechat({
        configUrl: landbotConfigUrl,
      });
    }
  };
  document.body.appendChild(script);
}

document.getElementById("locateBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    showToast("Geolocation not supported.");
    return;
  }

  showToast("Detecting your location...");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setCenter(loc);
      new google.maps.Marker({
        map,
        position: loc,
        title: "You are here",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      searchNear(loc);
    },
    () => showToast("Could not get location. Please enable location access."),
  );
});

let searchTimer;
document.getElementById("searchInput").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 3) return;

  searchTimer = setTimeout(() => {
    geocoder.geocode(
      { address: `${q}, Western Australia, Australia` },
      (results, status) => {
        if (status === "OK" && results[0]) {
          const loc = results[0].geometry.location;
          map.setCenter(loc);
          map.setZoom(13);
          searchNear({ lat: loc.lat(), lng: loc.lng() });
        } else {
          showToast("Suburb not found. Try another search.");
        }
      },
    );
  }, 600);
});

document.getElementById("radiusSlider").addEventListener("input", (e) => {
  radiusKm = parseInt(e.target.value, 10);
  document.getElementById("radiusLabel").textContent = `${radiusKm} km`;

  // Adjust zoom based on radius
  let zoom;
  if (radiusKm <= 2) zoom = 16;
  else if (radiusKm <= 5) zoom = 15;
  else if (radiusKm <= 10) zoom = 14;
  else zoom = 13;
  map.setZoom(zoom);

  if (userLocation) {
    searchNear(userLocation);
  } else if (map) {
    loadMarkers(map.getCenter(), radiusKm * 1000);
  }
});

document.getElementById("sortSelect").addEventListener("change", sortAndRender);

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const type = chip.dataset.type;

    if (type === "open_only") {
      openOnly = !openOnly;
      chip.classList.toggle("active", openOnly);
      sortAndRender();
      return;
    }

    if (activeFilters.has(type)) {
      if (activeFilters.size === 1) {
        showToast("At least one filter must be active.");
        return;
      }
      activeFilters.delete(type);
      chip.classList.remove("active");
    } else {
      activeFilters.add(type);
      chip.classList.add("active");
    }

    let cat;
    if (type === "hospital") cat = "hospital";
    else if (type === "urgent_care") cat = "urgent";
    else if (type === "pharmacy") cat = "pharmacy";

    if (cat) toggleMarkers(cat, activeFilters.has(type));
    sortAndRender();
  });
});

const mapStyle = [
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d1e8f0" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f0" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e0e0e0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#fde68a" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4b5563" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d4d4d8" }],
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#374151" }],
  },
  { elementType: "labels.text.fill", stylers: [{ color: "#555" }] },
  { elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
];

window.addEventListener("mouseover", initLandbot, { once: true });
window.addEventListener("touchstart", initLandbot, { once: true });

loadGoogleMapsScript();
