# copylinks

## Add text fragment to copy links

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-5.6-sol --config model_reasoning_effort=medium
-->

<!-- Note - this is a feature browsers already have via right click, and I didn't realize that when I wrote this. -->

Add a bookmarklet to copylinks/ that will copy the current page's URL and any text fragment to the clipboard.

That is, if I select some text on a page and click this bookmarklet, it will copy the URL with a text fragment to the clipboard.
If no text is selected, it will just copy the URL.
Use best practices to trim the text fragment, i.e. infer the textStart and textEnd (and prefix and suffix) sensibly.
Write and run test cases based on practical real-world examples.
See how other bookmarklet pages handle multiple bookmarklets in a single page and apply accordingly.

<!-- codex resume 01a02d16-0a64-78a1-ac91-c07251aa5104 -->
