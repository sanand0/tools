const form = document.getElementById("urlForm");
const alertsDiv = document.getElementById("alerts");
const results = document.getElementById("results");

function showAlert(message, type = "info", autoClose = false) {
  alertsDiv.insertAdjacentHTML(
    "beforeend",
    /* html */ `
        <div class="alert alert-${type} alert-dismissible fade show">
          ${message} <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`
  );
  const alert = alertsDiv.lastElementChild;
  if (autoClose) setTimeout(() => alert.remove(), 3000);
  return alert;
}

const githubComRegex = /github\.com\/([a-zA-Z0-9-]+)/;
const githubIoRegex = /([a-zA-Z0-9-]+)\.github\.io/;
const extractUser = (text) => {
  const matchCom = text.match(githubComRegex);
  const matchIo = text.match(githubIoRegex);
  return matchCom ? matchCom[1] : matchIo ? matchIo[1] : null;
};

async function fetchUserData(username, token) {
  const headers = { "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/users/${username}`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch data for ${username}: ${response.statusText}`);
  return await response.json();
}

function escapeCell(value) {
  // If the cell contains a tab or newline, wrap it in quotes. Escape quotes with ""
  return /[\t\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function convertToTSV(data) {
  const headers = Object.keys(data[0]);
  const rows = [
    headers.join("\t"),
    ...data.map((user) => headers.map((header) => escapeCell(user[header] || "")).join("\t")),
  ];
  return rows.join("\n");
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertsDiv.innerHTML = "";
  results.innerHTML = "";

  const token = document.getElementById("token").value.trim();
  const text = document.getElementById("urls").value;

  const input = text
    .split("\n")
    .map((d) => ({ source: d.trim(), username: extractUser(d) }))
    .filter((d) => d.source && d.username);
  if (input.length === 0) return showAlert("No valid GitHub URLs found!", "warning");

  const progressAlert = showAlert(
    `<i class="bi bi-arrow-repeat"></i> Fetching data for ${input.length} users...`,
    "info"
  );

  const userData = [];
  try {
    alertsDiv.insertAdjacentHTML(
      "beforeend",
      /* html */ `
          <div class="progress mb-3">
            <div class="progress-bar" role="progressbar"></div>
          </div>`
    );
    const progressBarInner = alertsDiv.lastElementChild.firstElementChild;

    for (const { source, username } of input) {
      try {
        userData.push({ source, ...(await fetchUserData(username, token)) });
        const progressPercent = (userData.length / input.length) * 100;
        progressBarInner.style.width = `${progressPercent}%`;
        progressBarInner.textContent = `${userData.length}/${input.length}`;
      } catch (error) {
        showAlert(error.message, "danger");
      }
    }

    if (userData.length > 0) {
      const headers = Object.keys(userData[0]);
      results.innerHTML = /* html */ `<table class="table table-striped">
            <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
            <tbody>
              ${userData
                .map(
                  (user) =>
                    `<tr>${Object.entries(user)
                      .map(([key, value]) => `<td>${value || ""}</td>`)
                      .join("")}</tr>`
                )
                .join("")}
            </tbody>
          </table>`;
      const tsv = convertToTSV(userData);
      await copyToClipboard(tsv);

      progressAlert.remove();
      showAlert(
        '<i class="bi bi-clipboard-check"></i> Results copied to clipboard! You can paste into Excel.',
        "success",
        true
      );
    }
  } catch (error) {
    showAlert(`Unexpected error: ${error.message}`, "danger");
  }
});
