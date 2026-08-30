const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf8');

// We will append the theme definitions at the end of the file or after root definitions.
const uiThemes = `

/* =========================================================================
   UI THEME DEFINITIONS
   ========================================================================= */

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

/* -----------------------------------------
   THEME 1: FINTECH (Default)
   ----------------------------------------- */
:root[data-ui-theme="fintech"] {
  --font: 'Inter', system-ui, sans-serif;
  --font-mono: 'Roboto Mono', monospace;
  --c-primary: #2563EB;
  --c-primary-mid: #1D4ED8;
  --c-primary-light: #3B82F6;
  --c-success: #059669;
  --c-success-mid: #059669;
  --c-success-bg: #d1fae5;
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 16px;
}
:root[data-ui-theme="fintech"][data-theme="light"] {
  --bg-page: #F8FAFC;
  --bg-card: #FFFFFF;
  --bg-sidebar: #0F172A;
  --bg-topbar: #FFFFFF;
  --border: #E2E8F0;
  --txt-primary: #0F172A;
  --bg-hover: #F1F5F9;
}
:root[data-ui-theme="fintech"][data-theme="dark"] {
  --bg-page: #0F172A;
  --bg-card: #1E293B;
  --bg-sidebar: #020617;
  --bg-topbar: #1E293B;
  --border: #334155;
  --txt-primary: #F8FAFC;
  --bg-hover: #334155;
}

/* -----------------------------------------
   THEME 2: MINIMALIST
   ----------------------------------------- */
:root[data-ui-theme="minimalist"] {
  --font: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --c-primary: #0F766E;
  --c-primary-mid: #115E59;
  --c-primary-light: #14B8A6;
  --c-warning: #D97706;
  --r-sm: 10px;
  --r-md: 16px;
  --r-lg: 24px;
}
:root[data-ui-theme="minimalist"][data-theme="light"] {
  --bg-page: #FAFAF9;
  --bg-card: #FFFFFF;
  --bg-sidebar: #0F766E;
  --bg-topbar: #FFFFFF;
  --border: #E7E5E4;
  --txt-primary: #1C1917;
  --bg-hover: #F5F5F4;
}
:root[data-ui-theme="minimalist"][data-theme="dark"] {
  --bg-page: #1C1917;
  --bg-card: #292524;
  --bg-sidebar: #0C0A09;
  --bg-topbar: #292524;
  --border: #44403C;
  --txt-primary: #FAFAF9;
  --bg-hover: #44403C;
}

/* -----------------------------------------
   THEME 3: MONOCHROME
   ----------------------------------------- */
:root[data-ui-theme="monochrome"] {
  --font: 'Figtree', system-ui, sans-serif;
  --font-mono: 'Space Mono', monospace;
  --c-primary: #000000;
  --c-primary-mid: #18181B;
  --c-primary-light: #3F3F46;
  --c-success: #10B981;
  --c-success-mid: #10B981;
  --c-success-bg: #d1fae5;
  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 12px;
}
:root[data-ui-theme="monochrome"][data-theme="light"] {
  --bg-page: #F4F4F5;
  --bg-card: #FFFFFF;
  --bg-sidebar: #000000;
  --bg-topbar: #FFFFFF;
  --border: #E4E4E7;
  --txt-primary: #09090B;
  --bg-hover: #F4F4F5;
}
:root[data-ui-theme="monochrome"][data-theme="dark"] {
  --bg-page: #09090B;
  --bg-card: #18181B;
  --bg-sidebar: #000000;
  --bg-topbar: #18181B;
  --border: #27272A;
  --txt-primary: #FAFAFA;
  --c-primary: #FFFFFF; /* Invert primary buttons in dark mode */
  --c-primary-mid: #E4E4E7;
  --bg-hover: #27272A;
}
:root[data-ui-theme="monochrome"][data-theme="dark"] .btn-primary {
  color: #000000 !important;
}

/* Ensure numbers in tables use the mono font */
table code, .invoice-number, .ledger-amount {
  font-family: var(--font-mono) !important;
}
`;

css += uiThemes;
fs.writeFileSync('css/style.css', css);
console.log('Appended themes to css/style.css');
