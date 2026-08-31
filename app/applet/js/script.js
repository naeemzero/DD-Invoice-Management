import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ════════════════════════════════════════
// INIT & GLOBALS
// ════════════════════════════════════════
let db, auth, storage;
let currentUser = null; // null if logged out, {uid, role:'admin'|'member', data}
let cachedOrg = {};
let cachedMembers = [];

async function fetchConfigAndInit() {
  try {
    const res = await fetch('/api/firebase-config');
    const cfg = await res.json();
    const app = initializeApp(cfg);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    setupAuthListener();
  } catch (err) {
    console.error("Firebase init failed:", err);
    showToast("System offline. Please check connection.", "error");
  }
}

// ════════════════════════════════════════
// DOM ELEMENTS
// ════════════════════════════════════════
const el = id => document.getElementById(id);
const q = sel => document.querySelector(sel);
const qAll = sel => document.querySelectorAll(sel);

// Screens
const authScreen = el('auth-screen');
const mainWrapper = q('.main-wrapper'); // Admin
const memberPortal = el('member-portal'); // Member

// Views (Admin)
const views = {
  dashboard: el('dashboard-view'),
  invoice: el('invoice-view'),
  history: el('history-view'),
  ledger: el('ledger-view'),
  members: el('members-view'),
  costs: el('costs-view'),
  settings: el('settings-view')
};
const navLinks = qAll('.nav-link');

// Sidebar
const sidebar = el('sidebar');
const sidebarOverlay = el('sidebar-overlay');
const menuBtn = el('menu-btn');
const closeBtn = el('sidebar-close-btn');

// ════════════════════════════════════════
// UTILS
// ════════════════════════════════════════
const fmtMoney = amt => '৳' + Number(amt).toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:2});
const fmtDate = (ds, withTime=false) => {
  if(!ds) return '—';
  const d = new Date(ds);
  const opts = { day:'numeric', month:'short', year:'numeric' };
  if(withTime){ opts.hour='2-digit'; opts.minute='2-digit'; }
  return d.toLocaleDateString('en-GB', opts);
};
const unformatAmt = str => Number(str.replace(/[^0-9.-]+/g,""));
function showToast(msg, type='success') {
  const c = el('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'circle-exclamation'}"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, 3000);
}

// Ensure theme toggle works correctly
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('dd_theme', isDark ? 'light' : 'dark');
}
const savedTheme = localStorage.getItem('dd_theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.setAttribute('data-theme', 'dark');
}
el('theme-toggle')?.addEventListener('click', toggleTheme);
el('topbar-theme-btn')?.addEventListener('click', toggleTheme);
el('mp-theme-btn')?.addEventListener('click', toggleTheme);

// Password reveal
qAll('.pwd-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = el(btn.dataset.for);
    if(inp.type === 'password'){ inp.type = 'text'; btn.innerHTML = '<i class="fas fa-eye-slash"></i>'; }
    else{ inp.type = 'password'; btn.innerHTML = '<i class="fas fa-eye"></i>'; }
  });
});

// Close modals
qAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => { el(btn.dataset.close).classList.add('hidden'); });
});

// Admin Navigation
navLinks.forEach(l => {
  l.addEventListener('click', e => {
    e.preventDefault();
    navLinks.forEach(n => n.classList.remove('active'));
    l.classList.add('active');
    Object.values(views).forEach(v => v.classList.remove('active'));
    const target = l.dataset.view;
    views[target].classList.add('active');
    el('page-title').textContent = l.querySelector('span').textContent;
    if(window.innerWidth <= 768) closeSidebar();
    
    // Refresh logic per view
    if(target === 'dashboard') loadDashboard();
    if(target === 'invoice') resetInvoiceForm();
    if(target === 'history') loadHistory();
    if(target === 'ledger') loadLedger();
    if(target === 'costs') loadCosts();
  });
});
qAll('.topbar-actions [data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    q(`.nav-link[data-view="${btn.dataset.view}"]`).click();
  });
});

function openSidebar(){ sidebar.classList.add('open'); sidebarOverlay.style.display='block'; setTimeout(()=>sidebarOverlay.style.opacity='1',10); }
function closeSidebar(){ sidebar.classList.remove('open'); sidebarOverlay.style.opacity='0'; setTimeout(()=>sidebarOverlay.style.display='none',300); }
menuBtn?.addEventListener('click', openSidebar);
closeBtn?.addEventListener('click', closeSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

// Member Portal Navigation
qAll('.mp-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    qAll('.mp-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qAll('.mp-view').forEach(v => v.classList.remove('active'));
    el(btn.dataset.mpView).classList.add('active');
  });
});

// CI Tabs
qAll('.ci-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    qAll('.ci-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qAll('.ci-panel').forEach(p => p.classList.remove('active'));
    el('ci-' + btn.dataset.citab).classList.add('active');
  });
});
// Profile Tabs
qAll('.profile-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    qAll('.profile-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qAll('.profile-tab-content').forEach(p => p.classList.remove('active'));
    el('ptab-' + btn.dataset.ptab).classList.add('active');
  });
});
// Auth Tabs
qAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    qAll('.auth-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qAll('.auth-tab-panel').forEach(p => p.classList.add('hidden'));
    el('auth-panel-' + btn.dataset.authtab).classList.remove('hidden');
  });
});

