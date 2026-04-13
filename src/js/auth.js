/* Auth & Firebase Logic - SDK Modular v10+ */

import { auth, db, googleProvider, SUPER_ADMIN_EMAIL, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

// ==========================================================
// UI FUNCTIONS
// ==========================================================

function showLogin() {
  document.getElementById('modal-login').classList.remove('hidden');
  document.getElementById('modal-register').classList.add('hidden');
}
window.showLogin = showLogin;

function showRegister() {
  document.getElementById('modal-register').classList.remove('hidden');
  document.getElementById('modal-login').classList.add('hidden');
}
window.showRegister = showRegister;

function switchToLogin() { showLogin(); }
window.switchToLogin = switchToLogin;

function switchToRegister() { showRegister(); }
window.switchToRegister = switchToRegister;

function scrollToPlans() {
  document.getElementById('plans').scrollIntoView({ behavior: 'smooth' });
}
window.scrollToPlans = scrollToPlans;

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
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
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
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
// GOOGLE SIGN IN
// ==========================================================

async function signInWithGoogle() {
  try {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    showToast('Error al conectar con Google', 'error');
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
      // NEW user - create account
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
      
      showToast('¡Bienvenido!');
      setTimeout(() => {
        window.location.replace(isSuperAdmin ? 'superadmin.html' : 'app.html');
      }, 500);
    } else {
      // EXISTING user - redirect based on role
      const userData = userDoc.data();
      console.log('🔄 Existing user, role:', userData.role);
      
      if (userData.role === 'superadmin') {
        window.location.replace('superadmin.html');
      } else if (!userData.isActive) {
        showToast('Tu cuenta está desactivada.', 'error');
        signOut(auth);
      } else {
        window.location.replace('app.html');
      }
    }
  } catch (error) {
    console.error('❌ Error processing user:', error);
    showToast('Error: ' + error.message, 'error');
    userProcessed = false;
  }
}

// ==========================================================
// INITIALIZE - Firebase Official Flow
// ==========================================================

// Step 1: Check if user is returning from Google redirect
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      console.log('🔄 Google redirect detected, processing user...');
      processUser(result.user);
    } else {
      console.log('ℹ️ No redirect result, setting up auth listener...');
      // Step 2: No redirect - just listen for auth changes
      onAuthStateChanged(auth, (user) => {
        if (user && !userProcessed) {
          processUser(user);
        }
      });
    }
  })
  .catch((error) => {
    console.error('❌ Redirect result error:', error);
    // Fallback: still set up auth listener
    onAuthStateChanged(auth, (user) => {
      if (user && !userProcessed) {
        processUser(user);
      }
    });
  });

// ==========================================================
// EMAIL/PASSWORD REGISTER
// ==========================================================

const formRegister = document.getElementById('form-register');
if (formRegister) {
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;
    const company = document.getElementById('register-company').value.trim();

    if (!name || !email || !password || !passwordConfirm) {
      showToast('Completa todos los campos obligatorios', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await processUser(userCredential.user);
    } catch (error) {
      console.error('Register Error:', error);
      let message = 'Error al crear la cuenta';
      if (error.code === 'auth/email-already-in-use') message = 'Este email ya está registrado';
      else if (error.code === 'auth/weak-password') message = 'La contraseña es muy débil';
      showToast(message, 'error');
    }
  });
}

// ==========================================================
// EMAIL/PASSWORD LOGIN
// ==========================================================

const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showToast('Completa todos los campos', 'error'); return; }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await processUser(userCredential.user);
    } catch (error) {
      console.error('Login Error:', error);
      let message = 'Error al iniciar sesión';
      if (error.code === 'auth/user-not-found') message = 'No existe una cuenta con este email';
      else if (error.code === 'auth/wrong-password') message = 'Contraseña incorrecta';
      else if (error.code === 'auth/invalid-email') message = 'Email inválido';
      else if (error.code === 'auth/too-many-requests') message = 'Demasiados intentos. Intenta más tarde.';
      showToast(message, 'error');
    }
  });
}

window.logout = function() {
  signOut(auth).then(() => { window.location.href = 'index.html'; });
};

// ==========================================================
// PASSWORD RESET
// ==========================================================

window.showForgotPassword = function() {
  document.getElementById('modal-login').classList.add('hidden');
  document.getElementById('modal-forgot').classList.remove('hidden');
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
      document.getElementById('modal-forgot').classList.add('hidden');
      document.getElementById('form-forgot-password').reset();
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
