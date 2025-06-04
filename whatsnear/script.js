import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
const marked = new Marked();

let map,
  userMarker,
  attractionMarkers = [];
let currentPosition = null;
let speechSynthesis, speechUtterance;

function initMap() {
  map = L.map("map").setView([0, 0], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);
  userMarker = L.marker([0, 0]).addTo(map);

  map.on("moveend", () => {
    currentPosition = {
      coords: {
        latitude: map.getCenter().lat,
        longitude: map.getCenter().lng,
      },
    };
  });
}

function updateUserLocation(position) {
  currentPosition = position;
  const { latitude, longitude } = position.coords;
  userMarker.setLatLng([latitude, longitude]);
  map.setView([latitude, longitude], 13);
  fetchNearbyAttractions();
}

async function fetchNearbyAttractions() {
  showLoading(true);
  const { latitude, longitude } = currentPosition.coords;
  const radius = 1000; // 1km radius
  const query = `
              [out:json];
              (
                node["tourism"="attraction"](around:${radius},${latitude},${longitude});
                way["tourism"="attraction"](around:${radius},${latitude},${longitude});
                relation["tourism"="attraction"](around:${radius},${latitude},${longitude});
              );
              out center;
          `;
  try {
    const response = await fetch(`https://llmfoundry.straive.com/-/proxy/https://overpass-api.de/api/interpreter`, {
      method: "POST",
      body: query,
    });
    const data = await response.json();
    const attractions = data.elements.slice(0, 5); // Limit to top 5 attractions
    await displayAttractions(attractions);
  } catch (error) {
    showError("Failed to fetch nearby attractions. Please try again.");
  } finally {
    showLoading(false);
  }
}

async function getAttractionDescription(attraction) {
  const prompt = `Describe the attraction "${attraction.tags.name}" located at ${attraction.lat}, ${attraction.lon} in about 50 words.`;
  try {
    const response = await fetch("https://llmfoundry.straive.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that provides brief descriptions of attractions.",
          },
          { role: "user", content: prompt },
        ],
      }),
    }).then((r) => r.json());
    return response.choices?.[0]?.message?.content || "Description not available.";
  } catch (error) {
    return "Failed to generate description.";
  }
}

async function displayAttractions(attractions) {
  const listElement = document.getElementById("attractionsList");
  listElement.innerHTML = "";
  attractionMarkers.forEach((marker) => map.removeLayer(marker));
  attractionMarkers = [];

  for (const attraction of attractions) {
    const description = await getAttractionDescription(attraction);
    const card = document.createElement("div");
    card.className = "card attraction-card";
    card.innerHTML = `
                  <div class="card-body">
                      <h5 class="card-title">${attraction.tags.name || "Unnamed Attraction"}</h5>
                      <p class="card-text">${marked.parse(description)}</p>
                      <button class="btn btn-sm btn-outline-secondary read-aloud-btn">
                          <i class="bi bi-volume-up"></i> Read Aloud
                      </button>
                      <button class="btn btn-sm btn-outline-secondary pause-btn d-none">
                          <i class="bi bi-pause-fill"></i> Pause
                      </button>
                      <button class="btn btn-sm btn-outline-secondary stop-btn d-none">
                          <i class="bi bi-stop-fill"></i> Stop
                      </button>
                  </div>
              `;
    listElement.appendChild(card);

    const marker = L.marker([attraction.lat, attraction.lon]).addTo(map);
    marker.bindPopup(attraction.tags.name || "Unnamed Attraction");
    attractionMarkers.push(marker);

    const readAloudBtn = card.querySelector(".read-aloud-btn");
    const pauseBtn = card.querySelector(".pause-btn");
    const stopBtn = card.querySelector(".stop-btn");

    readAloudBtn.addEventListener("click", () => {
      speechSynthesis.cancel();
      speechUtterance = new SpeechSynthesisUtterance(description);
      speechSynthesis.speak(speechUtterance);
      readAloudBtn.classList.add("d-none");
      pauseBtn.classList.remove("d-none");
      stopBtn.classList.remove("d-none");
    });

    pauseBtn.addEventListener("click", () => {
      if (speechSynthesis.speaking) {
        if (speechSynthesis.paused) {
          speechSynthesis.resume();
          pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
        } else {
          speechSynthesis.pause();
          pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume';
        }
      }
    });

    stopBtn.addEventListener("click", () => {
      speechSynthesis.cancel();
      readAloudBtn.classList.remove("d-none");
      pauseBtn.classList.add("d-none");
      stopBtn.classList.add("d-none");
    });
  }
}

function showLoading(isLoading) {
  document.getElementById("loadingSpinner").classList.toggle("d-none", !isLoading);
}

function showError(message) {
  const toastContainer = document.querySelector(".toast-container");
  const toastElement = document.createElement("div");
  toastElement.className = "toast";
  toastElement.setAttribute("role", "alert");
  toastElement.setAttribute("aria-live", "assertive");
  toastElement.setAttribute("aria-atomic", "true");
  toastElement.innerHTML = `
              <div class="toast-header bg-danger text-white">
                  <strong class="me-auto">Error</strong>
                  <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
              </div>
              <div class="toast-body">${message}</div>
          `;
  toastContainer.appendChild(toastElement);
  const toast = new bootstrap.Toast(toastElement);
  toast.show();
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  speechSynthesis = window.speechSynthesis;

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(updateUserLocation, () => {
      showError("Unable to retrieve your location. Please enable geolocation.");
    });

    navigator.geolocation.watchPosition(updateUserLocation, () => {
      showError("Lost access to location. Please check your settings.");
    });
  } else {
    showError("Geolocation is not supported by your browser.");
  }

  document.getElementById("refreshBtn").addEventListener("click", fetchNearbyAttractions);
});
