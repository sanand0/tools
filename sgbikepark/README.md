# Singapore Bike Parking Locator

This web application displays bicycle parking locations in Singapore on an interactive map. It helps users find nearby bike parking facilities.

## What it does

The SG Bike Parking Locator uses Leaflet.js to render an OpenStreetMap base layer. It then dynamically fetches and displays bicycle parking locations based on the user's current geographical position or the visible map area.

Key Features:
-   **Interactive Map:** Users can pan and zoom to explore different areas of Singapore.
-   **Geolocation:** On load, the app attempts to detect the user's current location to automatically show nearby parking. A "locate me" button is also provided.
-   **Dynamic Data Fetching:** Parking locations are fetched from an external API (`fetch.sanand.workers.dev/lta/BicycleParkingv2`) based on the latitude and longitude of the map's center. This ensures relevant data is shown as the user navigates the map.
-   **Marker Information:** Each parking spot is indicated by a map marker. Clicking a marker reveals a popup with details:
    *   Description of the location (e.g., "BLK 123 ABC STREET")
    *   Type of rack (e.g., "Yellow Box")
    *   Number of racks available.
-   **Real-time Updates:** As the user moves the map, new parking data is fetched for the new center of the map, and markers are updated accordingly. A red marker indicates the location around which parking spots are being displayed.

## Use Cases

-   **Cyclists:** Find convenient and official bicycle parking spots across Singapore.
-   **Urban Mobility Planning:** Useful as a quick reference for understanding the distribution of bicycle parking infrastructure.
-   **Commuters:** Plan bike-to-transit journeys by identifying parking near MRT stations or bus stops (if data is available).

## How It Works

1.  **Map Initialization:**
    *   The application initializes a Leaflet map centered on Singapore's Central Business District (CBD) by default.
    *   OpenStreetMap tiles are used as the base map layer.
    *   A locate control is added to the map, allowing users to easily center the map on their current position.

2.  **Initial Location & Data Load:**
    *   Upon loading, the app requests the user's current geolocation via the browser's `navigator.geolocation` API.
    *   If permission is granted and location is obtained, the map view is set to the user's location with a high zoom level.
    *   The `showParkings()` function is called with these coordinates.

3.  **`showParkings(latitude, longitude)` Function:**
    *   A prominent red marker is placed at the given `latitude` and `longitude` (either the user's current location or the map center after a move) with a popup saying "Showing bike parkings near here."
    *   An API call is made to `https://fetch.sanand.workers.dev/lta/BicycleParkingv2` with the `latitude` and `longitude` as query parameters. This API is expected to return a JSON object containing a `value` array of parking locations.
    *   Any previously displayed bike parking markers (excluding the red current location marker) are removed from the map.
    *   For each parking facility returned by the API, a new marker is added to the map at its specified `Latitude` and `Longitude`.
    *   Each new marker is given a popup that displays its `Description`, `RackType`, and `RackCount`.

4.  **Map Navigation:**
    *   If the user manually pans or zooms the map, the `moveend` event triggers.
    *   When this event occurs, the `showParkings()` function is called again with the new center coordinates of the map, refreshing the displayed parking locations relevant to the new view.

The application relies on Leaflet.js for mapping functionalities and an external API for sourcing bicycle parking data, presumably from Singapore's Land Transport Authority (LTA) via a proxy or aggregator service.
