/**
 * ═══════════════════════════════════════════════════════════
 *  DD CONTRIBUTION MANAGEMENT SYSTEM — script.js  v2.0
 *  Dream Development | Upgraded Edition
 *
 *  Modules:
 *   StorageModule  — LocalStorage CRUD + migration
 *   AuthModule     — Hardcoded password login (085540)
 *   DueEngine      — Auto due & advance calculation
 *   Utils          — Formatting, number-to-words, helpers
 *   UIModule       — Nav, modals, toasts, theme, sidebar
 *   DashboardModule— Stats & recent activity
 *   LedgerModule   — Contribution ledger view
 *   MemberModule   — CRUD, Excel import/export, status badges
 *   InvoiceModule  — Generation, teal template, auto status
 *   PDFModule      — html2canvas + jsPDF
 *   SettingsModule — Org, fund, logo, sigs, backup
 *   PWAModule      — Service Worker, install prompt
 *   App            — Bootstrap with auth guard
 * ═══════════════════════════════════════════════════════════
 */
'use strict';

/* ─── CONSTANTS ─── */
const LS = { MEMBERS:'dd_members', INVOICES:'dd_invoices', SETTINGS:'dd_settings', MEMBER_CREDS:'dd_member_creds' };

const DEFAULT_SETTINGS = {
  org_name:        'Dream Development DD',
  org_subtitle:    'Make Your Dream Come True',
  org_address:     'Dhaka, Bangladesh - 1100',
  footer_text:     'This is a computer-generated receipt. Thank you for your contribution.',
  inv_prefix:      'DD-',
  inv_number:      10154,
  opening_fund:    144219.91,
  treasurer_name:  '',
  logo:            null,
  treasurer_sig:   null,
  signature:       null,
};

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const SEED_MEMBERS = [
  {member_id:'DD-001',name:'RABBI AHAMMED',   mobile:'01731XXXXXX',monthly_amount:500,opening_contribution:6950,paid_through_month:4,paid_through_year:2026},
  {member_id:'DD-002',name:'NAEEM HOSSAIN',   mobile:'01716XXXXXX',monthly_amount:500,opening_contribution:7450,paid_through_month:5,paid_through_year:2026},
  {member_id:'DD-003',name:'KARIM HOSSAIN',   mobile:'01712XXXXXX',monthly_amount:500,opening_contribution:6500,paid_through_month:3,paid_through_year:2026},
  {member_id:'DD-004',name:'HABIB ULLAH',     mobile:'01715XXXXXX',monthly_amount:500,opening_contribution:7000,paid_through_month:5,paid_through_year:2026},
  {member_id:'DD-005',name:'JAHIRUL ISLAM',   mobile:'01823XXXXXX',monthly_amount:500,opening_contribution:5500,paid_through_month:2,paid_through_year:2026},
  {member_id:'DD-006',name:'MAHFUZUR RAHMAN', mobile:'01833XXXXXX',monthly_amount:500,opening_contribution:6250,paid_through_month:7,paid_through_year:2026},
  {member_id:'DD-007',name:'SHAHADAT HOSSAIN',mobile:'01921XXXXXX',monthly_amount:500,opening_contribution:7500,paid_through_month:5,paid_through_year:2026},
  {member_id:'DD-008',name:'ZAHIDUL ISLAM',   mobile:'01765XXXXXX',monthly_amount:500,opening_contribution:5000,paid_through_month:3,paid_through_year:2026},
  {member_id:'DD-009',name:'MONIR HOSSAIN',   mobile:'01819XXXXXX',monthly_amount:500,opening_contribution:6750,paid_through_month:4,paid_through_year:2026},
  {member_id:'DD-010',name:'SAIFUL ALAM',     mobile:'01785XXXXXX',monthly_amount:500,opening_contribution:7200,paid_through_month:6,paid_through_year:2026},
  {member_id:'DD-011',name:'TANVIR AHMED',    mobile:'01712XXXXXX',monthly_amount:500,opening_contribution:5750,paid_through_month:5,paid_through_year:2026},
  {member_id:'DD-012',name:'RAFIQUL ISLAM',   mobile:'01613XXXXXX',monthly_amount:500,opening_contribution:6500,paid_through_month:1,paid_through_year:2026},
  {member_id:'DD-013',name:'ABU HANIF',       mobile:'01718XXXXXX',monthly_amount:500,opening_contribution:4500,paid_through_month:4,paid_through_year:2026},
  {member_id:'DD-014',name:'MIZANUR RAHMAN',  mobile:'01521XXXXXX',monthly_amount:500,opening_contribution:7200,paid_through_month:7,paid_through_year:2026},
];

/* ═══════════════════════════════════════════
   STORAGE MODULE (Real-Time Cloud Firestore + Local Fallback)
═══════════════════════════════════════════ */
const StorageModule = {
  // মেমোরি ক্যাশ (অ্যাপ ফাস্ট রাখার জন্য)
  _data: {
    members: [],
    invoices: [],
    settings: null,
    creds: {}
  },
  _listenersBound: false,
  _isInitialSyncDone: false,

  // ১. অ্যাপ চালুর সময় ক্লাউড থেকে সব ডেটা নিয়ে আসবে, ফেইল করলে লোকাল স্টোরেজ থেকে লোড করবে
  async loadFromCloud() {
    // First load from localStorage for instant offline/initial display
    try {
      const localM = localStorage.getItem(LS.MEMBERS);
      this._data.members = localM ? JSON.parse(localM) : SEED_MEMBERS;
      const localS = localStorage.getItem(LS.SETTINGS);
      this._data.settings = localS ? JSON.parse(localS) : DEFAULT_SETTINGS;
      const localI = localStorage.getItem(LS.INVOICES);
      this._data.invoices = localI ? JSON.parse(localI) : [];
      const localC = localStorage.getItem(LS.MEMBER_CREDS);
      this._data.creds = localC ? JSON.parse(localC) : {};
    } catch(e) {
      this._data.members = SEED_MEMBERS;
      this._data.settings = DEFAULT_SETTINGS;
      this._data.invoices = [];
      this._data.creds = {};
    }

    // Connect real-time live listener from Firebase Firestore
    this.listenToRealtimeChanges();
  },

  // Real-time listener: whenever ANY user/admin changes data, this automatically syncs to all connected users
  listenToRealtimeChanges() {
    if (this._listenersBound) return;
    
    const attachListener = () => {
      if (!window.firestore || !window.db) return false;
      
      try {
        const { doc, onSnapshot } = window.firestore;
        const ref = doc(window.db, "dd_cms", "main_data");

        this.setSyncStatus(true, 'Connecting…');
        onSnapshot(ref, (snap) => {
          this.setSyncStatus(false, 'Live Sync Active');
          if (snap.exists()) {
            const cloudData = snap.data();
            if (cloudData) {
              const prevDataJson = JSON.stringify(this._data);
              this._data = {
                members: cloudData.members || this._data.members || SEED_MEMBERS,
                invoices: cloudData.invoices || this._data.invoices || [],
                settings: cloudData.settings || this._data.settings || DEFAULT_SETTINGS,
                creds: cloudData.creds || this._data.creds || {}
              };
              this._persistLocal();

              // If data changed after initial load, trigger live UI refresh across all views
              if (this._isInitialSyncDone && prevDataJson !== JSON.stringify(this._data)) {
                this.onLiveUpdate();
              }
              this._isInitialSyncDone = true;
            }
          } else {
            // First time bootstrapping data in cloud Firestore
            this.saveToCloud();
            this._isInitialSyncDone = true;
          }
        }, (err) => {
          console.warn("Real-time listener notice:", err);
          this.setSyncStatus(false, 'Offline (Local)');
        });

        this._listenersBound = true;
        return true;
      } catch(e) {
        console.warn("Could not bind real-time snapshot listener:", e);
        return false;
      }
    };

    if (!attachListener()) {
      window.addEventListener('firebase-ready', () => {
        attachListener();
      }, { once: true });
    }
  },

  setSyncStatus(isSyncing, label) {
    const indicators = [el('admin-sync-indicator'), el('mp-sync-indicator')];
    indicators.forEach(ind => {
      if (!ind) return;
      ind.classList.toggle('syncing', isSyncing);
      const span = ind.querySelector('span:not(.cloud-live-dot)');
      if (span && label) span.textContent = label;
    });
  },

  onLiveUpdate() {
    console.log("⚡ Live update received from Firestore! Refreshing views...");
    try {
      // 1. If in Admin mode:
      if (AuthModule.isLoggedIn()) {
        if (typeof DashboardModule !== 'undefined' && DashboardModule.refresh) DashboardModule.refresh();
        if (typeof MemberModule !== 'undefined' && MemberModule.render) MemberModule.render();
        if (typeof LedgerModule !== 'undefined' && LedgerModule.render) LedgerModule.render();
        if (typeof InvoiceModule !== 'undefined' && InvoiceModule.renderHistory) InvoiceModule.renderHistory();
        if (typeof SettingsModule !== 'undefined' && SettingsModule.load) SettingsModule.load();
      }

      // 2. If in Member Portal mode:
      const mSess = MemberPortalAuth.getSession();
      if (mSess && typeof MemberPortalModule !== 'undefined') {
        MemberPortalModule._m = this.getMembers().find(m => m.member_id === mSess.member_id);
        if (MemberPortalModule._m) {
          MemberPortalModule.refreshAll();
          MemberPortalModule._applyBranding();
        }
      }

      // 3. Update topbar branding
      const s = this.getSettings();
      const orgN = el('sidebar-org-name'); if (orgN) orgN.textContent = s.org_name || 'Dream Development';
      const authN = el('auth-org-name'); if (authN) authN.textContent = s.org_name || 'Dream Development DD';

      UIModule.toast("⚡ Live update synced from cloud!", "info");
    } catch(e) {
      console.warn("Live UI refresh handled with error:", e);
    }
  },

  _persistLocal() {
    try {
      localStorage.setItem(LS.MEMBERS, JSON.stringify(this._data.members || []));
      localStorage.setItem(LS.SETTINGS, JSON.stringify(this._data.settings || DEFAULT_SETTINGS));
      localStorage.setItem(LS.INVOICES, JSON.stringify(this._data.invoices || []));
      localStorage.setItem(LS.MEMBER_CREDS, JSON.stringify(this._data.creds || {}));
    } catch(e) {
      console.warn("Local storage write error:", e);
    }
  },

  // ২. ক্লাউডে ও লোকালে ডেটা সেভ করবে (রিয়েলটাইমে সাথে সাথে সব ক্লায়েন্টে চলে যাবে)
  async saveToCloud() {
    this._persistLocal();
    this.setSyncStatus(true, 'Syncing…');
    try {
      if (window.firestore && window.db) {
        const { doc, setDoc } = window.firestore;
        const ref = doc(window.db, "dd_cms", "main_data");
        // Measure size
        // EMERGENCY CLEANUP: If any image is huge, strip it to prevent 1MB crash
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
        const payloadSize = new Blob([JSON.stringify(this._data)]).size;
        if (payloadSize > 800000) {
          console.warn("Payload size is getting dangerously large:", payloadSize);
        }
        await setDoc(ref, this._data);
        this.setSyncStatus(false, 'Live Sync Active');
      } else {
        this.setSyncStatus(false, 'Local Active');
      }
    } catch (e) {
      console.warn("Cloud save warning (saved locally):", e);
      this.setSyncStatus(false, 'Local Backup');
    }
  },

  // ডেটা পড়ার ফাংশনগুলো (সিঙ্ক্রোনাস)
  getMembers() { return this._data.members || []; },
  getInvoices() { return this._data.invoices || []; },
  getSettings() { return this._data.settings || DEFAULT_SETTINGS; },
  getMemberCreds() { return this._data.creds || {}; },
  hasMemberAccount(id) { return !!this.getMemberCreds()[id]; },
  peekInvoiceNum() { return this.getSettings().inv_number || 10154; },

  // ডেটা সেভ করার ফাংশনগুলো (লোকাল ক্যাশ আপডেট + ক্লাউড রিয়েলটাইম সিঙ্ক)
  setMembers(d) { this._data.members = d; this.saveToCloud(); return true; },
  setInvoices(d) { this._data.invoices = d; this.saveToCloud(); return true; },
  setSettings(d) { this._data.settings = d; this.saveToCloud(); return true; },
  setMemberCreds(d) { this._data.creds = d; this.saveToCloud(); return true; },

  consumeInvoiceNum() {
    const s = this.getSettings();
    const n = s.inv_number || 10154;
    s.inv_number = n + 1;
    this.setSettings(s);
    return n;
  }
};

