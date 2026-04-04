// @ts-check
// radar.js — Technology Radar
// D3 v7 · marked v17 · DOMPurify (global)

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@17/+esm";

// ─── Geometry constants ────────────────────────────────────────────────────
const VB = 1000; // viewBox dimension (square)
const CX = 500,
  CY = 500; // radar center
const MAX_R = 456; // outer radius (leaves ~44px margin for labels)
const GAP_PX = 20; // physical gap width in SVG units (10px on each side of H/V axis)
const MIN_RING_FRAC = 0.15; // minimum fraction of MAX_R per ring (fallback when no weights)

// Quadrant angle ranges in D3 arc convention (0=top, clockwise, radians)
// Layout: techniques=upper-left, tools=upper-right, platforms=lower-left, frameworks=lower-right
const QUAD_DEFS = [
  { key: "techniques", startAngle: (3 * Math.PI) / 2, endAngle: 2 * Math.PI },
  { key: "tools", startAngle: 0, endAngle: Math.PI / 2 },
  { key: "platforms", startAngle: Math.PI, endAngle: (3 * Math.PI) / 2 },
  { key: "frameworks", startAngle: Math.PI / 2, endAngle: Math.PI },
];

// Quadrant label anchor positions (corners of the viewBox per quadrant)
const QUAD_LABEL_ANCHORS = {
  techniques: { x: 28,  y: 40,  anchor: "start" },
  tools:      { x: 972, y: 40,  anchor: "end" },
  platforms:  { x: 28,  y: 978, anchor: "start" },
  frameworks: { x: 972, y: 978, anchor: "end" },
};

// Ring definitions (ordered innermost → outermost)
const RING_ORDER = ["adopt", "trial", "assess", "hold"];

// ViewBox targets for smooth quadrant zoom animation
const HALF = VB / 2; // 500
const Z_PAD = 26; // padding past center to include gap/label area
const ZOOM_VBS = {
  techniques: [0,             0,             HALF + Z_PAD, HALF + Z_PAD],
  tools:      [HALF - Z_PAD, 0,             HALF + Z_PAD, HALF + Z_PAD],
  platforms:  [0,             HALF - Z_PAD, HALF + Z_PAD, HALF + Z_PAD],
  frameworks: [HALF - Z_PAD, HALF - Z_PAD, HALF + Z_PAD, HALF + Z_PAD],
};
const FULL_VB = [0, 0, VB, VB];

// ─── Seeded PRNG — Mulberry32 ──────────────────────────────────────────────
// Returns a deterministic random function for a given integer seed.
// Used so each node always lands at the same position regardless of render order.
const mulberry32 = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ─── Schema helpers — support both string and object ring/quadrant defs ────
// Handles legacy { "adopt": "Adopt" } as well as new { "adopt": { label, weight, description } }
const getRingLabel    = (data, key) => { const r = data.rings[key];     return (typeof r === "object" && r) ? (r.label || key)  : (r || key); };
const getRingWeight   = (data, key) => { const r = data.rings[key];     return (typeof r === "object" && r) ? (r.weight ?? 1) : 1; };
const getQuadrantLabel = (data, key) => { const q = data.quadrants[key]; return (typeof q === "object" && q) ? (q.label || key)  : (q || key); };

// ─── App State ────────────────────────────────────────────────────────────
const state = {
  data: null, // loaded JSON
  search: "", // debounced search string
  filters: {}, // { tagKey: Set([value, ...]) }
  quadrant: null, // active quadrant key or null
  ring: null, // active ring key or null
  activeNode: null, // id of open detail panel node
  geo: null, // computed geometry (ring radii, etc.)
  positions: null, // Map(nodeId → {x, y, angle})
  tagPanelOpen: false, // whether tag filter panel is expanded
};

// ─── URL state ────────────────────────────────────────────────────────────
function readURL() {
  const p = new URLSearchParams(location.search);
  state.search = p.get("q") || "";
  state.quadrant = p.get("quadrant") || null;
  state.ring = p.get("ring") || null;
  state.activeNode = p.has("node") ? +p.get("node") : null;

  state.filters = {};
  const filterStr = p.get("filter") || "";
  if (filterStr) {
    for (const pair of filterStr.split(",")) {
      const colon = pair.indexOf(":");
      if (colon < 1) continue;
      const key = pair.slice(0, colon).trim();
      const val = pair.slice(colon + 1).trim();
      if (!state.filters[key]) state.filters[key] = new Set();
      state.filters[key].add(val);
    }
  }
}

