const fs = require('fs');

// 1. UPDATE INDEX.HTML
let html = fs.readFileSync('index.html', 'utf8');
// Remove theme selector
html = html.replace(/<select id="ui-theme-selector"[\s\S]*?<\/select>/, '');
// Update font imports
const newFonts = `  <!-- Fonts for Theme Options -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;
html = html.replace(/<!-- Fonts for Theme Options -->[\s\S]*?<\/style>/, newFonts + '\n</style>'); // Fallback if necessary, but actually we injected it right before <link rel="stylesheet" href="css/style.css"/>
html = html.replace(/<!-- Fonts for Theme Options -->[\s\S]*?<link rel="stylesheet" href="css\/style\.css"\/>/, newFonts + '\n  <link rel="stylesheet" href="css/style.css"/>');
fs.writeFileSync('index.html', html);

// 2. UPDATE JS/SCRIPT.JS
let js = fs.readFileSync('js/script.js', 'utf8');
js = js.replace(/this\._setupUITheme\(\);\n\s+this\._setupTheme\(\);/, 'this._setupTheme();');
js = js.replace(/_setupUITheme\(\)\{[\s\S]*?_applyUITheme\(t\)\{[\s\S]*?\},/, '');
fs.writeFileSync('js/script.js', js);

// 3. UPDATE CSS/STYLE.CSS
let css = fs.readFileSync('css/style.css', 'utf8');
// Remove the injected themes block completely
css = css.replace(/\/\* =========================================================================\s*UI THEME DEFINITIONS[\s\S]*?$/g, '');

// Re-inject the global UI improvements that we want to keep
const globalImprovements = `
/* GLOBAL IMPROVEMENTS */
.card {
  box-shadow: var(--sh-sm) !important;
  border-radius: var(--r-md);
  padding: 24px;
}
.table-wrapper {
  box-shadow: var(--sh-xs) !important;
}
tbody tr {
  transition: background 0.15s ease;
}
tbody tr:hover {
  background: var(--bg-hover) !important;
}
.portal-badge-active, .portal-badge-none {
  border-radius: 99px;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.portal-badge-active {
  background: var(--c-success-bg);
  color: var(--c-success-mid);
  border: none;
}
.portal-badge-none {
  background: var(--bg-page);
  color: var(--txt-muted);
  border: none;
}
table code, .invoice-number, .ledger-amount {
  font-family: var(--font-mono) !important;
}
`;

css += globalImprovements;

// Replace root variables
css = css.replace(/:root\s*\{[\s\S]*?(?=\[data-theme="dark"\])/, `:root {
  --font: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --c-primary:       #0F766E;
  --c-primary-mid:   #115E59;
  --c-primary-light: #14B8A6;
  --c-teal:          #0F766E;
  --c-teal-mid:      #115E59;
  --c-teal-dark:     #134E4A;
  --c-teal-light:    #CCFBF1;
  --c-teal-bg:       #F0FDFA;
  --c-success:       #1b5e20;
  --c-success-mid:   #2e7d32;
  --c-success-bg:    #e8f5e9;
  --c-danger:        #b71c1c;
  --c-danger-mid:    #c62828;
  --c-danger-bg:     #ffebee;
  --c-warning:       #D97706;
  --c-warning-bg:    #FEF3C7;
  --c-info:          #01579b;
  --c-info-bg:       #e1f5fe;
  
  --bg-page:         #FAFAF9;
  --bg-card:         #FFFFFF;
  --bg-sidebar:      #0F766E;
  --bg-topbar:       #FFFFFF;
  --bg-input:        #F5F5F4;
  --bg-thead:        #F5F5F4;
  --bg-hover:        #F5F5F4;
  
  --txt-primary:     #1C1917;
  --txt-secondary:   #57534E;
  --txt-muted:       #A8A29E;
  --txt-inv:         #ffffff;
  --border:          #E7E5E4;
  
  --r-sm:            10px;
  --r-md:            16px;
  --r-lg:            24px;
  
  --sh-xs: 0 1px 3px rgba(15, 118, 110, .06);
  --sh-sm: 0 2px 8px rgba(15, 118, 110, .08);
  --sh-md: 0 4px 16px rgba(15, 118, 110, .10);
  --sh-lg: 0 8px 32px rgba(15, 118, 110, .14);
  --sh-xl: 0 20px 48px rgba(0, 0, 0, .18);
  
  --t-base: 0.2s ease;
  --t-bounce: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
`);

css = css.replace(/\[data-theme="dark"\]\s*\{[\s\S]*?(?=\/\*\s*─── RESET)/, `[data-theme="dark"] {
  --bg-page:     #1C1917;
  --bg-card:     #292524;
  --bg-sidebar:  #0C0A09;
  --bg-topbar:   #292524;
  --bg-input:    #44403C;
  --bg-thead:    #44403C;
  --bg-hover:    #44403C;
  
  --txt-primary: #FAFAF9;
  --txt-secondary:#D6D3D1;
  --txt-muted:   #A8A29E;
  --border:      #44403C;
}
`);

fs.writeFileSync('css/style.css', css);
console.log("Successfully applied Warm Minimalist theme!");
