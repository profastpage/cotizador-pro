/* Auth & Firebase Logic - SDK Modular v10+ */

import { auth, db, googleProvider, SUPER_ADMIN_EMAIL, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, linkWithCredential, fetchSignInMethodsForEmail, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

// ==========================================================
// UI FUNCTIONS
// ==========================================================

function showLogin() {
  const modal = document.getElementById('modal-login');
  if(modal) {
    modal.classList.remove('hidden');
    const regModal = document.getElementById('modal-register');
    if(regModal) regModal.classList.add('hidden');
  }
}
window.showLogin = showLogin;

function showRegister() {
  const modal = document.getElementById('modal-register');
  if(modal) {
    modal.classList.remove('hidden');
    const loginModal = document.getElementById('modal-login');
    if(loginModal) loginModal.classList.add('hidden');
  }
}
window.showRegister = showRegister;

function switchToLogin() { showLogin(); }
window.switchToLogin = switchToLogin;

function switchToRegister() { showRegister(); }
window.switchToRegister = switchToRegister;

function scrollToPlans() {
  const plans = document.getElementById('plans');
  if(plans) plans.scrollIntoView({ behavior: 'smooth' });
}
window.scrollToPlans = scrollToPlans;

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) { console.warn('Toast container not found'); return; }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  toast.style.cssText = "background:white; color:#333; padding:12px 20px; border-radius:8px; margin-bottom:10px; box-shadow:0 4px 12px rgba(0,0,0,0.15); display:flex; align-items:center; gap:10px; animation:slideIn 0.3s ease;";
  
  container.appendChild(toast);
  setTimeout(() => { 
    toast.style.opacity = '0'; 
    setTimeout(() => toast.remove(), 300); 
  }, 3000);
}

document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  });
});

document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const inputId = btn.dataset.toggle;
    const input = document.getElementById(inputId);
    if (input && input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else if (input) {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  });
});

const btnLoginNav = document.getElementById('btn-login-nav');
const btnRegisterNav = document.getElementById('btn-register-nav');
if (btnLoginNav) btnLoginNav.addEventListener('click', showLogin);
if (btnRegisterNav) btnRegisterNav.addEventListener('click', showRegister);

// ==========================================================
// GOOGLE SIGN IN - Using Popup with Account Linking
// ==========================================================

async function signInWithGoogle() {
  try {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    console.log('[Auth] Google sign-in with popup...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('[Auth] Google popup success:', result.user.email);
    
    const methods = await fetchSignInMethodsForEmail(auth, result.user.email);
    if (methods && methods.includes('password')) {
      const providers = result.user.providerData.map(p => p.providerId);
      if (!providers.includes('password')) {
        console.log('[Auth] Email has password account but not linked yet');
        showLinkingModal(result.user, 'google');
        return;
      }
    }
    
    await processUser(result.user);
  } catch (error) {
    console.error('[Auth] Google Sign-In Error:', error);
    if (error.code === 'auth/account-exists-with-different-credential') {
      showLinkingModal(error, 'google');
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.log('[Auth] Popup closed by user');
    } else if (error.code === 'auth/popup-blocked') {
      showToast('Pop-up bloqueado. Permite pop-ups en este sitio.', 'error');
    } else {
      showToast('Error al conectar con Google', 'error');
    }
  }
}

const btnGoogleLogin = document.getElementById('btn-google-login');
const btnGoogleRegister = document.getElementById('btn-google-register');
if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', signInWithGoogle);
if (btnGoogleRegister) btnGoogleRegister.addEventListener('click', signInWithGoogle);

// ==========================================================
// PROCESS USER - Create or redirect
// ==========================================================

let userProcessed = false;

async function processUser(user) {
  if (userProcessed || !user) return;
  userProcessed = true;
  
  console.log('✅ Processing user:', user.email);
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      console.log('🆕 New user, creating account...', isSuperAdmin ? 'as Super Admin' : 'as User');
      
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName || user.email.split('@')[0],
        email: user.email.toLowerCase(),
        company: '',
        role: isSuperAdmin ? 'superadmin' : 'user',
        plan: 'free',
        licenseDuration: 0,
        planStartDate: null,
        planEndDate: null,
        quotesUsedThisMonth: 0,
        lastQuoteReset: new Date().toISOString(),
        isActive: true,
        providerId: user.providerData[0]?.providerId || 'email',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      showToast('¡Bienvenido! Cuenta creada exitosamente.');
      setTimeout(() => {
        window.location.href = isSuperAdmin ? 'superadmin.html' : 'app.html';
      }, 800);
    } else {
      const userData = userDoc.data();
      console.log('🔄 Existing user, role:', userData.role);
      
      if (userData.role === 'superadmin') {
        window.location.href = 'superadmin.html';
      } else if (!userData.isActive) {
        showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
        signOut(auth);
      } else {
        window.location.href = 'app.html';
      }
    }
  } catch (error) {
    console.error('❌ Error processing user:', error);
    showToast('Error: ' + error.message, 'error');
    userProcessed = false;
  }
}