// ════════════════════════════════════════
// AUTH FLOW
// ════════════════════════════════════════
async function setupAuthListener() {
  onAuthStateChanged(auth, async user => {
    if (user) {
      // Check if admin or member
      try {
        const adminDoc = await getDoc(doc(db, 'settings', 'admin'));
        if (adminDoc.exists() && adminDoc.data().email === user.email) {
          currentUser = { uid: user.uid, role: 'admin', data: adminDoc.data() };
          await showAdminView();
        } else {
          // Check members
          const mSnap = await getDocs(query(collection(db, 'members'), where('auth_uid', '==', user.uid)));
          if (!mSnap.empty) {
            currentUser = { uid: user.uid, role: 'member', data: { id: mSnap.docs[0].id, ...mSnap.docs[0].data() } };
            // Update last login
            await updateDoc(doc(db, 'members', currentUser.data.id), { last_login: new Date().toISOString() });
            await showMemberView();
          } else {
            throw new Error("No profile found for this account.");
          }
        }
      } catch (err) {
        console.error("Auth routing error:", err);
        auth.signOut();
        showLoginView();
      }
    } else {
      currentUser = null;
      showLoginView();
    }
  });
}

async function showLoginView() {
  authScreen.classList.remove('hidden');
  mainWrapper.style.display = 'none';
  memberPortal.style.display = 'none';
  
  // Load org basic settings for branding on login screen
  try {
    const orgDoc = await getDoc(doc(db, 'settings', 'org'));
    if (orgDoc.exists()) {
      const org = orgDoc.data();
      cachedOrg = org;
      el('auth-org-name').textContent = org.name || 'Dream Development DD';
      el('auth-logo-text').style.display = org.logo_url ? 'none' : 'block';
      el('auth-logo-img').style.display = org.logo_url ? 'block' : 'none';
      if(org.logo_url) el('auth-logo-img').src = org.logo_url;
    }
    
    // Check if admin exists (bootstrap needed?)
    const adminDoc = await getDoc(doc(db, 'settings', 'admin'));
    if (!adminDoc.exists()) {
      el('admin-bootstrap-panel').classList.remove('hidden');
      el('normal-auth-panel').classList.add('hidden');
    } else {
      el('admin-bootstrap-panel').classList.add('hidden');
      el('normal-auth-panel').classList.remove('hidden');
    }
  } catch (err) {
    console.error("Login view setup error:", err);
    // If we fail here (e.g. firestore rules block read without auth), fallback
    el('admin-bootstrap-panel').classList.add('hidden');
    el('normal-auth-panel').classList.remove('hidden');
  }
}

// ════════════════════════════════════════
// ADMIN BOOTSTRAP (FIRST RUN)
// ════════════════════════════════════════
el('bootstrap-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const email = el('bootstrap-email').value.trim();
  const pwd = el('bootstrap-pwd').value;
  const pwd2 = el('bootstrap-pwd2').value;
  const err = el('bootstrap-err');
  const btn = el('bootstrap-submit-btn');
  
  if(!email || pwd.length < 6) { err.textContent = "Valid email & min 6 char password required."; err.classList.remove('hidden'); return; }
  if(pwd !== pwd2) { err.textContent = "Passwords do not match."; err.classList.remove('hidden'); return; }
  
  err.classList.add('hidden');
  const ogHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
  btn.disabled = true;
  
  try {
    // Note: This only works if Firestore rules allow creating the admin doc 
    // when it doesn't exist, OR if we proxy this through a Cloud Function.
    // Given the strict rules provided, we must rely on the Firebase Auth creation.
    // *Wait*, the provided firestore.rules requires admin claim.
    // If the rule strictly requires request.auth.token.admin == true, client-side bootstrap will fail.
    // For this prototype, we'll assume the environment allows the *first* admin creation,
    // or that it's pre-created by the user. If they provided strict rules that block this,
    // we will catch the error and advise.
    const userCred = await createUserWithEmailAndPassword(auth, email, pwd);
    await setDoc(doc(db, 'settings', 'admin'), { email: email });
    showToast("Admin account created successfully.");
  } catch(error) {
    console.error("Bootstrap error:", error);
    err.textContent = "Setup failed. Check database permissions or try again. " + error.message;
    err.classList.remove('hidden');
    if(auth.currentUser) auth.signOut();
  } finally {
    btn.innerHTML = ogHtml;
    btn.disabled = false;
  }
});

// ════════════════════════════════════════
// LOGIN LOGIC
// ════════════════════════════════════════
el('admin-login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const email = el('admin-email-input').value.trim();
  const pwd = el('admin-pwd-input').value;
  const err = el('admin-login-err');
  const btn = el('admin-login-btn');
  if(!email || !pwd) return;
  
  err.classList.add('hidden');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
  } catch(error) {
    err.textContent = "Invalid email or password.";
    err.classList.remove('hidden');
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';
  }
});

el('member-login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const memId = el('member-id-input').value.trim().toUpperCase();
  const pwd = el('member-pwd-input').value;
  const err = el('member-login-err');
  const btn = el('member-login-btn');
  if(!memId || !pwd) return;
  
  err.classList.add('hidden');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    // 1. Find member doc to get their email
    const mDoc = await getDoc(doc(db, 'members', memId));
    if(!mDoc.exists() || !mDoc.data().auth_email) {
      throw new Error("Member account not set up yet. Create account first.");
    }
    // 2. Sign in with the mapped email
    await signInWithEmailAndPassword(auth, mDoc.data().auth_email, pwd);
  } catch(error) {
    err.textContent = error.message.includes("not set up") ? error.message : "Invalid Member ID or password.";
    err.classList.remove('hidden');
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Member Sign In';
  }
});

el('logout-btn')?.addEventListener('click', () => auth.signOut());
el('mp-logout-btn')?.addEventListener('click', () => auth.signOut());

// ════════════════════════════════════════
// JOIN REQUEST (PUBLIC)
// ════════════════════════════════════════
el('open-join-request-btn')?.addEventListener('click', () => {
  el('join-request-form').reset();
  qAll('.doc-upload-zone img').forEach(img => { img.src=''; img.style.display='none'; });
  el('join-request-success').classList.add('hidden');
  el('join-request-modal').classList.remove('hidden');
});