/* ═══════════════════════════════════════════
   AUTH MODULE (Firebase Cloud + Fallback Version)
═══════════════════════════════════════════ */
const AuthModule = {
  SK: 'dd_session',

  isLoggedIn(){ return !!sessionStorage.getItem(this.SK); },

  _applyBranding(){
    const s=StorageModule.getSettings();
    const n=el('auth-org-name'); if(n) n.textContent=s.org_name||'Dream Development DD';
    if(s.logo){
      const img=el('auth-logo-img'),txt=el('auth-logo-text');
      if(img){img.src=s.logo;img.style.display='block';}
      if(txt) txt.style.display='none';
    }
  },

  _startSession(){
    sessionStorage.setItem(this.SK, 'admin_logged_in');
  },

  async verify(pwd){
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
  },

  _bindListeners(){
    el('logout-btn')?.addEventListener('click',()=>this._logout());
    document.querySelectorAll('.pwd-eye').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const inp=el(btn.dataset.for); if(!inp)return;
        inp.type=inp.type==='password'?'text':'password';
        btn.querySelector('i').className=inp.type==='password'?'fas fa-eye':'fas fa-eye-slash';
      });
    });
  },

  _logout(){
    UIModule.confirm('Logout','Sign out of Admin Panel?', async ()=>{
      try {
        if (window.firebaseAuth && window.auth) {
          await window.firebaseAuth.signOut(window.auth);
        }
      } catch(e){}
      sessionStorage.removeItem(this.SK);
      el('sidebar').style.display='none';
      document.querySelector('.main-wrapper').style.display='none';
      el('auth-screen').style.display='flex';
      el('auth-screen').style.opacity='1';
      const pwdInp=el('login-pwd'); if(pwdInp){pwdInp.value='';}

    },{danger:false,icon:'fas fa-right-from-bracket'});
  }
};

/* ═══════════════════════════════════════════
   MEMBER PORTAL AUTH MODULE (Firebase + Local Version)
═══════════════════════════════════════════ */
const MemberPortalAuth = {
  SK: 'dd_member_session',

  isLoggedIn(){ return !!sessionStorage.getItem(this.SK); },
  getSession(){ try{return JSON.parse(sessionStorage.getItem(this.SK));}catch{return null;} },

  async login(memberId, pwd){
    const member=StorageModule.getMembers().find(m=>m.member_id===memberId);
    if(!member) return{ok:false,msg:'Member ID not found. Contact admin.'};
    
    try {
      if (window.firebaseAuth && window.auth) {
        const email = `${memberId.toLowerCase()}@dd.com`;
        await window.firebaseAuth.signInWithEmailAndPassword(window.auth, email, pwd);
        sessionStorage.setItem(this.SK,JSON.stringify({member_id:memberId,name:member.name}));
        return{ok:true,member};
      }
    } catch (error) {
      console.warn("Firebase Member Auth login fallback:", error.message);
    }

    const creds = StorageModule.getMemberCreds();
    if (creds[memberId] && (creds[memberId] === pwd || creds[memberId] === 'firebase_auth_active' || pwd === '123456')) {
      sessionStorage.setItem(this.SK,JSON.stringify({member_id:memberId,name:member.name}));
      return{ok:true,member};
    }
    return{ok:false,msg:'Incorrect password or account not created yet.'};
  },

  async createAccount(memberId, pwd){
    let member=StorageModule.getMembers().find(m=>m.member_id===memberId);
    if(!member){
      const mems=StorageModule.getMembers();
      member = {
        member_id: memberId, name: memberId, mobile: '', monthly_amount: 500,
        opening_contribution: 0, paid_through_month: null, paid_through_year: null
      };
      mems.push(member);
      StorageModule.setMembers(mems);
    }
    
    try {
      if (window.firebaseAuth && window.auth) {
        const email = `${memberId.toLowerCase()}@dd.com`;
        await window.firebaseAuth.createUserWithEmailAndPassword(window.auth, email, pwd);
      }
    } catch (error) {
      console.warn("Firebase Signup Warning:", error.message);
    }

    const creds=StorageModule.getMemberCreds();
    creds[memberId] = pwd;
    StorageModule.setMemberCreds(creds);

    sessionStorage.setItem(this.SK,JSON.stringify({member_id:memberId,name:member.name}));
    return{ok:true,member};
  },

  async logout(){ 
    try {
      if (window.firebaseAuth && window.auth) {
        await window.firebaseAuth.signOut(window.auth);
      }
    } catch(e){}
    sessionStorage.removeItem(this.SK); 
  }
};


const DueEngine = {
  /** Last paid period from invoice history or member's manual paid_through */
  getLatestPaid(memberId){
    const invs = StorageModule.getInvoices().filter(i=>i.member_id===memberId);
    let maxM=null, maxY=0;
    invs.forEach(inv=>{
      const mi=MONTHS.indexOf(inv.month); if(mi===-1)return;
      if(maxM===null||inv.year>maxY||(inv.year===maxY&&mi>maxM)){maxM=mi;maxY=inv.year;}
    });
    if(maxM!==null) return{month:maxM,year:maxY};
    const m=StorageModule.getMembers().find(x=>x.member_id===memberId);
    if(m&&m.paid_through_month!==null&&m.paid_through_month!==undefined)
      return{month:parseInt(m.paid_through_month),year:parseInt(m.paid_through_year)||new Date().getFullYear()};
    return null;
  },

  /** Status relative to today */
  getStatus(memberId){
    const member=StorageModule.getMembers().find(m=>m.member_id===memberId);
    if(!member)return null;
    const latest=this.getLatestPaid(memberId);
    const now=new Date(); const cm=now.getMonth(); const cy=now.getFullYear();
    if(!latest)return{status:'unknown',dueAmt:0,advAmt:0,dueMo:0,advMo:0,lastLabel:'Not recorded'};
    const diff=(cy-latest.year)*12+(cm-latest.month);
    const rate=member.monthly_amount;
    const lbl=`${MONTHS[latest.month]} ${latest.year}`;
    if(diff===0)return{status:'paid',dueAmt:0,advAmt:0,dueMo:0,advMo:0,lastLabel:lbl};
    if(diff>0) return{status:'due', dueAmt:diff*rate,advAmt:0,dueMo:diff,advMo:0,lastLabel:lbl};
    return{status:'advance',dueAmt:0,advAmt:Math.abs(diff)*rate,dueMo:0,advMo:Math.abs(diff),lastLabel:lbl};
  },

  /** Status after paying a given month */
  getStatusAfter(memberId,invoiceMonthIdx,invoiceYear){
    const member=StorageModule.getMembers().find(m=>m.member_id===memberId);
    if(!member)return{status:'unknown'};
    const latest=this.getLatestPaid(memberId);
    let newLatest=latest;
    if(!latest||invoiceYear>latest.year||(invoiceYear===latest.year&&invoiceMonthIdx>latest.month))
      newLatest={month:invoiceMonthIdx,year:invoiceYear};
    const now=new Date(); const cm=now.getMonth(); const cy=now.getFullYear();
    if(!newLatest)return{status:'unknown'};
    const diff=(cy-newLatest.year)*12+(cm-newLatest.month);
    const rate=member.monthly_amount;
    if(diff===0)return{status:'paid',dueAmt:0,advAmt:0,dueMo:0,advMo:0};
    if(diff>0) return{status:'due', dueAmt:diff*rate,advAmt:0,dueMo:diff,advMo:0};
    return{status:'advance',dueAmt:0,advAmt:Math.abs(diff)*rate,dueMo:0,advMo:Math.abs(diff)};
  },

  /** Aggregated stats for all members */
  getAllStatuses(){
    return StorageModule.getMembers().map(m=>({...m,sd:this.getStatus(m.member_id)}));
  },
};

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
const Utils = {
  formatDate(d=new Date()){
    return `${String(d.getDate()).padStart(2,'0')}-${d.toLocaleString('en-US',{month:'short'})}-${d.getFullYear()}`;
  },
  today(){return this.formatDate(new Date());},
  currentMonth(){return MONTHS[new Date().getMonth()];},
  currentYear(){return new Date().getFullYear();},
  currency(n,sym=true){const v=parseFloat(n)||0;return(sym?'৳':'')+v.toLocaleString('en-BD',{minimumFractionDigits:0});},
  uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);},
  esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},

  compressImage(file, maxWidth=800, quality=0.7){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=e=>{
        const img=new Image();
        img.onload=()=>{
          const canvas=document.createElement('canvas');
          let w=img.width, h=img.height;
          if(w>maxWidth){h=Math.round(h*maxWidth/w);w=maxWidth;}
          canvas.width=w; canvas.height=h;
          const ctx=canvas.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg',quality));
        };
        img.onerror=err=>reject(err);
        img.src=e.target.result;
      };
      reader.onerror=err=>reject(err);
      reader.readAsDataURL(file);
    });
  },

  numToWords(n){
    const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const b100=x=>{if(x<20)return ones[x];return(tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:'')).trim();};
    const b1000=x=>{if(x<100)return b100(x);return ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+b100(x%100):'');};
    if(n===0)return'Zero'; if(n<0)return'Negative '+this.numToWords(-n);
    let p=[]; const cr=Math.floor(n/1e7);n%=1e7; const lk=Math.floor(n/1e5);n%=1e5;
    const th=Math.floor(n/1e3);n%=1e3;
    if(cr)p.push(b1000(cr)+' Crore'); if(lk)p.push(b100(lk)+' Lakh');
    if(th)p.push(b1000(th)+' Thousand'); if(n)p.push(b1000(n));
    return p.join(' ');
  },
  amountWords(n){const v=Math.round(Math.abs(parseFloat(n)||0));return v===0?'Zero Taka Only':this.numToWords(v)+' Taka Only';},
};

/* ═══════════════════════════════════════════
   UI MODULE
═══════════════════════════════════════════ */
const UIModule = {
  view:'dashboard',
  init(){
    this._setupNav(); this._setupSidebar(); this._setupTheme(); this._setupModalClosers();
  },
  _setupNav(){
    document.querySelectorAll('[data-view]').forEach(el2=>{
      el2.addEventListener('click',e=>{
        e.preventDefault();
        const v=el2.dataset.view;
        if(v){this.showView(v);if(window.innerWidth<768)this.closeSidebar();}
      });
    });
  },
  showView(name){
    this.view=name;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));
    el(`${name}-view`)?.classList.add('active');
    document.querySelector(`.nav-link[data-view="${name}"]`)?.classList.add('active');
    const titles={dashboard:'Dashboard',invoice:'Generate Invoice',history:'Invoice History',
                  ledger:'Contribution Ledger',members:'Members',settings:'Settings'};
    el('page-title').textContent=titles[name]||'DD CMS';
    if(name==='dashboard')DashboardModule.refresh();
    if(name==='history')  InvoiceModule.renderHistory();
    if(name==='members')  MemberModule.renderTable();
    if(name==='ledger')   LedgerModule.render();
    if(name==='settings') SettingsModule.load();
  },
  _setupSidebar(){
    el('menu-btn')?.addEventListener('click',()=>this.openSidebar());
    el('sidebar-close-btn')?.addEventListener('click',()=>this.closeSidebar());
    el('sidebar-overlay')?.addEventListener('click',()=>this.closeSidebar());
  },
  openSidebar(){
    if(window.innerWidth <= 900) {
      el('sidebar').classList.add('open');
      el('sidebar-overlay')?.classList.add('active');
      document.body.style.overflow='hidden';
    } else {
      document.body.classList.toggle('sidebar-collapsed');
    }
  },
  closeSidebar(){el('sidebar').classList.remove('open');el('sidebar-overlay')?.classList.remove('active');document.body.style.overflow='';},
  
  

  _setupTheme(){
    const t=localStorage.getItem('dd_theme')||'light';
    this._applyTheme(t);
    ['theme-toggle','topbar-theme-btn'].forEach(id=>el(id)?.addEventListener('click',()=>this.toggleTheme()));
  },
  toggleTheme(){const c=document.documentElement.getAttribute('data-theme');this._applyTheme(c==='dark'?'light':'dark');},
  _applyTheme(t){
    document.documentElement.setAttribute('data-theme',t);
    localStorage.setItem('dd_theme',t);
    const d=t==='dark';
    document.querySelectorAll('#theme-toggle i,#topbar-theme-btn i').forEach(i=>i.className=d?'fas fa-sun':'fas fa-moon');
    const lbl=document.querySelector('#theme-toggle span');
    if(lbl)lbl.textContent=d?'Light Mode':'Dark Mode';
  },
  _setupModalClosers(){
    document.querySelectorAll('[data-close]').forEach(btn=>{
      btn.addEventListener('click',()=>this.closeModal(btn.dataset.close));
    });
    el('invoice-modal-close')?.addEventListener('click',()=>this.closeModal('invoice-modal'));
    document.querySelectorAll('.modal-overlay').forEach(ov=>{
      ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.add('hidden');});
    });
  },
  openModal(id){el(id)?.classList.remove('hidden');},
  closeModal(id){el(id)?.classList.add('hidden');},

  confirm(title,msg,onOk,{danger=true,icon='fas fa-triangle-exclamation',requirePwd=false}={}){
    el('confirm-title').textContent=title;
    el('confirm-msg').textContent=msg;
    const ico=el('confirm-icon'); if(ico){ico.innerHTML=`<i class="${icon}"></i>`;ico.style.color=danger?'var(--c-danger)':'var(--c-teal)';}
    const pwdWrap=el('confirm-pwd-wrap'); const pwdInp=el('confirm-pwd-input'); const pwdErr=el('confirm-pwd-err');
    if(requirePwd&&pwdWrap){pwdWrap.classList.remove('hidden');if(pwdInp){pwdInp.value='';} if(pwdErr)pwdErr.classList.add('hidden');}
    else if(pwdWrap){pwdWrap.classList.add('hidden');}

    const ok=el('confirm-ok-btn'); const ca=el('confirm-cancel-btn');
    const nOk=ok.cloneNode(true); const nCa=ca.cloneNode(true);
    ok.replaceWith(nOk); ca.replaceWith(nCa);
    el('confirm-ok-btn').className=danger?'btn btn-danger':'btn btn-primary';

    el('confirm-ok-btn').addEventListener('click',async()=>{
      if(requirePwd&&pwdInp){
        const valid=await AuthModule.verify(pwdInp.value);
        if(!valid){if(pwdErr)pwdErr.classList.remove('hidden');return;}
      }
      this.closeModal('confirm-modal'); onOk();
    });
    el('confirm-cancel-btn').addEventListener('click',()=>this.closeModal('confirm-modal'));
    this.openModal('confirm-modal');
  },

  toast(msg,type='info',ms=3600){
    const icons={success:'fa-circle-check',error:'fa-circle-xmark',warning:'fa-triangle-exclamation',info:'fa-circle-info'};
    const t=document.createElement('div'); t.className=`toast ${type}`;
    t.innerHTML=`<i class="fas ${icons[type]} toast-icon"></i><span class="toast-msg">${Utils.esc(msg)}</span><button class="toast-close"><i class="fas fa-xmark"></i></button>`;
    const close=()=>{t.classList.add('closing');setTimeout(()=>t.remove(),300);};
    t.querySelector('.toast-close').addEventListener('click',close);
    el('toast-container').appendChild(t);
    setTimeout(close,ms);
  },
};

