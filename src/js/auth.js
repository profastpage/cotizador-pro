/* Auth & Firebase Logic - SDK Modular v10+ */

import { auth, db, googleProvider, SUPER_ADMIN_EMAIL, signInWithRedirect, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

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
// GOOGLE SIGN IN - Using onAuthStateChanged for reliability
// ==========================================================

let googleUserJustSignedIn = false;

async function signInWithGoogle() {
  try {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    googleUserJustSignedIn = true;
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    showToast('Error al conectar con Google', 'error');
    googleUserJustSignedIn = false;
  }
}

const btnGoogleLogin = document.getElementById('btn-google-login');
const btnGoogleRegister = document.getElementById('btn-google-register');
if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', signInWithGoogle);
if (btnGoogleRegister) btnGoogleRegister.addEventListener('click', signInWithGoogle);

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
      const user = userCredential.user;
      const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      await setDoc(doc(db, 'users', user.uid), {
        name, email: email.toLowerCase(), company: company || '',
        role: isSuperAdmin ? 'superadmin' : 'user',
        plan: 'free', planStartDate: null, planEndDate: null,
        quotesUsedThisMonth: 0, lastQuoteReset: new Date().toISOString(),
        isActive: true, providerId: 'email',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });

      showToast('¡Cuenta creada!');
      setTimeout(() => {
        window.location.replace(isSuperAdmin ? 'superadmin.html' : 'app.html');
      }, 1000);
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
      await signInWithEmailAndPassword(auth, email, password);
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

// ==========================================================
// AUTH STATE LISTENER - Handles ALL auth including Google
// ==========================================================

let authProcessed = false;

onAuthStateChanged(auth, (user) => {
  console.log('🔔 onAuthStateChanged fired:', user ? user.email : 'no user');
  
  if (authProcessed) {
    console.log('⏭️ Already processed, skipping');
    return;
  }
  
  if (!user) {
    console.log('👤 No user - staying on landing');
    return;
  }

  // User IS logged in
  authProcessed = true;
  console.log('✅ User authenticated:', user.email);

  // Check if user exists in Firestore
  getDoc(doc(db, 'users', user.uid))
    .then((userDoc) => {
      console.log('📄 User doc exists:', userDoc.exists());
      
      if (!userDoc.exists()) {
        // NEW user from Google - create account
        const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
        console.log('🆕 New user, superadmin:', isSuperAdmin);
        
        setDoc(doc(db, 'users', user.uid), {
          name: user.displayName || user.email.split('@')[0],
          email: user.email.toLowerCase(),
          company: '',
          role: isSuperAdmin ? 'superadmin' : 'user',
          plan: 'free',
          planStartDate: null,
          planEndDate: null,
          quotesUsedThisMonth: 0,
          lastQuoteReset: new Date().toISOString(),
          isActive: true,
          providerId: user.providerData[0]?.providerId || 'email',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).then(() => {
          console.log('✅ User created, redirecting...');
          showToast('¡Bienvenido!');
          setTimeout(() => {
            window.location.replace(isSuperAdmin ? 'superadmin.html' : 'app.html');
          }, 500);
        }).catch((err) => {
          console.error('❌ Failed to create user:', err);
          showToast('Error al crear cuenta: ' + err.message, 'error');
        });
      } else {
        // EXISTING user - redirect based on role
        const userData = userDoc.data();
        console.log('🔄 Existing user, role:', userData.role);
        
        if (userData.role === 'superadmin') {
          console.log('👑 Redirecting to superadmin');
          window.location.replace('superadmin.html');
        } else if (!userData.isActive) {
          console.log('⛔ Account inactive');
          showToast('Tu cuenta está desactivada.', 'error');
          signOut(auth);
        } else {
          console.log('🚀 Redirecting to app');
          window.location.replace('app.html');
        }
      }
    })
    .catch((error) => {
      console.error('❌ Firestore error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      authProcessed = false;
      showToast('Error de base de datos: ' + error.message, 'error');
    });
});

window.logout = function() {
  signOut(auth).then(() => { window.location.href = 'index.html'; });
};
