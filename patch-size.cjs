const fs = require('fs');
let code = fs.readFileSync('js/script.js', 'utf8');

code = code.replace(
  /const payloadSize = new Blob\(\[JSON\.stringify\(this\._data\)\]\)\.size;/,
  `// EMERGENCY CLEANUP: If any image is huge, strip it to prevent 1MB crash
        if (this._data && this._data.members) {
          this._data.members.forEach(m => {
            ['photo', 'nid_image', 'nominee_photo', 'nominee_nid_image'].forEach(imgKey => {
              if (m[imgKey] && m[imgKey].length > 200000) { // ~150KB base64
                console.warn("Stripping huge legacy image to prevent sync crash:", imgKey, "from member", m.member_id);
                m[imgKey] = null;
              }
            });
          });
        }
        const payloadSize = new Blob([JSON.stringify(this._data)]).size;`
);

fs.writeFileSync('js/script.js', code);
console.log('Patched storage size handler!');
