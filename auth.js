/* Auth & Firebase Logic */

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable Google Sign-In provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

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

function closePendingModal() {
  document.getElementById('modal-pending').classList.add('hidden');
  auth.signOut();
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
document.getElementById('btn-login-nav').addEventListener('click', showLogin);
document.getElementById('btn-register-nav').addEventListener('click', showRegister);

// ==========================================================
// GOOGLE SIGN IN
// ==========================================================

async function signInWithGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;

    // Check if user exists in Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();

    if (!userDoc.exists) {
      // New user, create document
      const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      await db.collection('users').doc(user.uid).set({
        name: user.displayName || user.email.split('@')[0],
        email: user.email.toLowerCase(),
        company: '',
        role: isSuperAdmin ? 'superadmin' : 'user',
        plan: 'free',
        planStartDate: null,
        planEndDate: null,
        quotesUsedThisMonth: 0,
        lastQuoteReset: new Date().toISOString(),
        isActive: false, // Pending approval
        approved: false, // Pending approval
        providerId: 'google.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (isSuperAdmin) {
        // Super admin auto-approved
        await db.collection('users').doc(user.uid).update({
          isActive: true,
          approved: true,
          plan: 'pro',
          licenseDuration: 0 // unlimited
        });
        window.location.href = 'superadmin.html';
      } else {
        // Regular user needs approval
        document.getElementById('modal-pending').classList.remove('hidden');
      }
    } else {
      // Existing user, check role and approval
      const userData = userDoc.data();

      if (userData.role === 'superadmin') {
        window.location.href = 'superadmin.html';
      } else if (!userData.approved) {
        document.getElementById('modal-pending').classList.remove('hidden');
      } else if (!userData.isActive) {
        showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
        auth.signOut();
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

document.getElementById('btn-google-login').addEventListener('click', signInWithGoogle);
document.getElementById('btn-google-register').addEventListener('click', signInWithGoogle);

// ==========================================================
// AUTH: REGISTER
// ==========================================================

document.getElementById('form-register').addEventListener('submit', async (e) => {
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
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Check if super admin
    const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    // Create user document in Firestore
    await db.collection('users').doc(user.uid).set({
      name,
      email: email.toLowerCase(),
      company: company || '',
      role: isSuperAdmin ? 'superadmin' : 'user',
      plan: 'free',
      planStartDate: null,
      planEndDate: null,
      quotesUsedThisMonth: 0,
      lastQuoteReset: new Date().toISOString(),
      isActive: isSuperAdmin, // Super admin auto-approved
      approved: isSuperAdmin, // Others need approval
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
      showToast('¡Cuenta creada! Pendiente de aprobación.');
      document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
      document.getElementById('modal-pending').classList.remove('hidden');
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

// ==========================================================
// AUTH: LOGIN
// ==========================================================

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('Completa todos los campos', 'error');
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
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

// ==========================================================
// AUTH STATE LISTENER
// ==========================================================

auth.onAuthStateChanged(async (user) => {
  if (user) {
    // User is logged in, check role and redirect
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();

        // If on landing page, redirect
        const currentPath = window.location.pathname;
        if (currentPath.includes('index.html') ||
            currentPath === '/' ||
            currentPath === '/public/' ||
            currentPath === '') {

          if (userData.role === 'superadmin') {
            window.location.href = 'superadmin.html';
          } else if (!userData.approved) {
            // Pending approval
            auth.signOut();
            document.getElementById('modal-pending').classList.remove('hidden');
          } else if (!userData.isActive) {
            showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
            auth.signOut();
          } else if (userData.plan === 'free') {
            window.location.href = 'app.html';
          } else if (userData.planEndDate && new Date(userData.planEndDate) > new Date()) {
            window.location.href = 'app.html';
          } else if (userData.licenseDuration === 0) {
            // Unlimited license
            window.location.href = 'app.html';
          } else {
            // Plan expired, redirect to app but show upgrade
            window.location.href = 'app.html?upgrade=true';
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

function logout() {
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
}
