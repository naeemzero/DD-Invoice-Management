const fs = require('fs');

let js = fs.readFileSync('js/script.js', 'utf8');

// Update _banner in PWAModule
const pwaBannerLogic = `
  _banner(){
    if(el('dd-install-banner'))return;
    const isIos = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    // Don't show if already installed
    if(isStandalone) return;
    
    // Only show if we have prompt OR if it's iOS (since iOS doesn't support the prompt API but supports manual install)
    if(!this._p && !isIos) return;

    const b=document.createElement('div'); 
    b.id='dd-install-banner';
    Object.assign(b.style,{
      position:'fixed', bottom:'22px', left:'50%', transform:'translateX(-50%)',
      background:'var(--bg-sidebar)', color:'#fff', padding:'12px 18px',
      borderRadius:'50px', display:'flex', alignItems:'center', gap:'12px',
      zIndex:'9999', boxShadow:'var(--sh-xl)', fontSize:'.85rem', fontWeight:'500',
      whiteSpace: 'nowrap', cursor: 'pointer'
    });
    
    if(isIos) {
      b.innerHTML = '<i class="fab fa-apple" style="font-size:1.2rem;"></i> <span>Install App: Tap <i class="fas fa-arrow-up-from-bracket"></i> then "Add to Home Screen"</span><button id="dd-close-install" style="background:none;border:none;color:#fff;margin-left:8px;"><i class="fas fa-times"></i></button>';
    } else {
      b.innerHTML = '<i class="fas fa-download" style="font-size:1.1rem; color:var(--c-warning);"></i> <span>Install DD CMS App</span> <button id="dd-install-btn" style="background:#fff; color:var(--c-teal); border:none; padding:6px 14px; border-radius:20px; font-weight:700; cursor:pointer;">Install</button><button id="dd-close-install" style="background:none;border:none;color:#fff;margin-left:8px;"><i class="fas fa-times"></i></button>';
    }
    
    document.body.appendChild(b);
    
    el('dd-install-btn')?.addEventListener('click', async(e)=>{
      e.stopPropagation();
      if(!this._p) return;
      this._p.prompt();
      const res = await this._p.userChoice;
      if(res.outcome==='accepted'){ b.remove(); this._p = null; }
    });
    
    el('dd-close-install')?.addEventListener('click', (e)=>{
      e.stopPropagation();
      b.remove();
      // Keep closed for session
      sessionStorage.setItem('dd_pwa_dismissed', '1');
    });
    
    if(sessionStorage.getItem('dd_pwa_dismissed') === '1') {
      b.style.display = 'none';
    }
  },
`;

js = js.replace(/_banner\(\)\{[\s\S]*?opacity='0';\s*setTimeout\(\(\)=>b\.remove\(\),300\);\s*\}\);\s*\}/, pwaBannerLogic.trim());

// We also need to add iOS detection to PWAModule.init() to call _banner() even if _p is null
js = js.replace(/window\.addEventListener\('beforeinstallprompt', e => \{/, `const isIos = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;
    if(isIos && !(window.navigator.standalone === true)) {
      setTimeout(() => this._banner(), 2000);
    }
    window.addEventListener('beforeinstallprompt', e => {`);

fs.writeFileSync('js/script.js', js);
console.log('Patched PWAModule!');