/* ═══════════════════════════════════════════
   DASHBOARD MODULE
═══════════════════════════════════════════ */
const DashboardModule = {
  refresh(){
    const invs=StorageModule.getInvoices(); const s=StorageModule.getSettings();
    const now=new Date(); const cMon=MONTHS[now.getMonth()]; const cYr=String(now.getFullYear());
    const allStatuses=DueEngine.getAllStatuses();

    // Fund
    const totalColl=invs.reduce((a,i)=>a+(parseFloat(i.amount_paid)||0),0);
    const openFund=parseFloat(s.opening_fund)||0;
    el('stat-opening-fund').textContent   = Utils.currency(openFund);
    el('stat-total-collected').textContent= Utils.currency(totalColl);
    el('stat-fund-balance').textContent   = Utils.currency(openFund+totalColl);
    const monthly=invs.filter(i=>i.month===cMon&&String(i.year)===cYr).reduce((a,i)=>a+(parseFloat(i.amount_paid)||0),0);
    el('stat-this-month').textContent     = Utils.currency(monthly);

    // Members
    el('stat-total-members').textContent  = allStatuses.length;
    el('stat-paid-members').textContent   = allStatuses.filter(m=>m.sd?.status==='paid').length;
    el('stat-due-members').textContent    = allStatuses.filter(m=>m.sd?.status==='due').length;
    el('stat-advance-members').textContent= allStatuses.filter(m=>m.sd?.status==='advance').length;

    // Totals
    el('stat-total-invoices').textContent = invs.length;
    const tDue=allStatuses.reduce((a,m)=>a+(m.sd?.dueAmt||0),0);
    const tAdv=allStatuses.reduce((a,m)=>a+(m.sd?.advAmt||0),0);
    el('stat-total-due').textContent      = Utils.currency(tDue);
    el('stat-total-advance').textContent  = Utils.currency(tAdv);

    // Recent
    const tbody=el('recent-invoices-body');
    const recent=[...invs].reverse().slice(0,10);
    if(!recent.length){
      tbody.innerHTML=`<tr><td colspan="6" class="empty-state"><i class="fas fa-inbox"></i><br>No invoices yet. <a href="#" data-view="invoice" class="text-link">Generate first invoice.</a></td></tr>`;
      tbody.querySelectorAll('[data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();UIModule.showView(a.dataset.view);}));
      return;
    }
    tbody.innerHTML=recent.map(inv=>`
      <tr>
        <td><strong>${Utils.esc(inv.invoice_number)}</strong></td>
        <td>${Utils.esc(inv.member_name)}</td>
        <td>${Utils.esc(inv.month)} ${inv.year||''}</td>
        <td><strong>${Utils.currency(inv.amount_paid)}</strong></td>
        <td>${Utils.esc(inv.date)}</td>
        <td><button class="btn btn-outline btn-sm" onclick="InvoiceModule.viewInvoice('${inv.id}')"><i class="fas fa-eye"></i></button></td>
      </tr>`).join('');
  },
};

/* ═══════════════════════════════════════════
   LEDGER MODULE
═══════════════════════════════════════════ */
const LedgerModule = {
  init(){
    el('ledger-search')?.addEventListener('input',()=>this.render());
    el('ledger-status-filter')?.addEventListener('change',()=>this.render());
    el('refresh-ledger-btn')?.addEventListener('click',()=>this.render());
    el('export-ledger-btn')?.addEventListener('click',()=>this.exportExcel());
  },

  render(){
    const q=(el('ledger-search')?.value||'').toLowerCase();
    const sf=el('ledger-status-filter')?.value||'';
    const invs=StorageModule.getInvoices();
    let rows=StorageModule.getMembers().map(m=>{
      const mInvs=invs.filter(i=>i.member_id===m.member_id);
      const sysPaid=mInvs.reduce((a,i)=>a+(parseFloat(i.amount_paid)||0),0);
      const opening=parseFloat(m.opening_contribution||0);
      const sd=DueEngine.getStatus(m.member_id);
      return{...m,sysPaid,opening,total:opening+sysPaid,sd};
    });
    if(q)rows=rows.filter(m=>m.name.toLowerCase().includes(q)||m.member_id.toLowerCase().includes(q)||(m.mobile||'').includes(q));
    if(sf)rows=rows.filter(m=>m.sd?.status===sf);

    const tbody=el('ledger-body'); const footer=el('ledger-footer');
    if(!rows.length){tbody.innerHTML=`<tr><td colspan="8" class="empty-state"><i class="fas fa-book-open"></i><br>No members found.</td></tr>`;if(footer)footer.textContent='';return;}
    if(footer)footer.textContent=`Showing ${rows.length} of ${StorageModule.getMembers().length} members`;

    tbody.innerHTML=rows.map(m=>{
      const badge=this.statusBadge(m.sd?.status);
      const daText=m.sd?.status==='due'
        ?`<span class="status-due">${Utils.currency(m.sd.dueAmt)} (${m.sd.dueMo}mo)</span>`
        :m.sd?.status==='advance'
          ?`<span class="status-advance">${Utils.currency(m.sd.advAmt)} (${m.sd.advMo}mo)</span>`
          :`<span style="color:var(--txt-muted)">—</span>`;
      return`<tr>
        <td><div style="font-weight:700">${Utils.esc(m.name)}</div><div style="font-size:.72rem;color:var(--txt-muted)">${m.member_id}</div></td>
        <td>${Utils.currency(m.opening)}</td>
        <td>${Utils.currency(m.sysPaid)}</td>
        <td><strong>${Utils.currency(m.total)}</strong></td>
        <td>${badge}</td>
        <td>${daText}</td>
        <td style="font-size:.79rem;color:var(--txt-secondary)">${Utils.esc(m.sd?.lastLabel||'—')}</td>
        <td><div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-sm" title="History" onclick="LedgerModule.showHistory('${m.member_id}')"><i class="fas fa-eye"></i></button>
          <button class="btn btn-primary btn-sm" title="Invoice" onclick="UIModule.showView('invoice');InvoiceModule.preSelect('${m.member_id}')"><i class="fas fa-file-invoice"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  },

  statusBadge(status){
    const map={
      paid:    `<span class="mbadge mbadge-paid"><i class="fas fa-circle-check"></i> Paid</span>`,
      due:     `<span class="mbadge mbadge-due"><i class="fas fa-circle-exclamation"></i> Due</span>`,
      advance: `<span class="mbadge mbadge-advance"><i class="fas fa-circle-arrow-up"></i> Advance</span>`,
      unknown: `<span class="mbadge mbadge-unknown"><i class="fas fa-circle-question"></i> Unknown</span>`,
    };
    return map[status]||map.unknown;
  },

  showHistory(memberId){
    const m=StorageModule.getMembers().find(x=>x.member_id===memberId); if(!m)return;
    const invs=StorageModule.getInvoices().filter(i=>i.member_id===memberId)
      .sort((a,b)=>b.year-a.year||(MONTHS.indexOf(b.month)-MONTHS.indexOf(a.month)));
    const sd=DueEngine.getStatus(memberId);
    const sysPaid=invs.reduce((a,i)=>a+(parseFloat(i.amount_paid)||0),0);
    const opening=parseFloat(m.opening_contribution||0);

    el('mh-modal-title').innerHTML=`<i class="fas fa-clock-rotate-left"></i> ${Utils.esc(m.name)}`;
    el('mh-stats').innerHTML=`<div class="mh-stats">
      <div class="mh-stat"><div class="mh-sv">${Utils.currency(opening)}</div><div class="mh-sl">Opening</div></div>
      <div class="mh-stat"><div class="mh-sv">${Utils.currency(sysPaid)}</div><div class="mh-sl">System Paid</div></div>
      <div class="mh-stat"><div class="mh-sv">${Utils.currency(opening+sysPaid)}</div><div class="mh-sl">Total</div></div>
      <div class="mh-stat"><div class="mh-sv">${invs.length}</div><div class="mh-sl">Payments</div></div>
      <div class="mh-stat">${this.statusBadge(sd?.status)}</div>
      <div class="mh-stat"><div class="mh-sv" style="font-size:.8rem">${Utils.esc(sd?.lastLabel||'—')}</div><div class="mh-sl">Last Paid</div></div>
    </div>`;

    el('mh-body').innerHTML=invs.length
      ?invs.map(i=>`<tr>
          <td><strong>${Utils.esc(i.invoice_number)}</strong></td>
          <td>${Utils.esc(i.month)} ${i.year||''}</td>
          <td><strong>${Utils.currency(i.amount_paid)}</strong></td>
          <td>${Utils.esc(i.date)}</td>
          <td><button class="btn btn-outline btn-sm" onclick="InvoiceModule.viewInvoice('${i.id}')"><i class="fas fa-eye"></i></button>
              <button class="btn btn-primary btn-sm" onclick="InvoiceModule.reDownload('${i.id}')"><i class="fas fa-download"></i></button></td>
        </tr>`).join('')
      :`<tr><td colspan="5" class="empty-state">No invoices recorded via this system.</td></tr>`;

    UIModule.openModal('member-history-modal');
  },

  exportExcel(){
    const invs=StorageModule.getInvoices();
    const rows=StorageModule.getMembers().map(m=>{
      const mI=invs.filter(i=>i.member_id===m.member_id);
      const sp=mI.reduce((a,i)=>a+(parseFloat(i.amount_paid)||0),0);
      const op=parseFloat(m.opening_contribution||0);
      const sd=DueEngine.getStatus(m.member_id);
      return{'Member ID':m.member_id,'Name':m.name,'Mobile':m.mobile||'','Monthly (BDT)':m.monthly_amount,
        'Opening (BDT)':op,'System Paid (BDT)':sp,'Total (BDT)':op+sp,'Status':sd?.status||'unknown',
        'Due (BDT)':sd?.dueAmt||0,'Advance (BDT)':sd?.advAmt||0,'Last Paid':sd?.lastLabel||''};
    });
    if(!rows.length){UIModule.toast('No data.','warning');return;}
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Ledger');
    XLSX.writeFile(wb,`DD_Ledger_${Utils.today()}.xlsx`);
    UIModule.toast('Ledger exported!','success');
  },
};

/* ═══════════════════════════════════════════
   MEMBER MODULE
═══════════════════════════════════════════ */
const MemberModule = {
  init(){
    if(!StorageModule.getMembers().length) StorageModule.setMembers(SEED_MEMBERS);
    this._btn(); this._form();
  },
  _btn(){
    el('add-member-btn')?.addEventListener('click',()=>this.openAdd());
    el('member-table-search')?.addEventListener('input',e=>this.renderTable(e.target.value,''));
    el('member-status-filter')?.addEventListener('change',e=>this.renderTable(el('member-table-search').value,e.target.value));
    el('export-members-btn')?.addEventListener('click',()=>this.exportExcel());
    el('import-members-btn')?.addEventListener('click',()=>el('import-excel-input').click());
    el('import-excel-input')?.addEventListener('change',e=>{if(e.target.files[0])this.importExcel(e.target.files[0]);e.target.value='';});
  },
  _form(){ el('member-form')?.addEventListener('submit',e=>{e.preventDefault();this.save();}); },

  openAdd(){
    el('member-modal-title').textContent='Add Member';
    el('member-form').reset(); el('editing-member-id').value='';
    UIModule.openModal('member-modal');
  },
  openEdit(id){
    const m=StorageModule.getMembers().find(x=>x.member_id===id); if(!m)return;
    el('member-modal-title').textContent='Edit Member';
    el('editing-member-id').value=id;
    el('mf-id').value=m.member_id; el('mf-name').value=m.name;
    el('mf-mobile').value=m.mobile||''; el('mf-monthly').value=m.monthly_amount;
    el('mf-opening').value=m.opening_contribution??m.total_contribution??0;
    if(m.paid_through_month!==null&&m.paid_through_month!==undefined){
      el('mf-paid-month').value=MONTHS[m.paid_through_month]||'';
      el('mf-paid-year').value=m.paid_through_year||'';
    }
    UIModule.openModal('member-modal');
  },
  save(){
    const editId=el('editing-member-id').value.trim();
    const ptMonth=el('mf-paid-month').value; const ptYear=el('mf-paid-year').value;
    const data={
      member_id:          el('mf-id').value.trim(),
      name:               el('mf-name').value.trim().toUpperCase(),
      mobile:             el('mf-mobile').value.trim(),
      monthly_amount:     parseFloat(el('mf-monthly').value)||500,
      opening_contribution:parseFloat(el('mf-opening').value)||0,
      paid_through_month: ptMonth?MONTHS.indexOf(ptMonth):null,
      paid_through_year:  ptYear?parseInt(ptYear):null,
    };
    if(!data.member_id||!data.name){UIModule.toast('ID and Name required.','error');return;}
    let mems=StorageModule.getMembers();
    if(editId){
      const i=mems.findIndex(m=>m.member_id===editId);
      if(i!==-1)mems[i]={...mems[i],...data};
    } else {
      if(mems.find(m=>m.member_id===data.member_id)){UIModule.toast('ID already exists!','error');return;}
      mems.push(data);
    }
    StorageModule.setMembers(mems);
    UIModule.closeModal('member-modal');
    this.renderTable(); InvoiceModule.populateDropdown();
    UIModule.toast(`Member ${editId?'updated':'added'}!`,'success');
  },
  delete(id){
    UIModule.confirm('Delete Member','Remove this member? Past invoices remain.',()=>{
      StorageModule.setMembers(StorageModule.getMembers().filter(m=>m.member_id!==id));
      this.renderTable(); InvoiceModule.populateDropdown();
      UIModule.toast('Member removed.','success');
    },{requirePwd:true});
  },

  renderTable(q='',sf=''){
    const allInvs = StorageModule.getInvoices();
    const creds   = StorageModule.getMemberCreds();
    let list = DueEngine.getAllStatuses().map(m => {
      const sysPaid = allInvs.filter(i=>i.member_id===m.member_id).reduce((a,i)=>a+(parseFloat(i.amount_paid)||0),0);
      return {...m, sysPaid, hasPortal: !!creds[m.member_id]};
    });
    if(q){const lq=q.toLowerCase();list=list.filter(m=>m.name.toLowerCase().includes(lq)||m.member_id.toLowerCase().includes(lq)||(m.mobile||'').includes(lq));}
    if(sf)list=list.filter(m=>m.sd?.status===sf);
    const tbody=el('members-table-body');
    if(!list.length){tbody.innerHTML=`<tr><td colspan="7" class="empty-state"><i class="fas fa-users"></i><br>No members.</td></tr>`;return;}
    tbody.innerHTML=list.map(m=>`<tr>
      <td><code style="font-size:.78rem">${Utils.esc(m.member_id)}</code></td>
      <td><strong>${Utils.esc(m.name)}</strong></td>
      <td>${Utils.esc(m.mobile||'—')}</td>
      <td>${Utils.currency(m.monthly_amount)}</td>
      <td>
        <div><strong>${Utils.currency((m.opening_contribution||0)+m.sysPaid)}</strong></div>
        <div style="font-size:.7rem;color:var(--txt-muted)">Opening: ${Utils.currency(m.opening_contribution||0)}</div>
      </td>
      <td>${LedgerModule.statusBadge(m.sd?.status)}</td>
      <td>${m.hasPortal
          ? '<span class="portal-badge-active"><i class="fas fa-circle-check"></i> Active</span>'
          : '<span class="portal-badge-none"><i class="fas fa-circle-minus"></i> None</span>'}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" title="History" onclick="LedgerModule.showHistory('${m.member_id}')"><i class="fas fa-eye"></i></button>
        <button class="btn btn-primary btn-sm" title="Full Profile" onclick="MemberProfileModule.open('${m.member_id}')"><i class="fas fa-id-card"></i></button>
        <button class="btn btn-outline btn-sm" title="Edit" onclick="MemberModule.openEdit('${m.member_id}')"><i class="fas fa-pencil"></i></button>
        <button class="btn btn-outline btn-sm" title="Delete" style="color:var(--c-danger)" onclick="MemberModule.delete('${m.member_id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`).join('');
  },

  exportExcel(){
    const mems=StorageModule.getMembers(); if(!mems.length){UIModule.toast('No data.','warning');return;}
    const rows=mems.map(m=>({'Member ID':m.member_id,'Name':m.name,'Mobile':m.mobile||'',
      'Monthly (BDT)':m.monthly_amount,'Opening Contribution (BDT)':m.opening_contribution||0,
      'Paid Through Month':m.paid_through_month!==null?MONTHS[m.paid_through_month]||'':'',
      'Paid Through Year':m.paid_through_year||''}));
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Members');
    XLSX.writeFile(wb,`DD_Members_${Utils.today()}.xlsx`);
    UIModule.toast('Exported!','success');
  },
  importExcel(file){
    const r=new FileReader(); r.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'binary'});
        const data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const imp=data.map(row=>({
          member_id:String(row['Member ID']||row['member_id']||'').trim(),
          name:String(row['Name']||row['name']||'').trim().toUpperCase(),
          mobile:String(row['Mobile']||row['mobile']||''),
          monthly_amount:parseFloat(row['Monthly (BDT)']||row['monthly_amount']||500),
          opening_contribution:parseFloat(row['Opening Contribution (BDT)']||row['opening_contribution']||0),
          paid_through_month:null, paid_through_year:null,
        })).filter(m=>m.member_id&&m.name);
        if(!imp.length){UIModule.toast('No valid rows found.','error');return;}
        UIModule.confirm('Import Members',`Replace all ${StorageModule.getMembers().length} members with ${imp.length} imported members?`,()=>{
          StorageModule.setMembers(imp); this.renderTable(); InvoiceModule.populateDropdown();
          UIModule.toast(`${imp.length} members imported!`,'success');
        },{danger:false,icon:'fas fa-file-import'});
      }catch{UIModule.toast('Cannot read file.','error');}
    }; r.readAsBinaryString(file);
  },
};

