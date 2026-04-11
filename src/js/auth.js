/* Auth & Firebase Logic - SDK Modular v10+ */

import { auth, db, googleProvider, SUPER_ADMIN_EMAIL, PLANS, LICENSE_DURATIONS, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

// ==========================================================
// UI FUNCTIONS
// ==========================================================

function showLogin() {
  document.getElementById('modal-login').classList.remove('hidden');
  document.getElementById('modal-register').classList.add('hidden');
}

function showRegister() {
  document.getElementById('modal-register').classList.remove('hidden');
  document.getElementById('modal-login').classList.add('hidden');
}

function switchToLogin() {
  showLogin();
}

function switchToRegister() {
  showRegister();
}

function scrollToPlans() {
  document.getElementById('plans').scrollIntoView({ behavior: 'smooth' });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : '❌'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Close modals
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  });
});

// Password toggle
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

// Nav buttons
const btnLoginNav = document.getElementById('btn-login-nav');
const btnRegisterNav = document.getElementById('btn-register-nav');
if (btnLoginNav) btnLoginNav.addEventListener('click', showLogin);
if (btnRegisterNav) btnRegisterNav.addEventListener('click', showRegister);

// ==========================================================
// GOOGLE SIGN IN
// ==========================================================

async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (!userDoc.exists()) {
      // New user, create document
      const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      await setDoc(doc(db, 'users', user.uid), {
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
        approved: true,
        providerId: 'google.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (isSuperAdmin) {
        window.location.href = 'superadmin.html';
      } else {
        showToast('¡Cuenta creada! Redirigiendo...');
        setTimeout(() => {
          window.location.href = 'app.html';
        }, 1000);
      }
    } else {
      const userData = userDoc.data();

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
    console.error('Error Google Sign-In:', error);
    let message = 'Error al iniciar sesión con Google';
    if (error.code === 'auth/popup-closed-by-user') {
      message = 'Inicio de sesión cancelado';
    } else if (error.code === 'auth/popup-blocked') {
      message = 'Permite las ventanas emergentes para usar Google';
    }
    showToast(message, 'error');
  }
}

const btnGoogleLogin = document.getElementById('btn-google-login');
const btnGoogleRegister = document.getElementById('btn-google-register');
if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', signInWithGoogle);
if (btnGoogleRegister) btnGoogleRegister.addEventListener('click', signInWithGoogle);

// ==========================================================
// AUTH: REGISTER
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
        name,
        email: email.toLowerCase(),
        company: company || '',
        role: isSuperAdmin ? 'superadmin' : 'user',
        plan: 'free',
        planStartDate: null,
        planEndDate: null,
        quotesUsedThisMonth: 0,
        lastQuoteReset: new Date().toISOString(),
        isActive: true,
        approved: true,
        providerId: 'email',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (isSuperAdmin) {
        showToast('¡Cuenta de administrador creada! Redirigiendo...');
        setTimeout(() => {
          window.location.href = 'superadmin.html';
        }, 1000);
      } else {
        showToast('¡Cuenta creada! Redirigiendo...');
        setTimeout(() => {
          window.location.href = 'app.html';
        }, 1000);
      }

    } catch (error) {
      console.error('Error registering:', error);
      let message = 'Error al crear la cuenta';
      if (error.code === 'auth/email-already-in-use') {
        message = 'Este email ya está registrado';
      } else if (error.code === 'auth/weak-password') {
        message = 'La contraseña es muy débil';
      }
      showToast(message, 'error');
    }
  });
}

// ==========================================================
// AUTH: LOGIN
// ==========================================================

const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showToast('Completa todos los campos', 'error');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error logging in:', error);
      let message = 'Error al iniciar sesión';
      if (error.code === 'auth/user-not-found') {
        message = 'No existe una cuenta con este email';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Contraseña incorrecta';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Email inválido';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Demasiados intentos. Intenta más tarde.';
      }
      showToast(message, 'error');
    }
  });
}

// ==========================================================
// AUTH STATE LISTENER
// ==========================================================

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentPath = window.location.pathname;

        if (currentPath.includes('index.html') || currentPath === '/' || currentPath === '') {
          if (userData.role === 'superadmin') {
            window.location.href = 'superadmin.html';
          } else if (!userData.isActive) {
            showToast('Tu cuenta está desactivada.', 'error');
            signOut(auth);
          } else {
            window.location.href = 'app.html';
          }
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
  }
});

// ==========================================================
// EXPORT
// ==========================================================

window.logout = function() {
  signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
};