async function uploadFile(file, path) {
  if(!file) return null;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

el('join-request-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = el('join-request-submit-btn');
  const err = el('join-request-err');
  err.classList.add('hidden');
  
  const name = el('jr-name').value.trim();
  const mobile = el('jr-mobile').value.trim();
  if(!name || !mobile) { err.textContent = "Name and Mobile are required."; err.classList.remove('hidden'); return; }
  
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  
  try {
    const ts = Date.now();
    const reqId = 'req_' + ts;
    const getF = id => el(id).files[0];
    
    // Upload files (unauthenticated users can write to /join_requests/ via rules)
    const photoUrl = await uploadFile(getF('jr-photo-input'), `join_requests/${reqId}_photo`);
    const sigUrl = await uploadFile(getF('jr-signature-input'), `join_requests/${reqId}_sig`);
    const nidFUrl = await uploadFile(getF('jr-nidfront-input'), `join_requests/${reqId}_nidF`);
    const nidBUrl = await uploadFile(getF('jr-nidback-input'), `join_requests/${reqId}_nidB`);
    const nPhotoUrl = await uploadFile(getF('jr-nominee-photo-input'), `join_requests/${reqId}_nPhoto`);
    const nNidFUrl = await uploadFile(getF('jr-nominee-nidfront-input'), `join_requests/${reqId}_nNidF`);
    const nNidBUrl = await uploadFile(getF('jr-nominee-nidback-input'), `join_requests/${reqId}_nNidB`);
    
    const data = {
      name, mobile,
      father_name: el('jr-father').value.trim(),
      mother_name: el('jr-mother').value.trim(),
      birthdate: el('jr-birthdate').value,
      blood_group: el('jr-blood').value,
      nid: el('jr-nid').value.trim(),
      present_address: el('jr-present-addr').value.trim(),
      permanent_address: el('jr-permanent-addr').value.trim(),
      photo_url: photoUrl,
      signature_url: sigUrl,
      nid_front_url: nidFUrl,
      nid_back_url: nidBUrl,
      nominee: {
        name: el('jr-nominee-name').value.trim(),
        relation: el('jr-nominee-relation').value,
        nid: el('jr-nominee-nid').value.trim(),
        photo_url: nPhotoUrl,
        nid_front_url: nNidFUrl,
        nid_back_url: nNidBUrl
      },
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'join_requests', reqId), data);
    el('join-request-form').reset();
    el('join-request-success').classList.remove('hidden');
    setTimeout(() => { el('join-request-modal').classList.add('hidden'); }, 4000);
  } catch(error) {
    console.error(error);
    err.textContent = "Failed to submit: " + error.message;
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application';
  }
});

// Image previews for JR form
['jr-photo','jr-signature','jr-nidfront','jr-nidback','jr-nominee-photo','jr-nominee-nidfront','jr-nominee-nidback'].forEach(id => {
  el(`${id}-input`)?.addEventListener('change', e => {
    const f = e.target.files[0];
    if(f){
      el(`${id}-preview`).src = URL.createObjectURL(f);
      el(`${id}-preview`).style.display = 'block';
      el(`${id}-ph`).style.display = 'none';
    }
  });
});

// ════════════════════════════════════════
// MEMBER ACCOUNT CREATION
// ════════════════════════════════════════
el('create-account-link')?.addEventListener('click', () => {
  el('member-setup-modal').classList.remove('hidden');
  el('setup-member-id').value = '';
  el('setup-member-pwd').value = '';
  el('setup-member-pwd2').value = '';
  el('member-setup-error').classList.add('hidden');
});

el('create-account-btn')?.addEventListener('click', async () => {
  const mId = el('setup-member-id').value.trim().toUpperCase();
  const pwd = el('setup-member-pwd').value;
  const pwd2 = el('setup-member-pwd2').value;
  const err = el('member-setup-error');
  const btn = el('create-account-btn');
  
  if(!mId || pwd.length < 6) { err.textContent = "Member ID and min 6 char password required."; err.classList.remove('hidden'); return; }
  if(pwd !== pwd2) { err.textContent = "Passwords do not match."; err.classList.remove('hidden'); return; }
  
  err.classList.add('hidden');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
  btn.disabled = true;
  
  try {
    // 1. Admin must have created the member doc first.
    // Unauthenticated reads might be blocked, so we use a cloud function or rely on
    // an 'allow read' rule for public basic member info if creating accounts.
    // For this implementation, we map Member ID to a synthetic email: <id>@dd.org
    const syntheticEmail = `${mId.toLowerCase()}@member.dd.org`;
    
    // Create Auth User
    const userCred = await createUserWithEmailAndPassword(auth, syntheticEmail, pwd);
    
    // The member doc MUST already exist (admin created it). We update it with auth_uid.
    // *CRITICAL*: The provided security rules say members can only update their OWN doc.
    // But they aren't linked yet. This requires the admin to create the auth account, OR
    // we use a system where the new user can claim the doc.
    // To comply with standard Firebase without backend, we'll try to update the doc now that we are auth'd.
    // The rule allows update if request.auth.uid == resource.data.auth_uid.
    // If it's not set, they can't claim it securely from client.
    // WORKAROUND for prototype: We set it. If it fails due to rules, we alert.
    
    try {
      await updateDoc(doc(db, 'members', mId), { 
        auth_uid: userCred.user.uid,
        auth_email: syntheticEmail
      });
      showToast("Account created! Logging in...");
      el('member-setup-modal').classList.add('hidden');
    } catch(dbErr) {
      // If rules block claiming, we must delete the auth account we just made to prevent orphans
      await userCred.user.delete();
      throw new Error("Admin has not added this Member ID yet, or it is already claimed.");
    }
    
  } catch(error) {
    console.error(error);
    err.textContent = error.message.includes("email-already-in-use") 
      ? "Account already exists for this ID." 
      : error.message;
    err.classList.remove('hidden');
    auth.signOut();
  } finally {
    btn.innerHTML = '<i class="fas fa-check"></i> Create Account';
    btn.disabled = false;
  }
});

