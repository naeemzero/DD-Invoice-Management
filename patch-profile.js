const fs = require('fs');
let code = fs.readFileSync('js/script.js', 'utf8');

// 1. Add 'Login as Member' & 'Set Portal Password' to MemberProfileModule.open
code = code.replace(
  /el\('profile-account-badge'\)\.innerHTML=has[^;]+;/,
  `el('profile-account-badge').innerHTML = has
      ? '<span class="portal-badge-active" style="margin-right:8px;"><i class="fas fa-circle-check"></i> Portal Active</span><button class="btn btn-sm btn-outline" onclick="MemberProfileModule.loginAsMember()">Login as Member</button>'
      : '<span class="portal-badge-none" style="margin-right:8px;"><i class="fas fa-circle-minus"></i> No Portal Account</span><button class="btn btn-sm btn-primary" onclick="MemberProfileModule.setupPortal()">Create Portal</button>';
`
);

// Add the new functions to MemberProfileModule
code = code.replace(
  /open\(memberId\){/,
  `loginAsMember() {
    MemberPortalModule.init({ member_id: this._id, name: el('profile-display-name').textContent });
    UIModule.closeModal('member-profile-modal');
    el('sidebar').style.display='none';
    document.querySelector('.main-wrapper').style.display='none';
    el('member-portal').style.display='flex';
  },
  async setupPortal() {
    const pwd = prompt('Enter a new password for this member (min 6 chars):');
    if (!pwd) return;
    if (pwd.length < 6) { UIModule.toast('Password too short','error'); return; }
    const res = await MemberPortalAuth.createAccount(this._id, pwd);
    if (res.ok) {
      UIModule.toast('Portal created!', 'success');
      this.open(this._id);
      MemberModule.renderTable();
    } else {
      UIModule.toast(res.msg, 'error');
    }
  },
  open(memberId){`
);

// 2. Ensure images are explicitly preserved in save()
code = code.replace(
  /nominee_nid_number:el\('pf-nominee-nid'\)\.value\.trim\(\),/,
  `nominee_nid_number:el('pf-nominee-nid').value.trim(),
      photo: ex.photo || null,
      nid_image: ex.nid_image || null,
      nominee_photo: ex.nominee_photo || null,
      nominee_nid_image: ex.nominee_nid_image || null,`
);

// Write back
fs.writeFileSync('js/script.js', code);
console.log('Patched profile module!');