function writeURL() {
  const p = new URLSearchParams();
  if (state.search) p.set("q", state.search);
  if (state.quadrant) p.set("quadrant", state.quadrant);
  if (state.ring) p.set("ring", state.ring);
  if (state.activeNode != null) p.set("node", state.activeNode);

  const filterParts = [];
  for (const [key, vals] of Object.entries(state.filters)) {
    for (const v of vals) filterParts.push(`${key}:${v}`);
  }
  if (filterParts.length) p.set("filter", filterParts.join(","));

  // Preserve ?data= so sharable URLs keep the custom dataset
  const dataParam = new URLSearchParams(location.search).get("data");
  if (dataParam) p.set("data", dataParam);

  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

// ─── Geometry computation ──────────────────────────────────────────────────
// Computes ring outer-radius boundaries. Uses explicit ring weights if provided
// in the data schema; otherwise falls back to node-count-based sizing.
function computeGeometry(data) {
  const hasWeights = RING_ORDER.some((r) => {
    const ring = data.rings[r];
    return typeof ring === "object" && ring !== null && ring.weight != null;
  });

  let fracs;
  if (hasWeights) {
    fracs = RING_ORDER.map((r) => Math.max(0.1, getRingWeight(data, r)));
  } else {
    const ringCounts = Object.fromEntries(RING_ORDER.map((r) => [r, 0]));
    for (const n of data.nodes) if (ringCounts[n.ring] !== undefined) ringCounts[n.ring]++;
    const total = Math.max(1, data.nodes.length);
    fracs = RING_ORDER.map((r) => Math.max(MIN_RING_FRAC, ringCounts[r] / total));
  }

  const fracSum = fracs.reduce((a, b) => a + b, 0);
  fracs = fracs.map((f) => f / fracSum); // normalize to sum=1

  // Build cumulative outer radii
  const ringRadii = {}; // key → { inner, outer }
  let cumR = 0;
  RING_ORDER.forEach((r, i) => {
    const inner = cumR;
    cumR += fracs[i] * MAX_R;
    ringRadii[r] = { inner, outer: cumR };
  });

  // Dynamic node radius: scale down for dense datasets
  const maxZoneDensity = Math.max(
    ...RING_ORDER.flatMap((r) =>
      QUAD_DEFS.map((q) => data.nodes.filter((n) => n.ring === r && n.quadrant === q.key).length),
    ),
  );
  // Radius: 12px for sparse, 5px minimum; scale by 1/sqrt(density)
  const baseNodeR = Math.max(5, Math.min(12, Math.round(12 * Math.sqrt(6 / Math.max(1, maxZoneDensity)))));
  const nodeScale = data.ui?.node_scale ?? 1;
  const nodeR = Math.max(4, Math.round(baseNodeR * nodeScale));
  const nodeFillOpacity = data.ui?.node_fill_opacity ?? 1;
  // node_font_scale defaults to node_scale (or 1 if neither set)
  const nodeFontScale = data.ui?.node_font_scale ?? nodeScale;

  return { ringRadii, nodeR, nodeFillOpacity, nodeFontScale };
}

// ─── Node placement (seeded grid + jitter) ────────────────────────────────
// For each ring+quadrant zone, builds a grid of positions sized to node radius,
// shuffles with a seeded PRNG, assigns nodes. Small jitter is added per node.
// Angular buffer is computed per radial layer from GAP_PX so nodes stay clear
// of the physical cross-gap lines on the H and V axes.
function computeNodePositions(data, geo) {
  const { ringRadii, nodeR } = geo;
  const spacing = nodeR * 2 + 3; // center-to-center minimum spacing

  // Group nodes by zone
  const zones = new Map();
  for (const n of data.nodes) {
    const key = `${n.quadrant}::${n.ring}`;
    if (!zones.has(key)) zones.set(key, []);
    zones.get(key).push(n);
  }

  const positions = new Map(); // nodeId → { x, y, angle, r }

  for (const [key, nodes] of zones) {
    const [qKey, rKey] = key.split("::");
    const qDef = QUAD_DEFS.find((q) => q.key === qKey);
    const rBand = ringRadii[rKey];
    if (!qDef || !rBand) continue;

    const rMin = rBand.inner + nodeR + 3;
    const rMax = rBand.outer - nodeR - 3;

    if (rMin >= rMax) continue; // degenerate ring

    // Build concentric-ring grid of candidate positions.
    // At each radius r, the physical gap of GAP_PX/2 on each axis side corresponds
    // to an angular buffer of asin(GAP_PX/2 / r). This keeps nodes off the gap lines.
    const grid = [];
    for (let r = rMin; r <= rMax; r += spacing) {
      const halfGapAngle = Math.asin(Math.min(0.99, (GAP_PX / 2) / r));
      const aStart = qDef.startAngle + halfGapAngle;
      const aEnd = qDef.endAngle - halfGapAngle;
      if (aStart >= aEnd) continue;

      const arcLen = r * (aEnd - aStart);
      const nSlots = Math.max(1, Math.floor(arcLen / spacing));
      const aStep = (aEnd - aStart) / nSlots;
      for (let j = 0; j < nSlots; j++) {
        grid.push({ r, a: aStart + aStep * (j + 0.5) });
      }
    }

    // Zone-level shuffle using a hash of the key as seed
    let zSeed = 0;
    for (let i = 0; i < key.length; i++) zSeed = (Math.imul(31, zSeed) + key.charCodeAt(i)) >>> 0;
    const zRng = mulberry32(zSeed);
    for (let i = grid.length - 1; i > 0; i--) {
      const j = Math.floor(zRng() * (i + 1));
      [grid[i], grid[j]] = [grid[j], grid[i]];
    }

    // Sort nodes by id so keyboard nav is deterministic
    const sorted = [...nodes].sort((a, b) => a.id - b.id);

    sorted.forEach((node, i) => {
      const slot = grid[i % grid.length];
      // Per-node jitter using node.id as seed (reproducible given the same id)
      const rng = mulberry32(node.id * 2654435761);
      const jr = (rng() - 0.5) * spacing * 0.35; // radial jitter
      const r = Math.max(rMin, Math.min(rMax, slot.r + jr));
      const halfGapAngle = Math.asin(Math.min(0.99, (GAP_PX / 2) / r));
      const aS = qDef.startAngle + halfGapAngle + 0.002;
      const aE = qDef.endAngle - halfGapAngle - 0.002;
      const ja = (rng() - 0.5) * ((spacing * 0.35) / r); // angular jitter
      const a = Math.max(aS, Math.min(aE, slot.a + ja));

      // D3 convention: x = cx + r*sin(a), y = cy - r*cos(a)
      positions.set(node.id, {
        x: CX + r * Math.sin(a),
        y: CY - r * Math.cos(a),
        angle: a,
        r,
      });
    });
  }

  return positions;
}

// ─── Helper: snake_case → "Human Label" ───────────────────────────────────
const snakeToLabel = (key) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Helper: format YYYY-MM as "April 2022" ───────────────────────────────
function formatMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const date = new Date(+y, +m - 1);
  return date.toLocaleString("en", { month: "long", year: "numeric" });
}

