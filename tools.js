const { tools } = await fetch("tools.json").then((r) => r.json());

let currentSort = "default";
let sortedTools = [...tools];

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const toolCard = ({ icon, title, description, url, created }) => /* html */ `
  <div class="col-md-6 col-lg-4">
    <div class="card h-100">
      <a href="${url}" class="card-body text-decoration-none">
        <i class="bi ${icon} fs-2 text-primary mb-3"></i>
        <h5 class="card-title">${title}</h5>
        <p class="card-text">${description}</p>
        ${created ? `<small class="text-muted">Created: ${formatDate(created)}</small>` : ""}
      </a>
    </div>
  </div>
`;

const sortTools = (sortBy) => {
  currentSort = sortBy;

  if (sortBy === "alphabetical") {
    sortedTools = [...tools].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "date") {
    sortedTools = [...tools].sort((a, b) => {
      if (!a.created && !b.created) return 0;
      if (!a.created) return 1;
      if (!b.created) return -1;
      return new Date(b.created) - new Date(a.created);
    });
  } else {
    sortedTools = [...tools];
  }

  renderTools();
  updateSortButtons();
};

const updateSortButtons = () => {
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-outline-primary");
  });

  const activeBtn = document.querySelector(`[data-sort="${currentSort}"]`);
  if (activeBtn) {
    activeBtn.classList.remove("btn-outline-primary");
    activeBtn.classList.add("btn-primary");
  }
};

const renderTools = () => {
  document.querySelector("#tools-grid").innerHTML = /* html */ `
    <div class="row g-4">
      ${sortedTools.map(toolCard).join("")}
    </div>
  `;
};

document.querySelector("#tools-container").innerHTML = /* html */ `
  <div class="d-flex justify-content-center mb-4">
    <div class="btn-group" role="group">
      <button type="button" class="btn btn-primary sort-btn" data-sort="default">Default</button>
      <button type="button" class="btn btn-outline-primary sort-btn" data-sort="alphabetical">A-Z</button>
      <button type="button" class="btn btn-outline-primary sort-btn" data-sort="date">By Date</button>
    </div>
  </div>
  <div id="tools-grid"></div>
`;

document.querySelectorAll(".sort-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    sortTools(btn.dataset.sort);
  });
});

renderTools();
