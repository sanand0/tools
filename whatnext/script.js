// A crude version of event delegation
// All live events are bound to the container.
// on('click', 'item', handler) runs handler if a ".item" is clicked.
var container = document.getElementById("container");
function on(event, className, handler) {
  container.addEventListener(
    event,
    function (e) {
      // SVG .className is an object with .baseVal and .animVal. HTML .className is a string
      var cls = (typeof e.target.className == "object" ? e.target.className.baseVal : e.target.className).split(/\s+/);
      for (var i = 0, l = cls.length; i < l; i++) if (cls[i] == className) return handler(e);
    },
    false,
  );
}

// Construct an SVG element. e.g. svg('path', {d: 'M10,10h100', stroke: '#000'})
function svg(tag, attrs, text) {
  var element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (var key in attrs) element.setAttributeNS(null, key, attrs[key]);
  if (typeof text !== "undefined") element.appendChild(document.createTextNode(text));
  return element;
}

// Remove all child nodes of a node
function clear(node) {
  for (var children = node.childNodes, i = children.length - 1; i >= 0; i--) node.removeChild(children[i]);
}

// Replace multiple whitespaces with a single space, and remove leading + trailing space
function strip(s) {
  return s.replace(/\s+/g, " ").replace(/^ /, "").replace(/ $/, "");
}

// Make items draggable
var startX, startY;
on("dragstart", "item", function (e) {
  startX = e.screenX;
  startY = e.screenY;
  // Firefox won't trigger dragend without dataTransfer.setData().
  // IE does not like 'text/plain' -- only 'text'. http://stackoverflow.com/a/26660055/100904
  e.dataTransfer.setData("text", "");
});
on("dragend", "item", function (e) {
  // Firefox dragend sets clientX to 0. Using screenX instead
  e.target.style.left = parseInt(e.target.style.left) + e.screenX - startX + "px";
  e.target.style.top = parseInt(e.target.style.top) + e.screenY - startY + "px";
  save();
});

// #add-item button adds a random item on the page
var items = document.getElementById("items");

function add_item(item_state) {
  var item = document.createElement("div");
  item.setAttribute("draggable", "true");
  item.setAttribute("class", "item");
  item.setAttribute("contentEditable", "true");
  item.style.left = item_state.x + "px";
  item.style.top = item_state.y + "px";
  item.innerHTML = item_state.t;
  item.style.borderColor = item_state.c;
  items.appendChild(item);
  return item;
}

document.getElementById("add-item").addEventListener("click", function () {
  // Add the item just below the new item button, making it easier to drag it
  add_item({
    x: this.getBoundingClientRect().left - document.body.getBoundingClientRect().left,
    y: -10,
    t: "New item",
  }).focus();
  save();
});

// Clicking on the #publish button confirms a Firebase URL to save at, and PUTs the state to that URL
var publish_node = document.getElementById("publish-url");
document.getElementById("publish").addEventListener("click", function (e) {
  e.preventDefault();
  var publish_url = prompt("Publish to Firebase URL:", publish_node.textContent);
  if (publish_url !== null) {
    publish_node.textContent = publish_url;
    save();
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", publish_url, true);
    xhr.send(JSON.stringify(state()));
  }
});

// Clicking on #refresh-from button confirms a Firebase URL to load from, and GETs the state from that URL
document.getElementById("refresh-from").addEventListener("click", function (e) {
  e.preventDefault();
  var publish_url = prompt("Load from Firebase URL, overwriting what you have?", publish_node.textContent);
  if (publish_url !== null) {
    publish_node.textContent = publish_url;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", publish_url, true);
    xhr.onload = function () {
      load(JSON.parse(this.response));
    };
    xhr.send();
  }
});

// If an item is left empty, schedule its deletion in a few seconds
on("focusout", "item", function (e) {
  if (!e.target.textContent) {
    if (e.target.timeout) clearTimeout(e.target.timeout);
    e.target.timeout = setTimeout(function () {
      // Delete after a few seconds but only if it's still empty, and to be deleted
      if (!e.target.textContent && e.target.classList.contains("to-be-deleted")) {
        e.target.parentNode.removeChild(e.target);
        save();
      } else e.target.classList.remove("to-be-deleted");
      delete e.target.timeout;
    }, 5000);
    e.target.classList.add("to-be-deleted");
  } else save();
});

on("focusin", "item", function (e) {
  e.target.classList.remove("to-be-deleted");
});

// draw_grid() draws a background grid and label the grid
var gridbase = document.getElementById("gridbase"),
  grid = document.getElementById("grid"),
  box = gridbase.getBBox(),
  pad = 8;
function draw_grid() {
  clear(grid);
  // Draw the grid
  for (var i = 0, n = labels.col.length, w = box.width / n; i < n; i++) {
    grid.appendChild(svg("path", { d: "M" + i * w + ",0 v" + box.height }));
    grid.appendChild(
      svg(
        "text",
        {
          id: "col:" + i,
          class: "label legend",
          x: (i + 0.5) * w,
          y: box.height - pad,
          "text-anchor": "middle",
        },
        labels.col[i],
      ),
    );
  }
  for (var i = 0, n = labels.row.length, h = box.height / n; i < n; i++) {
    y = (n - 0.5 - i) * h;
    grid.appendChild(svg("path", { d: "M0," + (y + h * 0.5) + " h" + box.width }));
    grid.appendChild(
      svg(
        "text",
        {
          id: "row:" + i,
          class: "label legend",
          x: 0,
          y: y + pad,
          dy: "0.35em",
          "text-anchor": "middle",
          transform: "rotate(-90,5," + y + ")",
        },
        labels.row[i],
      ),
    );
  }
  save();
}

