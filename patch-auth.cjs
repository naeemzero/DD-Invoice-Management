const fs = require('fs');
let code = fs.readFileSync('js/script.js', 'utf8');

// 1. Fix AuthModule.verify to register the admin account if missing
code = code.replace(
  /async verify\(pwd\)\{\s*try \{\s*if \(window\.firebaseAuth && window\.auth\) \{\s*const adminEmail = "admin@dd\.com";\s*await window\.firebaseAuth\.signInWithEmailAndPassword\(window\.auth, adminEmail, pwd\);\s*return true;\s*\}\s*\} catch \(error\) \{\s*console\.warn\("Firebase Admin Auth verification fallback:", error\.message\);\s*\}\s*\/\/ Hardcoded and standard admin password fallback\s*return pwd === '085540' \|\| pwd === 'admin' \|\| pwd === '123456';\s*\}/,
  `async verify(pwd){
    const adminEmail = "admin@dd.com";
    if (window.firebaseAuth && window.auth) {
      try {
        await window.firebaseAuth.signInWithEmailAndPassword(window.auth, adminEmail, pwd);
        return true;
      } catch (error) {
        console.warn("Firebase Admin Auth login failed:", error.message);
        if (pwd === '085540' || pwd === 'admin' || pwd === '123456') {
          try {
            await window.firebaseAuth.createUserWithEmailAndPassword(window.auth, adminEmail, pwd);
            console.log("Admin account created automatically in Firebase!");
            return true;
          } catch (createErr) {
            console.warn("Could not create admin account:", createErr.message);
          }
        }
      }
    }
    return pwd === '085540' || pwd === 'admin' || pwd === '123456';
  }`
);

// 2. Change 5MB limit to 1MB limit for uploads
code = code.replace(/5\*1024\*1024/g, '1*1024*1024');
code = code.replace(/Max 5MB/g, 'Max 1MB');

fs.writeFileSync('js/script.js', code);
console.log('Patched script.js!');