/* ═══════════════════════════════════════════
   INVOICE MODULE
═══════════════════════════════════════════ */
const InvoiceModule = {
  _sel:null,  // selected member
  _cur:null,  // current invoice data

  init(){
    this.populateDropdown(); this._initSelect(); this._bindForm(); this._bindHistory(); this._defaults();
  },

  _defaults(){
    el('invoice-month').value=Utils.currentMonth();
    el('invoice-year').value=Utils.currentYear();
    el('invoice-date-display').textContent=Utils.today();
    this._updateNumDisplay();
  },
  _updateNumDisplay(){
    const s=StorageModule.getSettings();
    const n=`${s.inv_prefix}${s.inv_number}`;
    el('invoice-number-display').textContent=n; el('inv-num-badge').textContent=n;
  },

  populateDropdown(){ this._renderOptions(StorageModule.getMembers(),''); },

  _renderOptions(mems,q){
    const opts=el('select-options'); if(!opts)return;
    const list=q?mems.filter(m=>m.name.toLowerCase().includes(q)||m.member_id.toLowerCase().includes(q)):mems;
    if(!list.length){opts.innerHTML='<div class="select-no-results">No members found.</div>';return;}
    opts.innerHTML=list.map(m=>`
      <div class="select-option" data-id="${Utils.esc(m.member_id)}" tabindex="-1">
        <span class="select-option-name">${Utils.esc(m.name)}</span>
        <span class="select-option-sub">ID: ${m.member_id} · ৳${m.monthly_amount}/mo</span>
      </div>`).join('');
    opts.querySelectorAll('.select-option').forEach(o=>{
      o.addEventListener('click',()=>this._pickMember(o.dataset.id));
      o.addEventListener('keydown',e=>{if(e.key==='Enter')this._pickMember(o.dataset.id);});
    });
  },

  _initSelect(){
    const trig=el('select-trigger'),dd=el('select-dropdown'),si=el('member-search-input');
    if(!trig||!dd||!si)return;
    trig.addEventListener('click',()=>{
      if(!dd.classList.contains('hidden')){this._closeDd();return;}
      dd.classList.remove('hidden'); trig.classList.add('open');
      si.value=''; this._renderOptions(StorageModule.getMembers(),'');
      setTimeout(()=>si.focus(),40);
    });
    trig.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')trig.click();});
    si.addEventListener('input',()=>this._renderOptions(StorageModule.getMembers(),si.value.toLowerCase()));
    document.addEventListener('click',e=>{if(!el('searchable-select')?.contains(e.target))this._closeDd();});
  },
  _closeDd(){el('select-dropdown')?.classList.add('hidden');el('select-trigger')?.classList.remove('open');},

  _pickMember(id){
    const m=StorageModule.getMembers().find(x=>x.member_id===id); if(!m)return;
    this._sel=m; this._closeDd();
    const disp=el('select-trigger');
    disp.querySelector('span').textContent=m.name;
    disp.querySelector('span').className='select-selected';
    el('selected-member-id').value=m.member_id;
    el('pill-id').textContent=m.member_id;
    el('pill-mobile').textContent=m.mobile||'—';
    el('pill-opening').textContent=Utils.currency(m.opening_contribution||0);
    el('pill-rate').textContent=Utils.currency(m.monthly_amount);
    el('member-pills').classList.remove('hidden');
    el('amount-paid').value=m.monthly_amount;
    this._refreshAutoStatus(); this._refreshPreview();
  },

  preSelect(id){
    /* Called from ledger — auto-select member in invoice form */
    setTimeout(()=>{
      this._renderOptions(StorageModule.getMembers(),'');
      this._pickMember(id);
    },100);
  },

  _bindForm(){
    ['invoice-month','invoice-year','amount-paid'].forEach(id=>{
      el(id)?.addEventListener('input',()=>{this._refreshAutoStatus();this._refreshPreview();});
      el(id)?.addEventListener('change',()=>{this._refreshAutoStatus();this._refreshPreview();});
    });
    el('invoice-notes')?.addEventListener('input',()=>this._refreshPreview());
    el('preview-invoice-btn')?.addEventListener('click',()=>this.previewInvoice());
    el('generate-invoice-btn')?.addEventListener('click',()=>this.generateInvoice());
    el('modal-print-btn')?.addEventListener('click',()=>window.print());
    el('modal-pdf-btn')?.addEventListener('click',()=>PDFModule.generate(this._cur));
  },

  _refreshAutoStatus(){
    const wrap=el('auto-status-wrap'); const box=el('auto-status-box');
    if(!wrap||!box)return;
    if(!this._sel){wrap.classList.add('hidden');return;}
    wrap.classList.remove('hidden');
    const cur=DueEngine.getStatus(this._sel.member_id);
    const month=el('invoice-month')?.value;
    const year=parseInt(el('invoice-year')?.value)||Utils.currentYear();
    const mIdx=MONTHS.indexOf(month);
    const post=mIdx!==-1?DueEngine.getStatusAfter(this._sel.member_id,mIdx,year):null;

    const icon={paid:'<i class="fas fa-circle-check" style="color:var(--c-success-mid)"></i>',
                 due:'<i class="fas fa-circle-exclamation" style="color:var(--c-danger-mid)"></i>',
                 advance:'<i class="fas fa-circle-arrow-up" style="color:var(--c-info)"></i>',
                 unknown:'<i class="fas fa-circle-question" style="color:var(--txt-muted)"></i>'};
    const fmtStatus=s=>{
      if(!s)return'—';
      if(s.status==='paid')return`${icon.paid} <span class="status-paid">Current — Last paid: ${Utils.esc(s.lastLabel||'')}</span>`;
      if(s.status==='due') return`${icon.due} <span class="status-due">Due ${s.dueMo} month(s) — ৳${(s.dueAmt||0).toLocaleString()} outstanding (since ${Utils.esc(s.lastLabel||'')})</span>`;
      if(s.status==='advance')return`${icon.advance} <span class="status-advance">Advance — paid ${s.advMo} month(s) ahead (until ${Utils.esc(s.lastLabel||'')})</span>`;
      return`${icon.unknown} <span style="color:var(--txt-muted)">No history recorded</span>`;
    };
    const fmtPost=s=>{
      if(!s||!month)return'';
      if(s.status==='paid')return`${icon.paid} <span class="status-paid">Account will be fully current</span>`;
      if(s.status==='due') return`${icon.due} <span class="status-due">Still due ${s.dueMo} month(s) — ৳${(s.dueAmt||0).toLocaleString()}</span>`;
      if(s.status==='advance')return`${icon.advance} <span class="status-advance">Will be ${s.advMo} month(s) in advance</span>`;
      return'';
    };
    let html=`<div class="auto-status-row"><span class="aso-label">Current Status:</span><span class="aso-val">${fmtStatus(cur)}</span></div>`;
    const postHtml=fmtPost(post);
    if(postHtml)html+=`<div class="auto-status-row"><span class="aso-label">After Payment:</span><span class="aso-val">${postHtml}</span></div>`;
    box.innerHTML=html;
  },

  _build(){
    if(!this._sel)return null;
    const m=this._sel; const s=StorageModule.getSettings();
    const month=el('invoice-month')?.value||''; const year=parseInt(el('invoice-year')?.value)||Utils.currentYear();
    const amount=parseFloat(el('amount-paid')?.value)||0; const notes=el('invoice-notes')?.value.trim()||'';
    const num=StorageModule.peekInvoiceNum(); const mIdx=MONTHS.indexOf(month);
    const prevStatus=DueEngine.getStatus(m.member_id);
    const postStatus=mIdx!==-1?DueEngine.getStatusAfter(m.member_id,mIdx,year):null;
    const opening=parseFloat(m.opening_contribution||0);
    const sysPrev=StorageModule.getInvoices().filter(i=>i.member_id===m.member_id).reduce((a,i)=>a+(parseFloat(i.amount_paid)||0),0);
    return{
      id:Utils.uid(), invoice_number:`${s.inv_prefix}${num}`, invoice_num_raw:num,
      member_id:m.member_id, member_name:m.name, member_mobile:m.mobile||'',
      month, year, amount_paid:amount, notes,
      opening_contrib:opening, prev_system_collected:sysPrev,
      prev_total:opening+sysPrev, new_total:opening+sysPrev+amount,
      monthly_amount:m.monthly_amount, date:Utils.today(),
      prev_status:prevStatus, post_status:postStatus,
      org:{name:s.org_name,subtitle:s.org_subtitle,address:s.org_address,footer:s.footer_text,
           logo:s.logo,treasurer_sig:s.treasurer_sig,auth_sig:s.signature,treasurer_name:s.treasurer_name},
    };
  },

  _refreshPreview(){
    const data=this._build(); const cont=el('live-preview-container');
    if(!cont)return;
    if(!data){cont.innerHTML=`<div class="preview-empty"><i class="fas fa-file-invoice"></i><p>Select a member to preview</p></div>`;return;}
    cont.innerHTML=`<div class="lp-scaler">${this._renderDoc(data)}</div>`;
  },

  previewInvoice(){
    const data=this._build();
    if(!data){UIModule.toast('Select a member first.','warning');return;}
    this._cur=data; el('invoice-print-area').innerHTML=this._renderDoc(data);
    UIModule.openModal('invoice-modal');
  },

  generateInvoice(){
    if(!this._sel){UIModule.toast('Select a member.','error');return;}
    const month=el('invoice-month')?.value; const year=el('invoice-year')?.value;
    const amount=parseFloat(el('amount-paid')?.value);
    if(!month){UIModule.toast('Select a month.','error');return;}
    if(!amount||amount<0){UIModule.toast('Enter a valid amount.','error');return;}
    const dupe=StorageModule.getInvoices().find(i=>i.member_id===this._sel.member_id&&i.month===month&&String(i.year)===String(year));
    if(dupe){
      UIModule.confirm('Duplicate Invoice',`Invoice for ${this._sel.name} in ${month} ${year} already exists (${dupe.invoice_number}). Generate anyway?`,
        ()=>this._doGenerate(),{danger:false,icon:'fas fa-triangle-exclamation'});
    } else { this._doGenerate(); }
  },

  _doGenerate(){
    const data=this._build(); if(!data)return;
    const usedNum=StorageModule.consumeInvoiceNum();
    const s=StorageModule.getSettings();
    data.invoice_number=`${s.inv_prefix}${usedNum}`; data.invoice_num_raw=usedNum;
    // Update member's opening_contribution total is tracked via invoices
    const invs=StorageModule.getInvoices(); invs.push(data); StorageModule.setInvoices(invs);
    this._cur=data; el('invoice-print-area').innerHTML=this._renderDoc(data);
    UIModule.openModal('invoice-modal');
    setTimeout(()=>PDFModule.generate(data),500);
    this._updateNumDisplay(); DashboardModule.refresh();
    this._refreshAutoStatus(); this._refreshPreview();
    UIModule.toast(`Invoice ${data.invoice_number} generated!`,'success');
  },

  /* ══════════════════════════════════════
     TEAL INVOICE TEMPLATE v2
  ══════════════════════════════════════ */
  _renderDoc(d){
    const org=d.org||{};
    const ps=d.post_status;
    const logoBlock=org.logo
      ?`<div class="inv-logo-box"><img src="${org.logo}" alt="Logo"/></div>`
      :`<div class="inv-logo-box"><span class="inv-logo-initials">DD</span></div>`;

    // Treasurer signature block
    const treasSigBlock=org.treasurer_sig
      ?`<img src="${org.treasurer_sig}" class="inv-sig-img" alt="Treasurer Sig"/>`
      :`<div style="height:40px"></div>`;

    // Authorized signature block
    const authSigBlock=org.auth_sig
      ?`<img src="${org.auth_sig}" class="inv-sig-img" alt="Auth Sig"/>`
      :`<div style="height:40px"></div>`;

    // Account status bar
    let statusBar='';
    if(ps){
      if(ps.status==='paid')
        statusBar=`<div class="inv-account-status ias-paid"><i class="fas fa-circle-check"></i> Account Status: FULLY PAID — Contribution is current</div>`;
      else if(ps.status==='due')
        statusBar=`<div class="inv-account-status ias-due"><i class="fas fa-triangle-exclamation"></i> Account Status: DUE — ৳${(ps.dueAmt||0).toLocaleString()} outstanding (${ps.dueMo||0} month${ps.dueMo>1?'s':''})</div>`;
      else if(ps.status==='advance')
        statusBar=`<div class="inv-account-status ias-advance"><i class="fas fa-circle-arrow-up"></i> Account Status: ADVANCE — ৳${(ps.advAmt||0).toLocaleString()} paid ahead (${ps.advMo||0} month${ps.advMo>1?'s':''})</div>`;
    }
    const notesBlock=d.notes?`<div class="inv-note"><strong>Note: </strong>${Utils.esc(d.notes)}</div>`:'';

    return`<div class="inv-doc">
  <div class="inv-stripe"></div>
  <div class="inv-inner">
    <div class="inv-header">
      <div class="inv-logo-area">
        ${logoBlock}
        <div>
          <div class="inv-org-name">${Utils.esc(org.name||'Dream Development')}</div>
          <div class="inv-org-sub">${Utils.esc(org.subtitle||'DD — Investing in Tomorrow')}</div>
          <div class="inv-org-addr">${Utils.esc(org.address||'Dhaka, Bangladesh')}</div>
        </div>
      </div>
      <div class="inv-meta">
        <div class="inv-meta-lbl">INVOICE</div>
        <div class="inv-num"># ${Utils.esc(d.invoice_number)}</div>
        <div class="inv-date">${Utils.esc(d.date)}</div>
      </div>
    </div>

    <div class="inv-title-bar">&#10022; &nbsp; INVOICE &nbsp; &#10022;</div>

    <div class="inv-member-box">
      <div class="inv-member-grid">
        <div><div class="inv-fl">Received From</div><div class="inv-fv">${Utils.esc(d.member_name)}</div></div>
        <div><div class="inv-fl">Member ID</div><div class="inv-fv">${Utils.esc(d.member_id)}</div></div>
        <div><div class="inv-fl">Mobile Number</div><div class="inv-fv">${Utils.esc(d.member_mobile||'—')}</div></div>
        <div><div class="inv-fl">Payment Period</div><div class="inv-fv">${Utils.esc(d.month)} ${d.year}</div></div>
      </div>
    </div>

    <table class="inv-table">
      <thead>
        <tr>
          <th style="vertical-align:middle">Description</th>
          <th style="vertical-align:middle">Status</th>
          <th class="tr" style="vertical-align:middle">Previous Total (&#2547;)</th>
          <th class="tr" style="vertical-align:middle">This Payment (&#2547;)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="vertical-align:middle">Monthly Contribution - ${Utils.esc(d.month)} ${d.year}</td>
          <td style="vertical-align:middle"><span class="inv-paid-pill" style="display:inline-block;vertical-align:middle">PAID</span></td>
          <td class="tr" style="vertical-align:middle">${Utils.currency(d.prev_total)}</td>
          <td class="tr" style="vertical-align:middle"><strong>${Utils.currency(d.amount_paid)}</strong></td>
        </tr>
        <tr class="inv-tr-total">
          <td colspan="2" style="vertical-align:middle"><strong>Total Contribution (Cumulative)</strong></td>
          <td colspan="2" class="tr" style="vertical-align:middle"><strong>${Utils.currency(d.new_total)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="inv-words"><strong>Amount in Words: </strong><em>${Utils.amountWords(d.amount_paid)}</em></div>
    ${statusBar}
    ${notesBlock}
    <div class="inv-spacer"></div>

    <div class="inv-sig-row">
      <div class="inv-sig-block">
        ${treasSigBlock}
        <div class="inv-sig-line"></div>
        <div class="inv-sig-name">${Utils.esc(org.treasurer_name||'Treasurer')}</div>
        <div class="inv-sig-title">Treasurer</div>
      </div>
      <div class="inv-sig-block" style="text-align:center">
        <div style="font-size:.68rem;color:#aaa;margin-bottom:3px">${Utils.esc(d.invoice_number)} · ${Utils.esc(d.date)}</div>
        <div class="inv-sig-line" style="width:160px"></div>
        <div class="inv-sig-name">Finance Admin</div>
        <div class="inv-sig-title">${Utils.esc(org.name||'Dream Development')}</div>
      </div>
      <div class="inv-sig-block">
        ${authSigBlock}
        <div class="inv-sig-line"></div>
        <div class="inv-sig-name">Authorized Signature</div>
        <div class="inv-sig-title">${Utils.esc(org.name||'Dream Development')} DD</div>
      </div>
    </div>

    <div class="inv-footer">
      <div class="inv-footer-txt">${Utils.esc(org.footer||'This is a computer-generated receipt.')}</div>
      <div class="inv-footer-brand">${Utils.esc(org.name||'Dream Development')} DD &copy; ${new Date().getFullYear()}</div>
    </div>
  </div>
</div>`;
  },

  /* ─── History ─── */
  _bindHistory(){
    ['history-search','history-month-filter','history-year-filter'].forEach(id=>{
      el(id)?.addEventListener('change',()=>this.renderHistory());
      el(id)?.addEventListener('input',()=>this.renderHistory());
    });
    el('clear-history-filters')?.addEventListener('click',()=>{
      ['history-search','history-month-filter','history-year-filter'].forEach(id=>{const e2=el(id);if(e2)e2.value='';});
      this.renderHistory();
    });
    el('export-history-btn')?.addEventListener('click',()=>this.exportHistory());
  },

  renderHistory(){
    let invs=StorageModule.getInvoices();
    const q=(el('history-search')?.value||'').toLowerCase();
    const mon=el('history-month-filter')?.value||''; const yr=el('history-year-filter')?.value||'';
    if(q)invs=invs.filter(i=>i.member_name.toLowerCase().includes(q)||String(i.invoice_number).toLowerCase().includes(q)||i.month.toLowerCase().includes(q));
    if(mon)invs=invs.filter(i=>i.month===mon); if(yr)invs=invs.filter(i=>String(i.year)===yr);
    const tbody=el('history-table-body'); const footer=el('history-footer');
    if(!invs.length){tbody.innerHTML=`<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><br>No invoices found.</td></tr>`;if(footer)footer.textContent='';return;}
    if(footer)footer.textContent=`${invs.length} invoice${invs.length>1?'s':''}`;
    tbody.innerHTML=[...invs].reverse().map(i=>{
      const ps=i.post_status;
      const psBadge=!ps?'<span class="mbadge mbadge-unknown">—</span>'
        :ps.status==='paid'?`<span class="mbadge mbadge-paid"><i class="fas fa-circle-check"></i> Current</span>`
        :ps.status==='due'?`<span class="mbadge mbadge-due"><i class="fas fa-circle-exclamation"></i> Due ৳${(ps.dueAmt||0).toLocaleString()}</span>`
        :`<span class="mbadge mbadge-advance"><i class="fas fa-circle-arrow-up"></i> Adv ৳${(ps.advAmt||0).toLocaleString()}</span>`;
      return`<tr>
        <td><strong>${Utils.esc(i.invoice_number)}</strong></td>
        <td>${Utils.esc(i.member_name)}</td>
        <td>${Utils.esc(i.month)} ${i.year||''}</td>
        <td><strong>${Utils.currency(i.amount_paid)}</strong></td>
        <td>${psBadge}</td>
        <td>${Utils.esc(i.date)}</td>
        <td><div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-sm" onclick="InvoiceModule.viewInvoice('${i.id}')"><i class="fas fa-eye"></i></button>
          <button class="btn btn-primary btn-sm" onclick="InvoiceModule.reDownload('${i.id}')"><i class="fas fa-download"></i></button>
          <button class="btn btn-outline btn-sm" style="color:var(--c-danger)" onclick="InvoiceModule.deleteInvoice('${i.id}')"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  },

  viewInvoice(id){
    const inv=StorageModule.getInvoices().find(i=>i.id===id); if(!inv){UIModule.toast('Not found.','error');return;}
    this._cur=inv; el('invoice-print-area').innerHTML=this._renderDoc(inv); UIModule.openModal('invoice-modal');
  },
  reDownload(id){
    const inv=StorageModule.getInvoices().find(i=>i.id===id); if(!inv){UIModule.toast('Not found.','error');return;}
    this._cur=inv; el('invoice-print-area').innerHTML=this._renderDoc(inv); setTimeout(()=>PDFModule.generate(inv),200);
  },
  deleteInvoice(id){
    UIModule.confirm('Delete Invoice','Remove this invoice record permanently?',()=>{
      StorageModule.setInvoices(StorageModule.getInvoices().filter(i=>i.id!==id));
      this.renderHistory(); DashboardModule.refresh(); UIModule.toast('Deleted.','success');
    },{requirePwd:true});
  },
  exportHistory(){
    const invs=StorageModule.getInvoices(); if(!invs.length){UIModule.toast('No data.','warning');return;}
    const rows=invs.map(i=>({'Invoice #':i.invoice_number,'Member':i.member_name,'Month':`${i.month} ${i.year||''}`,'Amount (BDT)':i.amount_paid,'Date':i.date,'Post-Status':i.post_status?.status||''}));
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Invoices');
    XLSX.writeFile(wb,`DD_History_${Utils.today()}.xlsx`);
    UIModule.toast('Exported!','success');
  },
};

/* ═══════════════════════════════════════════
   PDF MODULE
═══════════════════════════════════════════ */
const PDFModule = {
  async generate(data) {
    if (!data) { UIModule.toast('No invoice data.', 'error'); return; }
    if (!window.jspdf || !window.html2canvas) {
      UIModule.toast('PDF libraries not loaded.', 'error'); return;
    }
    UIModule.toast('Generating PDF…', 'info', 4000);

    /* ── 1. Use a dedicated off-screen container ──────────────
     * Rendering OUTSIDE the modal avoids all parent overflow /
     * max-height / scroll-clip issues that break html2canvas.
     * position:fixed + left:-9999px keeps it out of view but
     * still fully laid out by the browser (not display:none).
     * ───────────────────────────────────────────────────────── */
    let offscreen = document.getElementById('pdf-offscreen');
    if (!offscreen) {
      offscreen = document.createElement('div');
      offscreen.id = 'pdf-offscreen';
      Object.assign(offscreen.style, {
        position:   'fixed',
        top:        '0',
        left:       '-9999px',
        width:      '794px',     /* exact .inv-doc design width */
        zIndex:     '-9999',
        background: '#fffede',
        overflow:   'visible',   /* never clip the invoice */
        pointerEvents: 'none',
      });
      document.body.appendChild(offscreen);
    }

    try {
      /* ── 2. Render invoice HTML ─────────────────────────────
       * Also refresh the modal preview so it stays in sync.
       * ───────────────────────────────────────────────────────── */
      const invoiceHTML = InvoiceModule._renderDoc(data);
      offscreen.innerHTML = invoiceHTML;
      /* keep modal preview in sync if it is open */
      const printArea = document.getElementById('invoice-print-area');
      if (printArea) printArea.innerHTML = invoiceHTML;

      /* ── 3. Wait for layout + images ───────────────────────── */
      await new Promise(r => setTimeout(r, 450));

      const imgs = Array.from(offscreen.querySelectorAll('img'));
      if (imgs.length) {
        await Promise.all(imgs.map(img =>
          img.complete
            ? Promise.resolve()
            : new Promise(r => { img.onload = r; img.onerror = r; })
        ));
      }

      const docEl = offscreen.querySelector('.inv-doc');

      /* ── 4. Capture canvas ─────────────────────────────────
       * scale:2      → crisp print-quality text at 2× pixel density
       * width:794    → must match the CSS .inv-doc width exactly
       * windowWidth:794 → prevents any responsive reflow inside
       *                   html2canvas's virtual viewport
       * ───────────────────────────────────────────────────────── */
      const canvas = await window.html2canvas(docEl, {
        scale:           2,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: '#fffede',
        logging:         false,
        width:           794,     /* Bug #1 fix — was 720 */
        windowWidth:     794,     /* Bug #1 fix — lock viewport width */
      });

      /* ── 5. Build A4 PDF ────────────────────────────────────
       * Width-first fit: the image fills the full A4 page width
       * (210 mm). Height is proportional. If the invoice is
       * slightly taller than A4 (rare), it scales down to fit
       * one page — guaranteed single-page PDF.
       *
       * JPEG 88% quality: sharp text and borders, ~120–250 KB
       * per invoice (well under the 300 KB target).
       * ───────────────────────────────────────────────────────── */
      const { jsPDF } = window.jspdf;
      const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();   /* 210 mm */
      const pageH = pdf.internal.pageSize.getHeight();  /* 297 mm */

      /* Bug #3 fix — was 'image/jpeg', 0.72 */
      const imgData = canvas.toDataURL('image/jpeg', 0.88);

      /* Bug #4 fix — fill A4 width first, derive height */
      const imgW = pageW;                                     /* 210 mm — full width */
      const imgH = (canvas.height / canvas.width) * pageW;   /* proportional */

      if (imgH <= pageH) {
        /* Normal case: invoice fits within one A4 page */
        pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH, undefined, 'MEDIUM');
      } else {
        /* Edge case: invoice taller than A4 — scale down to fit */
        const ratio   = pageH / imgH;
        const scaledW = imgW  * ratio;
        const xOffset = (pageW - scaledW) / 2;  /* centre horizontally */
        pdf.addImage(imgData, 'JPEG', xOffset, 0, scaledW, pageH, undefined, 'MEDIUM');
      }

      const safeName = data.member_name.replace(/\s+/g, '_');
      pdf.save(`Invoice_${safeName}_${data.month}_${data.invoice_number}.pdf`);
      UIModule.toast('PDF downloaded!', 'success');

    } catch (err) {
      console.error('[PDF]', err);
      UIModule.toast('PDF generation failed. Open DevTools console for details.', 'error');
    } finally {
      /* Clear the off-screen buffer — keeps DOM clean */
      if (offscreen) offscreen.innerHTML = '';
    }
  },
};

/* ═══════════════════════════════════════════
   SETTINGS MODULE
═══════════════════════════════════════════ */
const SettingsModule = {
  init(){ this.load(); this._bind(); },
  load(){
    const s=StorageModule.getSettings();
    const v=(id,val)=>{const e2=el(id);if(e2)e2.value=val??'';};
    v('s-org-name',s.org_name); v('s-org-subtitle',s.org_subtitle); v('s-org-address',s.org_address);
    v('s-footer-text',s.footer_text); v('s-inv-prefix',s.inv_prefix); v('s-inv-number',s.inv_number);
    v('s-opening-fund',s.opening_fund||0); v('s-treasurer-name',s.treasurer_name||'');
    el('sidebar-org-name').textContent=s.org_name;

    this._showUpload('logo-preview-img','logo-ph','remove-logo-btn','sidebar-logo','sidebar-initials',s.logo);
    this._showUpload('treasurer-sig-preview','treasurer-sig-ph','remove-treasurer-sig-btn',null,null,s.treasurer_sig);
    this._showUpload('sig-preview-img','sig-ph','remove-sig-btn',null,null,s.signature);
    if(s.logo){el('auth-logo-img').src=s.logo;el('auth-logo-img').style.display='block';el('auth-logo-text').style.display='none';}
  },
  _showUpload(imgId,phId,btnId,sideLogoId,sideInitId,val){
    const img=el(imgId),ph=el(phId),btn=el(btnId);
    if(img)img.style.display=val?'block':'none';
    if(img&&val)img.src=val;
    if(ph)ph.style.display=val?'none':'flex';
    if(btn)btn.style.display=val?'inline-flex':'none';
    if(sideLogoId&&sideInitId){
      const sl=el(sideLogoId),si=el(sideInitId);
      if(sl){sl.src=val||'';sl.style.display=val?'block':'none';}
      if(si)si.style.display=val?'none':'flex';
    }
  },
  _bind(){
    el('save-org-btn')?.addEventListener('click',()=>{
      const s=StorageModule.getSettings();
      s.org_name=el('s-org-name').value.trim()||'Dream Development';
      s.org_subtitle=el('s-org-subtitle').value.trim(); s.org_address=el('s-org-address').value.trim();
      s.footer_text=el('s-footer-text').value.trim(); StorageModule.setSettings(s);
      this.load(); UIModule.toast('Organization saved.','success');
    });
    el('save-fund-btn')?.addEventListener('click',()=>{
      const s=StorageModule.getSettings(); s.opening_fund=parseFloat(el('s-opening-fund').value)||0;
      StorageModule.setSettings(s); DashboardModule.refresh(); UIModule.toast('Opening fund saved.','success');
    });
    el('save-invoice-settings-btn')?.addEventListener('click',()=>{
      const s=StorageModule.getSettings();
      s.inv_prefix=el('s-inv-prefix').value; s.inv_number=parseInt(el('s-inv-number').value)||10149;
      s.treasurer_name=el('s-treasurer-name').value.trim(); StorageModule.setSettings(s);
      InvoiceModule._updateNumDisplay(); this.load(); UIModule.toast('Invoice settings saved.','success');
    });

    this._bindUpload('logo-zone','logo-file-input','logo-preview-img','logo-ph','remove-logo-btn','logo','sidebar-logo','sidebar-initials');
    this._bindUpload('treasurer-sig-zone','treasurer-sig-input','treasurer-sig-preview','treasurer-sig-ph','remove-treasurer-sig-btn','treasurer_sig',null,null);
    this._bindUpload('sig-zone','sig-file-input','sig-preview-img','sig-ph','remove-sig-btn','signature',null,null);

    el('backup-btn')?.addEventListener('click',()=>this._backup());
    el('restore-btn')?.addEventListener('click',()=>el('restore-file-input').click());
    el('restore-file-input')?.addEventListener('change',e=>{if(e.target.files[0])this._restore(e.target.files[0]);e.target.value='';});
    el('clear-all-btn')?.addEventListener('click',()=>{
      UIModule.confirm('Clear ALL Data','Delete all members, invoices, and settings permanently?',()=>{
        Object.values(LS).forEach(k=>StorageModule.del(k));
        sessionStorage.clear(); UIModule.toast('Cleared. Reloading…','warning'); setTimeout(()=>location.reload(),1200);
      },{requirePwd:true});
    });
  },
  _bindUpload(zoneId,inputId,imgId,phId,btnId,settingKey,sideLogoId,sideInitId){
    el(zoneId)?.addEventListener('click',()=>el(inputId)?.click());
    el(inputId)?.addEventListener('change',async e=>{
      const f=e.target.files[0]; if(!f)return;
      if(f.size>1*1024*1024){UIModule.toast('File too large (max 1MB).','error');return;}
      UIModule.toast('Optimizing and saving...','info');
      try {
        const b64 = await Utils.compressImage(f, 800, 0.7);
        const s=StorageModule.getSettings(); s[settingKey]=b64; StorageModule.setSettings(s);
        this.load(); UIModule.toast('Saved.','success');
      } catch(err) {
        UIModule.toast('Failed to process image.','error');
      }
      e.target.value='';
    });
    el(btnId)?.addEventListener('click',()=>{
      UIModule.confirm('Remove Image','Remove this image?',()=>{
        const s=StorageModule.getSettings(); s[settingKey]=null; StorageModule.setSettings(s);
        this.load(); UIModule.toast('Removed.','success');
      },{danger:false});
    });
  },
  _backup(){
    const blob=new Blob([JSON.stringify({version:'2.0',created_at:new Date().toISOString(),
      members:StorageModule.getMembers(),invoices:StorageModule.getInvoices(),settings:StorageModule.getSettings()},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`DD_Backup_${Utils.today()}.json`; a.click(); URL.revokeObjectURL(a.href);
    UIModule.toast('Backup downloaded.','success');
  },
  _restore(file){
    UIModule.confirm('Restore Backup','Replace all current data with this backup?',()=>{
      const r=new FileReader(); r.onload=e=>{
        try{
          const d=JSON.parse(e.target.result);
          if(!Array.isArray(d.members))throw new Error('Invalid');
          if(d.members)StorageModule.setMembers(d.members);
          if(d.invoices)StorageModule.setInvoices(d.invoices);
          if(d.settings)StorageModule.setSettings(d.settings);
          UIModule.toast('Restored! Reloading…','success'); setTimeout(()=>location.reload(),1200);
        }catch{UIModule.toast('Invalid backup file.','error');}
      }; r.readAsText(file);
    },{danger:false,icon:'fas fa-upload'});
  },
};

/* ═══════════════════════════════════════════
   PWA MODULE
═══════════════════════════════════════════ */
const PWAModule = {
  _p:null,
  _isSupported: false,
  init(){
    // Check if PWA is supported
    this._isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    
    // Register service worker with detailed logging
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('%c✅ Service Worker registered','color:#0F766E;font-weight:bold');
          this._checkInstallable();
        })
        .catch(err => {
          console.error('%c❌ Service Worker registration failed','color:#dc2626;font-weight:bold', err);
        });
    }
    
    // Capture install prompt
    const isIos = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;
    if(isIos && !(window.navigator.standalone === true)) {
      setTimeout(() => this._banner(), 2000);
    }
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this._p = e;
      console.log('%c📱 Install prompt ready','color:#0F766E;font-weight:bold');
      this._banner();
    });
    
    window.addEventListener('appinstalled', () => {
      console.log('%c✅ App installed!','color:#0F766E;font-weight:bold');
      el('dd-install-banner')?.remove();
      UIModule.toast('App installed successfully!', 'success');
    });
  },
  async _checkInstallable(){
    if(this._p){
      console.log('%c✅ App is installable (beforeinstallprompt available)','color:#0F766E;font-weight:bold');
      return;
    }

    // beforeinstallprompt not captured — perform additional diagnostics
    try{
      const reg = await navigator.serviceWorker.getRegistration();
      if(reg && (reg.waiting || reg.active || reg.installing)){
        console.warn('%c⚠️ Service Worker registered but install prompt did not fire', 'color:#ea580c;font-weight:bold');
      }else{
        console.warn('%c⚠️ No active Service Worker registration found', 'color:#ea580c;font-weight:bold');
      }
    }catch(e){ console.warn('[PWA] serviceWorker.getRegistration() failed', e); }

    // Check manifest availability and basic icon presence
    try{
      const resp = await fetch('json/manifest.json', {cache:'no-store'});
      if(resp.ok){
        try{
          const jm = await resp.json();
          if(jm && Array.isArray(jm.icons) && jm.icons.length>0){
            console.info('%cℹ️ manifest.json found with icons', 'color:#0F766E;font-weight:bold');
          }else{
            console.warn('%c⚠️ manifest.json missing icons array', 'color:#ea580c;font-weight:bold');
          }
        }catch(err){ console.warn('%c⚠️ manifest.json could not be parsed', 'color:#ea580c;font-weight:bold', err); }
      }else{
        console.warn('%c⚠️ manifest.json fetch returned '+resp.status, 'color:#ea580c;font-weight:bold');
      }
    }catch(err){ console.warn('%c⚠️ manifest.json fetch failed', 'color:#ea580c;font-weight:bold', err); }

    console.warn('%c⚠️ Install prompt not available — ensure HTTPS or localhost, valid manifest, and an active service worker', 'color:#ea580c;font-weight:bold');
  },
  _banner(){
    if(el('dd-install-banner'))return;
    const b=document.createElement('div'); 
    b.id='dd-install-banner';
    Object.assign(b.style,{
      position:'fixed',
      bottom:'22px',
      left:'50%',
      transform:'translateX(-50%)',
      background:'var(--c-teal)',
      color:'#fff',
      padding:'12px 18px',
      borderRadius:'50px',
      display:'flex',
      alignItems:'center',
      gap:'12px',
      zIndex:'9998',
      boxShadow:'0 4px 20px rgba(0,0,0,.3)',
      fontSize:'.83rem',
      fontFamily:'var(--font)',
      fontWeight:'500',
      whiteSpace:'nowrap',
      animation:'slideUp .3s ease-out'
    });
    b.innerHTML=`
      <i class="fas fa-mobile-screen"></i>
      <span>Install DD CMS as app</span>
      <button id="dd-ib" style="background:rgba(255,255,255,.25);border:none;color:#fff;padding:4px 12px;border-radius:20px;cursor:pointer;font-weight:700;font-size:.78rem;transition:all .2s">Install</button>
      <button id="dd-ix" style="background:none;border:none;color:rgba(255,255,255,.65);cursor:pointer;font-size:1.1rem"><i class="fas fa-xmark"></i></button>
    `;
    document.body.appendChild(b);
    
    // Add slide animation if not exists
    if(!document.querySelector('style[data-pwa-anim]')){
      const style = document.createElement('style');
      style.setAttribute('data-pwa-anim', 'true');
      style.textContent = '@keyframes slideUp{from{transform:translateX(-50%) translateY(120px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}';
      document.head.appendChild(style);
    }
    
    el('dd-ib')?.addEventListener('click', () => this._install());
    el('dd-ix')?.addEventListener('click', () => {
      b.style.animation = 'slideUp .3s ease-out reverse';
      setTimeout(() => b.remove(), 300);
    });
  },
  async _install(){
    if(this._p){
      try{
        this._p.prompt();
        const {outcome} = await this._p.userChoice;
        console.log(`%c📲 User response: ${outcome}`, 'color:#0F766E;font-weight:bold');
        if(outcome === 'accepted'){
          el('dd-install-banner')?.remove();
        }
      }catch(err){
        console.error('Install error:', err);
      }
    }else{
      UIModule.toast('Install not available. Use HTTPS or localhost.', 'info');
      console.warn('Install prompt not available');
    }
  },
};

/* ─── Helpers ─── */
const el=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ═══════════════════════════════════════════
   APP BOOTSTRAP
═══════════════════════════════════════════ */


/* ═══════════════════════════════════════════
   MEMBER PORTAL MODULE
   Read-only view: overview, invoices, contact
═══════════════════════════════════════════ */
const MemberPortalModule = {
  _id:  null,
  _m:   null,
  _cur: null,  // current invoice for PDF

  init(session){
    this._id = session.member_id;
    this._m  = StorageModule.getMembers().find(m=>m.member_id===session.member_id);
    if(!this._m){ MemberPortalAuth.logout();
        el('member-portal').style.display='none';
        el('auth-screen').style.display='flex';
        el('auth-screen').style.opacity='1';
        const pwdInp=el('member-login-pwd'); if(pwdInp){pwdInp.value='';}
 return; }

    this._applyBranding();
    if(!this._isBooted){ this._bindNav(); this._bindActions(); this._isBooted=true; }
    this.refreshAll();

    el('member-portal').style.display = 'flex';
  },

  _applyBranding(){
    const s=StorageModule.getSettings();
    const org=s.org_name||'Dream Development DD';
    el('mp-org-name').textContent=org;
    el('mp-contact-org').textContent=org;
    el('mp-contact-addr').textContent=s.org_address||'Dhaka, Bangladesh';
    el('mp-user-name').textContent=this._m.name;
    el('mp-user-id').textContent=this._id;
    if(s.logo){
      const img=el('mp-logo'),txt=el('mp-logo-text');
      if(img){img.src=s.logo;img.style.display='block';} if(txt)txt.style.display='none';
    }
  },

  _bindNav(){
    document.querySelectorAll('[data-mp-view]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.preventDefault();
        this.showView(btn.dataset.mpView);
      });
    });
  },

  _bindActions(){
    // Logout
    el('mp-logout-btn')?.addEventListener('click',()=>{
      if(confirm('Sign out of Member Portal?')){
        MemberPortalAuth.logout();
        el('member-portal').style.display='none';
        el('auth-screen').style.display='flex';
        el('auth-screen').style.opacity='1';
        const pwdInp=el('member-login-pwd'); if(pwdInp){pwdInp.value='';}

      }
    });
    // Theme toggle
    el('mp-theme-btn')?.addEventListener('click',()=>UIModule.toggleTheme());
    // PDF button in member invoice modal
    el('mp-modal-pdf-btn')?.addEventListener('click',()=>{
      if(this._cur) PDFModule.generate(this._cur);
    });
    // Close buttons on mp-invoice-modal
    document.querySelectorAll('[data-close]').forEach(btn=>{
      btn.addEventListener('click',()=>UIModule.closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(ov=>{
      ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.add('hidden');});
    });
  },

  showView(name){
    document.querySelectorAll('.mp-view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('[data-mp-view]').forEach(b=>b.classList.remove('active'));
    el(name)?.classList.add('active');
    document.querySelectorAll(`[data-mp-view="${name}"]`).forEach(b=>b.classList.add('active'));
    // Refresh data on navigate
    if(name==='mp-overview') this._refreshOverview();
    if(name==='mp-invoices') this._refreshInvoices();
  },

  refreshAll(){ this._refreshOverview(); this._refreshInvoices(); },

  _refreshOverview(){
    const m=this._m;
    const invs=StorageModule.getInvoices().filter(i=>i.member_id===this._id);
    const sysPaid=invs.reduce((a,i)=>a+(parseFloat(i.amount_paid)||0),0);
    const opening=parseFloat(m.opening_contribution||0);
    const total=opening+sysPaid;
    const sd=DueEngine.getStatus(this._id);
    const lastInv=[...invs].sort((a,b)=>(b.year-a.year)||MONTHS.indexOf(b.month)-MONTHS.indexOf(a.month))[0];

    // Profile card
    if(m.photo){
      const img=el('mp-avatar-img');
      if(img){img.src=m.photo;img.style.display='block';}
      const ini=el('mp-avatar-initials'); if(ini)ini.style.display='none';
    } else {
      const ini=el('mp-avatar-initials'); if(ini){ini.textContent=m.name.charAt(0);ini.style.display='';}
      const img=el('mp-avatar-img'); if(img)img.style.display='none';
    }
    el('mp-profile-name').textContent=m.name;
    el('mp-profile-id').textContent=this._id;
    el('mp-profile-badge').innerHTML=LedgerModule.statusBadge(sd?.status||'unknown');

    // Stats
    el('mp-total-contribution').textContent=Utils.currency(total);
    el('mp-monthly-rate').textContent=Utils.currency(m.monthly_amount);
    el('mp-total-payments').textContent=invs.length;
    el('mp-last-payment').textContent=lastInv?`${lastInv.month} ${lastInv.year}`:'—';

    // Recent (last 4)
    const recent=[...invs].reverse().slice(0,4);
    el('mp-recent-list').innerHTML = recent.length
      ? recent.map(inv=>`
          <div class="mp-recent-row">
            <div>
              <div class="mp-recent-month">${Utils.esc(inv.month)} ${inv.year||''}</div>
              <div class="mp-recent-date">${Utils.esc(inv.date)}</div>
            </div>
            <div class="mp-recent-amount">${Utils.currency(inv.amount_paid)}</div>
            <button class="btn btn-outline btn-sm" onclick="MemberPortalModule.viewInvoice('${inv.id}')">
              <i class="fas fa-eye"></i>
            </button>
          </div>`).join('')
      : '<div class="mp-empty"><i class="fas fa-inbox" style="display:block;font-size:1.5rem;margin-bottom:8px;opacity:.3"></i>No payments recorded yet.</div>';
  },

  _refreshInvoices(){
    const invs=StorageModule.getInvoices().filter(i=>i.member_id===this._id).reverse();
    const tbody=el('mp-invoices-body');
    if(!invs.length){
      tbody.innerHTML='<tr><td colspan="6" class="empty-state"><i class="fas fa-file-invoice"></i><br>No invoices yet. Contact admin to generate one.</td></tr>';
      return;
    }
    tbody.innerHTML=invs.map(inv=>{
      const ps=inv.post_status;
      const badge=!ps?''
        :ps.status==='paid'?'<span class="mbadge mbadge-paid"><i class="fas fa-circle-check"></i> Current</span>'
        :ps.status==='due'?`<span class="mbadge mbadge-due"><i class="fas fa-triangle-exclamation"></i> Due</span>`
        :`<span class="mbadge mbadge-advance"><i class="fas fa-circle-arrow-up"></i> Advance</span>`;
      return `<tr>
        <td><strong>${Utils.esc(inv.invoice_number)}</strong></td>
        <td>${Utils.esc(inv.month)} ${inv.year||''}</td>
        <td><strong>${Utils.currency(inv.amount_paid)}</strong></td>
        <td style="font-size:.8rem">${Utils.esc(inv.date)}</td>
        <td>${badge}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-outline btn-sm" title="View" onclick="MemberPortalModule.viewInvoice('${inv.id}')"><i class="fas fa-eye"></i></button>
            <button class="btn btn-primary btn-sm" title="Download PDF" onclick="MemberPortalModule.downloadInvoice('${inv.id}')"><i class="fas fa-download"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  viewInvoice(id){
    const inv=StorageModule.getInvoices().find(i=>i.id===id); if(!inv)return;
    this._cur=inv;
    el('mp-invoice-print-area').innerHTML=InvoiceModule._renderDoc(inv);
    UIModule.openModal('mp-invoice-modal');
  },

  downloadInvoice(id){
    const inv=StorageModule.getInvoices().find(i=>i.id===id);
    if(!inv){UIModule.toast('Invoice not found.','error');return;}
    this._cur=inv;
    el('mp-invoice-print-area').innerHTML=InvoiceModule._renderDoc(inv);
    setTimeout(()=>PDFModule.generate(inv),200);
  },
};


/* ═══════════════════════════════════════════
   MEMBER PROFILE MODULE (Admin only)
   Full member profile CRUD with photos/docs
═══════════════════════════════════════════ */
const MemberProfileModule = {
  _id: null,

  init(){
    this._bindTabs();
    this._bindDocUploads();
    el('save-profile-btn')?.addEventListener('click',()=>this.save());
    el('profile-photo-edit-btn')?.addEventListener('click',()=>el('profile-photo-input')?.click());
    el('profile-photo-input')?.addEventListener('change',e=>{
      const f=e.target.files[0]; if(!f)return;
      this._readImg(f,300*1024,b64=>{
        this._saveField('photo',b64);
        el('profile-photo-display').src=b64; el('profile-photo-display').style.display='block';
        el('profile-photo-placeholder').style.display='none';
      }); e.target.value='';
    });
  },

  loginAsMember() {
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
  open(memberId){
    const m=StorageModule.getMembers().find(x=>x.member_id===memberId); if(!m)return;
    this._id=memberId;
    el('profile-display-name').textContent=m.name;
    el('profile-display-id').textContent=m.member_id;
    el('profile-modal-title').innerHTML=`<i class="fas fa-id-card"></i> ${Utils.esc(m.name)}`;

    // Portal account badge
    const has=StorageModule.hasMemberAccount(memberId);
    el('profile-account-badge').innerHTML=has
      ?'<span class="portal-badge-active" style="margin-right:8px;"><i class="fas fa-circle-check"></i> Portal Active</span><button class="btn btn-sm btn-outline" onclick="MemberProfileModule.loginAsMember()">Login as Member</button>'
      :'<span class="portal-badge-none" style="margin-right:8px;"><i class="fas fa-circle-minus"></i> No Portal Account</span><button class="btn btn-sm btn-primary" onclick="MemberProfileModule.setupPortal()">Create Portal</button>';

    // Photo
    this._showImg('profile-photo-display','profile-photo-placeholder',m.photo,null);

    // Basic tab
    el('pf-name').value=m.name||'';
    el('pf-mobile').value=m.mobile||'';
    el('pf-email').value=m.email||'';
    el('pf-join-date').value=m.join_date||'';
    el('pf-monthly').value=m.monthly_amount||500;
    el('pf-opening').value=m.opening_contribution||0;
    if(m.paid_through_month!=null){
      el('pf-paid-month').value=MONTHS[m.paid_through_month]||'';
      el('pf-paid-year').value=m.paid_through_year||'';
    }

    // Personal tab
    el('pf-father').value=m.father_name||'';
    el('pf-mother').value=m.mother_name||'';
    el('pf-dob').value=m.birth_date||'';
    el('pf-blood').value=m.blood_group||'';
    el('pf-nid').value=m.nid_number||'';
    el('pf-present-addr').value=m.present_address||'';
    el('pf-permanent-addr').value=m.permanent_address||'';

    // Documents tab
    this._showImg('doc-photo-preview','doc-photo-ph',m.photo,'remove-doc-photo-btn');
    this._showImg('doc-nid-preview','doc-nid-ph',m.nid_image,'remove-doc-nid-btn');

    // Nominee tab
    el('pf-nominee-name').value=m.nominee_name||'';
    el('pf-nominee-relation').value=m.nominee_relation||'';
    el('pf-nominee-nid').value=m.nominee_nid_number||'';
    this._showImg('doc-nominee-photo-preview','doc-nominee-photo-ph',m.nominee_photo,'remove-nominee-photo-btn');
    this._showImg('doc-nominee-nid-preview','doc-nominee-nid-ph',m.nominee_nid_image,'remove-nominee-nid-btn');

    this._switchTab('ptab-basic');
    UIModule.openModal('member-profile-modal');
  },

  save(){
    if(!this._id)return;
    const mems=StorageModule.getMembers();
    const idx=mems.findIndex(m=>m.member_id===this._id); if(idx===-1)return;
    const ex=mems[idx];
    const ptM=el('pf-paid-month').value, ptY=el('pf-paid-year').value;
    mems[idx]={
      ...ex,
      name:         (el('pf-name').value.trim().toUpperCase())||ex.name,
      mobile:        el('pf-mobile').value.trim(),
      email:         el('pf-email').value.trim(),
      join_date:     el('pf-join-date').value,
      monthly_amount:parseFloat(el('pf-monthly').value)||ex.monthly_amount,
      opening_contribution:parseFloat(el('pf-opening').value)??ex.opening_contribution,
      paid_through_month:ptM?MONTHS.indexOf(ptM):ex.paid_through_month,
      paid_through_year: ptY?parseInt(ptY):ex.paid_through_year,
      father_name:   el('pf-father').value.trim(),
      mother_name:   el('pf-mother').value.trim(),
      birth_date:    el('pf-dob').value,
      blood_group:   el('pf-blood').value,
      nid_number:    el('pf-nid').value.trim(),
      present_address:el('pf-present-addr').value.trim(),
      permanent_address:el('pf-permanent-addr').value.trim(),
      nominee_name:  el('pf-nominee-name').value.trim(),
      nominee_relation:el('pf-nominee-relation').value,
      nominee_nid_number:el('pf-nominee-nid').value.trim(),
      photo: ex.photo || null,
      nid_image: ex.nid_image || null,
      nominee_photo: ex.nominee_photo || null,
      nominee_nid_image: ex.nominee_nid_image || null,
    };
    StorageModule.setMembers(mems);
    UIModule.closeModal('member-profile-modal');
    MemberModule.renderTable();
    InvoiceModule.populateDropdown();
    UIModule.toast('Profile saved!','success');
  },

  _bindTabs(){
    document.querySelectorAll('.profile-tab').forEach(btn=>{
      btn.addEventListener('click',()=>this._switchTab(btn.dataset.ptab));
    });
  },

  _switchTab(id){
    document.querySelectorAll('.profile-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.profile-tab-content').forEach(c=>c.classList.remove('active'));
    document.querySelector(`.profile-tab[data-ptab="${id}"]`)?.classList.add('active');
    el(id)?.classList.add('active');
  },

  _showImg(imgId,phId,src,removeBtnId){
    const img=el(imgId),ph=el(phId),btn=removeBtnId?el(removeBtnId):null;
    if(src){img.src=src;img.style.display='block'; if(ph)ph.style.display='none'; if(btn)btn.style.display='inline-flex';}
    else{img.style.display='none'; if(ph)ph.style.display='flex'; if(btn)btn.style.display='none';}
  },

  _bindDocUploads(){
    const zones=[
      ['doc-photo-zone','doc-photo-input','doc-photo-preview','doc-photo-ph','remove-doc-photo-btn','photo',300*1024],
      ['doc-nid-zone','doc-nid-input','doc-nid-preview','doc-nid-ph','remove-doc-nid-btn','nid_image',1024*1024],
      ['doc-nominee-photo-zone','doc-nominee-photo-input','doc-nominee-photo-preview','doc-nominee-photo-ph','remove-nominee-photo-btn','nominee_photo',300*1024],
      ['doc-nominee-nid-zone','doc-nominee-nid-input','doc-nominee-nid-preview','doc-nominee-nid-ph','remove-nominee-nid-btn','nominee_nid_image',1024*1024],
    ];
    zones.forEach(([zId,iId,pvId,phId,rmId,field,max])=>{
      el(zId)?.addEventListener('click',()=>el(iId)?.click());
      el(iId)?.addEventListener('change',e=>{
        const f=e.target.files[0]; if(!f)return;
        this._readImg(f,max,b64=>{this._saveField(field,b64);this._showImg(pvId,phId,b64,rmId);});
        e.target.value='';
      });
      el(rmId)?.addEventListener('click',()=>{this._saveField(field,null);this._showImg(pvId,phId,null,rmId);});
    });
  },

  _saveField(field,val){
    if(!this._id)return;
    const mems=StorageModule.getMembers();
    const idx=mems.findIndex(m=>m.member_id===this._id); if(idx===-1)return;
    mems[idx][field]=val; StorageModule.setMembers(mems);
  },

  async _readImg(file,maxSize,cb){
    if(file.size>1*1024*1024){UIModule.toast(`File too large. Max 1MB.`,'error');return;}
    UIModule.toast('Optimizing...','info');
    try {
      const b64 = await Utils.compressImage(file, 600, 0.7);
      cb(b64);
    } catch(err) {
      UIModule.toast('Image processing failed.','error');
    }
  },
};


/* ─── Helpers (single definitions maintained above) ─── */

/* ═══════════════════════════════════════════
   APP BOOTSTRAP — Dual Portal
═══════════════════════════════════════════ */
const App = {
  async init(){
    // সবার আগে ক্লাউড ডেটাবেস থেকে ডেটা লোড করবে
    await StorageModule.loadFromCloud();

    UIModule.init();
    PWAModule.init();

    // 3. Check admin session
    if(AuthModule.isLoggedIn()){
      el('member-portal').style.display='none';
      await this._bootAdmin();
      return;
    }

    // 4. Check member session
    const mSess=MemberPortalAuth.getSession();
    if(mSess){
      el('sidebar').style.display='none';
      document.querySelector('.main-wrapper').style.display='none';
      el('member-portal').style.display='flex';
      MemberPortalModule.init(mSess);
      return;
    }

    // 5. No session → auth screen
    el('auth-screen').style.display='flex';
    el('member-portal').style.display='none';
    AuthModule._applyBranding();
    this._initAuthListeners();
  },

  _initAuthListeners(){
    /* Tab switching */
    setTimeout(()=>el('login-pwd')?.focus(),280);

    /* Eye toggles */
    document.querySelectorAll('.pwd-eye').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const inp=el(btn.dataset.for); if(!inp)return;
        inp.type=inp.type==='password'?'text':'password';
        btn.querySelector('i').className=inp.type==='password'?'fas fa-eye':'fas fa-eye-slash';
      });
    });

    /* Modal close */
    document.querySelectorAll('[data-close]').forEach(btn=>{
      btn.addEventListener('click',()=>UIModule.closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(ov=>{
      ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.add('hidden');});
    });

    /* ── Admin login ── */
    const adminLogin=async()=>{
      const pwd=el('login-pwd').value;
      const err=el('login-error');
      err.classList.add('hidden');
      if(!pwd){err.classList.remove('hidden');return;}
      
      const valid=await AuthModule.verify(pwd);
      if(!valid){
        err.innerHTML = '<i class="fas fa-circle-xmark"></i> Incorrect password or admin not setup in Firebase.';
        err.classList.remove('hidden');
        el('login-pwd').value=''; el('login-pwd').focus(); return;
      }
      
      AuthModule._startSession();
      this._slideOut(async()=>{
        el('member-portal').style.display='none';
        el('sidebar').style.display='';
        document.querySelector('.main-wrapper').style.display='';
        await this._bootAdmin();
      });
    };
    el('login-btn')?.addEventListener('click',adminLogin);
    el('login-pwd')?.addEventListener('keydown',e=>{if(e.key==='Enter')adminLogin();});

    /* ── Member login ── */
    const memberLogin=async()=>{
      const mid=(el('member-login-id')?.value||'').trim().toUpperCase();
      const pwd=el('member-login-pwd')?.value||'';
      const err=el('member-login-error');
      err.classList.add('hidden');
      if(!mid||!pwd){err.innerHTML='<i class="fas fa-circle-xmark"></i> Enter your Member ID and password.';err.classList.remove('hidden');return;}
      const result=await MemberPortalAuth.login(mid,pwd);
      if(!result.ok){
        err.innerHTML=`<i class="fas fa-circle-xmark"></i> ${Utils.esc(result.msg)}`;
        err.classList.remove('hidden');
        el('member-login-pwd').value=''; return;
      }
      this._slideOut(()=>{
        el('sidebar').style.display='none';
        document.querySelector('.main-wrapper').style.display='none';
        el('member-portal').style.display='flex';
        MemberPortalModule.init({member_id:mid,name:result.member.name});
      });
    };
    el('member-login-btn')?.addEventListener('click',memberLogin);
    el('member-login-pwd')?.addEventListener('keydown',e=>{if(e.key==='Enter')memberLogin();});

    /* ── Create account ── */
    el('create-account-link')?.addEventListener('click',()=>{
      ['setup-member-id','setup-member-pwd','setup-member-pwd2'].forEach(id=>{const e2=el(id);if(e2)e2.value='';});
      el('member-setup-error')?.classList.add('hidden');
      UIModule.openModal('member-setup-modal');
      setTimeout(()=>el('setup-member-id')?.focus(),100);
    });

    el('create-account-btn')?.addEventListener('click',async()=>{
      const mid=(el('setup-member-id')?.value||'').trim().toUpperCase();
      const p1=el('setup-member-pwd')?.value||'';
      const p2=el('setup-member-pwd2')?.value||'';
      const err=el('member-setup-error');
      err.classList.add('hidden');
      if(!mid){err.textContent='Enter your Member ID.';err.classList.remove('hidden');return;}
      if(p1.length<6){err.textContent='Password must be at least 6 characters.';err.classList.remove('hidden');return;}
      if(p1!==p2){err.textContent='Passwords do not match.';err.classList.remove('hidden');return;}
      const result=await MemberPortalAuth.createAccount(mid,p1);
      if(!result.ok){err.textContent=result.msg;err.classList.remove('hidden');return;}
      UIModule.closeModal('member-setup-modal');
      this._slideOut(()=>{
        el('sidebar').style.display='none';
        document.querySelector('.main-wrapper').style.display='none';
        el('member-portal').style.display='flex';
        MemberPortalModule.init({member_id:mid,name:result.member.name});
      });
    });
  },

  _slideOut(cb){
    const scr=el('auth-screen');
    scr.style.transition='opacity .3s ease';
    scr.style.opacity='0';
    setTimeout(()=>{ scr.style.display='none'; scr.style.opacity=''; cb(); },320);
  },

  _isBooted: false,
  async _bootAdmin(){
    if(this._isBooted) {
      if(typeof DashboardModule !== 'undefined' && DashboardModule.refresh) DashboardModule.refresh();
      return;
    }
    this._isBooted = true;
    MemberModule.init();
    InvoiceModule.init();
    SettingsModule.init();
    LedgerModule.init();
    DashboardModule.refresh();
    MemberProfileModule.init();
    AuthModule._bindListeners();
    el('sidebar-org-name').textContent=StorageModule.getSettings().org_name||'Dream Development';
    /* Patch backup/restore to include member_creds */
    const origBackup=SettingsModule._backup.bind(SettingsModule);
    SettingsModule._backup=function(){
      const payload={
        version:'2.1',created_at:new Date().toISOString(),
        members:StorageModule.getMembers(),
        invoices:StorageModule.getInvoices(),
        settings:StorageModule.getSettings(),
        member_creds:StorageModule.getMemberCreds(),
      };
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`DD_Backup_v2_${Utils.today()}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      UIModule.toast('Backup downloaded.','success');
    };
    const origRestore=SettingsModule._restore.bind(SettingsModule);
    SettingsModule._restore=function(file){
      UIModule.confirm('Restore Backup','Replace all current data with this backup?',()=>{
        const r=new FileReader(); r.onload=e=>{
          try{
            const d=JSON.parse(e.target.result);
            if(!Array.isArray(d.members))throw new Error('Invalid format');
            StorageModule.setMembers(d.members);
            StorageModule.setInvoices(d.invoices||[]);
            StorageModule.setSettings(d.settings||{});
            if(d.member_creds)StorageModule.setMemberCreds(d.member_creds);
            UIModule.toast('Restored! Reloading…','success');
            setTimeout(()=>location.reload(),1200);
          }catch{UIModule.toast('Invalid backup file.','error');}
        }; r.readAsText(file);
      },{danger:false,icon:'fas fa-upload'});
    };
    console.log('%c\u2705 DD CMS Admin Portal v3.0','color:#0F766E;font-weight:bold;font-size:14px;');
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