// ==========================================================
// INITIALIZE - Listen for auth state changes
// ==========================================================

onAuthStateChanged(auth, (user) => {
  if (user && !userProcessed) {
    processUser(user);
  }
});

// ==========================================================
// FUNCIONES DE LOGIN EXPLÍCITAS (EXPORTADAS)
// ==========================================================

export async function loginWithEmail(email, password) {
  try {
    console.log('📧 Iniciando Email Login...');
    if (!email || !password) throw new Error('Faltan datos');
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods && methods.includes('google.com')) {
      const providers = userCredential.user.providerData.map(p => p.providerId);
      if (!providers.includes('google.com')) {
        console.log('[Auth] User has Google but entered with email - offer to link');
        showLinkingModal(userCredential.user, 'email');
        return;
      }
    }
    
    await processUser(userCredential.user);
    return userCredential.user;
    
  } catch (error) {
    console.error('Login Error:', error);
    let message = 'Error al iniciar sesión';
    if (error.code === 'auth/user-not-found') message = 'No existe una cuenta con este email';
    else if (error.code === 'auth/wrong-password') message = 'Contraseña incorrecta';
    else if (error.code === 'auth/invalid-email') message = 'Email inválido';
    else if (error.code === 'auth/too-many-requests') message = 'Demasiados intentos. Intenta más tarde.';
    else if (error.code === 'auth/account-exists-with-different-credential') {
      showLinkingModal(error, 'email');
      return;
    }
    showToast(message, 'error');
    throw error;
  }
}

export async function registerWithEmail(email, password, name = '', company = '') {
  try {
    console.log('📝 Registrando nuevo usuario...');
    if (!email || !password) throw new Error('Faltan datos');
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
    
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods && methods.includes('google.com')) {
      throw new Error('Este email ya está registrado con Google. Usa "Iniciar con Google".');
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    if (name) {
      await userCredential.user.updateProfile({ displayName: name });
    }
    
    await processUser(userCredential.user);
    return userCredential.user;
    
  } catch (error) {
    console.error('Register Error:', error);
    let message = 'Error al crear la cuenta';
    if (error.code === 'auth/email-already-in-use') message = 'Este email ya está registrado';
    else if (error.code === 'auth/weak-password') message = 'La contraseña es muy débil (mínimo 6 caracteres)';
    else if (error.code === 'auth/invalid-email') message = 'Email inválido';
    showToast(message, 'error');
    throw error;
  }
}

// ==========================================================
// ACCOUNT LINKING MODAL
// ==========================================================

