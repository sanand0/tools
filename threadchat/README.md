# ThreadChat

ThreadChat is a lightweight, client-only discussion board inspired by Hacker News. It supports threaded conversations, fake authentication, and in-memory storage seeded with demo data to encourage quick engagement.

![Screenshot](screenshot.webp)

## What it does

- Users can sign up or sign in using modal dialogs; authentication is entirely in-memory.
- Submit link or ask posts and discuss them in nested comment threads.
- Upvote posts and comments to build karma.
- Browse user profiles showing creation date, karma, and recent activity.
- Load more stories dynamically without reloading the page.

## Use Cases

- Prototype a community discussion board without a backend.
- Explore UI flows for nested comments and fake auth.
- Demonstrate engagement features such as upvotes and profiles.

## How It Works

All data lives in an in-memory `data` object. The interface renders lists, threads, and profiles entirely on the client using Bootstrap for styling. No network requests are made, so refreshing the page resets the data to its seeded state.
