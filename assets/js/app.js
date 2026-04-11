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
let userLocation = null;
let radiusKm = 5;

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
  if (!key) {
    document.getElementById("loading").style.display = "none";
    showToast(
      "Missing Google Maps API key. Set GOOGLE_MAPS_API_KEY in server env.",
    );
    return;
  }

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=initMap`;
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);
}

function loadMarkers(center, radius = 5000) {
  clearMarkers();
  allResults = [];
  renderList([]);
  document.getElementById("loading").style.display = "flex";

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

function addMarkers(results, status, color, category) {
  if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return;

  results.forEach((place) => {
    if (!place.geometry || !place.geometry.location) return;

    if (!allResults.find((r) => r.place_id === place.place_id)) {
      let type;
      if (category === "hospital") type = "hospital";
      else if (category === "urgent") type = "urgent_care";
      else if (category === "pharmacy") type = "pharmacy";
      allResults.push({ ...place, _type: type });
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

  const content = `
    <div style="max-width:220px">
      <h3>${place.name}</h3>
      <p>${place.vicinity || "No address"}</p>
      <p>⏱ Wait: ${marker.waitTime} mins</p>
      <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}')">Get Directions</button>
    </div>
  `;

  infoWindow.setContent(content);
  infoWindow.open(map, marker);
}

function updateAllPopups() {
  Object.keys(markers).forEach((cat) => {
    markers[cat].forEach((m) => {
      m.waitTime = generateWaitTime(cat);
    });
  });
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
  const sorted = [...allResults].filter((place) =>
    activeFilters.has(place._type),
  );

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
  } else if (sort === "rating") {
    sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
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
      const rating = place.rating
        ? `<span class="stars">⭐ ${place.rating.toFixed(1)}</span>`
        : "";
      const openNow = place.opening_hours
        ? place.opening_hours.open_now
          ? '<span class="open-badge open">Open Now</span>'
          : '<span class="open-badge closed">Closed</span>'
        : '<span class="open-badge unknown">Hours N/A</span>';

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
            ${rating}
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
    let color;

    if (place._type === "hospital") {
      category = "hospital";
      color = "red";
    } else if (place._type === "urgent_care") {
      category = "urgent";
      color = "orange";
    } else if (place._type === "pharmacy") {
      category = "pharmacy";
      color = "green";
    } else {
      return;
    }

    const marker = new google.maps.Marker({
      map,
      position: place.geometry.location,
      title: place.name,
      icon: {
        url: `https://maps.google.com/mapfiles/ms/icons/${color}-dot.png`,
      },
    });

    marker.waitTime = generateWaitTime(category);
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
  if (userLocation) searchNear(userLocation);
});

document.getElementById("sortSelect").addEventListener("change", sortAndRender);

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const type = chip.dataset.type;
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
