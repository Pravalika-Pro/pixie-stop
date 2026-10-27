# Pixie Travels

A sparkly little site with a login, travel itineraries, a closet, shops and a wishlist.
Plain HTML, CSS and JavaScript. No build step.

## Files
- `index.html`: page structure
- `styles.css`: all styling
- `app.js`: all logic (login, tabs, uploads, saving)
- `images/`: put photos here if you want visitors to see them

## Publish on GitHub Pages
1. Create a new repository on GitHub (for example `pixie-travels`).
2. Upload all files and the `images` folder, keeping `index.html` at the top level.
3. Go to Settings, then Pages. Under "Build and deployment", choose "Deploy from a branch", pick `main` and `/ (root)`, then Save.
4. After a minute your site is live at `https://YOUR-USERNAME.github.io/pixie-travels/`.

## Login
Username: `pravalika`
Password: `proversion@45`

This is a front-end gate only. Anyone can read the credentials in `app.js`.

## Photos
- Photos you upload in the browser are shrunk and saved in that browser only (localStorage). Other visitors will not see them.
- To show photos to everyone, add files to `images/` and set `image: 'images/your-photo.jpg'` on the sample items in `seedData()` in `app.js`.
