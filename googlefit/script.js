import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
const form = document.getElementById("googlefit-form");
const filesInput = document.getElementById("files");
const headerRow = document.getElementById("header-row");
const activityData = document.getElementById("activity-data");

saveform("#googlefit-form");

// Track unique sports and dates
const sports = new Set();
const dates = new Set();

// Store activity data by date and sport
const activities = new Map();

form.addEventListener("submit", (e) => e.preventDefault());

filesInput.addEventListener("change", async () => {
  const files = filesInput.files;
  if (!files.length) return;

  // Reset data
  sports.clear();
  dates.clear();
  activities.clear();
  headerRow.innerHTML = "<th>Date</th>";
  activityData.innerHTML = "";

  // Process each file
  for (const file of files) {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");

    // Get activity data
    const activity = doc.querySelector("Activity");
    const sport = activity.getAttribute("Sport");
    const date = activity.querySelector("Id").textContent.split("T")[0];
    const lap = activity.querySelector("Lap");

    // Store data
    sports.add(sport);
    dates.add(date);

    if (!activities.has(date)) {
      activities.set(date, new Map());
    }
    activities.get(date).set(sport, {
      distance: parseFloat(lap.querySelector("DistanceMeters").textContent),
      time: parseFloat(lap.querySelector("TotalTimeSeconds").textContent),
      calories: parseFloat(lap.querySelector("Calories").textContent),
    });
  }

  // Sort sports and dates
  const sortedSports = [...sports].sort();
  const sortedDates = [...dates].sort().reverse();

  // Create header
  sortedSports.forEach((sport) => {
    const th = document.createElement("th");
    th.textContent = sport;
    headerRow.appendChild(th);
  });

  // Create rows
  sortedDates.forEach((date) => {
    const tr = document.createElement("tr");
    const dateCell = document.createElement("td");
    dateCell.textContent = date;
    tr.appendChild(dateCell);

    sortedSports.forEach((sport) => {
      const td = document.createElement("td");
      const data = activities.get(date)?.get(sport);
      if (data) {
        td.innerHTML = /* html */ `
              ${(data.distance / 1000).toFixed(2)} km<br>
              ${Math.floor(data.time / 60)}m ${Math.round(data.time % 60)}s<br>
              ${Math.round(data.calories)} cal
            `;
      }
      tr.appendChild(td);
    });

    activityData.appendChild(tr);
  });
});
