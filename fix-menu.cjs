const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf8');

css = css.replace(/\.menu-btn\s*\{[\s\S]*?\}/, '.menu-btn { display: none; background: none; border: none; color: var(--txt-primary); font-size: 1.2rem; cursor: pointer; padding: 8px; margin-right: 12px; }');
css = css.replace(/@media \(max-width: 900px\)\s*\{[\s\S]*?\.menu-btn\s*\{[\s\S]*?\}/, match => match.replace(/\.menu-btn\s*\{[\s\S]*?\}/, '.menu-btn { display: inline-flex !important; }'));

// Let's just make it simple: append the correct rule at the end.
css += `
@media (min-width: 901px) {
  #menu-btn { display: none !important; }
}
@media (max-width: 900px) {
  #menu-btn { display: inline-flex !important; align-items: center; justify-content: center; background: none; border: none; font-size: 1.4rem; color: var(--txt-primary); margin-right: 12px; cursor: pointer; }
  .topbar { padding-left: 12px !important; }
  .page-title { font-size: 1.2rem; }
}
`;
fs.writeFileSync('css/style.css', css);
