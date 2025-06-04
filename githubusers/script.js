import { showToast } from '../../common/ui.js';
import { API_KEY_FIELD_ID } from '../../common/api_fields.js';
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const form = document.getElementById("urlForm");
// const alertsDiv = document.getElementById("alerts"); // Replaced by showToast
const results = document.getElementById("results");

let userDataStorage = []; // To store fetched and processed user data

// Define the order and selection of fields
const SELECTED_FIELDS = [
  "source",
  "html_url",
  "avatar_url",
  "name",
  "company",
  "blog",
  "location",
  "email",
  "hireable",
  "bio",
  "twitter_username",
  "public_repos",
  "public_gists",
  "followers",
  "following",
  "created_at",
  "updated_at",
];

function bootstrapBgColor(alertType) {
  const mapping = {
    'info': 'bg-info',
    'warning': 'bg-warning',
    'danger': 'bg-danger',
    'success': 'bg-success',
    'primary': 'bg-primary',
  };
  return mapping[alertType] || 'bg-secondary'; // Default to secondary if type unknown
}

// function showAlert(message, type = "info", autoClose = false) { // Replaced by showToast
//   alertsDiv.insertAdjacentHTML(
//     "beforeend",
//     /* html */ `
//         <div class="alert alert-${type} alert-dismissible fade show">
//           ${message} <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
//         </div>`
//   );
//   const alert = alertsDiv.lastElementChild;
//   if (autoClose) setTimeout(() => alert.remove(), 3000);
//   return alert;
// }

const githubComRegex = /github\.com\/([a-zA-Z0-9_-]+)/i;
const githubIoRegex = /([a-zA-Z0-9_-]+)\.github\.io/i;
const plainUsernameRegex = /^@?([a-zA-Z0-9_-]+)$/i; // Allows optional @ prefix

const extractUser = (text) => {
  if (!text) return null;
  const matchCom = text.match(githubComRegex);
  if (matchCom) return matchCom[1];
  const matchIo = text.match(githubIoRegex);
  if (matchIo) return matchIo[1];
  const matchPlain = text.match(plainUsernameRegex);
  if (matchPlain) return matchPlain[1];
  return null;
};

