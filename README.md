# Tools

A collection of single page web apps, mostly LLM generated. Hosted at [tools.s-anand.net](https://tools.s-anand.net).

## Overview

This repository contains a collection of standalone web tools built with:
- Vanilla JavaScript (ES6+)
- Bootstrap 5.3 for styling
- Bootstrap Icons

## Local Development

1. Clone the repository: `git clone https://github.com/s-anand/tools.git && cd tools`
2. Serve the directory using any static file server. E.g. `python -m http.server 8000` or `npx serve` or `caddy file-server`
3. Open `http://localhost:[PORT]` in your browser

## Adding New Tools

1. Create a new directory for your tool
2. Add your tool's files (HTML, JS, CSS)
3. Update `tools.json` with your tool's metadata:
   ```js
   {
     "tools": [
       {
         "icon": "bi-[icon-name]",
         "title": "Tool Name",
         "description": "Tool description",
         "url": "/path/to/tool/"
       }
     ]
   }
   ```

## Deployment

The site is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment process:

1. Push changes to the main branch
2. GitHub Actions builds and deploys to GitHub Pages
3. The site becomes available at tools.s-anand.net

## Project Structure

- `index.html` - Main landing page
- `tools.js` - Dynamic tool card generator
- `tools.json` - Tool metadata
- `/[tool-name]/` - Individual tool directories, mostly with just a single LLM-generated `index.html` file

## License

[MIT](LICENSE)
