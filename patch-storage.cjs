const fs = require('fs');
let code = fs.readFileSync('js/script.js', 'utf8');

code = code.replace(
  /await setDoc\(ref, this\._data\);/,
  `// Measure size
        const payloadSize = new Blob([JSON.stringify(this._data)]).size;
        if (payloadSize > 800000) {
          console.warn("Payload size is getting dangerously large:", payloadSize);
        }
        await setDoc(ref, this._data);`
);

fs.writeFileSync('js/script.js', code);
console.log('Patched StorageModule!');