async function fetchUserData(username, token) {
  const headers = { "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/users/${username}`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch data for ${username}: ${response.statusText}`);
  return await response.json();
}

function escapeCell(value) {
  const stringValue = String(value); // Ensure value is a string
  // If the cell contains a tab or newline, wrap it in quotes. Escape quotes with ""
  return /[\t\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

function convertToTSV(data) {
  const headers = SELECTED_FIELDS; // Use SELECTED_FIELDS for consistent header order
  const rows = [
    headers.join("\t"),
    ...data.map((user) => 
      headers.map((header) => {
        const value = user[header] === null || user[header] === undefined ? "" : user[header];
        return escapeCell(value); // escapeCell will handle string conversion
      }).join("\t")
    ),
  ];
  return rows.join("\n");
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  // alertsDiv.innerHTML = ""; // Replaced by showToast
  results.innerHTML = "";
  userDataStorage = []; // Clear previous results

  const token = document.getElementById(API_KEY_FIELD_ID).value.trim();
  const text = document.getElementById("urls").value;

  const input = text
    .split("\n")
    .map((d) => ({ source: d.trim(), username: extractUser(d) }))
    .filter((d) => d.source && d.username);
  if (input.length === 0) return showToast("No valid GitHub URLs found!", bootstrapBgColor("warning"));

  showToast(
    `<i class="bi bi-arrow-repeat"></i> Fetching data for ${input.length} users...`,
    bootstrapBgColor("info")
  );

  let fetchedDataArray = []; // Temporary array for raw fetched data
  try {
    // It's tricky to show progress with toasts, so we'll skip direct replacement of progress bar for now
    // Consider a more dedicated progress display if needed, separate from toasts.
    // alertsDiv.insertAdjacentHTML(
    //   "beforeend",
    //   /* html */ `
    //       <div class="progress mb-3">
    //         <div class="progress-bar" role="progressbar"></div>
    //       </div>`
    // );
    // const progressBarInner = alertsDiv.lastElementChild.firstElementChild;

    for (const { source, username } of input) {
      try {
        const rawData = await fetchUserData(username, token);
        const processedUser = { source };
        SELECTED_FIELDS.slice(1).forEach(field => { // slice(1) to skip 'source'
          let value = rawData[field] === null || rawData[field] === undefined ? "" : rawData[field];
          
          // Date Formatting for userDataStorage
          if (["created_at", "updated_at"].includes(field) && value) {
            try {
              value = new Date(value).toLocaleDateString('en-US', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
              });
            } catch (dateError) {
              console.error(`Error formatting date for ${field}: ${value}`, dateError);
              // Keep original value (or empty string) if formatting fails
              value = rawData[field] === null || rawData[field] === undefined ? "" : rawData[field]; // Revert to original if error
            }
          } 
          // Number Formatting for userDataStorage
          else if (["public_repos", "public_gists", "followers", "following"].includes(field) && typeof value === 'number') {
            value = value.toLocaleString('en-US');
          }
          // For other fields (html_url, blog, email, twitter_username, avatar_url, etc.),
          // store the raw value in userDataStorage.
          processedUser[field] = value;
        });
        fetchedDataArray.push(processedUser);
        
        const progressPercent = (fetchedDataArray.length / input.length) * 100;
        // progressBarInner.style.width = `${progressPercent}%`; // Progress bar display change needed
        // progressBarInner.textContent = `${fetchedDataArray.length}/${input.length}`;
      } catch (error) {
        showToast(error.message, bootstrapBgColor("danger"));
      }
    }
    userDataStorage = fetchedDataArray; // Store processed data

    if (userDataStorage.length > 0) {
      // Display results in table
      results.innerHTML = /* html */ `<table class="table table-striped">
            <thead><tr>${SELECTED_FIELDS.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
            <tbody>
              ${userDataStorage
                .map((user) => {
                  const cells = SELECTED_FIELDS.map((field) => {
                    // user[field] already has dates/numbers formatted as per userDataStorage modifications.
                    // For link/image fields, user[field] contains the raw URL or username.
                    const cellData = user[field] === null || user[field] === undefined ? "" : user[field];
                    let displayHtml = cellData;

                    if (field === "html_url" && cellData) {
                      displayHtml = `<a href="${cellData}" target="_blank">${cellData}</a>`;
                    } else if (field === "blog" && cellData) {
                      let blogUrl = cellData;
                      if (!blogUrl.startsWith('http://') && !blogUrl.startsWith('https://')) {
                        blogUrl = `http://${blogUrl}`;
                      }
                      displayHtml = `<a href="${blogUrl}" target="_blank">${cellData}</a>`;
                    } else if (field === "email" && cellData) {
                      displayHtml = `<a href="mailto:${cellData}">${cellData}</a>`;
                    } else if (field === "twitter_username" && cellData) {
                      displayHtml = `<a href="https://twitter.com/${cellData}" target="_blank">@${cellData}</a>`;
                    } else if (field === "avatar_url" && cellData) {
                      displayHtml = `<img src="${cellData}" alt="${user.name || 'Avatar'}" width="50" height="50" style="border-radius: 50%;">`;
                    }
                    return `<td>${displayHtml}</td>`;
                  }).join("");
                  return `<tr>${cells}</tr>`;
                })
                .join("")}
            </tbody>
          </table>`;
      
      // progressAlert.remove(); // Toast used instead
      showToast(
        "Data fetched successfully! Click 'Copy to Excel' or 'Download CSV'.",
        bootstrapBgColor("success")
      );
    } else {
      // progressAlert.remove(); // Toast used instead
      // Check if any other error toasts were shown. If not, show this warning.
      // This logic might need refinement if multiple toasts can appear and we only want one summary.
      // For now, we'll show it regardless if no data.
      showToast("No user data processed. Check inputs or token.", bootstrapBgColor("warning"));
    }
  } catch (error) {
    showToast(`Unexpected error: ${error.message}`, bootstrapBgColor("danger"));
    // if (progressAlert) progressAlert.remove(); // Toast used instead
  }
});

// Event listener for Download CSV button
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
downloadCsvBtn.addEventListener("click", () => {
  if (userDataStorage.length === 0) {
    showToast("No data to download.", bootstrapBgColor("warning"));
    return;
  }
  const csv = convertToCSV(userDataStorage);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "github_users.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV downloaded.", bootstrapBgColor("success"));
});

// Event listener for Copy to Excel button
const copyToExcelBtn = document.getElementById("copyToExcelBtn");
copyToExcelBtn.addEventListener("click", async () => {
  if (userDataStorage.length === 0) {
    showToast("No data to copy.", bootstrapBgColor("warning"));
    return;
  }
  try {
    const tsv = convertToTSV(userDataStorage);
    await copyToClipboard(tsv);
    showToast("Results copied to clipboard! You can paste into Excel.", bootstrapBgColor("success"));
  } catch (error) {
    showToast(`Error copying to clipboard: ${error.message}`, bootstrapBgColor("danger"));
  }
});

// Helper function to convert data to CSV format
function convertToCSV(data) {
  const headers = SELECTED_FIELDS;
  const rows = [
    headers.join(","), // CSV headers
    ...data.map((user) =>
      headers
        .map((header) => escapeCellCSV(user[header] === null || user[header] === undefined ? "" : user[header]))
        .join(",")
    ),
  ];
  return rows.join("\n");
}

// Adapted escapeCell for CSV: fields with comma, quote, or newline are quoted. Quotes are doubled.
function escapeCellCSV(value) {
  const stringValue = String(value); // Ensure value is a string
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
saveform("#urlForm");
