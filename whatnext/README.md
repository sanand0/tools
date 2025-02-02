What Next?
==========

Sometimes, it's hard to figure out what to do next.

One classic approach is to list all your items, rate them on an urgency and
importance scale, and pick those on the top right quadrant. Stephen Covey
explains this in his book [First Things
First](http://en.wikipedia.org/wiki/First_Things_First_(book).

This can be generalised. Almost anything can be prioritised on a grid.

This page is an **offline single-page app** that lets you add things and move
them around. You can pick your axis scales. Everything's saved in your
browser and available the next time you visit. (But it won't be available
in other browsers or for other people.)

[Use the app](http://sanand0.github.io/whatnext/)

Here's a screenshot

![Screenshot](img/screenshot.png)


Usage
-----

- **Add an item** by clicking on the "New item" button on top. You can edit
  and move the item around.
- **Delete the item** by delete the text in it. It will vanish in 5 seconds
  after it loses focus. (If you change your mind, click on the item and press
  `Ctrl-Z` to undo.)
- **Edit labels** by clicking on the labels at the left and bottom. To delete
  a label, edit it and make it blank. It will automatically be removed.
- **Add labels** by clicking on the "+" button at the top left or bottom right.
- Your actions are automatically saved in your browser. Re-visit the page to
  continue from where you left off.
- **Change views** by selecting the dropdown at the top right. A view is like
  a new clean slate. You can add or delete views.
- **Publish** and **refresh** across machines by creating a free [Firebase
  account](https://www.firebase.com/signup/) and entering a <code>.json</code>
  URL. Or use this:
  `https://whatnextapp.firebaseio.com/your-name/sheet-name.json`.


Technical tutorial
------------------

You can read this step-by-step [write-up on how this app was
built](https://github.com/sanand0/whatnext/wiki) to understand the underlying
technology.


License
-------

This software is released under the
[MIT License](http://en.wikipedia.org/wiki/MIT_License)
