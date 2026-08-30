const fs = require('fs');
let js = fs.readFileSync('js/script.js', 'utf8');

// 1. Soft logout for Admin
js = js.replace(/sessionStorage\.removeItem\(this\.SK\);\s*location\.reload\(\);/g, `sessionStorage.removeItem(this.SK);
      el('sidebar').style.display='none';
      document.querySelector('.main-wrapper').style.display='none';
      el('auth-screen').style.display='flex';
      el('auth-screen').style.opacity='1';
      const pwdInp=el('login-pwd'); if(pwdInp){pwdInp.value='';}
`);

// 2. Add _isBooted to App
js = js.replace(/async _bootAdmin\(\)\{/, `_isBooted: false,\n  async _bootAdmin(){
    if(this._isBooted) {
      if(typeof DashboardModule !== 'undefined' && DashboardModule.refresh) DashboardModule.refresh();
      return;
    }
    this._isBooted = true;`);

// 3. Soft logout for Member Portal
js = js.replace(/MemberPortalAuth\.logout\(\);\s*location\.reload\(\);/g, `MemberPortalAuth.logout();
        el('member-portal').style.display='none';
        el('auth-screen').style.display='flex';
        el('auth-screen').style.opacity='1';
        const pwdInp=el('member-login-pwd'); if(pwdInp){pwdInp.value='';}
`);

// 4. Add _isBooted to MemberPortalModule
js = js.replace(/_m:null,\s*_id:null,/, `_m:null, _id:null, _isBooted:false,`);
js = js.replace(/this\._bindNav\(\);\s*this\._bindActions\(\);/, `if(!this._isBooted){ this._bindNav(); this._bindActions(); this._isBooted=true; }`);

fs.writeFileSync('js/script.js', js);
console.log('Logout patched for SPA mode!');
