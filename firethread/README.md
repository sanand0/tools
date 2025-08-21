# FireThread

Firebase-auth discussion board with nested comments.

## Setup

- Set up [`tools-anand` project](https://console.firebase.google.com/u/0/project/tools-anand/overview) on Firebase.
- Enable Google sign in under [Build > Authentication](https://console.firebase.google.com/u/0/project/tools-anand/authentication/providers)
- Copy `memory/config.json` to `firethread/config.json`
- Create Firestore collections `posts` and `comments`
- Create indices based on console.error message