function showLinkingModal(userOrError, method) {
  const email = userOrError.email || userOrError.user?.email;
  if (!email) {
    showToast('Error: No se pudo identificar la cuenta', 'error');
    return;
  }
  
  const otherMethod = method === 'google' ? 'email y contraseña' : 'Google';
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); display: flex; align-items: center;
    justify-content: center; z-index: 10000; padding: 20px;
  `;
  
  modal.innerHTML = `
    <div style="background: var(--color-card, #fff); border-radius: 16px; padding: 24px; max-width: 400px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
      <h3 style="margin: 0 0 16px; color: var(--color-text-primary, #0f172a);">🔗 Vincular Cuentas</h3>
      <p style="margin: 0 0 20px; color: var(--color-text-secondary, #475569);">
        El email <strong>${email}</strong> ya tiene una cuenta registrada con <strong>${otherMethod}</strong>.
        <br><br>¿Qué deseas hacer?
      </p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="btn-link-accounts" style="background: var(--color-primary, #1e40af); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">✅ Usar misma cuenta (vincular)</button>
        <button id="btn-signin-other" style="background: var(--color-bg-tertiary, #f1f5f9); color: var(--color-text-primary, #0f172a); border: 1px solid var(--color-border, #e2e8f0); padding: 12px 20px; border-radius: 8px; font-weight: 500; cursor: pointer;">🔁 Iniciar con ${otherMethod}</button>
        <button id="btn-cancel-link" style="background: transparent; color: var(--color-text-muted, #64748b); border: none; padding: 8px; cursor: pointer;">Cancelar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#btn-link-accounts').onclick = async () => {
    modal.remove();
    try {
      if (method === 'google') {
        const password = await promptForPassword(email);
        if (!password) return;
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await linkWithCredential(cred.user, userOrError.credential);
        showToast('✅ Cuentas vinculadas exitosamente', 'success');
        processUser(cred.user);
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        showToast('✅ Vincula tu cuenta en Ajustes > Seguridad', 'info');
        processUser(result.user);
      }
    } catch (err) {
      console.error('Link error:', err);
      showToast('Error al vincular: ' + err.message, 'error');
    }
  };
  
  modal.querySelector('#btn-signin-other').onclick = () => {
    modal.remove();
    if (method === 'google') {
      showToast('Inicia sesión con tu email y contraseña', 'info');
      showLogin();
    } else {
      signInWithGoogle();
    }
  };
  
  modal.querySelector('#btn-cancel-link').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function promptForPassword(email) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); display: flex; align-items: center;
      justify-content: center; z-index: 10001; padding: 20px;
    `;
    
    modal.innerHTML = `
      <div style="background: var(--color-card, #fff); border-radius: 16px; padding: 24px; max-width: 400px; width: 100%;">
        <h3 style="margin: 0 0 16px; color: var(--color-text-primary, #0f172a);">🔐 Ingresa tu contraseña</h3>
        <p style="margin: 0 0 20px; color: var(--color-text-muted, #64748b);">Para vincular con Google, confirma tu identidad:</p>
        <input type="email" value="${email}" disabled style="width: 100%; padding: 10px; margin-bottom: 12px; border-radius: 6px; border: 1px solid var(--color-border, #e2e8f0); background: var(--color-bg-secondary, #f8fafc);">
        <input type="password" id="link-password" placeholder="Contraseña" style="width: 100%; padding: 10px; margin-bottom: 20px; border-radius: 6px; border: 1px solid var(--color-border, #e2e8f0);">
        <div style="display: flex; gap: 12px;">
          <button id="btn-confirm-pass" style="flex: 1; background: var(--color-primary, #1e40af); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">Confirmar</button>
          <button id="btn-cancel-pass" style="flex: 1; background: var(--color-bg-tertiary, #f1f5f9); color: var(--color-text-primary, #0f172a); border: 1px solid var(--color-border, #e2e8f0); padding: 12px; border-radius: 8px; cursor: pointer;">Cancelar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#link-password');
    const confirmBtn = modal.querySelector('#btn-confirm-pass');
    const cancelBtn = modal.querySelector('#btn-cancel-pass');
    
    const handleConfirm = () => {
      const pass = input.value;
      modal.remove();
      resolve(pass || null);
    };
    
    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = () => { modal.remove(); resolve(null); };
    input.onkeydown = (e) => { if (e.key === 'Enter') handleConfirm(); };
    input.focus();
  });
}

// ==========================================================
// ROUTE PROTECTION - VERSIÓN CORREGIDA SIN BUCLES
// ==========================================================

let authCheckInProgress = false;
let isLoggingOut = false;
let isInitialized = false;

