const fs = require('fs');

let css = fs.readFileSync('css/style.css', 'utf8');

// 1. UPDATE COLORS
css = css.replace(/:root\s*\{[\s\S]*?(?=\[data-theme="dark"\])/, `:root {
  --font: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Color Palette: Royal Blue, Strawberry, Cyan, Red, Magenta */
  --c-primary:       #2563EB; /* Royal Blue */
  --c-primary-mid:   #1D4ED8;
  --c-primary-light: #3B82F6;
  
  --c-teal:          #D946EF; /* Reusing teal var for Magenta to avoid breaking classes */
  --c-teal-mid:      #C026D3;
  --c-teal-dark:     #A21CAF;
  --c-teal-light:    #FAE8FF;
  --c-teal-bg:       #FDF4FF;
  
  --c-success:       #06B6D4; /* Cyan */
  --c-success-mid:   #0891B2;
  --c-success-bg:    #ECFEFF;
  
  --c-danger:        #EF4444; /* Red */
  --c-danger-mid:    #DC2626;
  --c-danger-bg:     #FEF2F2;
  
  --c-warning:       #E11D48; /* Strawberry (Rose) */
  --c-warning-bg:    #FFF1F2;
  
  --c-info:          #4169E1; /* Prime Blue */
  --c-info-bg:       #EFF6FF;
  
  --bg-page:         #F8FAFC;
  --bg-card:         #FFFFFF;
  --bg-sidebar:      #1E3A8A; /* Deep Royal Blue */
  --bg-topbar:       #FFFFFF;
  --bg-input:        #F1F5F9;
  --bg-thead:        #F1F5F9;
  --bg-hover:        #F1F5F9;
  
  --txt-primary:     #0F172A;
  --txt-secondary:   #475569;
  --txt-muted:       #94A3B8;
  --txt-inv:         #ffffff;
  --border:          #E2E8F0;
  
  --r-sm:            10px;
  --r-md:            16px;
  --r-lg:            24px;
  
  --sidebar-w:       260px;
  --sidebar-collapsed-w: 72px;
  
  --sh-xs: 0 1px 3px rgba(37, 99, 235, .06);
  --sh-sm: 0 2px 8px rgba(37, 99, 235, .08);
  --sh-md: 0 4px 16px rgba(37, 99, 235, .10);
  --sh-lg: 0 8px 32px rgba(37, 99, 235, .14);
  --sh-xl: 0 20px 48px rgba(0, 0, 0, .18);
  
  --t-base: 0.2s ease;
  --t-bounce: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
`);

css = css.replace(/\[data-theme="dark"\]\s*\{[\s\S]*?(?=\/\*\s*─── RESET)/, `[data-theme="dark"] {
  --bg-page:     #0B1120;
  --bg-card:     #1E293B;
  --bg-sidebar:  #0F172A;
  --bg-topbar:   #1E293B;
  --bg-input:    #334155;
  --bg-thead:    #334155;
  --bg-hover:    #334155;
  
  --txt-primary: #F8FAFC;
  --txt-secondary:#CBD5E1;
  --txt-muted:   #64748B;
  --border:      #334155;
}
`);

// 2. DESKTOP SIDEBAR LOGIC (Remove hide rules, add collapse rules)
// First remove the old @media hiding #menu-btn on desktop
css = css.replace(/@media \(min-width: 901px\)\s*\{\s*#menu-btn\s*\{\s*display:\s*none\s*!important;\s*\}\s*\}/g, '');

// Append new desktop rules
css += `
/* --- LAPTOP / DESKTOP SIDEBAR COLLAPSE --- */
@media (min-width: 901px) {
  #menu-btn {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    font-size: 1.3rem;
    color: var(--txt-primary);
    margin-right: 16px;
    cursor: pointer;
  }
  
  body.sidebar-collapsed .sidebar {
    width: var(--sidebar-collapsed-w);
  }
  
  body.sidebar-collapsed .main-wrapper {
    margin-left: var(--sidebar-collapsed-w);
  }
  
  body.sidebar-collapsed .org-info,
  body.sidebar-collapsed .sidebar-close-btn,
  body.sidebar-collapsed .nav-link span,
  body.sidebar-collapsed .theme-toggle-btn span,
  body.sidebar-collapsed .logout-btn span {
    display: none;
  }
  
  body.sidebar-collapsed .nav-link {
    justify-content: center;
    padding: 12px;
  }
  body.sidebar-collapsed .nav-link i {
    font-size: 1.1rem;
    margin: 0;
  }
  body.sidebar-collapsed .sidebar-header {
    justify-content: center;
    padding: 16px 0;
  }
  body.sidebar-collapsed .theme-toggle-btn,
  body.sidebar-collapsed .logout-btn {
    justify-content: center;
    padding: 12px;
  }
  body.sidebar-collapsed .theme-toggle-btn i,
  body.sidebar-collapsed .logout-btn i {
    margin: 0;
    font-size: 1.1rem;
  }
}
`;

fs.writeFileSync('css/style.css', css);
console.log('Patched CSS for colors and laptop sidebar!');

// 3. UPDATE HTML ICON (Hamburger to 3-dots)
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<i class="fas fa-bars"><\/i>/g, '<i class="fas fa-ellipsis-v"></i>');
// Add member portal menu button if it doesn't have one? Wait, member portal doesn't have a sidebar, it has top nav. But let's check if there is a menu btn.
fs.writeFileSync('index.html', html);
console.log('Patched HTML icon!');

// 4. UPDATE JS (Toggle Logic)
let js = fs.readFileSync('js/script.js', 'utf8');
js = js.replace(/openSidebar\(\)\{el\('sidebar'\)\.classList\.add\('open'\);el\('sidebar-overlay'\)\?\.classList\.add\('active'\);document\.body\.style\.overflow='hidden';\}/, `openSidebar(){
    if(window.innerWidth <= 900) {
      el('sidebar').classList.add('open');
      el('sidebar-overlay')?.classList.add('active');
      document.body.style.overflow='hidden';
    } else {
      document.body.classList.toggle('sidebar-collapsed');
    }
  }`);
fs.writeFileSync('js/script.js', js);
console.log('Patched JS logic!');
