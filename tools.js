const { tools } = await fetch("tools.json").then((r) => r.json());

const toolCard = ({ icon, title, description, url }) => /* html */ `
  <div class="col-md-6 col-lg-4">
    <div class="card h-100">
      <a href="${url}" class="card-body text-decoration-none">
        <i class="bi ${icon} fs-2 text-primary mb-3"></i>
        <h5 class="card-title">${title}</h5>
        <p class="card-text">${description}</p>
      </a>
    </div>
  </div>
`;

document.querySelector("#tools-container").innerHTML = /* html */ `
  <div class="row g-4">
    ${tools.map(toolCard).join("")}
  </div>
`;