export function protectRoute(requiredAuth = true) {
  if (authCheckInProgress) return;
  authCheckInProgress = true;

  const path = window.location.pathname;
  const isLoginPage = path.includes('index.html') || path.endsWith('/') || path === '';
  
  console.log('🛡️ ProtectRoute:', path, 'IsLogin?', isLoginPage);

  onAuthStateChanged(auth, (user) => {
    if (isLoggingOut) {
      authCheckInProgress = false;
      return;
    }

    if (requiredAuth && !user) {
      if (!isLoginPage) {
        console.log('🔐 Sin usuario. Redirigiendo a index.html...');
        localStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = '/index.html';
      }
    } else if (user) {
      if (isLoginPage) {
        console.log('✅ Usuario logueado en login. Redirigiendo a app.html...');
        const redirect = localStorage.getItem('redirectAfterLogin') || '/app.html';
        localStorage.removeItem('redirectAfterLogin');
        window.location.href = redirect;
      } else {
        console.log('✅ Acceso concedido a:', path);
        updateUI(user);
        saveSession(user);
        
        if (!isInitialized) {
          isInitialized = true;
          onAppReady(user);
        }
      }
    }
    authCheckInProgress = false;
  });
}

// ==========================================================
// LOGOUT SEGURO - VERSIÓN CORREGIDA
// ==========================================================

window.logout = async function() {
  if (isLoggingOut) return;
  isLoggingOut = true;

  try {
    console.log('🚪 Iniciando logout...');
    clearSession();
    await signOut(auth);
    
    showToast('Sesión cerrada correctamente', 'info');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    window.location.href = '/index.html';
    
  } catch (error) {
    console.error('Error logout:', error);
    clearSession();
    window.location.href = '/index.html';
  } finally {
    isLoggingOut = false;
  }
};

// ==========================================================
// SESSION UTILITIES
// ==========================================================

function clearSession() {
  localStorage.removeItem('cotizapro_session');
  localStorage.removeItem('redirectAfterLogin');
  window.currentUser = null;
  isInitialized = false;
}

function saveSession(user) {
  const sessionData = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };
  localStorage.setItem('cotizapro_session', JSON.stringify(sessionData));
}

function updateUI(user) {
  const nameEls = document.querySelectorAll('.user-name');
  const emailEls = document.querySelectorAll('.user-email');
  const photoEls = document.querySelectorAll('.user-photo');
  
  nameEls.forEach(el => el.textContent = user.displayName || 'Usuario');
  emailEls.forEach(el => el.textContent = user.email || '');
  photoEls.forEach(el => { if (user.photoURL) el.src = user.photoURL; });
}

function onAppReady(user) {
  console.log('🚀 App ready for user:', user.email);
}

// Expose globally
window.protectRoute = protectRoute;
window.cotizaAuth = {
  loginWithGoogle: signInWithGoogle,
  loginWithEmail,
  registerWithEmail,
  logout: window.logout,
  getCurrentUser: () => auth.currentUser,
  protectRoute
};

window.showForgotPassword = function() {
  const loginModal = document.getElementById('modal-login');
  const forgotModal = document.getElementById('modal-forgot');
  if(loginModal) loginModal.classList.add('hidden');
  if(forgotModal) forgotModal.classList.remove('hidden');
};

const formForgot = document.getElementById('form-forgot-password');
if (formForgot) {
  formForgot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) {
      showToast('Ingresa tu email', 'error');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('¡Email de recuperación enviado! Revisa tu bandeja.', 'success');
      const forgotModal = document.getElementById('modal-forgot');
      if(forgotModal) forgotModal.classList.add('hidden');
      formForgot.reset();
    } catch (error) {
      console.error('Password reset error:', error);
      let message = 'Error al enviar el email de recuperación';
      if (error.code === 'auth/user-not-found') message = 'No existe una cuenta con este email';
      else if (error.code === 'auth/invalid-email') message = 'Email inválido';
      else if (error.code === 'auth/too-many-requests') message = 'Demasiados intentos. Intenta más tarde.';
      showToast(message, 'error');
    }
  });
}

console.log('✅ Auth System Loaded (Final Version)');