// ════════════════════════════════════════
// ADMIN VIEW
// ════════════════════════════════════════
async function showAdminView() {
  authScreen.classList.add('hidden');
  memberPortal.style.display = 'none';
  mainWrapper.style.display = 'flex';
  el('s-admin-email-display').textContent = currentUser.data.email;
  
  await loadOrgSettings();
  await loadDashboard();
  loadMembersData(); // Preload members for select
}

async function loadOrgSettings() {
  const sSnap = await getDoc(doc(db, 'settings', 'org'));
  if(sSnap.exists()){
    cachedOrg = sSnap.data();
    el('sidebar-org-name').textContent = cachedOrg.name || 'Dream Development';
    el('sidebar-initials').style.display = cachedOrg.logo_url ? 'none' : 'block';
    el('sidebar-logo').style.display = cachedOrg.logo_url ? 'block' : 'none';
    if(cachedOrg.logo_url) el('sidebar-logo').src = cachedOrg.logo_url;
    
    // Populate settings form
    el('s-org-name').value = cachedOrg.name || '';
    el('s-org-subtitle').value = cachedOrg.subtitle || '';
    el('s-org-address').value = cachedOrg.address || '';
    el('s-org-phone').value = cachedOrg.phone || '';
    el('s-org-email').value = cachedOrg.email || '';
    el('s-org-facebook').value = cachedOrg.facebook || '';
    el('s-footer-text').value = cachedOrg.footer_text || '';
    if(cachedOrg.logo_url){ el('logo-preview-img').src=cachedOrg.logo_url; el('logo-preview-img').style.display='block'; el('logo-ph').style.display='none'; el('remove-logo-btn').style.display='inline-block';}
    if(cachedOrg.seal_url){ el('seal-preview-img').src=cachedOrg.seal_url; el('seal-preview-img').style.display='block'; el('seal-ph').style.display='none'; el('remove-seal-btn').style.display='inline-block';}
  }
  
  const invSnap = await getDoc(doc(db, 'settings', 'invoice'));
  if(invSnap.exists()){
    const d = invSnap.data();
    el('s-inv-prefix').value = d.prefix || '';
    el('s-inv-number').value = d.next_number || 1;
    el('s-treasurer-name').value = d.treasurer_name || '';
    if(d.treasurer_sig_url){ el('treasurer-sig-preview').src=d.treasurer_sig_url; el('treasurer-sig-preview').style.display='block'; el('treasurer-sig-ph').style.display='none'; el('remove-treasurer-sig-btn').style.display='inline-block';}
    if(d.auth_sig_url){ el('sig-preview-img').src=d.auth_sig_url; el('sig-preview-img').style.display='block'; el('sig-ph').style.display='none'; el('remove-sig-btn').style.display='inline-block';}
  }
  
  const cSnap = await getDoc(doc(db, 'settings', 'contact'));
  if(cSnap.exists()){
    const d = cSnap.data();
    el('s-admin-display-name').value = d.admin_name || '';
    el('s-admin-display-role').value = d.admin_role || '';
    if(d.treasurer_photo_url){ el('treasurer-photo-preview-img').src=d.treasurer_photo_url; el('treasurer-photo-preview-img').style.display='block'; el('treasurer-photo-ph').style.display='none';}
    if(d.admin_photo_url){ el('admin-photo-preview-img').src=d.admin_photo_url; el('admin-photo-preview-img').style.display='block'; el('admin-photo-ph').style.display='none';}
  }
  
  const fSnap = await getDoc(doc(db, 'settings', 'fund'));
  if(fSnap.exists()){ el('s-opening-fund').value = fSnap.data().opening_balance || 0; }
  
  loadReceivers();
}

async function loadMembersData() {
  const snap = await getDocs(collection(db, 'members'));
  cachedMembers = [];
  snap.forEach(d => cachedMembers.push({id: d.id, ...d.data()}));
  
  // Update invoice select options
  const list = el('select-options');
  if(!list) return;
  list.innerHTML = '';
  cachedMembers.filter(m => m.status !== 'left').forEach(m => {
    const div = document.createElement('div');
    div.className = 'select-option';
    div.innerHTML = `<span>${m.name}</span><span class="opt-id">${m.id}</span>`;
    div.addEventListener('click', () => selectMemberForInvoice(m));
    list.appendChild(div);
  });
  
  if(views.members.classList.contains('active')) renderMembersTable();
}

