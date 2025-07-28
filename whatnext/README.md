# What Next?

"What Next?" is a flexible, offline-first single-page application for visual prioritization. It allows you to organize tasks, ideas, or any items on a customizable grid, classically known as an Eisenhower (Urgency/Importance) Matrix, to help you decide what to focus on next.

One classic approach is to list all your items, rate them on an urgency and
importance scale, and pick those on the top right quadrant. Stephen Covey
explains this in his book [First Things First](<http://en.wikipedia.org/wiki/First_Things_First_(book)>).

This can be generalised. Almost anything can be prioritised on a grid.

This page is an **offline single-page app** that lets you add things and move
them around. You can pick your axis scales. Everything's saved in your
browser and available the next time you visit. (But it won't be available
in other browsers or for other people.)

[Use the app](http://tools.s-anand.net/whatnext/)

![Screenshot](screenshot.png)

## Usage

## Use Cases

## What it does

This tool provides a digital canvas where you can:

- Place items (tasks, notes, ideas) onto a 2D grid.
- Define the meaning of the grid's axes (e.g., Urgency vs. Importance, Cost vs. Benefit).
- Visually assess priorities based on an item's position.
- Manage multiple distinct priority matrices or "views."

## Use Cases

- **Task Management:** Prioritize personal or work tasks using the classic Eisenhower Matrix (Urgent/Important).
- **Decision Making:** Evaluate options based on custom criteria (e.g., Impact/Effort, Risk/Reward).
- **Project Planning:** Organize project features or milestones.
- **Idea Brainstorming & Sorting:** Visually sort and categorize ideas.
- **Strategic Planning:** Map out strategic initiatives on a customizable grid.

## Technical tutorial

**Core Functionality:**

- **Interactive Grid:**
  - Items are placed on an SVG grid. Default axes are "Urgency" and "Importance."
  - **Customizable Labels:** Click on axis labels (left/bottom) to edit them. Blank labels are removed, changing grid dimensions. Add new labels via "+" icons.
- **Item Management:**
  - **Add Items:** Click "New item" to add a task/note. It appears on the grid, ready to be dragged.
  - **Edit Items:** Click an item to edit its text directly.
  - **Move Items:** Drag items to different positions on the grid to change their priority.
  - **Delete Items:** Clear the text within an item. It will be marked for deletion and disappear after 5 seconds if it remains empty and loses focus. (You can undo by quickly re-focusing and using Ctrl+Z).
  - **Color Coding:** Ctrl-click an item to cycle through five preset border colors for visual differentiation.
- **Offline Storage (Default):**
  - All your items, axis labels, notes, and view configurations are automatically saved in your web browser's `localStorage`.
  - The application loads your data when you revisit the page in the same browser. No internet connection is required for core functionality.
- **Multiple Views:**
  - Organize different projects or contexts into separate "views."
  - Switch between views using the dropdown menu at the top right. Each view is a distinct matrix with its own items and labels, identified by a URL hash (e.g., `index.html#myproject`).
  - Create new views or clear existing ones from this menu.
- **Notes Area:** An editable section below the grid for any additional notes related to the current view.

## How It Works

**Core Functionality:**

- **Interactive Grid:**
  - Items are placed on an SVG grid. Default axes are "Urgency" and "Importance."
  - **Customizable Labels:** Click on axis labels (left/bottom) to edit them. Blank labels are removed, changing grid dimensions. Add new labels via "+" icons.
- **Item Management:**
  - **Add Items:** Click "New item" to add a task/note. It appears on the grid, ready to be dragged.
  - **Edit Items:** Click an item to edit its text directly.
  - **Move Items:** Drag items to different positions on the grid to change their priority.
  - **Delete Items:** Clear the text within an item. It will be marked for deletion and disappear after 5 seconds if it remains empty and loses focus. (You can undo by quickly re-focusing and using Ctrl+Z).
  - **Color Coding:** Ctrl-click an item to cycle through five preset border colors for visual differentiation.
- **Offline Storage (Default):**
  - All your items, axis labels, notes, and view configurations are automatically saved in your web browser's `localStorage`.
  - The application loads your data when you revisit the page in the same browser. No internet connection is required for core functionality.
- **Multiple Views:**
  - Organize different projects or contexts into separate "views."
  - Switch between views using the dropdown menu at the top right. Each view is a distinct matrix with its own items and labels, identified by a URL hash (e.g., `index.html#myproject`).
  - Create new views or clear existing ones from this menu.
- **Notes Area:** An editable section below the grid for any additional notes related to the current view.

**Optional Firebase Synchronization:**

- **Publish:** You can save the state of your current view to a Firebase Realtime Database URL that you provide (requires a free Firebase account and setup of a `.json` endpoint).
- **Refresh From:** Load data from a specified Firebase URL, overwriting the current view in your browser. This allows for manual synchronization across different browsers or machines.

## Technical Notes

- The application is a single HTML file with embedded CSS and JavaScript.
- It has no server-side backend dependencies for its core offline functionality.
- A step-by-step [write-up on how this app was built](https://github.com/sanand0/whatnext/wiki) is available for those interested in the underlying technology.

## License

This software is released under the [MIT License](http://en.wikipedia.org/wiki/MIT_License).