// ─── Visibility filter ────────────────────────────────────────────────────
function isVisible(node) {
  if (state.quadrant && node.quadrant !== state.quadrant) return false;
  if (state.ring && node.ring !== state.ring) return false;

  // Tag filters: across groups = AND, within group = OR
  for (const [key, vals] of Object.entries(state.filters)) {
    if (!vals.size) continue;
    const nodeVal = node.tags?.[key];
    if (nodeVal == null) return false;
    const nodeVals = Array.isArray(nodeVal) ? nodeVal.map(String) : [String(nodeVal)];
    if (!nodeVals.some((v) => vals.has(v))) return false;
  }

  if (state.search) {
    const q = state.search.toLowerCase();
    const haystack = [
      node.name,
      node.description,
      node.quadrant,
      node.ring,
      ...Object.values(node.tags || {}).flatMap((v) => (Array.isArray(v) ? v : [v])),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

// ─── Apply filters → update SVG node classes ──────────────────────────────
function applyFilters() {
  const container = d3.select(".nodes-container");
  const anyFilter =
    state.search || state.quadrant || state.ring || Object.values(state.filters).some((s) => s.size > 0);

  container.classed("has-filter", anyFilter);

  if (state.data) {
    container.selectAll(".node-group").each(function (d) {
      d3.select(this).classed("filtered-out", !isVisible(d));
    });
  }

  // Dim quadrant labels that are not the active quadrant
  d3.selectAll(".quadrant-label-group").each(function () {
    const key = [...this.classList].find((c) => c.startsWith("quad-group-"))?.replace("quad-group-", "");
    d3.select(this).classed("quad-dimmed", !!(state.quadrant && key !== state.quadrant));
  });

  zoomToQuadrant(state.quadrant);
  writeURL();
  // Update keyboard nav counter if panel is open
  if (state.activeNode != null) updatePanelNav();
}

// ─── Quadrant zoom — smooth SVG viewBox animation ─────────────────────────
// When a quadrant is selected, transitions the SVG viewBox to fill that zone.
// Interpolates numerically so the animation is smooth at any frame rate.
function zoomToQuadrant(quadKey) {
  const svg = d3.select(".radar-svg");
  if (!svg.node()) return;
  const target = quadKey ? ZOOM_VBS[quadKey] : FULL_VB;
  const currentAttr = svg.attr("viewBox") || FULL_VB.join(" ");
  const current = currentAttr.trim().split(/\s+/).map(Number);
  if (current.join(" ") === target.join(" ")) return;
  svg
    .transition("zoom")
    .duration(440)
    .ease(d3.easeCubicInOut)
    .attrTween("viewBox", () => {
      const interp = d3.interpolate(current, target);
      return (t) => interp(t).join(" ");
    });
}

// ─── Filtered nodes (for keyboard navigation) ─────────────────────────────
function visibleNodes() {
  if (!state.data) return [];
  return state.data.nodes.filter(isVisible).sort((a, b) => a.id - b.id);
}

// ══════════════════════════════════════════════════════════════════════════════
// Part 2: SVG + Rings + Quadrant labels + Nodes
// ══════════════════════════════════════════════════════════════════════════════

function renderRadar(data, geo) {
  const container = d3.select("#radar-container");
  container.selectAll("*").remove();

  const svg = container
    .append("svg")
    .attr("class", "radar-svg")
    .attr("viewBox", `0 0 ${VB} ${VB}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("role", "img")
    .attr("aria-label", data.title || "Technology Radar");

  const { ringRadii, nodeR } = geo;

  // ── Background ring arcs — full 90° (no gap trimming at arc level) ──────
  const arcGen = d3.arc();

  const ringsGroup = svg.append("g").attr("class", "rings-group");

  RING_ORDER.forEach((rKey, ri) => {
    const { inner, outer } = ringRadii[rKey];
    QUAD_DEFS.forEach((q) => {
      ringsGroup
        .append("path")
        .attr("class", `ring-arc ring-arc-${ri + 1}`)
        .attr("data-quadrant", q.key)
        .attr("d", arcGen({ innerRadius: inner, outerRadius: outer, startAngle: q.startAngle, endAngle: q.endAngle }))
        .attr("transform", `translate(${CX},${CY})`)
        .style("cursor", "pointer")
        .on("click", () => {
          state.quadrant = state.quadrant === q.key ? null : q.key;
          applyFilters();
          renderFilterBar(data);
        });
    });
  });

  // ── Ring boundary arcs (subtle lines between rings) ──────────────────────
  const boundaryGroup = svg.append("g").attr("class", "boundaries-group");
  RING_ORDER.forEach((rKey) => {
    const { outer } = ringRadii[rKey];
    if (outer >= MAX_R) return; // skip outermost
    QUAD_DEFS.forEach((q) => {
      boundaryGroup
        .append("path")
        .attr("fill", "none")
        .attr("stroke", "var(--border)")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.7)
        .attr("d", arcGen({ innerRadius: outer, outerRadius: outer, startAngle: q.startAngle, endAngle: q.endAngle }))
        .attr("transform", `translate(${CX},${CY})`);
    });
  });

  // ── Physical cross-gap (background-colored rectangles on the H/V axes) ──
  // These cover the arc seams and create clean visual separation between quadrants.
  const half = GAP_PX / 2;
  const gapGroup = svg.append("g").attr("class", "gap-group").attr("pointer-events", "none");
  // Vertical bar (separates left quadrants from right quadrants)
  gapGroup.append("rect").attr("class", "gap-bar gap-vertical")
    .attr("x", CX - half).attr("y", CY - MAX_R - 4)
    .attr("width", GAP_PX).attr("height", (MAX_R + 4) * 2);
  // Horizontal bar (separates top quadrants from bottom quadrants)
  gapGroup.append("rect").attr("class", "gap-bar gap-horizontal")
    .attr("x", CX - MAX_R - 4).attr("y", CY - half)
    .attr("width", (MAX_R + 4) * 2).attr("height", GAP_PX);

  // ── Ring labels — placed along the right horizontal gap axis ─────────────
  // Positioned at (CX + midR, CY) so they sit in the horizontal gap strip.
  const labelsGroup = svg.append("g").attr("class", "ring-labels-group");
  RING_ORDER.forEach((rKey) => {
    const { inner, outer } = ringRadii[rKey];
    const midR = (inner + outer) / 2;
    labelsGroup
      .append("text")
      .attr("class", "ring-label")
      .attr("x", CX + midR)
      .attr("y", CY)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text(getRingLabel(data, rKey));
  });

  // ── Quadrant labels — bold, uppercase, at the outer corners ──────────────
  const quadLabelGroup = svg.append("g").attr("class", "quad-labels-group");

  QUAD_DEFS.forEach((q) => {
    const { x, y, anchor } = QUAD_LABEL_ANCHORS[q.key];
    const label = getQuadrantLabel(data, q.key);

    const g = quadLabelGroup
      .append("g")
      .attr("class", `quadrant-label-group quad-group-${q.key}`)
      .on("click", () => {
        state.quadrant = state.quadrant === q.key ? null : q.key;
        applyFilters();
        renderFilterBar(data);
      });

    g.append("text")
      .attr("class", "quadrant-label")
      .attr("x", x)
      .attr("y", y)
      .attr("text-anchor", anchor)
      .attr("fill", `var(--q-${q.key})`)
      .text(label);
  });

  // ── Node container (separate group so filter class targets only nodes) ──
  svg.append("g").attr("class", "nodes-container");

  geo.nodeR = nodeR;
}

// ── Change indicator: arc + arrowhead for "in" / "out" ─────────────────────
// Arc spans 90° centered on the radial-outward direction from radar center.
// "in" arrowhead points toward center; "out" points away.
function changeIndicatorPaths(nodeX, nodeY, angle, nodeR) {
  const arcR = nodeR + 5;
  const s = Math.SQRT1_2; // 1/√2

  // Outward radial unit vector in SVG coords (D3 convention)
  const rx = Math.sin(angle),
    ry = -Math.cos(angle);
  // CCW-perpendicular unit vector
  const px = -ry,
    py = rx; // = (cos α, sin α)

  // Arc endpoints relative to node center (±45° from outward direction)
  const x0 = arcR * (rx * s - px * s),
    y0 = arcR * (ry * s - py * s); // α-45°
  const x1 = arcR * (rx * s + px * s),
    y1 = arcR * (ry * s + py * s); // α+45°

  // Arc in absolute SVG coords
  const ax0 = nodeX + x0,
    ay0 = nodeY + y0;
  const ax1 = nodeX + x1,
    ay1 = nodeY + y1;
  // Sweep=1 (CW in SVG) gives the 90° short arc through the outward midpoint
  const arcPath = `M ${ax0.toFixed(2)} ${ay0.toFixed(2)} A ${arcR} ${arcR} 0 0 1 ${ax1.toFixed(2)} ${ay1.toFixed(2)}`;

  // Arrowhead at the midpoint of the arc (= the point farthest from radar center)
  // in node-local coords: (arcR*rx, arcR*ry)
  const ah = 5,
    aw = 3.5;
  const midX = nodeX + arcR * rx,
    midY = nodeY + arcR * ry;
  const inArrow = arrowTri(midX, midY, -rx, -ry, ah, aw); // tip points toward center
  const outArrow = arrowTri(midX, midY, rx, ry, ah, aw); // tip points away from center

  return { arcPath, inArrow, outArrow };
}

function arrowTri(tx, ty, dx, dy, height, width) {
  // Triangle: tip at (tx,ty), pointing in direction (dx,dy)
  const len = Math.hypot(dx, dy);
  const ux = dx / len,
    uy = dy / len;
  const nx = -uy,
    ny = ux; // perpendicular
  const bx = tx - ux * height,
    by = ty - uy * height;
  return (
    `M ${tx.toFixed(2)} ${ty.toFixed(2)} ` +
    `L ${(bx + nx * width).toFixed(2)} ${(by + ny * width).toFixed(2)} ` +
    `L ${(bx - nx * width).toFixed(2)} ${(by - ny * width).toFixed(2)} Z`
  );
}

// ── Render all nodes ─────────────────────────────────────────────────────────
function renderNodes(data, geo, positions) {
  const { nodeR, nodeFillOpacity, nodeFontScale } = geo;
  const container = d3.select(".nodes-container");
  container.selectAll("*").remove();

  // Set CSS custom properties for font scale on the container so CSS rules pick them up
  container
    .style("--node-font-size", `${(9 * nodeFontScale).toFixed(2)}px`)
    .style("--node-font-size-3d", `${(6.5 * nodeFontScale).toFixed(2)}px`);

  const groups = container
    .selectAll(".node-group")
    .data(data.nodes, (d) => d.id)
    .join("g")
    .attr("class", (d) => `node-group node-q-${d.quadrant}`)
    .attr("role", "button")
    .attr("tabindex", "0")
    .attr("aria-label", (d) => `${d.name}, ${getRingLabel(data, d.ring)}`)
    .attr("transform", (d) => {
      const p = positions.get(d.id);
      return p ? `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})` : "translate(0,0)";
    });

  // Invisible larger hit area for easier click/hover on small nodes
  groups
    .append("circle")
    .attr("class", "node-hitarea")
    .attr("r", Math.max(nodeR + 4, 14))
    .attr("fill", "transparent")
    .attr("stroke", "none");

  // ── "new" indicator: outer dashed ring ──────────────────────────────────
  groups
    .filter((d) => d.change === "new")
    .append("circle")
    .attr("class", (d) => `node-new-ring node-q-${d.quadrant}`)
    .attr("r", nodeR + 4)
    .attr("fill", "none");

  // ── "in" / "out" arc arrowhead ──────────────────────────────────────────
  groups
    .filter((d) => d.change === "in" || d.change === "out")
    .each(function (d) {
      const pos = positions.get(d.id);
      if (!pos) return;
      const { arcPath, inArrow, outArrow } = changeIndicatorPaths(0, 0, pos.angle, nodeR);
      const g = d3.select(this);
      g.append("path").attr("class", `node-change-arc node-q-${d.quadrant}`).attr("d", arcPath);
      g.append("path")
        .attr("class", `node-change-arrow node-q-${d.quadrant}`)
        .attr("d", d.change === "in" ? inArrow : outArrow);
    });

  // ── Filled circle ────────────────────────────────────────────────────────
  groups
    .append("circle")
    .attr("class", (d) => `node-circle node-q-${d.quadrant}`)
    .attr("r", nodeR)
    .attr("fill-opacity", nodeFillOpacity);

  // ── Number label ─────────────────────────────────────────────────────────
  groups
    .append("text")
    .attr("class", (d) => `node-label${d.id >= 100 ? " node-label-3d" : ""}`)
    .attr("dy", "0.05em")
    .text((d) => (d.id <= 999 ? d.id : "·"));

  // ── Hover interactions ────────────────────────────────────────────────────
  groups
    .on("mouseenter", function (event, d) {
      d3.select(this).classed("hovered", true);
      d3.select(".nodes-container").classed("has-hover", true);
      showTooltip(event, d.name);
    })
    .on("mousemove", (event, d) => showTooltip(event, d.name))
    .on("mouseleave", function () {
      d3.select(this).classed("hovered", false);
      d3.select(".nodes-container").classed("has-hover", false);
      hideTooltip();
    })
    .on("click", (_, d) => openPanel(d.id))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPanel(d.id);
      }
    });

  applyFilters();
}

// ─── Tooltip ──────────────────────────────────────────────────────────────
const tooltip = d3.select("#tooltip");

function showTooltip(event, name) {
  tooltip.text(name).classed("visible", true);
  positionTooltip(event);
}

function positionTooltip(event) {
  const tip = tooltip.node();
  const { innerWidth, innerHeight } = window;
  const tw = tip.offsetWidth,
    th = tip.offsetHeight;
  let tx = event.clientX + 12,
    ty = event.clientY - 28;
  if (tx + tw > innerWidth - 8) tx = event.clientX - tw - 12;
  if (ty < 8) ty = event.clientY + 16;
  if (ty + th > innerHeight - 8) ty = innerHeight - th - 8;
  tooltip.style("left", `${tx}px`).style("top", `${ty}px`);
}

function hideTooltip() {
  tooltip.classed("visible", false);
}

// ══════════════════════════════════════════════════════════════════════════════
// Part 3: Header + Filter Bar + Legend
// ══════════════════════════════════════════════════════════════════════════════

// ─── Sidebar — title, how-to, quadrant/ring descriptions, legend ──────────
function renderSidebar(data) {
  // Logo
  const logoWrap = document.getElementById("sidebar-logo");
  if (logoWrap && data.logo) {
    const img = document.createElement("img");
    img.src = data.logo;
    img.alt = "";
    img.loading = "lazy";
    logoWrap.appendChild(img);
  }

  // Title + subtitle
  const titleEl = document.getElementById("sidebar-title-text");
  if (titleEl) {
    titleEl.innerHTML = `
      <h1 class="sidebar-title">${escHtml(data.title || "Technology Radar")}</h1>
      ${data.subtitle ? `<p class="sidebar-subtitle">${escHtml(data.subtitle)}</p>` : ""}
    `;
  }

  // Info section
  const infoEl = document.getElementById("sidebar-info");
  if (!infoEl) return;
  infoEl.innerHTML = "";

  // How to read (top-level description, parsed as markdown)
  if (data.description) {
    const html = window.DOMPurify.sanitize(marked.parse(data.description));
    infoEl.insertAdjacentHTML("beforeend", `
      <div class="sidebar-section">
        <p class="sidebar-section-title">How to read this radar</p>
        <div class="sidebar-how-to">${html}</div>
      </div>`);
  }

  // Quadrant descriptions
  const quadDescs = QUAD_DEFS.map((q) => {
    const qData = data.quadrants[q.key];
    return { key: q.key, label: getQuadrantLabel(data, q.key), desc: (typeof qData === "object" && qData?.description) || null };
  }).filter((q) => q.desc);

  if (quadDescs.length) {
    let dl = `<div class="sidebar-section"><p class="sidebar-section-title">Quadrants</p><dl class="sidebar-dl">`;
    for (const q of quadDescs) {
      dl += `<dt class="sidebar-dt sidebar-q-${q.key}">${escHtml(q.label)}</dt><dd class="sidebar-dd">${escHtml(q.desc)}</dd>`;
    }
    dl += `</dl></div>`;
    infoEl.insertAdjacentHTML("beforeend", dl);
  }

  // Ring descriptions
  const ringDescs = RING_ORDER.map((r) => {
    const rData = data.rings[r];
    return { key: r, label: getRingLabel(data, r), desc: (typeof rData === "object" && rData?.description) || null };
  }).filter((r) => r.desc);

  if (ringDescs.length) {
    let dl = `<div class="sidebar-section"><p class="sidebar-section-title">Rings</p><dl class="sidebar-dl">`;
    for (const r of ringDescs) {
      dl += `<dt class="sidebar-dt">${escHtml(r.label)}</dt><dd class="sidebar-dd">${escHtml(r.desc)}</dd>`;
    }
    dl += `</dl></div>`;
    infoEl.insertAdjacentHTML("beforeend", dl);
  }
}

function renderLegend() {
  const legend = d3.select("#sidebar-legend");
  legend.selectAll("*").remove();

  legend.append("p").attr("class", "sidebar-legend-title").text("Legend");

  const row = legend.append("div").attr("class", "legend-items-row");

  const items = [
    { label: "New", change: "new" },
    { label: "Moved in/out", change: "in" },
    { label: "No change", change: "" },
  ];

  const r = 9;
  items.forEach(({ label, change }) => {
    const item = row.append("div").attr("class", "legend-item");
    const svg = item
      .append("svg")
      .attr("class", "legend-icon")
      .attr("viewBox", "-16 -16 32 32")
      .attr("width", 22)
      .attr("height", 22);

    if (change === "new") {
      svg.append("circle").attr("r", r).attr("class", "node-q-techniques node-circle");
      svg.append("circle").attr("r", r + 4).attr("fill", "none").attr("class", "node-new-ring node-q-techniques");
    } else if (change === "in") {
      svg.append("circle").attr("r", r).attr("class", "node-q-techniques node-circle");
      const { arcPath, inArrow } = changeIndicatorPaths(0, 0, 0, r);
      svg.append("path").attr("d", arcPath).attr("class", "node-change-arc node-q-techniques");
      svg.append("path").attr("d", inArrow).attr("class", "node-change-arrow node-q-techniques");
    } else {
      svg.append("circle").attr("r", r).attr("class", "node-q-techniques node-circle");
    }

    item.append("span").text(label);
  });
}

// ─── Filter Bar ────────────────────────────────────────────────────────────
function renderFilterBar(data) {
  const bar = d3.select("#filter-bar");
  bar.selectAll("*").remove();

  // ── Search ──────────────────────────────────────────────────────────────
  const searchWrap = bar.append("div").attr("class", "filter-search-wrap");
  searchWrap.append("i").attr("class", "bi bi-search");
  const searchInput = searchWrap
    .append("input")
    .attr("type", "search")
    .attr("class", "filter-search")
    .attr("placeholder", "Search…")
    .attr("value", state.search)
    .attr("aria-label", "Search technologies");

  let searchTimer;
  searchInput.on("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = this.value.trim().toLowerCase();
      applyFilters();
    }, 150);
  });

  bar.append("div").attr("class", "filter-sep");

  // ── Quadrant filters ────────────────────────────────────────────────────
  const quadGroup = bar.append("div").attr("class", "filter-group");
  quadGroup.append("span").attr("class", "filter-group-label").text("Quadrant");

  QUAD_DEFS.forEach((q) => {
    quadGroup
      .append("button")
      .attr("class", () => `chip${state.quadrant === q.key ? " active" : ""}`)
      .attr("data-quadrant", q.key)
      .attr("aria-pressed", state.quadrant === q.key)
      .text(getQuadrantLabel(data, q.key))
      .on("click", () => {
        state.quadrant = state.quadrant === q.key ? null : q.key;
        applyFilters();
        renderFilterBar(data);
      });
  });

  bar.append("div").attr("class", "filter-sep");

  // ── Ring filters ─────────────────────────────────────────────────────────
  const ringGroup = bar.append("div").attr("class", "filter-group");
  ringGroup.append("span").attr("class", "filter-group-label").text("Ring");

  RING_ORDER.forEach((rKey) => {
    ringGroup
      .append("button")
      .attr("class", () => `chip${state.ring === rKey ? " active" : ""}`)
      .attr("aria-pressed", state.ring === rKey)
      .text(getRingLabel(data, rKey))
      .on("click", () => {
        state.ring = state.ring === rKey ? null : rKey;
        applyFilters();
        renderFilterBar(data);
      });
  });

  // ── Active filter chips for quadrant/ring + clear-all ───────────────────
  const hasActiveFilters = state.quadrant || state.ring || Object.values(state.filters).some((s) => s.size > 0);
  if (state.quadrant || state.ring) {
    bar.append("div").attr("class", "filter-sep");
    const activeGroup = bar.append("div").attr("class", "filter-group");
    if (hasActiveFilters) {
      activeGroup
        .append("button")
        .attr("class", "chip-clear-all")
        .text("Clear all")
        .on("click", () => {
          state.filters = {};
          state.quadrant = null;
          state.ring = null;
          state.search = "";
          applyFilters();
          renderFilterBar(data);
        });
    }
  }

  // ── Tag filters — Bootstrap multi-select dropdowns, one per tag key ─────
  // Keys where >90% of distinct values are singletons are skipped (URLs, IDs, etc.)
  const allNodes = data.nodes;
  const tagKeys = [...new Set(allNodes.flatMap((n) => Object.keys(n.tags || {})))].sort().filter((key) => {
    const valueCounts = new Map();
    for (const n of allNodes) {
      const v = n.tags?.[key];
      if (v == null) continue;
      const vals = Array.isArray(v) ? v.map(String) : [String(v)];
      for (const val of vals) {
        if (val && val !== "false") valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
      }
    }
    if (!valueCounts.size) return false;
    const singletonCount = [...valueCounts.values()].filter((c) => c === 1).length;
    return singletonCount / valueCounts.size <= 0.9;
  });

  if (tagKeys.length) {
    bar.append("div").attr("class", "filter-sep");
    const tagDropdownsWrap = bar.append("div").attr("class", "tag-dropdowns");

    // "Clear filters" button — only shown when tag filters are active
    const hasTagFilters = Object.values(state.filters).some((s) => s.size > 0);
    if (hasTagFilters) {
      tagDropdownsWrap
        .append("button")
        .attr("class", "chip-clear-all")
        .text("Clear filters")
        .on("click", () => {
          state.filters = {};
          applyFilters();
          renderFilterBar(data);
        });
    }

    tagKeys.forEach((key) => {
      const vals = [
        ...new Set(
          allNodes
            .flatMap((n) => {
              const v = n.tags?.[key];
              if (v == null) return [];
              return Array.isArray(v) ? v.map(String) : [String(v)];
            })
            .filter((v) => v && v !== "false"),
        ),
      ]
        .sort()
        .slice(0, 20);

      if (!vals.length) return;

      const activeSet = state.filters[key] ? new Set(state.filters[key]) : new Set();
      const hasActive = activeSet.size > 0;

      // Bootstrap dropdown wrapper
      const dropDiv = tagDropdownsWrap.append("div").attr("class", "dropdown");

      const toggleBtn = dropDiv
        .append("button")
        .attr("class", `tag-filter-btn${hasActive ? " has-active" : ""}`)
        .attr("type", "button")
        .attr("data-bs-toggle", "dropdown")
        .attr("data-bs-auto-close", "outside")
        .attr("aria-expanded", "false")
        .text(snakeToLabel(key) + (hasActive ? ` · ${activeSet.size}` : ""));

      const menu = dropDiv
        .append("div")
        .attr("class", "dropdown-menu tag-dropdown-menu");

      vals.forEach((v) => {
        const isActive = activeSet.has(v);
        const labelEl = menu
          .append("label")
          .attr("class", `dropdown-item d-flex align-items-center${isActive ? " active" : ""}`);

        labelEl
          .append("input")
          .attr("type", "checkbox")
          .attr("class", "form-check-input")
          .property("checked", isActive)
          .on("change", function (e) {
            if (!state.filters[key]) state.filters[key] = new Set();
            if (this.checked) state.filters[key].add(v);
            else {
              state.filters[key].delete(v);
              if (!state.filters[key].size) delete state.filters[key];
            }
            applyFilters();
            // Update this item's visual state without rebuilding the bar
            labelEl.classed("active", !!state.filters[key]?.has(v));
            const cnt = state.filters[key]?.size || 0;
            toggleBtn.classed("has-active", cnt > 0);
            toggleBtn.text(snakeToLabel(key) + (cnt ? ` · ${cnt}` : ""));
          });

        labelEl.append("span").text(v);
      });

      // Bootstrap auto-init via data-bs-toggle; no programmatic init needed
    });
  }
}
// Part 4: Detail Panel + Keyboard Navigation
// ══════════════════════════════════════════════════════════════════════════════

function openPanel(nodeId) {
  const panel = document.getElementById("detail-panel");
  const alreadyOpen = panel.classList.contains("open");

  state.activeNode = nodeId;
  writeURL();

  if (alreadyOpen) {
    // Panel already visible — just swap content, no transition needed
    renderPanelContent(nodeId);
    return;
  }

  panel.hidden = false;
  const scrim = document.getElementById("panel-scrim");
  scrim.classList.add("visible");
  // Defer so hidden→visible transition fires
  requestAnimationFrame(() => {
    panel.classList.add("open");
    renderPanelContent(nodeId);
    document.getElementById("panel-content").focus();
  });

  document.addEventListener("keydown", handlePanelKey);
}

function closePanel() {
  state.activeNode = null;
  writeURL();

  const panel = document.getElementById("detail-panel");
  const scrim = document.getElementById("panel-scrim");

  panel.classList.remove("open");
  scrim.classList.remove("visible");
  setTimeout(() => {
    panel.hidden = true;
  }, 310);

  // Clear node highlight so all nodes return to full opacity immediately
  d3.selectAll(".node-group").classed("hovered", false);
  d3.select(".nodes-container").classed("has-hover", false);

  document.removeEventListener("keydown", handlePanelKey);
}

function handlePanelKey(e) {
  // Don't intercept when user is typing in an input
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "Escape") {
    e.preventDefault();
    closePanel();
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    panelNav(-1);
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    panelNav(+1);
    return;
  }
}

function panelNav(delta) {
  const nodes = visibleNodes();
  if (!nodes.length) return;
  const idx = nodes.findIndex((n) => n.id === state.activeNode);
  const next = nodes[(idx + delta + nodes.length) % nodes.length];
  if (next) {
    crossfadePanelContent(() => {
      state.activeNode = next.id;
      writeURL();
      renderPanelContent(next.id);
    });
  }
}

function crossfadePanelContent(fn) {
  const el = document.getElementById("panel-content");
  el.classList.add("fade-out");
  setTimeout(() => {
    fn();
    el.classList.remove("fade-out");
    el.classList.add("fade-in");
    setTimeout(() => el.classList.remove("fade-in"), 80);
  }, 80);
}

function updatePanelNav() {
  const nodes = visibleNodes();
  const idx = nodes.findIndex((n) => n.id === state.activeNode);
  const nav = document.getElementById("panel-nav");
  if (!nav) return;

  const prevBtn = nav.querySelector(".panel-nav-btn[data-dir='-1']");
  const nextBtn = nav.querySelector(".panel-nav-btn[data-dir='1']");
  const counter = nav.querySelector(".panel-nav-counter");

  if (prevBtn) prevBtn.disabled = nodes.length <= 1;
  if (nextBtn) nextBtn.disabled = nodes.length <= 1;
  if (counter) counter.textContent = `${idx + 1} of ${nodes.length} visible`;
}

function renderPanelContent(nodeId) {
  const node = state.data?.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const data = state.data;
  const content = document.getElementById("panel-content");
  const nav = document.getElementById("panel-nav");

  // ── Nav bar ──────────────────────────────────────────────────────────────
  nav.innerHTML = "";
  const prevBtn = Object.assign(document.createElement("button"), {
    className: "panel-nav-btn",
    innerHTML: "&#8592;",
    title: "Previous (←)",
  });
  prevBtn.dataset.dir = "-1";
  prevBtn.addEventListener("click", () => panelNav(-1));

  const counter = Object.assign(document.createElement("span"), { className: "panel-nav-counter" });

  const nextBtn = Object.assign(document.createElement("button"), {
    className: "panel-nav-btn",
    innerHTML: "&#8594;",
    title: "Next (→)",
  });
  nextBtn.dataset.dir = "1";
  nextBtn.addEventListener("click", () => panelNav(+1));

  nav.append(prevBtn, counter, nextBtn);
  updatePanelNav();

  // ── Content ──────────────────────────────────────────────────────────────
  const ringLabel = getRingLabel(data, node.ring);
  const quadLabel = getQuadrantLabel(data, node.quadrant);

  const descHTML = node.description ? window.DOMPurify.sanitize(marked.parse(node.description)) : "";

  // Tags
  const tagKeys = Object.keys(node.tags || {});
  const tagsHTML = tagKeys.length
    ? `
    <div class="panel-tags">
      <p class="panel-section-title">Details</p>
      <dl class="panel-tag-list">
        ${tagKeys
          .map((k) => {
            const v = node.tags[k];
            if (v == null || v === false) return "";
            const label = snakeToLabel(k);
            let valueHTML;
            if (Array.isArray(v)) {
              // Each chip is clickable to filter by that tag value
              valueHTML = `<div class="panel-tag-chips">${v
                .map(
                  (i) =>
                    `<span class="panel-tag-chip panel-tag-filter" role="button" tabindex="0" data-tag-key="${escHtml(k)}" data-tag-val="${escHtml(String(i))}">${escHtml(String(i))}</span>`,
                )
                .join("")}</div>`;
            } else if (typeof v === "string" && /^https?:\/\//.test(v)) {
              valueHTML = `<a href="${escHtml(v)}" target="_blank" rel="noopener">${escHtml(v)}</a>`;
            } else {
              // Scalar non-URL values: clickable to filter
              valueHTML = `<span class="panel-tag-filter" role="button" tabindex="0" data-tag-key="${escHtml(k)}" data-tag-val="${escHtml(String(v))}">${escHtml(String(v))}</span>`;
            }
            return `<dt class="panel-tag-key">${escHtml(label)}</dt><dd class="panel-tag-value">${valueHTML}</dd>`;
          })
          .join("")}
      </dl>
    </div>`
    : "";

  // History
  const history = (node.history || []).slice(); // already reverse-chron in data
  const historyHTML = history.length
    ? `
    <div class="panel-history">
      <p class="panel-section-title">History</p>
      <ol class="history-timeline">
        ${history
          .map(
            (h) => `
          <li class="history-item">
            <div class="history-date">${escHtml(h.date || "")}</div>
            <div class="history-ring-badge">${escHtml(getRingLabel(data, h.ring) || h.ring || "")}</div>
            ${h.note ? `<p class="history-note">${escHtml(h.note)}</p>` : ""}
          </li>`,
          )
          .join("")}
      </ol>
    </div>`
    : "";

  content.innerHTML = `
    <div class="panel-badge-row">
      <span class="panel-id-badge">#${node.id}</span>
      <span class="panel-quadrant-badge panel-q-${node.quadrant}">${escHtml(quadLabel)}</span>
      <span class="panel-ring-badge panel-ring-${node.ring}">${escHtml(ringLabel)}</span>
    </div>
    <h1 id="panel-node-name" class="panel-node-name">${escHtml(node.name)}</h1>
    ${descHTML ? `<div class="panel-description">${descHTML}</div>` : ""}
    ${tagsHTML}
    ${node.added ? `<p class="panel-added">First appeared: <strong>${escHtml(formatMonth(node.added))}</strong></p>` : ""}
    ${historyHTML}
  `;

  // Tag value filter clicks — toggle filter and reflect state visually
  content.querySelectorAll("[data-tag-key]").forEach((el) => {
    const key = el.dataset.tagKey;
    const val = el.dataset.tagVal;
    // Reflect current filter state
    el.classList.toggle("filter-active", !!state.filters[key]?.has(val));
    el.addEventListener("click", () => {
      if (!state.filters[key]) state.filters[key] = new Set();
      if (state.filters[key].has(val)) state.filters[key].delete(val);
      else state.filters[key].add(val);
      if (!state.filters[key].size) delete state.filters[key];
      applyFilters();
      renderFilterBar(state.data);
      // Update active state on this chip
      el.classList.toggle("filter-active", !!state.filters[key]?.has(val));
    });
  });

  // Highlight this node on the radar
  d3.selectAll(".node-group").classed("hovered", (d) => d.id === nodeId);
  d3.select(".nodes-container").classed("has-hover", true);
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ══════════════════════════════════════════════════════════════════════════════
// Part 5: Main initialization
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  try {
    // ?data=<url> allows loading any data.json URL for testing or sharing
    const dataUrl = new URLSearchParams(location.search).get("data") || "./data.json";
    const data = await fetch(dataUrl).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });

    state.data = data;
    readURL(); // restore state from URL before first render

    // Compute geometry and positions
    const geo = computeGeometry(data);
    const positions = computeNodePositions(data, geo);

    // Render in order
    renderSidebar(data);
    renderFilterBar(data);
    renderRadar(data, geo);
    renderNodes(data, geo, positions);
    renderLegend();

    // Show app
    document.getElementById("loading").hidden = true;
    document.getElementById("app").hidden = false;

    // Restore open panel from URL
    if (state.activeNode != null) {
      const node = data.nodes.find((n) => n.id === state.activeNode);
      if (node) openPanel(state.activeNode);
    }

    // Restore quadrant zoom if quadrant was set in URL
    if (state.quadrant) zoomToQuadrant(state.quadrant);

    document.getElementById("panel-close").addEventListener("click", closePanel);
  } catch (err) {
    document.getElementById("loading").innerHTML = `<div class="loading-content" style="color:var(--text)">
        <p style="font-size:14px;max-width:340px;text-align:center">
          <strong>Failed to load radar data.</strong><br>${err.message}
        </p>
      </div>`;
    console.error(err);
  }
}

main();