// ════════════════════════════════════════
// ADMIN: DASHBOARD
// ════════════════════════════════════════
async function loadDashboard() {
  let fundSnap;
  try { fundSnap = await getDoc(doc(db, 'settings', 'fund')); } catch(e){}
  const openingFund = fundSnap && fundSnap.exists() ? (Number(fundSnap.data().opening_balance)||0) : 0;
  
  const members = cachedMembers.length ? cachedMembers : (await getDocs(collection(db, 'members'))).docs.map(d=>({id:d.id,...d.data()}));
  const invoices = (await getDocs(query(collection(db, 'invoices'), orderBy('created_at', 'desc')))).docs.map(d=>({id:d.id,...d.data()}));
  const costs = (await getDocs(collection(db, 'costs'))).docs.map(d=>({id:d.id,...d.data()}));
  const investments = (await getDocs(collection(db, 'investments'))).docs.map(d=>({id:d.id,...d.data()}));
  const fines = (await getDocs(collection(db, 'fines'))).docs.map(d=>({id:d.id,...d.data()}));
  
  let totalContrib = 0, thisMonth = 0;
  let advanceHeld = 0, dueOutstanding = 0;
  
  const now = new Date();
  const cmM = now.getMonth(), cmY = now.getFullYear();
  
  invoices.forEach(inv => {
    totalContrib += Number(inv.amount || 0);
    const idt = new Date(inv.date || inv.created_at);
    if(idt.getMonth()===cmM && idt.getFullYear()===cmY) thisMonth += Number(inv.amount||0);
  });
  
  // Calculate due/advance per member
  let paidCount=0, dueCount=0, advCount=0;
  members.filter(m=>m.status!=='left').forEach(m => {
    const st = calculateMemberStatus(m);
    if(st.type === 'due') { dueOutstanding += st.amt; dueCount++; }
    if(st.type === 'advance') { advanceHeld += st.amt; advCount++; }
    if(st.type === 'paid') paidCount++;
  });
  
  // Fund calculation
  const totalFineIncome = fines.reduce((sum,f) => sum + (f.status==='paid'?Number(f.amount||0):0), 0);
  const totalCost = costs.reduce((sum,c) => sum + Number(c.amount||0), 0);
  
  // Fixed costs (Income = recovered, Cost = total campaign size)
  const fcSnap = await getDocs(collection(db, 'fixed_costs'));
  let totalFcRecovered = 0, totalFcCost = 0;
  fcSnap.forEach(d => {
    totalFcCost += Number(d.data().total_amount||0);
    totalFcRecovered += Object.values(d.data().payments||{}).reduce((sum,v)=>sum+Number(v),0);
  });
  
  // Investments
  let activeInvested = 0, investProfit = 0;
  investments.forEach(inv => {
    const prin = Number(inv.amount||0);
    const withD = (inv.withdrawals||[]).reduce((sum,w)=>sum+Number(w.amount||0),0);
    const prof = (inv.profits||[]).reduce((sum,p)=>sum+Number(p.amount||0),0);
    activeInvested += (prin - withD);
    investProfit += prof;
  });
  
  const currentFund = openingFund + totalContrib + totalFineIncome + totalFcRecovered + investProfit - totalCost - totalFcCost - activeInvested;
  const netWorth = currentFund + activeInvested;
  
  el('stat-fund-balance').textContent = fmtMoney(currentFund);
  el('stat-total-collected').textContent = fmtMoney(totalContrib + openingFund);
  el('stat-this-month').textContent = fmtMoney(thisMonth);
  
  el('stat-income-contrib').textContent = fmtMoney(totalContrib);
  el('stat-income-fine').textContent = fmtMoney(totalFineIncome);
  el('stat-income-fixedcost').textContent = fmtMoney(totalFcRecovered);
  el('stat-income-invest').textContent = fmtMoney(investProfit);
  
  el('stat-cost-op').textContent = fmtMoney(totalCost);
  el('stat-cost-fixed').textContent = fmtMoney(totalFcCost);
  el('stat-invested-active').textContent = fmtMoney(activeInvested);
  el('stat-networth').textContent = fmtMoney(netWorth);
  
  el('stat-total-members').textContent = members.filter(m=>m.status!=='left').length;
  el('stat-paid-members').textContent = paidCount;
  el('stat-due-members').textContent = dueCount;
  el('stat-advance-members').textContent = advCount;
  
  el('stat-total-invoices').textContent = invoices.length;
  el('stat-total-due').textContent = fmtMoney(dueOutstanding);
  el('stat-total-advance').textContent = fmtMoney(advanceHeld);
  
  // Recent 5 tx
  const tb = el('recent-invoices-body');
  tb.innerHTML = '';
  invoices.slice(0,5).forEach(inv => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge bg-success">IN</span></td>
      <td><strong>${inv.member_name}</strong><br><small class="text-muted">${inv.invoice_number}</small></td>
      <td style="font-weight:600;color:var(--c-teal)">+${fmtMoney(inv.amount)}</td>
      <td>${fmtDate(inv.date)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="viewInvoice('${inv.id}')">View</button></td>
    `;
    tb.appendChild(tr);
  });
  if(invoices.length===0) tb.innerHTML = '<tr><td colspan="5" class="empty-state">No transactions yet.</td></tr>';
}

function calculateMemberStatus(m) {
  if(!m.ledger_base_month || !m.ledger_base_year) return { type: 'unknown', text: 'Not Recorded', amt: 0 };
  
  const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const bMIdx = mNames.indexOf(m.ledger_base_month);
  if(bMIdx === -1) return { type: 'unknown', text: 'Invalid Base', amt: 0 };
  
  const bY = Number(m.ledger_base_year);
  
  // The member is paid THROUGH bMIdx, bY.
  // Compare to CURRENT month/year.
  const now = new Date();
  const cMIdx = now.getMonth();
  const cY = now.getFullYear();
  
  const baseTotalMonths = (bY * 12) + bMIdx;
  const currentTotalMonths = (cY * 12) + cMIdx;
  const diff = currentTotalMonths - baseTotalMonths;
  
  const rate = Number(m.monthly_amount || 0);
  
  if (diff === 0) return { type: 'paid', text: 'Paid', amt: 0 };
  if (diff > 0) return { type: 'due', text: `${diff} mo Due`, amt: diff * rate };
  if (diff < 0) return { type: 'advance', text: `${Math.abs(diff)} mo Adv`, amt: Math.abs(diff) * rate };
}

// ════════════════════════════════════════
// ADMIN: INVOICE GENERATION
// ════════════════════════════════════════
const selTrigger = el('select-trigger');
const selDrop = el('select-dropdown');
const selSearch = el('member-search-input');
let selectedMember = null;

selTrigger?.addEventListener('click', () => { selDrop.classList.toggle('hidden'); selSearch.focus(); });
document.addEventListener('click', e => { if(selTrigger && !selTrigger.contains(e.target) && !selDrop.contains(e.target)) selDrop.classList.add('hidden'); });

selSearch?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  qAll('.select-option').forEach(opt => {
    const text = opt.textContent.toLowerCase();
    opt.style.display = text.includes(q) ? 'flex' : 'none';
  });
});

async function selectMemberForInvoice(m) {
  selectedMember = m;
  el('select-display').textContent = `${m.name} (${m.id})`;
  el('select-display').style.color = 'var(--text-main)';
  selDrop.classList.add('hidden');
  
  el('member-pills').classList.remove('hidden');
  el('pill-id').textContent = m.id;
  el('pill-mobile').textContent = m.mobile || '—';
  el('pill-opening').textContent = fmtMoney(m.opening_balance||0);
  el('pill-rate').textContent = fmtMoney(m.monthly_amount||0);
  
  const st = calculateMemberStatus(m);
  const sw = el('auto-status-wrap');
  const sb = el('auto-status-box');
  if(st.type !== 'paid' && st.type !== 'unknown'){
    sw.classList.remove('hidden');
    sb.className = `auto-status-box ${st.type}`;
    sb.innerHTML = `<i class="fas fa-${st.type==='due'?'circle-exclamation':'circle-arrow-up'}"></i> Currently ${st.text} (${fmtMoney(st.amt)})`;
  } else {
    sw.classList.add('hidden');
  }
  
  el('amount-paid').value = st.type === 'due' ? st.amt : m.monthly_amount;
  
  // Check Fines and Fixed Costs
  const exWrap = el('extra-charges-wrap');
  exWrap.innerHTML = '';
  exWrap.classList.add('hidden');
  
  // Get unpaid fines
  const fSnap = await getDocs(query(collection(db, 'fines'), where('member_id','==',m.id), where('status','==','unpaid')));
  fSnap.forEach(doc => {
    exWrap.classList.remove('hidden');
    const d = doc.data();
    exWrap.innerHTML += `<div class="charge-row"><label><input type="checkbox" class="extra-charge-cb" data-type="fine" data-id="${doc.id}" data-amt="${d.amount}" data-desc="Fine: ${d.reason}"/> Add Fine: ${d.reason}</label><strong>${fmtMoney(d.amount)}</strong></div>`;
  });
  
  // Get unpaid fixed costs
  const fcSnap = await getDocs(collection(db, 'fixed_costs'));
  fcSnap.forEach(doc => {
    const d = doc.data();
    if(!d.payments || !d.payments[m.id]) {
       exWrap.classList.remove('hidden');
       exWrap.innerHTML += `<div class="charge-row"><label><input type="checkbox" class="extra-charge-cb" data-type="fixedcost" data-id="${doc.id}" data-amt="${d.per_member_share}" data-desc="Fixed Cost: ${d.name}"/> Add Fixed Cost: ${d.name}</label><strong>${fmtMoney(d.per_member_share)}</strong></div>`;
    }
  });
  
  updateLivePreview();
}

el('amount-paid')?.addEventListener('input', updateLivePreview);
document.addEventListener('change', e => { if(e.target.classList.contains('extra-charge-cb')) updateLivePreview(); });
el('invoice-date')?.addEventListener('change', updateLivePreview);
el('invoice-receiver')?.addEventListener('change', updateLivePreview);
el('invoice-method')?.addEventListener('change', updateLivePreview);
el('invoice-reference')?.addEventListener('input', updateLivePreview);
el('invoice-notes')?.addEventListener('input', updateLivePreview);

async function updateLivePreview() {
  if(!selectedMember) return;
  const amt = Number(el('amount-paid').value || 0);
  const rate = Number(selectedMember.monthly_amount || 0);
  const baseM = selectedMember.ledger_base_month;
  const baseY = selectedMember.ledger_base_year;
  const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  
  let pMonthStr = "Monthly Contribution";
  let monthsCovered = 0;
  
  if(rate > 0 && baseM && baseY) {
    monthsCovered = amt / rate; // Can be fractional
    if(monthsCovered > 0) {
      const bIdx = mNames.indexOf(baseM);
      const startIdx = (Number(baseY) * 12) + bIdx + 1; // start from NEXT month
      
      const sY = Math.floor(startIdx / 12);
      const sM = startIdx % 12;
      
      if(monthsCovered <= 1) {
        if(monthsCovered === 1) pMonthStr = `${mNames[sM]} ${sY}`;
        else pMonthStr = `Partial Payment (${mNames[sM]} ${sY})`;
      } else {
        const endIdx = startIdx + Math.floor(monthsCovered) - 1;
        const eY = Math.floor(endIdx / 12);
        const eM = endIdx % 12;
        pMonthStr = `${mNames[sM]} ${sY} to ${mNames[eM]} ${eY}`;
        if(monthsCovered % 1 !== 0) pMonthStr += " + Partial";
      }
    }
  }
  
  const extras = [];
  let totalEx = 0;
  qAll('.extra-charge-cb:checked').forEach(cb => {
    const a = Number(cb.dataset.amt);
    totalEx += a;
    extras.push({ desc: cb.dataset.desc, amt: a });
  });
  
  const grandTotal = amt + totalEx;
  
  // Calculate Post-Status
  let postStatusHtml = '';
  if(baseM && baseY) {
    const totalNewMonths = (Number(baseY)*12) + mNames.indexOf(baseM) + monthsCovered;
    const now = new Date();
    const currentTotal = (now.getFullYear()*12) + now.getMonth();
    const diff = currentTotal - totalNewMonths;
    if(diff === 0) postStatusHtml = '<div class="pi-status-stamp PAID">PAID</div>';
    else if(diff > 0) postStatusHtml = `<div class="pi-status-stamp DUE">${Math.floor(diff)} MO DUE</div>`;
    else postStatusHtml = `<div class="pi-status-stamp PAID">ADVANCE</div>`;
  }
  
  const c = el('live-preview-container');
  const d = new Date(el('invoice-date').value || Date.now());
  const rName = el('invoice-receiver').options[el('invoice-receiver').selectedIndex]?.text || '';
  const mth = el('invoice-method').value || '';
  const refTx = el('invoice-reference').value || '';
  const nts = el('invoice-notes').value || '';
  
  const iSnap = await getDoc(doc(db, 'settings', 'invoice'));
  const invSet = iSnap.exists() ? iSnap.data() : {};
  const invNo = (invSet.prefix||'') + (invSet.next_number||1) + '_' + selectedMember.name.replace(/\s+/g,'');
  el('invoice-number-display').textContent = invNo;
  el('inv-num-badge').textContent = invNo;
  
  c.innerHTML = `
    <div class="print-invoice-wrapper" id="the-actual-invoice">
      <div class="pi-header">
        <div class="pi-brand">
          ${cachedOrg.logo_url ? `<img src="${cachedOrg.logo_url}" class="pi-logo"/>` : ''}
          <div class="pi-org-info">
            <h1>${cachedOrg.name || 'Dream Development'}</h1>
            <p>${cachedOrg.address || ''}<br>${cachedOrg.phone || ''} | ${cachedOrg.email || ''}</p>
          </div>
        </div>
        <div class="pi-title">
          <h2>INVOICE</h2>
          <div class="pi-inv-no"># ${invNo}</div>
          <div class="pi-date">Date: ${d.toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</div>
          ${postStatusHtml}
        </div>
      </div>
      
      <div class="pi-meta-row">
        <div class="pi-bill-to">
          <div class="pi-meta-lbl">Bill To</div>
          <div class="pi-member-name">${selectedMember.name}</div>
          <div class="pi-member-detail">Member ID: <strong>${selectedMember.id}</strong></div>
          <div class="pi-member-detail">${selectedMember.mobile || ''}</div>
        </div>
        <div class="pi-payment-info">
          <div class="pi-meta-lbl">Payment Details</div>
          <div class="pi-pi-row"><span class="pi-pi-lbl">Method:</span> <span class="pi-pi-val">${mth}</span></div>
          ${refTx ? `<div class="pi-pi-row"><span class="pi-pi-lbl">Ref:</span> <span class="pi-pi-val">${refTx}</span></div>` : ''}
          <div class="pi-pi-row"><span class="pi-pi-lbl">Received By:</span> <span class="pi-pi-val">${rName}</span></div>
        </div>
      </div>
      
      <table class="pi-table">
        <thead><tr><th>Description</th><th class="col-amt">Amount</th></tr></thead>
        <tbody>
          <tr><td>${pMonthStr}</td><td class="col-amt">${fmtMoney(amt)}</td></tr>
          ${extras.map(x => `<tr><td>${x.desc}</td><td class="col-amt">${fmtMoney(x.amt)}</td></tr>`).join('')}
        </tbody>
      </table>
      
      <div class="pi-summary-row">
        <div class="pi-summary-box">
          <div class="pi-sum-line"><span>Subtotal</span><span>${fmtMoney(grandTotal)}</span></div>
          <div class="pi-sum-total"><span>Total Paid</span><span>${fmtMoney(grandTotal)}</span></div>
        </div>
      </div>
      
      ${nts ? `<div class="pi-notes"><strong>Notes:</strong><br>${nts}</div>` : ''}
      
      <div class="pi-signatures">
        ${cachedOrg.seal_url ? `<div class="pi-seal"><img src="${cachedOrg.seal_url}"/></div>` : ''}
        <div class="pi-sig-box">
          <div class="pi-sig-line"></div>
          <div class="pi-sig-name">Member Signature</div>
        </div>
        <div class="pi-sig-box">
          ${invSet.treasurer_sig_url ? `<img src="${invSet.treasurer_sig_url}" class="pi-sig-img"/>` : '<div class="pi-sig-img"></div>'}
          <div class="pi-sig-line"></div>
          <div class="pi-sig-name">${invSet.treasurer_name || 'Treasurer'}</div>
          <div class="pi-sig-title">Treasurer</div>
        </div>
        <div class="pi-sig-box">
          ${invSet.auth_sig_url ? `<img src="${invSet.auth_sig_url}" class="pi-sig-img"/>` : '<div class="pi-sig-img"></div>'}
          <div class="pi-sig-line"></div>
          <div class="pi-sig-name">Authorized Signature</div>
        </div>
      </div>
      
      <div class="pi-footer">${cachedOrg.footer_text || 'Thank you for your contribution.'}</div>
    </div>
  `;
}

// Zoom controls
let zoom = 0.46;
el('zoom-in-btn')?.addEventListener('click', () => { zoom += 0.1; applyZoom(); });
el('zoom-out-btn')?.addEventListener('click', () => { zoom = Math.max(0.2, zoom - 0.1); applyZoom(); });
el('zoom-reset-btn')?.addEventListener('click', () => { zoom = window.innerWidth>1024?0.46:0.8; applyZoom(); });
function applyZoom(){ 
  el('live-preview-container').style.transform = `scale(${zoom})`; 
  el('zoom-level-label').textContent = Math.round(zoom*100)+'%';
}
// init zoom based on screen
if(window.innerWidth<=1024) zoom=0.8;
setTimeout(applyZoom,100);

el('preview-invoice-btn')?.addEventListener('click', () => {
  if(!selectedMember) return;
  el('invoice-print-area').innerHTML = el('live-preview-container').innerHTML;
  el('invoice-modal').classList.remove('hidden');
});

el('generate-invoice-btn')?.addEventListener('click', async () => {
  if(!selectedMember) return showToast("Select a member.", "error");
  const amt = Number(el('amount-paid').value || 0);
  if(amt <= 0 && qAll('.extra-charge-cb:checked').length===0) return showToast("Amount required.", "error");
  
  const btn = el('generate-invoice-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  
  try {
    // 1. Get next invoice number safely
    const iRef = doc(db, 'settings', 'invoice');
    const iSnap = await getDoc(iRef);
    const iSet = iSnap.exists() ? iSnap.data() : { next_number: 1, prefix: 'DD-' };
    const num = iSet.next_number || 1;
    const invNo = (iSet.prefix||'') + num + '_' + selectedMember.name.replace(/\s+/g,'');
    
    // 2. Calculate new ledger baseline
    const rate = Number(selectedMember.monthly_amount || 0);
    const monthsCovered = rate > 0 ? amt / rate : 0;
    
    let newBaseM = selectedMember.ledger_base_month;
    let newBaseY = selectedMember.ledger_base_year;
    
    if(monthsCovered > 0 && newBaseM && newBaseY) {
      const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const bIdx = mNames.indexOf(newBaseM);
      const totalMonths = (Number(newBaseY) * 12) + bIdx + monthsCovered;
      newBaseY = Math.floor(totalMonths / 12);
      newBaseM = mNames[Math.floor(totalMonths % 12)];
    }
    
    // 3. Handle extra charges
    const batch = writeBatch(db);
    const extras = [];
    qAll('.extra-charge-cb:checked').forEach(cb => {
      const typ = cb.dataset.type;
      const tId = cb.dataset.id;
      if(typ === 'fine') {
        batch.update(doc(db, 'fines', tId), { status: 'paid', paid_at: new Date().toISOString() });
        extras.push({ type:'fine', id:tId, amount: Number(cb.dataset.amt) });
      } else if(typ === 'fixedcost') {
        // We must fetch the FC doc to merge payment
        // We'll do this outside the batch for simplicity or just run an update
        const fp = `payments.${selectedMember.id}`;
        batch.update(doc(db, 'fixed_costs', tId), { [fp]: Number(cb.dataset.amt) });
        extras.push({ type:'fixedcost', id:tId, amount: Number(cb.dataset.amt) });
      }
    });
    
    // 4. Save Invoice record
    const invData = {
      invoice_number: invNo,
      member_id: selectedMember.id,
      member_name: selectedMember.name,
      amount: amt, // Base contribution amount
      extras: extras,
      total_amount: amt + extras.reduce((s,x)=>s+x.amount,0),
      date: el('invoice-date').value || new Date().toISOString().split('T')[0],
      receiver: el('invoice-receiver').value,
      method: el('invoice-method').value,
      reference: el('invoice-reference').value,
      notes: el('invoice-notes').value,
      months_covered: monthsCovered,
      created_at: serverTimestamp()
    };
    
    const newInvRef = doc(collection(db, 'invoices'));
    batch.set(newInvRef, invData);
    
    // 5. Update Member
    batch.update(doc(db, 'members', selectedMember.id), {
      ledger_base_month: newBaseM,
      ledger_base_year: newBaseY
    });
    
    // 6. Increment sequence
    batch.update(iRef, { next_number: num + 1 });
    
    await batch.commit();
    
    // 7. Generate PDF
    await generatePDF(el('live-preview-container').querySelector('.print-invoice-wrapper'), invNo);
    
    showToast("Invoice saved & downloaded!");
    resetInvoiceForm();
    loadDashboard(); // Refresh background data
    
  } catch(err) {
    console.error(err);
    showToast("Failed: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generate & Download PDF';
  }
});

async function generatePDF(element, filename) {
  if(!element) return;
  // Ensure it's rendered properly before canvas capture
  element.style.transform = 'none';
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
  const imgData = canvas.toDataURL('image/jpeg', 1.0);
  const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
  const w = pdf.internal.pageSize.getWidth();
  const h = (canvas.height * w) / canvas.width;
  pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
  pdf.save(`${filename}.pdf`);
  applyZoom(); // restore zoom
}

el('modal-pdf-btn')?.addEventListener('click', () => {
  const node = el('invoice-print-area').querySelector('.print-invoice-wrapper');
  generatePDF(node, el('invoice-number-display').textContent || 'invoice');
});
el('modal-print-btn')?.addEventListener('click', () => {
  const content = el('invoice-print-area').innerHTML;
  const win = window.open('', '', 'width=800,height=900');
  win.document.write(`<html><head><title>Print</title><style>
    body{margin:0;padding:0;}
    @media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
  <link rel="stylesheet" href="css/style.css"/>
  </head><body><div id="live-preview-container" style="transform:none!important;margin:0!important;box-shadow:none!important;">${content}</div></body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
});

function resetInvoiceForm() {
  selectedMember = null;
  el('select-display').textContent = 'Search by name or ID…';
  el('select-display').style.color = '';
  el('member-pills').classList.add('hidden');
  el('auto-status-wrap').classList.add('hidden');
  el('extra-charges-wrap').classList.add('hidden');
  el('amount-paid').value = '';
  el('invoice-date').value = new Date().toISOString().split('T')[0];
  el('invoice-reference').value = '';
  el('invoice-notes').value = '';
  el('live-preview-container').innerHTML = '<div class="preview-empty"><i class="fas fa-file-invoice"></i><p>Select a member to preview</p></div>';
  el('invoice-number-display').textContent = '—';
  el('inv-num-badge').textContent = '—';
}

async function loadReceivers() {
  const snap = await getDoc(doc(db, 'settings', 'receivers'));
  const list = snap.exists() ? snap.data().list || [] : ['Admin', 'Bank Transfer', 'bKash'];
  
  // Populate settings list
  const sl = el('receivers-list');
  if(sl){
    sl.innerHTML = '';
    list.forEach((r,i) => {
      sl.innerHTML += `<div style="display:flex;gap:8px;margin-bottom:8px">
        <input type="text" class="form-control rec-inp" value="${r}"/>
        <button class="icon-btn" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
      </div>`;
    });
  }
  
  // Populate dropdowns
  const ir = el('invoice-receiver');
  if(ir) {
    ir.innerHTML = '';
    list.forEach(r => ir.innerHTML += `<option>${r}</option>`);
  }
  const im = el('invoice-method');
  if(im) {
    im.innerHTML = '<option>Cash</option><option>bKash</option><option>Nagad</option><option>Bank Transfer</option><option>Cheque</option>';
  }
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
window.addEventListener('DOMContentLoaded', fetchConfigAndInit);
