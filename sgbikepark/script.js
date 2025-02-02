const cbd = [1.282091, 103.851987];

const map = L.map("map").setView(cbd, 15);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
L.control.locate().addTo(map);
map.on("moveend", () => {
  const center = map.getCenter();
  showParkings([center.lat, center.lng]);
});

// Get the current location from the browser with as high accuracy as possible
navigator.geolocation.getCurrentPosition((position) => {
  map.setView([position.coords.latitude, position.coords.longitude], 18);
  showParkings([position.coords.latitude, position.coords.longitude]);
});

async function showParkings([lat, lng]) {
  // Add marker at current location
  const currentLocation = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
  })
    .addTo(map)
    .bindPopup("Showing bike parkings near here")
    .openPopup();
  // Fetch the parking locations from the API
  const url = "https://fetch.sanand.workers.dev/lta/BicycleParkingv2?" + new URLSearchParams({ Lat: lat, Long: lng });
  const data = await fetch(url).then((r) => r.json());
  // Remove all markers before adding new ones
  map.eachLayer((layer) => (layer instanceof L.Marker && layer !== currentLocation ? map.removeLayer(layer) : null));
  // Add markers for each parking location
  data.value.forEach((d) => {
    L.marker([d.Latitude, d.Longitude]).addTo(map).bindPopup(`${d.Description} (${d.RackType}: ${d.RackCount})`);
  });
}
