const fs = require('fs');
let code = fs.readFileSync('js/script.js', 'utf8');

// We will make MemberProfileModule.open async and load images from a separate collection.
// But wait! We need to make sure StorageModule doesn't save images to main_data anymore to free up space.

