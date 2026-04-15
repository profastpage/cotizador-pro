// PWA Install - js/pwa-install.js
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt captured');
    const btn = document.getElementById('btnInstalarApp');
    if (btn) {
        btn.style.display = '';
        btn.disabled = false;
    }
});

async function instalarApp() {
    if (!deferredPrompt) {
        alert('La app ya está instalada o no es compatible con este navegador');
        return;
    }
    console.log('[PWA] Showing install dialog...');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    deferredPrompt = null;
    
    const btn = document.getElementById('btnInstalarApp');
    if (btn) {
        if (outcome === 'accepted') {
            btn.textContent = '✅ Instalando...';
            btn.disabled = true;
        } else {
            btn.style.display = 'none';
        }
    }
}

// Hide button if already installed
window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    const btn = document.getElementById('btnInstalarApp');
    if (btn) btn.style.display = 'none';
    deferredPrompt = null;
});

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnInstalarApp');
    if (btn) {
        btn.style.display = 'none';
        btn.addEventListener('click', instalarApp);
    }
    
    // Hide if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        const section = document.getElementById('install-app-section');
        if (section) section.style.display = 'none';
    }
});
