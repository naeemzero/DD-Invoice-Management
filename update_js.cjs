const fs = require('fs');
let code = fs.readFileSync('js/script.js', 'utf8');

const themeJS = `
  _setupUITheme(){
    const t = localStorage.getItem('dd_ui_theme') || 'fintech';
    this._applyUITheme(t);
    const sel = document.getElementById('ui-theme-selector');
    if (sel) {
      sel.value = t;
      sel.addEventListener('change', (e) => this._applyUITheme(e.target.value));
    }
  },
  _applyUITheme(t){
    document.documentElement.setAttribute('data-ui-theme', t);
    localStorage.setItem('dd_ui_theme', t);
  },
`;

code = code.replace(/_setupTheme\(\)\{/, themeJS + '\n  _setupTheme(){');
code = code.replace(/this\._setupTheme\(\);/, 'this._setupUITheme();\n    this._setupTheme();');

fs.writeFileSync('js/script.js', code);
console.log('Updated script.js');
