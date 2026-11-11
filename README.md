# Wüest Dimensions, design concept

Static concept page for a Wüest Dimensions brand refresh. Not the official Wüest Partner website.

- `index.html`: the product page
- `app/`: the Karta concept app (static pages, demo data plus live swisstopo address and building register lookups), opened from the Login buttons
  - `app/maps.js`: live maps on Market map, Location quality and Rental listings (MapLibre GL in `app/vendor/`, swisstopo base maps; the overlays are demo data)
  - `app/switches.js`: the range and view switches, and the tabs marked as not part of the concept
- `gate/`: the entry screen shown on every page until the Concept Access Terms are accepted in the browser, plus Privacy choices and the terms and privacy text (`legal-content.js`). Google Analytics is wired in `gate.js` but off until a measurement ID is set there
- `scene.html`: the interactive Zürich 3D scene shown in the hero frame (three.js, swisstopo swissBUILDINGS3D and GWR data; market figures are for illustration)

No build step. Vercel serves the folder as is.
