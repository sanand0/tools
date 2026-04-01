# Prompts

<!--

cd ~/code/tools
dev.sh
codex --yolo

-->

Create a scroller/ tool with a bookmarklet similar to page2md/, booktsrtappicker/, straiveintelligence/, etc.

It should add an unobtrusive circular area to the bottom left of the page with low opacity (0.3) with a color combination that is visible on dark and light screens (e.g. thick black border with white fill and a black SVG icon inside it - all of which inherit the opacity).

On hover, it should expand to a play/pause toggle button, a speed slider (0 px/second to 5000 px/second), a direction toggle (showing either up arrow or down arrow, toggling) and a close button.

Clicking on the close button should remove the entire scroller UI/code from the page.
Clicking on the play button should start a smooth autoscroll at the selected speed and direction, and the play button should toggle to a pause button. Clicking on the pause button should stop the autoscroll and toggle back to the play button.
Clicking on the speed slider should adjust the autoscroll speed in real-time.
Clicking on the direction toggle should reverse the autoscroll direction in real-time.

Ensure that only one instance of the scroller runs at any time.
This should work on any page. Isolate UI inside a high-z-index host `div` with `ShadowRoot`
Factor in edge cases like pages that have their own scroll handlers, or iframes, etc. Dynamically find the largest scrollabel element on the page when required. Log warnings and indicate visually with a red border if there are no scrollable areas or permissions are denied (e.g. cross-origin iframes, synthetic events).
The autoscroll should be smooth and not janky. Use requestAnimationFrame not setInterval.
It should also not interfere with the user's ability to manually scroll or interact with the page.

Plan. Write tests first. Then implement and package.

---

Drop the core button - we don't need that. Instead, use the Play/Pause button itself. So, the play/pause is always visible (with low opacity by default).

Reduce the opacity from 0.3 to 0.1.

The controls are not vertically aligned. The scroll speed slider should be vertically aligned with the rest of the controls but is not, because the speed-value label moves it down. Move the label to the right of the slider to fix this. Similarly, the status can be formatted better and moved to the same row. Just maintain one row.

Use [data-role="shell"] { padding: 3px; } instead of 6px;

Change the range of the speed slider to 0-1000 px/second and the default to 300 px/second.

Once the scroller reaches the beginning/end of scroll, pause automatically and toggle the play button.

OPTIONAL: On GMail, I get "Uncaught TypeError: Failed to set the 'innerHTML' property on 'ShadowRoot': This document requires 'TrustedHTML' assignment." Can this be resolved?

Update tests. Then build, implement, and package.

---

Add a "Delayed start" icon, sort of like a photo timer, that will start the scroll after a 3 second countdown.

When the scrolling starts, auto-collapse the controls and enable the opacity.

<!-- codex resume 019d4647-544b-7262-83d5-253b89eaf3c6 -->
