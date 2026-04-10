/* Auth & Firebase Logic */

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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

// Close modals
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  });
});

// Nav buttons
document.getElementById('btn-login-nav').addEventListener('click', showLogin);
document.getElementById('btn-register-nav').addEventListener('click', showRegister);

// ==========================================================
// AUTH: REGISTER
// ==========================================================

document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const company = document.getElementById('register-company').value.trim();
  
  if (!name || !email || !password) {
    showToast('Completa todos los campos obligatorios', 'error');
    return;
  }
  
  if (password.length < 6) {
    showToast('La contraseña debe tener al menos 6 caracteres', 'error');
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
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    showToast('¡Cuenta creada exitosamente!');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    
    // Redirect based on role
    setTimeout(() => {
      if (isSuperAdmin) {
        window.location.href = '../admin/index.html';
      } else {
        window.location.href = 'app/index.html';
      }
    }, 1000);
    
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
    showToast('¡Bienvenido de vuelta!');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  } catch (error) {
    console.error('Error logging in:', error);
    let message = 'Error al iniciar sesión';
    if (error.code === 'auth/user-not-found') {
      message = 'No existe una cuenta con este email';
    } else if (error.code === 'auth/wrong-password') {
      message = 'Contraseña incorrecta';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Email inválido';
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
        if (window.location.pathname.includes('public/index.html') || 
            window.location.pathname === '/' ||
            window.location.pathname === '/public/') {
          
          if (userData.role === 'superadmin') {
            window.location.href = '../admin/index.html';
          } else {
            // Check if plan is active
            if (userData.plan === 'free') {
              window.location.href = 'app/index.html';
            } else if (userData.planEndDate && new Date(userData.planEndDate) > new Date()) {
              window.location.href = 'app/index.html';
            } else {
              // Plan expired, redirect to app but show upgrade
              window.location.href = 'app/index.html?upgrade=true';
            }
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
    window.location.href = '../public/index.html';
  });
}
