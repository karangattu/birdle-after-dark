# birdle-after-dark

An interactive activity that teaches about different types of Owls in the San Francisco Bay Area

## How to run locally

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Open the provided `localhost` link in your browser.

## PWA and offline behavior

The production build is a Progressive Web App. `npm run build` generates a web app manifest and service worker for GitHub Pages at `/birdle-after-dark/`.

The service worker precaches the game shell plus images, video, and bird audio so the installed game can run offline after it has loaded once online. Installed copies also check for a newer GitHub Pages deployment on startup, when the app returns to the foreground, and every 30 minutes while open. When a new service worker activates, open app windows reload automatically onto the latest deployed version.
