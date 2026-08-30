const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const themeSelector = `      <select id="ui-theme-selector" class="form-control" style="width:auto; height:32px; padding:2px 8px; font-size:12px; margin-right:8px;">
        <option value="fintech">1: FinTech (Blue)</option>
        <option value="minimalist">2: Minimal (Teal)</option>
        <option value="monochrome">3: Exec (Monochrome)</option>
      </select>`;

html = html.replace(
  /<div class="topbar-actions">/,
  '<div class="topbar-actions">\n' + themeSelector
);

const fontImports = `
  <!-- Fonts for Theme Options -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Figtree:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
`;

if (!html.includes('Plus+Jakarta+Sans')) {
  html = html.replace(/<link rel="stylesheet" href="css\/style.css"\/>/, fontImports + '\n  <link rel="stylesheet" href="css/style.css"/>');
}

fs.writeFileSync('index.html', html);
console.log('Updated index.html');
