# GitPicker

A possible next iteration of this tool.

---

I am building GitPicker, a front-end only lit-html (no React) web app that:

- Asks the user what they are evaluating the users for (e.g. a job description, finding Python evangelists, etc.)
- Searches on GitHub to find a relevant set of GitHub users
- OR: Allows Paste a bunch of GitHub URLs or upload a bunch of CVs, and extracts the GitHub user profile links from those (https://github.com/[user])
- Fetches all relevant information about the users that may be useful to filter, e.g.
  - Profile information: email, twitter, company, blog, location, hireable, etc.
  - How old is their GitHub repo?
  - How frequently updated is it?
  - How many followers do they have?
  - Do they have a bio? Is it comprehensive?
  - What repositories have they created?
  - How popular are these repositories?
  - What languages do they code in?
  - etc.
- Automatically identifies the information to filter by using an LLM, assigning suggested weightages
- Allows the user to modify these weightages
- Ranks the users based on these weightages, explaining their ranking against the evaluation

Given this:

1. What kinds of roles can this application help? Give me a comprehensive list with specific examples.
2. What kind of user interface should I create for the app? List the components it would include, providing alternatives for these. For each component, give me suggestions on the implementation, pointing to specific sites as examples.
