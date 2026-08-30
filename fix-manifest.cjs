const fs = require('fs');

let manifest = JSON.parse(fs.readFileSync('json/manifest.json', 'utf8'));

manifest.start_url = "../index.html";
manifest.scope = "../";
manifest.icons.forEach(i => i.src = "../icon/" + i.src.split('/').pop());
manifest.screenshots.forEach(i => i.src = "../icon/" + i.src.split('/').pop());
manifest.shortcuts.forEach(s => s.icons.forEach(i => i.src = "../icon/" + i.src.split('/').pop()));

manifest.theme_color = "#2563EB"; // Royal Blue to match the new theme
manifest.background_color = "#1E3A8A"; // Deep Blue

fs.writeFileSync('json/manifest.json', JSON.stringify(manifest, null, 2));
console.log('Manifest fixed');