// The data for the labels is here
var labels = {
  row: ["Urgent", "Slightly urgent", "Not urgent"],
  col: ["Not important", "Slightly important", "Important"],
};

// Clicking on any label lets you edit or delete it it
on("click", "label", function (e) {
  var key = e.target.getAttributeNS(null, "id").split(":"),
    axis = key[0],
    index = +key[1],
    current_label = labels[axis][index],
    new_label = prompt('Rename "' + current_label + '". (Or make it blank to delete)', current_label);
  if (new_label !== null) {
    new_label = strip(new_label);
    if (new_label) labels[axis][index] = new_label;
    else labels[axis].splice(index, 1);
    draw_grid();
  }
});

// Clicking on the '+' icons lets you add a new row or column
on("click", "add-label", function (e) {
  var key = e.target.getAttributeNS(null, "id").split(":"),
    axis = key[0],
    new_label = prompt("Add " + axis, "Name");
  if (new_label !== null) {
    new_label = strip(new_label);
    if (new_label) {
      labels[axis].push(new_label);
      draw_grid();
    }
  }
});

// Shift-click on an item to cycle through colors. Office 2013 palette in rgb() since that is what getComputedStyle returns
var colors = ["rgb(91, 155, 213)", "rgb(237, 125, 49)", "rgb(165, 165, 165)", "rgb(255, 192, 0)", "rgb(112, 173, 71)"];
on("click", "item", function (e) {
  if (e.ctrlKey) {
    var index = colors.indexOf(getComputedStyle(e.target)["border-top-color"]);
    e.target.style.borderColor = colors[index < 0 ? 1 : (index + 1) % colors.length];
    save();
  }
});

// When heading changes, apply the heading everywhere (h1 and title) and save it
var app_name_heading = document.getElementById("app-name");
app_name_heading.addEventListener(
  "focusout",
  function (e) {
    set_heading(e.target.textContent);
    save();
  },
  false,
);

// Set the heading everywhere to name
function set_heading(name) {
  for (var i = 0, nodes = document.querySelectorAll(".app-name"), node; (node = nodes[i]); i++) node.textContent = name;
}

// Whenever notes change, save it
var notes = document.getElementById("notes");
notes.addEventListener("focusout", save, false);

// The state of the application is a JSON object
function state() {
  var items = [];
  for (var i = 0, nodes = document.querySelectorAll(".item"), node; (node = nodes[i]); i++)
    items.push({
      x: parseInt(node.style.left),
      y: parseInt(node.style.top),
      t: node.innerHTML,
      c: getComputedStyle(node)["border-top-color"],
    });
  return {
    item: items,
    row: labels.row,
    col: labels.col,
    name: app_name_heading.textContent,
    notes: notes.innerHTML,
    publish_url: publish_node.textContent,
  };
}

// Save the state in localStorage
function save() {
  var app_id = "priority" + window.location.hash.replace(/^#/, "");
  localStorage[app_id] = JSON.stringify(state());
}

// Load the state from localStorage based on the URL hash
function load(state) {
  set_heading(state.name || "Priority matrix");
  publish_node.textContent = state.publish_url || "";
  labels.row = state.row;
  labels.col = state.col;
  notes.innerHTML = state.notes || "Your notes here";
  clear(items);
  for (var i = 0, item_state; (item_state = state.item[i]); i++) {
    add_item(item_state);
  }
  draw_grid();
}

var app_list_select = document.getElementById("app-list-select");
var app_list = document.getElementById("app-list");
function show_states() {
  clear(app_list);
  var current_hash = window.location.hash.replace(/^#/, "");
  for (var app_id in localStorage)
    if (app_id.match(/^priority/)) {
      var state = JSON.parse(localStorage[app_id]),
        option = document.createElement("option"),
        hash = app_id.replace(/^priority/, "");
      option.setAttribute("id", hash);
      if (current_hash == hash) {
        option.setAttribute("selected", "selected");
        option.setAttribute("class", "app-name");
      }
      option.appendChild(document.createTextNode(state.name));
      app_list.appendChild(option);
    }
}
app_list_select.addEventListener("change", function () {
  var hash = app_list_select[app_list_select.selectedIndex].id;
  if (hash == "_new_view") {
    window.location.hash = Math.round(Math.random() * 1000);
    set_heading("New view");
    clear(items);
    publish_node.textContent = "";
  } else if (hash == "_clear_view") {
    if (confirm("Delete this view without undo?")) {
      delete localStorage["priority" + window.location.hash.replace(/^#/, "")];
      window.location.hash = "";
    }
  } else window.location.hash = hash;
});

// When the URL hash changes, switch to a different view
function hashchange() {
  var app_id = "priority" + window.location.hash.replace(/^#/, "");
  if (app_id in localStorage) load(JSON.parse(localStorage[app_id]));
  else draw_grid();
  show_states();
}
window.addEventListener("hashchange", hashchange, false);
hashchange();
