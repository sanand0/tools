import { createCard } from "./card.js";
import { files } from "./notes.js";
import { readParam } from "../common/demo.js";

const card = await createCard(document.getElementById("notes"), { showAllOnSearch: true });

const normalize = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const deckId = readParam("deck", { fallback: "" });
if (deckId) {
  const file = files.find((item) => item.id === deckId || normalize(item.name) === normalize(deckId));
  if (file) {
    const select = card.querySelector(".note-file");
    select.value = file.url;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
