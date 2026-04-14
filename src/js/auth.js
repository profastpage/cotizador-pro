/* Auth & Firebase Logic - SDK Modular v10+ */
/* v2.1.0 - Con sistema de recuperación de cuentas y migración de datos */

import { auth, db, googleProvider, SUPER_ADMIN_EMAIL, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, linkWithCredential, fetchSignInMethodsForEmail, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

// ==========================================================
// UI FUNCTIONS
// ==========================================================

function showLogin() {
  document.getElementById('modal-login').classList.remove('hidden');
  document.getElementById('modal-register').classList.add('hidden');
  document.getElementById('modal-forgot')?.classList.add('hidden');
}
window.showLogin = showLogin;

function showRegister() {
  document.getElementById('modal-register').classList.remove('hidden');
  document.getElementById('modal-login').classList.add('hidden');
  document.getElementById('modal-forgot')?.classList.add('hidden');
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
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
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
// DATA MIGRATION ENGINE - Recover orphaned Firestore data
// ==========================================================

/**
 * Busca datos huérfanos en Firestore asociados a un email.
 * Cuando una cuenta Firebase Auth es eliminada y recreada, el uid cambia,
 * pero los datos en Firestore quedan asociados al uid anterior.
 * Esta función busca esos datos por email y los migra al nuevo uid.
 */
async function findOrphanedDataByEmail(email) {
  const orphaned = { userDoc: null, quotes: [], clients: [], companies: [], oldUid: null };

  try {
    // Buscar en la colección 'users' por email
    const usersRef = collection(db, 'users');
    const qUsers = query(usersRef, where('email', '==', email.toLowerCase()));
    const usersSnap = await getDocs(qUsers);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      // Ignorar el documento del usuario actual (si ya existe)
      if (auth.currentUser && uid === auth.currentUser.uid) continue;

      orphaned.userDoc = { id: uid, ...userDoc.data() };
      orphaned.oldUid = uid;
      console.log(`[Migration] Found orphaned user doc: ${uid} for email: ${email}`);
      break;
    }

    if (orphaned.oldUid) {
      // Buscar cotizaciones huérfanas
      const quotesRef = collection(db, 'quotes');
      const qQuotes = query(quotesRef, where('userId', '==', orphaned.oldUid));
      const quotesSnap = await getDocs(qQuotes);
      quotesSnap.forEach(d => orphaned.quotes.push({ id: d.id, ...d.data() }));

      // Buscar clientes huérfanos
      const clientsRef = collection(db, 'clients');
      const qClients = query(clientsRef, where('userId', '==', orphaned.oldUid));
      const clientsSnap = await getDocs(qClients);
      clientsSnap.forEach(d => orphaned.clients.push({ id: d.id, ...d.data() }));

      // Buscar empresas huérfanas
      const companiesRef = collection(db, 'companies');
      const qCompanies = query(companiesRef, where('userId', '==', orphaned.oldUid));
      const companiesSnap = await getDocs(qCompanies);
      companiesSnap.forEach(d => orphaned.companies.push({ id: d.id, ...d.data() }));

      console.log(`[Migration] Found: ${orphaned.quotes.length} quotes, ${orphaned.clients.length} clients, ${orphaned.companies.length} companies`);
    }
  } catch (error) {
    console.error('[Migration] Error finding orphaned data:', error);
  }

  return orphaned;
}

/**
 * Migra datos huérfanos al nuevo uid del usuario autenticado.
 */
async function migrateOrphanedData(newUid, orphaned) {
  if (!orphaned.oldUid) return { success: false, message: 'No hay datos huérfanos' };

  try {
    const batchResults = { quotes: 0, clients: 0, companies: 0, errors: [] };

    // Migrar user doc - sobrescribir con datos antiguos preservando el rol
    if (orphaned.userDoc) {
      const oldData = orphaned.userDoc;
      const newUserData = {
        name: oldData.name || '',
        email: oldData.email || '',
        company: oldData.company || '',
        role: oldData.role || 'user',
        plan: oldData.plan || 'free',
        licenseDuration: oldData.licenseDuration || 0,
        planStartDate: oldData.planStartDate || null,
        planEndDate: oldData.planEndDate || null,
        quotesUsedThisMonth: oldData.quotesUsedThisMonth || 0,
        lastQuoteReset: oldData.lastQuoteReset || new Date().toISOString(),
        isActive: oldData.isActive !== undefined ? oldData.isActive : true,
        providerId: oldData.providerId || 'email',
        phone: oldData.phone || '',
        createdAt: oldData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        migratedFrom: orphaned.oldUid,
        migratedAt: new Date().toISOString()
      };

      // Verificar si el super admin email coincide y preservar el rol
      if (oldData.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        newUserData.role = 'superadmin';
      }

      await setDoc(doc(db, 'users', newUid), newUserData);
      console.log(`[Migration] User doc migrated from ${orphaned.oldUid} to ${newUid}`);

      // Eliminar el documento de usuario antiguo
      try {
        await deleteDoc(doc(db, 'users', orphaned.oldUid));
        console.log(`[Migration] Old user doc ${orphaned.oldUid} deleted`);
      } catch (e) {
        console.warn(`[Migration] Could not delete old user doc:`, e);
      }
    }

    // Migrar cotizaciones
    for (const quote of orphaned.quotes) {
      try {
        const { id, ...data } = quote;
        data.userId = newUid;
        data.migratedFrom = orphaned.oldUid;
        data.migratedAt = new Date().toISOString();
        await addDoc(collection(db, 'quotes'), data);
        batchResults.quotes++;
      } catch (e) {
        batchResults.errors.push(`Quote ${quote.id}: ${e.message}`);
      }
    }

    // Migrar clientes
    for (const client of orphaned.clients) {
      try {
        const { id, ...data } = client;
        data.userId = newUid;
        data.migratedFrom = orphaned.oldUid;
        data.migratedAt = new Date().toISOString();
        await addDoc(collection(db, 'clients'), data);
        batchResults.clients++;
      } catch (e) {
        batchResults.errors.push(`Client ${client.id}: ${e.message}`);
      }
    }

    // Migrar empresas
    for (const company of orphaned.companies) {
      try {
        const { id, ...data } = company;
        data.userId = newUid;
        data.migratedFrom = orphaned.oldUid;
        data.migratedAt = new Date().toISOString();
        await setDoc(doc(db, 'companies', newUid), data);
        batchResults.companies++;
      } catch (e) {
        batchResults.errors.push(`Company ${company.id}: ${e.message}`);
      }
    }

    // Eliminar datos antiguos si la migración fue exitosa
    if (batchResults.errors.length === 0) {
      console.log('[Migration] Cleaning up old data...');
      for (const quote of orphaned.quotes) {
        try { await deleteDoc(doc(db, 'quotes', quote.id)); } catch (e) { /* ignore */ }
      }
      for (const client of orphaned.clients) {
        try { await deleteDoc(doc(db, 'clients', client.id)); } catch (e) { /* ignore */ }
      }
      for (const company of orphaned.companies) {
        try { await deleteDoc(doc(db, 'companies', company.id)); } catch (e) { /* ignore */ }
      }
    }

    console.log(`[Migration] Complete: ${batchResults.quotes} quotes, ${batchResults.clients} clients, ${batchResults.companies} companies migrated`);
    return { success: true, ...batchResults };
  } catch (error) {
    console.error('[Migration] Fatal error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Muestra el modal de recuperación con opciones mejoradas.
 * Ahora ofrece: reset de contraseña, login con Google, o crear cuenta nueva.
 */
async function showAccountRecoveryModal(email, reason = 'no_methods') {
  // First, check what methods exist for this email
  let existingMethods = [];
  try {
    existingMethods = await fetchSignInMethodsForEmail(auth, email) || [];
  } catch (e) {
    console.warn('[Recovery] Could not check methods:', e);
  }

  const hasPassword = existingMethods.includes('password');
  const hasGoogle = existingMethods.includes('google.com');
  const accountExists = existingMethods.length > 0;

  let warningMsg = '';
  let warningBg = '#fef3c7';
  let warningBorder = '#fbbf24';
  let warningColor = '#92400e';

  if (reason === 'wrong_password' && hasPassword) {
    warningMsg = `🔒 La cuenta <strong>${email}</strong> existe pero la contraseña es incorrecta.<br><small>Puedes restablecer tu contraseña por email.</small>`;
    warningBg = '#fee2e2';
    warningBorder = '#fca5a5';
    warningColor = '#991b1b';
  } else if (reason === 'no_methods' && accountExists) {
    if (hasGoogle && !hasPassword) {
      warningMsg = `🔑 La cuenta <strong>${email}</strong> está registrada con Google.<br><small>Usa el botón "Continuar con Google" para ingresar.</small>`;
      warningBg = '#dbeafe';
      warningBorder = '#93c5fd';
      warningColor = '#1e40af';
    } else {
      warningMsg = `⚠️ No se pudo iniciar sesión con <strong>${email}</strong>.<br><small>Intenta restablecer tu contraseña o ingresa con otro método.</small>`;
    }
  } else {
    warningMsg = `⚠️ No encontramos una cuenta activa para <strong>${email}</strong>.<br><small>Es posible que la cuenta haya sido eliminada o necesite ser creada nuevamente.</small>`;
  }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.zIndex = '10000';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-dialog" style="max-width:480px;">
      <div class="modal-header">
        <h2 class="modal-title">🔄 Recuperación de Cuenta</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
      </div>
      <div class="modal-body" style="text-align:left;">
        <div style="background:${warningBg};border:1px solid ${warningBorder};border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="margin:0;color:${warningColor};font-weight:500;">${warningMsg}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${accountExists ? `
            <button id="btn-recover-reset" class="btn btn-primary btn-block" style="padding:14px;">
              🔑 Restablecer Contraseña
              <small style="display:block;font-weight:400;opacity:0.85;margin-top:4px;">Enviar email de recuperación a ${email}</small>
            </button>
          ` : ''}
          ${hasGoogle ? `
            <button id="btn-recover-google" class="btn btn-google btn-block" style="padding:14px;">
              <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-right:8px;vertical-align:middle;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continuar con Google
              <small style="display:block;font-weight:400;opacity:0.85;margin-top:4px;">Tu cuenta está vinculada con Google</small>
            </button>
          ` : ''}
          <button id="btn-recover-register" class="btn btn-outline btn-block" style="padding:14px;">
            🆕 Crear cuenta nueva con este email
            <small style="display:block;font-weight:400;opacity:0.85;margin-top:4px;">Se migrarán datos anteriores si existen</small>
          </button>
          <button class="btn btn-outline btn-block" onclick="this.closest('.modal').remove()" style="padding:12px;color:var(--color-gray-500);">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Password reset
  const resetBtn = modal.querySelector('#btn-recover-reset');
  if (resetBtn) {
    resetBtn.onclick = async () => {
      resetBtn.disabled = true;
      resetBtn.textContent = 'Enviando...';
      try {
        await sendPasswordResetEmail(auth, email);
        showToast('✅ Email de recuperación enviado. Revisa tu bandeja de entrada.', 'success');
        modal.remove();
      } catch (error) {
        console.error('Reset error:', error);
        if (error.code === 'auth/user-not-found') {
          showToast('No hay cuenta Firebase para este email. Prueba crear cuenta nueva.', 'error');
        } else {
          showToast('Error al enviar email: ' + error.message, 'error');
        }
        resetBtn.disabled = false;
        resetBtn.innerHTML = '🔑 Restablecer Contraseña<small style="display:block;font-weight:400;opacity:0.85;margin-top:4px;">Reintentar</small>';
      }
    };
  }

  // Register new account
  modal.querySelector('#btn-recover-register').onclick = () => {
    modal.remove();
    document.getElementById('register-email').value = email;
    document.getElementById('register-name').value = email.split('@')[0];
    document.getElementById('register-name').focus();
    showRegister();
  };

  // Google sign in
  const googleBtn = modal.querySelector('#btn-recover-google');
  if (googleBtn) {
    googleBtn.onclick = () => {
      modal.remove();
      signInWithGoogle();
    };
  }

  modal.querySelector('.modal-backdrop').onclick = () => modal.remove();
}

/**
 * Muestra modal de progreso/results de migración.
 */
function showMigrationResults(results) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.zIndex = '10001';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-dialog" style="max-width:420px;">
      <div class="modal-header">
        <h2 class="modal-title">${results.success ? '✅ Datos Recuperados' : '⚠️ Migración Parcial'}</h2>
      </div>
      <div class="modal-body" style="text-align:center;">
        <div style="font-size:3rem;margin-bottom:16px;">${results.success ? '🎉' : '📦'}</div>
        ${results.success ? `
          <p style="margin:0 0 16px;color:#166534;font-weight:500;">Tus datos anteriores han sido restaurados exitosamente.</p>
          <div style="text-align:left;background:#f0fdf4;border-radius:12px;padding:16px;">
            <p>📄 Cotizaciones migradas: <strong>${results.quotes}</strong></p>
            <p>👥 Clientes migrados: <strong>${results.clients}</strong></p>
            <p>🏢 Empresas migradas: <strong>${results.companies}</strong></p>
          </div>
        ` : `
          <p style="margin:0 0 16px;color:#92400e;">Se creó tu cuenta pero hubo errores en la migración.</p>
          <p style="font-size:0.875rem;color:#64748b;">Contacta al administrador si necesitas recuperar datos antiguos.</p>
          ${results.errors?.length > 0 ? `<div style="text-align:left;background:#fef2f2;border-radius:12px;padding:12px;margin-top:12px;"><small>${results.errors.join('<br>')}</small></div>` : ''}
        `}
        <button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="this.closest('.modal').remove()">Continuar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-backdrop').onclick = () => modal.remove();
}

// ==========================================================
// GOOGLE SIGN IN - Using Popup with Account Linking
// ==========================================================

async function signInWithGoogle() {
  try {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    console.log('[Auth] Google sign-in with popup...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('[Auth] Google popup success:', result.user.email);

    // Check if this email already has a password account
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
// PROCESS USER - Create, migrate or redirect
// ==========================================================

let userProcessed = false;

async function processUser(user) {
  if (userProcessed || !user) return;
  userProcessed = true;

  console.log('✅ Processing user:', user.email);

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (!userDoc.exists()) {
      // NEW Firebase Auth user (o uid nuevo por re-registro)
      const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      console.log('🆕 New auth user detected, checking for orphaned data...');

      // Buscar datos huérfanos por email
      const orphaned = await findOrphanedDataByEmail(user.email);

      if (orphaned.oldUid) {
        console.log('📦 Orphaned data found! Starting migration...');
        showToast('Recuperando datos anteriores...', 'info');

        // Migrar datos al nuevo uid
        const migrationResult = await migrateOrphanedData(user.uid, orphaned);

        if (migrationResult.success) {
          showToast('¡Datos recuperados exitosamente!', 'success');
          setTimeout(() => showMigrationResults(migrationResult), 500);
        } else {
          showToast('Cuenta creada. Algunos datos no pudieron recuperarse.', 'error');
        }

        // Esperar un momento y redirigir
        setTimeout(() => {
          const isSA = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
          redirectOnce(isSA ? '/superadmin.html' : '/app.html');
        }, 1500);
      } else {
        // No hay datos huérfanos, crear cuenta nueva
        console.log('🆕 No orphaned data found, creating fresh account...', isSuperAdmin ? 'as Super Admin' : 'as User');

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
          redirectOnce(isSuperAdmin ? '/superadmin.html' : '/app.html');
        }, 800);
      }
    } else {
      // EXISTING user doc - redirect based on role
      const userData = userDoc.data();
      console.log('🔄 Existing user, role:', userData.role);

      if (userData.role === 'superadmin') {
        redirectOnce('/superadmin.html');
      } else if (!userData.isActive) {
        showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
        signOut(auth);
      } else {
        redirectOnce('/app.html');
      }
    }
  } catch (error) {
    console.error('❌ Error processing user:', error);
    showToast('Error: ' + error.message, 'error');
    userProcessed = false;
  }
  // Auto-reset after 10 seconds to prevent getting stuck
  setTimeout(() => { userProcessed = false; }, 10000);
}

// ==========================================================
// INITIALIZE - Listen for auth state changes
// ==========================================================

// Reset all locks on page load to prevent stale state
sessionStorage.removeItem(REDIRECT_LOCK_KEY);
sessionStorage.removeItem(LOGOUT_FLAG_KEY);

onAuthStateChanged(auth, (user) => {
  if (!isLoginPagePath() || isLoggingOut) return;
  if (user && !userProcessed) {
    processUser(user);
  }
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
      await registerWithEmail(email, password, name, company);
    } catch (error) {
      console.error('Register Error:', error);
      let message = 'Error al crear la cuenta';
      if (error.code === 'auth/email-already-in-use') {
        message = 'Este email ya está registrado. Intenta iniciar sesión o usa "Recuperar contraseña".';
      }
      else if (error.code === 'auth/weak-password') message = 'La contraseña es muy débil';
      showToast(message, 'error');
    }
  });
}

// ==========================================================
// EMAIL/PASSWORD LOGIN - With Account Recovery
// ==========================================================

const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showToast('Completa todos los campos', 'error'); return; }

    await loginWithEmail(email, password);
  });
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
  modal.className = 'modal';
  modal.style.zIndex = '10000';

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-dialog" style="max-width:420px;">
      <div class="modal-header">
        <h2 class="modal-title">🔗 Vincular Cuentas</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <p style="margin:0 0 20px;color:var(--color-gray-600);">
          El email <strong>${email}</strong> ya tiene una cuenta registrada con <strong>${otherMethod}</strong>.
          <br><br>¿Qué deseas hacer?
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button id="btn-link-accounts" class="btn btn-primary btn-block">✅ Usar misma cuenta (vincular)</button>
          <button id="btn-signin-other" class="btn btn-outline btn-block">🔁 Iniciar con ${otherMethod}</button>
          <button id="btn-cancel-link" class="btn btn-block" style="color:var(--color-gray-500);background:none;border:none;cursor:pointer;padding:8px;">Cancelar</button>
        </div>
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
  modal.querySelector('.modal-backdrop').onclick = () => modal.remove();
}

function promptForPassword(email) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '10001';

    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog" style="max-width:400px;">
        <div class="modal-header">
          <h2 class="modal-title">🔐 Confirmar Identidad</h2>
        </div>
        <div class="modal-body">
          <p style="margin:0 0 16px;color:var(--color-gray-500);">Para vincular con Google, confirma tu contraseña:</p>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" value="${email}" disabled class="form-input" style="opacity:0.7;">
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" id="link-password" class="form-input" placeholder="Tu contraseña">
          </div>
          <div style="display:flex;gap:12px;">
            <button id="btn-confirm-pass" class="btn btn-primary" style="flex:1;">Confirmar</button>
            <button id="btn-cancel-pass" class="btn btn-outline" style="flex:1;">Cancelar</button>
          </div>
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
// ROUTE PROTECTION - Improved, No Infinite Loops
// ==========================================================

let authCheckInProgress = false;
let isLoggingOut = false;
let isInitialized = false;
const LOGOUT_FLAG_KEY = 'cotizapro_is_logging_out';
const REDIRECT_LOCK_KEY = 'cotizapro_redirect_lock';

function isLoginPagePath() {
  const path = window.location.pathname;
  return path === '/' || path === '' || path === '/index.html' || path === '/index';
}

function redirectOnce(targetPath, force = false) {
  const normalizedTarget = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  const currentPath = window.location.pathname;
  const cleanCurrent = currentPath.replace(/\.html$/, '');
  const cleanTarget = normalizedTarget.replace(/\.html$/, '');
  if (cleanCurrent === cleanTarget || currentPath === cleanTarget) return;
  if (!force && sessionStorage.getItem(REDIRECT_LOCK_KEY) === '1') return;
  sessionStorage.setItem(REDIRECT_LOCK_KEY, '1');
  console.log('[Redirect]', normalizedTarget, force ? '(forced)' : '');
  window.location.href = normalizedTarget;
}

export function protectRoute(requiredAuth = true) {
  if (authCheckInProgress) {
    console.log('⏳ Auth check already in progress...');
    return;
  }

  authCheckInProgress = true;

  const path = window.location.pathname;
  const isLoginPage = path === '/' || path === '' || path === '/index.html' || path === '/index';

  console.log('🔍 protectRoute:', { path, requiredAuth, isLoginPage, isLoggingOut });
  if (!isLoginPage) {
    sessionStorage.removeItem(REDIRECT_LOCK_KEY);
  }

  if (isLoggingOut || sessionStorage.getItem(LOGOUT_FLAG_KEY) === '1') {
    authCheckInProgress = false;
    return;
  }

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    console.log('👤 Auth state changed:', user?.email || 'No user');

    // Reset redirect lock on auth state change (allows fresh redirects)
    if (!isLoggingOut) {
      sessionStorage.removeItem(REDIRECT_LOCK_KEY);
    }

    if (requiredAuth && !user) {
      if (!isLoginPage) {
        console.log('🔐 No auth, redirecting to login...');
        localStorage.setItem('redirectAfterLogin', window.location.pathname);
        redirectOnce('/index.html');
      }
    } else if (user && isLoginPage) {
      console.log('✅ Already logged in, redirecting to dashboard...');
      const redirect = localStorage.getItem('redirectAfterLogin') || '/app.html';
      localStorage.removeItem('redirectAfterLogin');
      redirectOnce(redirect);
    } else if (user) {
      updateUI(user);
      saveSession(user);

      if (!isInitialized) {
        isInitialized = true;
        onAppReady(user);
      }
    }

    authCheckInProgress = false;
    unsubscribe();
  });
}

// ==========================================================
// IMPROVED LOGOUT - No Cycles
// ==========================================================

export async function logout() {
  if (isLoggingOut) {
    console.log('⏳ Logout already in progress...');
    return;
  }

  try {
    isLoggingOut = true;
    console.log('🚪 Starting logout...');

    // Clear ALL state FIRST before signOut
    clearSession();
    userProcessed = false;
    isInitialized = false;
    authCheckInProgress = false;
    sessionStorage.removeItem(REDIRECT_LOCK_KEY);
    sessionStorage.removeItem(LOGOUT_FLAG_KEY);
    localStorage.removeItem('redirectAfterLogin');

    await signOut(auth);

    console.log('✅ Logout successful');
    showToast('Sesión cerrada correctamente', 'info');

    // Force redirect to login (bypass lock since we just cleared it)
    redirectOnce('/index.html', true);

  } catch (error) {
    console.error('❌ Error al cerrar sesión:', error);
    clearSession();
    userProcessed = false;
    isInitialized = false;
    sessionStorage.removeItem(REDIRECT_LOCK_KEY);
    sessionStorage.removeItem(LOGOUT_FLAG_KEY);
    redirectOnce('/index.html', true);

  } finally {
    // Immediately reset flags (no setTimeout race condition)
    isLoggingOut = false;
  }
}
window.logout = logout;

export async function loginWithEmail(email, password) {
  const safeEmail = (email || '').trim().toLowerCase();
  if (!safeEmail || !password) {
    showToast('Completa todos los campos', 'error');
    throw new Error('Credenciales incompletas');
  }

  const methods = await fetchSignInMethodsForEmail(auth, safeEmail);

  if (methods && methods.includes('google.com') && !methods.includes('password')) {
    showToast('Este correo está registrado con Google. Usa "Continuar con Google".', 'error');
    return null;
  }

  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, safeEmail, password);
  } catch (error) {
    console.error('[Auth] Login error:', error.code, error.message);

    // Firebase v10+ merged user-not-found and wrong-password into invalid-credential
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
      // Re-check methods to determine the real cause
      const recheckMethods = await fetchSignInMethodsForEmail(auth, safeEmail).catch(() => []);

      if (recheckMethods && recheckMethods.length > 0) {
        // Account EXISTS in Firebase Auth → password is wrong
        if (recheckMethods.includes('password')) {
          showAccountRecoveryModal(safeEmail, 'wrong_password');
        } else if (recheckMethods.includes('google.com')) {
          showAccountRecoveryModal(safeEmail, 'google_only');
        } else {
          showAccountRecoveryModal(safeEmail, 'wrong_password');
        }
      } else {
        // Account truly doesn't exist → offer full recovery
        showAccountRecoveryModal(safeEmail, 'no_methods');
      }
      return null;
    }

    if (error.code === 'auth/too-many-requests') {
      showToast('Demasiados intentos. Espera unos minutos o restablece tu contraseña.', 'error');
      return null;
    }

    if (error.code === 'auth/user-disabled') {
      showToast('Esta cuenta ha sido deshabilitada. Contacta al administrador.', 'error');
      return null;
    }

    showToast('Error al iniciar sesión: ' + error.message, 'error');
    return null;
  }

  if (methods && methods.includes('google.com')) {
    const providers = userCredential.user.providerData.map(p => p.providerId);
    if (!providers.includes('google.com')) {
      console.log('[Auth] User has Google but entered with email - offer to link');
      showLinkingModal(userCredential.user, 'email');
      return null;
    }
  }

  await processUser(userCredential.user);
  return userCredential.user;
}

export async function registerWithEmail(email, password, name = '', company = '') {
  const safeEmail = (email || '').trim().toLowerCase();
  if (!safeEmail || !password) {
    showToast('Completa todos los campos obligatorios', 'error');
    throw new Error('Datos incompletos');
  }
  if (password.length < 6) {
    showToast('La contraseña debe tener al menos 6 caracteres', 'error');
    throw new Error('Contraseña débil');
  }

  const methods = await fetchSignInMethodsForEmail(auth, safeEmail);
  if (methods && methods.includes('google.com')) {
    showToast('Este email ya está registrado con Google. Usa "Continuar con Google".', 'error');
    throw new Error('Cuenta ya existe con Google');
  }

  // ✅ MEJORA: Si el email ya existe con password, ofrecer login
  if (methods && methods.includes('password')) {
    showToast('Este email ya está registrado. Intenta iniciar sesión.', 'error');
    showLogin();
    throw new Error('Cuenta ya existe');
  }

  const userCredential = await createUserWithEmailAndPassword(auth, safeEmail, password);
  await processUser(userCredential.user);
  return userCredential.user;
}

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
      if (error.code === 'auth/user-not-found') {
        // ✅ MEJORA: Ofrecer crear cuenta nueva
        showAccountRecoveryModal(email);
        return;
      }
      else if (error.code === 'auth/invalid-email') message = 'Email inválido';
      else if (error.code === 'auth/too-many-requests') message = 'Demasiados intentos. Intenta más tarde.';
      showToast(message, 'error');
    }
  });
}
