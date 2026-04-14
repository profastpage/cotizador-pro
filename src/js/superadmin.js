/* Super Admin Panel - v2.1.0 - With Data Migration Tools */

import { auth, db, SUPER_ADMIN_EMAIL, PLANS, signOut, onAuthStateChanged, collection, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, setDoc, serverTimestamp, increment } from '../firebase-config.js';

let allUsers = [];
let currentUserData = null;

// Wait for auth, then load or show message
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not logged in - show login prompt
    showLoginPrompt();
    return;
  }

  // Check if super admin
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists() || userDoc.data().role !== 'superadmin') {
    // Not super admin
    showNotAuthorized();
    return;
  }

  // Super admin - load everything
  currentUserData = userDoc.data();
  document.getElementById('admin-name').textContent = currentUserData.name;
  document.getElementById('setting-admin-email').value = SUPER_ADMIN_EMAIL;

  // Load dashboard first, then clients (fixes race condition where clients table was empty)
  loadDashboard().then(() => {
    loadClients();
  });
});

function showLoginPrompt() {
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;">
        <h2>Inicia sesión como administrador</h2>
        <p>Ve a <a href="index.html">Iniciar Sesión</a> primero</p>
      </div>
    `;
  }
}

function showNotAuthorized() {
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;">
        <h2>No autorizado</h2>
        <p>No tienes permisos de administrador</p>
        <a href="index.html" class="btn btn-primary">Volver al inicio</a>
      </div>
    `;
  }
}

// Tab navigation
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) {
    const tab = tabBtn.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    tabBtn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    
    const titles = {
      dashboard: 'Dashboard',
      clients: 'Clientes',
      plans: 'Planes',
      settings: 'Configuración'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Dashboard';
  }
  
  // Close modals
  if (e.target.hasAttribute('data-close-modal')) {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }
});

// ==========================================================
// DASHBOARD
// ==========================================================

async function loadDashboard() {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users = [];
    let monthlyRevenue = 0;
    let activeUsers = 0;
    let freeUsers = 0;
    let paidUsers = 0;
    let totalQuotes = 0;
    let basicUsers = 0, businessUsers = 0, proUsers = 0;

    snapshot.forEach(docSnap => {
      const user = { id: docSnap.id, ...docSnap.data() };
      if (user.role === 'superadmin') return;
      users.push(user);
      if (user.isActive) {
        activeUsers++;
        totalQuotes += (user.quotesUsedThisMonth || 0);
        if (user.plan === 'free') freeUsers++;
        else if (user.plan === 'basic') { basicUsers++; monthlyRevenue += 35; }
        else if (user.plan === 'business') { businessUsers++; monthlyRevenue += 59; }
        else if (user.plan === 'pro') { proUsers++; monthlyRevenue += 99; }
        else paidUsers++;
      }
    });

    allUsers = users;

    // Update stat cards
    document.getElementById('stat-total-users').textContent = allUsers.length;
    document.getElementById('stat-active-users').textContent = activeUsers;
    document.getElementById('stat-free-users').textContent = freeUsers;
    document.getElementById('stat-paid-users').textContent = basicUsers + businessUsers + proUsers;
    document.getElementById('stat-monthly-revenue').textContent = `S/ ${monthlyRevenue}`;

    // Update plan breakdown
    const elBasic = document.getElementById('stat-basic-users');
    const elBusiness = document.getElementById('stat-business-users');
    const elPro = document.getElementById('stat-pro-users');
    const elQuotes = document.getElementById('stat-total-quotes');
    if (elBasic) elBasic.textContent = basicUsers;
    if (elBusiness) elBusiness.textContent = businessUsers;
    if (elPro) elPro.textContent = proUsers;
    if (elQuotes) elQuotes.textContent = totalQuotes;

    // Recent users table with phone
    const recent = allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
    const tbody = document.getElementById('recent-users-tbody');
    if (tbody) {
      tbody.innerHTML = recent.map(u => `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td>${u.phone || '-'}</td>
          <td><span class="badge badge-${u.plan}">${getPlanName(u.plan)}</span></td>
          <td>${formatDate(u.createdAt)}</td>
          <td><span class="badge ${u.isActive ? 'badge-active' : 'badge-inactive'}">${u.isActive ? 'Activo' : 'Inactivo'}</span></td>
          <td>
            <button class="btn btn-xs btn-primary" onclick="window.quickPlan('${u.id}','basic')" title="Plan Básico">Básico</button>
            <button class="btn btn-xs btn-success" onclick="window.quickPlan('${u.id}','business')" title="Plan Business">Business</button>
            <button class="btn btn-xs btn-warning" onclick="window.quickPlan('${u.id}','pro')" title="Plan Pro">Pro</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// ==========================================================
// CLIENTS
// ==========================================================

function loadClients() {
  renderClients(allUsers);
}

function renderClients(users) {
  const tbody = document.getElementById('clients-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;">No hay clientes registrados</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const planEndDate = u.planEndDate ? new Date(u.planEndDate) : null;
    const isExpired = planEndDate && planEndDate < new Date() && u.licenseDuration !== 0;
    return `
      <tr>
        <td>
          <strong>${u.name}</strong>
          <br><small style="color:var(--color-gray-500);word-break:break-all">${u.email}</small>
          ${u.phone ? `<br><small>📱 ${u.phone}</small>` : ''}
          ${u.company ? `<br><small>🏢 ${u.company}</small>` : ''}
        </td>
        <td><span class="badge badge-${u.plan}">${getPlanName(u.plan)}</span></td>
        <td>${u.licenseDuration === 0 ? '∞ Ilimitado' : planEndDate && !isExpired ? formatDateShort(planEndDate) : isExpired ? 'Vencido' : 'Gratis'}</td>
        <td>${u.quotesUsedThisMonth || 0} / ${getPlanQuota(u.plan)}</td>
        <td><span class="badge ${u.isActive && !isExpired ? 'badge-active' : 'badge-inactive'}">${u.isActive ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-xs btn-primary" onclick="window.quickPlan('${u.id}','basic')" title="Activar Básico">B</button>
            <button class="btn btn-xs btn-success" onclick="window.quickPlan('${u.id}','business')" title="Activar Business">Bu</button>
            <button class="btn btn-xs btn-warning" onclick="window.quickPlan('${u.id}','pro')" title="Activar Pro">P</button>
            <button class="btn btn-xs btn-info" onclick="window.applyCoupon('${u.id}')" title="Aplicar Cupón">🎁</button>
            <button class="btn btn-xs btn-secondary" onclick="window.editClient('${u.id}')" title="Editar">✏️</button>
            <button class="btn btn-xs ${u.isActive ? 'btn-danger' : 'btn-success'}" onclick="window.toggleClient('${u.id}', ${!u.isActive})" title="${u.isActive ? 'Desactivar' : 'Activar'}">${u.isActive ? '⏸️' : '▶️'}</button>
            <button class="btn btn-xs btn-danger" onclick="window.resetClientData('${u.id}')" title="Eliminar datos">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Search clients
document.addEventListener('input', (e) => {
  if (e.target.id === 'search-clients') {
    const q = e.target.value.toLowerCase();
    renderClients(allUsers.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q) || 
      (u.company && u.company.toLowerCase().includes(q))
    ));
  }
});

// Edit client
window.editClient = function(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('edit-client-id').value = userId;
  document.getElementById('edit-client-name').value = user.name;
  document.getElementById('edit-client-email').value = user.email;
  document.getElementById('edit-client-plan').value = user.plan;
  document.getElementById('edit-client-active').value = user.isActive.toString();
  document.getElementById('edit-client-quotes-used').value = user.quotesUsedThisMonth || 0;
  document.getElementById('edit-client-duration').value = user.licenseDuration || 0;
  document.getElementById('modal-edit-client').classList.remove('hidden');
};

// Save client
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'form-edit-client') {
    e.preventDefault();
    const userId = document.getElementById('edit-client-id').value;
    const plan = document.getElementById('edit-client-plan').value;
    const duration = parseInt(document.getElementById('edit-client-duration').value) || 0;
    const isActive = document.getElementById('edit-client-active').value === 'true';
    const quotesUsed = parseInt(document.getElementById('edit-client-quotes-used').value) || 0;
    const now = new Date();
    const planEndDate = duration > 0 ? new Date(now.setMonth(now.getMonth() + duration)).toISOString() : null;

    try {
      await updateDoc(doc(db, 'users', userId), {
        plan, isActive, licenseDuration: duration,
        planStartDate: new Date().toISOString(),
        planEndDate, quotesUsedThisMonth: quotesUsed,
        lastQuoteReset: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast('Cliente actualizado ✅');
      document.getElementById('modal-edit-client').classList.add('hidden');
      loadDashboard();
      loadClients();
    } catch (err) {
      showToast('Error al actualizar', 'error');
    }
  }
});

// Reset quotes
document.addEventListener('click', async (e) => {
  if (e.target.id === 'btn-reset-quotes') {
    const userId = document.getElementById('edit-client-id').value;
    try {
      await updateDoc(doc(db, 'users', userId), { 
        quotesUsedThisMonth: 0, 
        lastQuoteReset: new Date().toISOString() 
      });
      document.getElementById('edit-client-quotes-used').value = 0;
      showToast('Cotizaciones reseteadas');
    } catch (err) {
      showToast('Error al resetear', 'error');
    }
  }
});

// Toggle client
window.toggleClient = async function(userId, newState) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isActive: newState,
      updatedAt: new Date().toISOString()
    });
    showToast(`Cliente ${newState ? 'activado' : 'desactivado'}`);
    loadDashboard();
    loadClients();
  } catch (err) {
    showToast('Error', 'error');
  }
};

// Quick plan activation from dashboard
window.quickPlan = async function(userId, plan) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  
  const planNames = { basic: 'Básico', business: 'Business', pro: 'Pro' };
  if (!confirm(`¿Activar plan ${planNames[plan]} para ${user.name}?`)) return;
  
  try {
    await updateDoc(doc(db, 'users', userId), {
      plan,
      isActive: true,
      licenseDuration: 1,
      planStartDate: new Date().toISOString(),
      planEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      quotesUsedThisMonth: 0,
      lastQuoteReset: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    showToast(`✅ Plan ${planNames[plan]} activado para ${user.name}`);
    loadDashboard();
    loadClients();
  } catch (err) {
    showToast('Error al activar plan', 'error');
  }
};

// Coupon/Discount system
window.applyCoupon = async function(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  
  const discount = prompt(`Descuento para ${user.name} (%):`, '20');
  if (!discount || isNaN(discount)) return;
  
  const months = prompt(`Meses de descuento:`, '1');
  if (!months || isNaN(months)) return;
  
  try {
    const now = new Date();
    const endDate = new Date(now.getTime() + parseInt(months) * 30 * 24 * 60 * 60 * 1000);
    
    await updateDoc(doc(db, 'users', userId), {
      isActive: true,
      licenseDuration: parseInt(months),
      planStartDate: now.toISOString(),
      planEndDate: endDate.toISOString(),
      discountPercent: parseInt(discount),
      quotesUsedThisMonth: 0,
      lastQuoteReset: now.toISOString(),
      updatedAt: now.toISOString()
    });
    showToast(`🎁 Cupón ${discount}% por ${months} mes(es) aplicado a ${user.name}`);
    loadDashboard();
    loadClients();
  } catch (err) {
    showToast('Error al aplicar cupón', 'error');
  }
};

// Reset client data (delete all quotes and clients)
window.resetClientData = async function(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  if (!confirm(`¿Eliminar TODOS los datos de ${user.name}?\nSe borrarán cotizaciones y clientes.`)) return;
  
  try {
    // Delete all quotes
    const quotesRef = collection(db, 'quotes');
    const qQuotes = query(quotesRef, where('userId', '==', userId));
    const quotesSnap = await getDocs(qQuotes);
    const deletePromises = quotesSnap.docs.map(docSnap => deleteDoc(doc(db, 'quotes', docSnap.id)));
    await Promise.all(deletePromises);
    
    // Delete all clients
    const clientsRef = collection(db, 'clients');
    const qClients = query(clientsRef, where('userId', '==', userId));
    const clientsSnap = await getDocs(qClients);
    const deleteClientPromises = clientsSnap.docs.map(docSnap => deleteDoc(doc(db, 'clients', docSnap.id)));
    await Promise.all(deleteClientPromises);
    
    // Reset user counters
    await updateDoc(doc(db, 'users', userId), {
      quotesUsedThisMonth: 0,
      lastQuoteReset: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    showToast(`🗑️ Datos de ${user.name} eliminados`);
    loadDashboard();
    loadClients();
  } catch (err) {
    showToast('Error al eliminar datos', 'error');
    console.error(err);
  }
};

// ==========================================================
// HELPERS
// ==========================================================

function getPlanName(plan) {
  return { free: '🆓 Gratis', basic: '📋 Básico', business: '💼 Business', pro: '🚀 Pro' }[plan] || plan;
}

function getPlanQuota(plan) {
  return { free: 3, basic: 60, business: 200, pro: -1 }[plan] || 3;
}

function getPlanPrice(plan) {
  return { free: 0, basic: 35, business: 59, pro: 99 }[plan] || 0;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateShort(date) {
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Logout - improved, prevents cycles
let adminIsLoggingOut = false;

window.logout = async function() {
  if (adminIsLoggingOut) return;
  adminIsLoggingOut = true;
  
  try {
    localStorage.removeItem('cotizapro_session');
    await signOut(auth);
    showToast('Sesión cerrada correctamente', 'info');
    await new Promise(r => setTimeout(r, 300));
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Logout error:', err);
    window.location.href = 'index.html';
  } finally {
    adminIsLoggingOut = false;
  }
};

// ==========================================================
// DATA MIGRATION TOOLS
// ==========================================================

/**
 * Search for orphaned data by email
 */
window.searchOrphanedData = async function() {
  const email = document.getElementById('migration-search-email').value.trim().toLowerCase();
  const resultDiv = document.getElementById('orphaned-data-result');
  if (!email) { showToast('Ingresa un email', 'error'); return; }

  resultDiv.innerHTML = '<p style="color:var(--color-gray-500);">Buscando...</p>';

  try {
    // Search in users collection by email
    const usersRef = collection(db, 'users');
    const qUsers = query(usersRef, where('email', '==', email));
    const usersSnap = await getDocs(qUsers);

    const foundUsers = [];
    usersSnap.forEach(docSnap => foundUsers.push({ id: docSnap.id, ...docSnap.data() }));

    if (foundUsers.length === 0) {
      resultDiv.innerHTML = `
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;">
          <p style="margin:0;color:#0369a1;">No se encontraron datos para este email en Firestore.</p>
        </div>
      `;
      return;
    }

    let html = '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;">';
    html += `<p style="margin:0 0 8px;color:#0369a1;font-weight:500;">Se encontraron ${foundUsers.length} documento(s) de usuario:</p>`;

    for (const u of foundUsers) {
      // Count related data
      let quotesCount = 0, clientsCount = 0, companiesCount = 0;
      try {
        const qQ = query(collection(db, 'quotes'), where('userId', '==', u.id));
        quotesCount = (await getDocs(qQ)).size;
      } catch (e) {}
      try {
        const qC = query(collection(db, 'clients'), where('userId', '==', u.id));
        clientsCount = (await getDocs(qC)).size;
      } catch (e) {}
      try {
        const qCo = query(collection(db, 'companies'), where('userId', '==', u.id));
        companiesCount = (await getDocs(qCo)).size;
      } catch (e) {}

      const isCurrentAdmin = auth.currentUser && u.id === auth.currentUser.uid;
      html += `
        <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;">
          <p style="margin:0;font-weight:600;">${u.name} ${isCurrentAdmin ? '(TU CUENTA ACTUAL)' : ''}</p>
          <p style="margin:4px 0 0;font-size:0.8rem;color:var(--color-gray-500);">
            UID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.75rem;">${u.id}</code>
          </p>
          <p style="margin:4px 0 0;font-size:0.8rem;color:var(--color-gray-500);">
            Rol: <strong>${u.role}</strong> | Plan: <strong>${u.plan}</strong> | Activo: ${u.isActive ? 'Sí' : 'No'}
          </p>
          <p style="margin:4px 0 0;font-size:0.8rem;color:var(--color-gray-500);">
            📄 ${quotesCount} cotizaciones | 👥 ${clientsCount} clientes | 🏢 ${companiesCount} empresas
          </p>
          <p style="margin:4px 0 0;font-size:0.75rem;color:var(--color-gray-400);">
            Creado: ${formatDate(u.createdAt)} | Actualizado: ${formatDate(u.updatedAt)}
          </p>
          ${!isCurrentAdmin ? `
            <div style="margin-top:8px;">
              <input type="text" id="migrate-target-${u.id}" placeholder="UID destino (nueva cuenta)" 
                style="width:70%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:4px;font-size:0.8rem;margin-right:4px;">
              <button class="btn btn-xs btn-primary" onclick="window.migrateToUid('${u.id}')">Migrar</button>
            </div>
          ` : ''}
        </div>
      `;
    }

    html += '</div>';
    resultDiv.innerHTML = html;
  } catch (error) {
    console.error('Search error:', error);
    resultDiv.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
      <p style="margin:0;color:#dc2626;">Error: ${error.message}</p>
      <p style="margin:8px 0 0;font-size:0.8rem;color:#991b1b;">
        Es posible que necesites crear un índice compuesto en Firebase Console para la búsqueda por email.
      </p>
    </div>`;
  }
};

/**
 * Migrate data from found user to a target UID
 */
window.migrateToUid = async function(oldUid) {
  const targetInput = document.getElementById(`migrate-target-${oldUid}`);
  const newUid = targetInput?.value.trim();
  if (!newUid) { showToast('Ingresa el UID destino', 'error'); return; }
  if (newUid === oldUid) { showToast('El UID destino debe ser diferente', 'error'); return; }
  if (!confirm(`¿Migrar datos de ${oldUid.substring(0, 8)}... a ${newUid.substring(0, 8)}...?`)) return;

  showToast('Migrando datos...', 'info');

  try {
    const result = await executeMigration(oldUid, newUid);
    if (result.success) {
      showToast(`✅ Migración exitosa: ${result.quotes} cotizaciones, ${result.clients} clientes, ${result.companies} empresas`, 'success');
      document.getElementById('migration-search-email').value = '';
      document.getElementById('orphaned-data-result').innerHTML = '';
      loadDashboard();
      loadClients();
    } else {
      showToast('Error en la migración: ' + (result.message || 'Error desconocido'), 'error');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
};

/**
 * Manual migration between two UIDs
 */
window.manualMigrate = async function() {
  const oldUid = document.getElementById('migration-old-uid').value.trim();
  const newUid = document.getElementById('migration-new-uid').value.trim();
  const resultDiv = document.getElementById('manual-migration-result');

  if (!oldUid || !newUid) { showToast('Ingresa ambos UIDs', 'error'); return; }
  if (oldUid === newUid) { showToast('Los UIDs deben ser diferentes', 'error'); return; }
  if (!confirm(`¿Migrar TODOS los datos de ${oldUid} a ${newUid}?`)) return;

  resultDiv.innerHTML = '<p style="color:var(--color-gray-500);">Migrando...</p>';
  showToast('Migrando datos...', 'info');

  try {
    const result = await executeMigration(oldUid, newUid);
    if (result.success) {
      resultDiv.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;">
          <p style="margin:0;color:#166534;font-weight:500;">✅ Migración exitosa</p>
          <p style="margin:4px 0 0;color:#166534;font-size:0.85rem;">
            📄 ${result.quotes} cotizaciones | 👥 ${result.clients} clientes | 🏢 ${result.companies} empresas
          </p>
        </div>
      `;
      showToast('Migración exitosa', 'success');
      loadDashboard();
      loadClients();
    } else {
      resultDiv.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
        <p style="margin:0;color:#dc2626;">Error: ${result.message || 'Error desconocido'}</p>
        ${result.errors?.length > 0 ? `<p style="margin:8px 0 0;font-size:0.8rem;color:#991b1b;">${result.errors.join('<br>')}</p>` : ''}
      </div>`;
    }
  } catch (error) {
    resultDiv.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
      <p style="margin:0;color:#dc2626;">Error: ${error.message}</p>
    </div>`;
    showToast('Error: ' + error.message, 'error');
  }
};

/**
 * Core migration function - moves all data from oldUid to newUid
 */
async function executeMigration(oldUid, newUid) {
  const results = { quotes: 0, clients: 0, companies: 0, errors: [], success: true };

  try {
    // 1. Check if source user doc exists
    const oldUserDoc = await getDoc(doc(db, 'users', oldUid));
    if (oldUserDoc.exists()) {
      const oldData = oldUserDoc.data();
      // Check if target user doc already exists
      const newUserDoc = await getDoc(doc(db, 'users', newUid));
      if (newUserDoc.exists()) {
        // Update existing target with data from source
        await updateDoc(doc(db, 'users', newUid), {
          name: oldData.name || newUserDoc.data().name,
          company: oldData.company || newUserDoc.data().company,
          phone: oldData.phone || newUserDoc.data().phone || '',
          plan: oldData.plan || newUserDoc.data().plan,
          licenseDuration: oldData.licenseDuration || 0,
          planStartDate: oldData.planStartDate || null,
          planEndDate: oldData.planEndDate || null,
          quotesUsedThisMonth: oldData.quotesUsedThisMonth || 0,
          role: oldData.role === 'superadmin' ? 'superadmin' : newUserDoc.data().role,
          migratedFrom: oldUid,
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new user doc with source data
        await setDoc(doc(db, 'users', newUid), {
          ...oldData,
          id: newUid,
          migratedFrom: oldUid,
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 2. Migrate quotes
    const quotesSnap = await getDocs(query(collection(db, 'quotes'), where('userId', '==', oldUid)));
    for (const docSnap of quotesSnap.docs) {
      try {
        const data = docSnap.data();
        data.userId = newUid;
        data.migratedFrom = oldUid;
        data.migratedAt = new Date().toISOString();
        await addDoc(collection(db, 'quotes'), data);
        results.quotes++;
      } catch (e) { results.errors.push(`Quote ${docSnap.id}: ${e.message}`); }
    }

    // 3. Migrate clients
    const clientsSnap = await getDocs(query(collection(db, 'clients'), where('userId', '==', oldUid)));
    for (const docSnap of clientsSnap.docs) {
      try {
        const data = docSnap.data();
        data.userId = newUid;
        data.migratedFrom = oldUid;
        data.migratedAt = new Date().toISOString();
        await addDoc(collection(db, 'clients'), data);
        results.clients++;
      } catch (e) { results.errors.push(`Client ${docSnap.id}: ${e.message}`); }
    }

    // 4. Migrate companies
    const companiesSnap = await getDocs(query(collection(db, 'companies'), where('userId', '==', oldUid)));
    for (const docSnap of companiesSnap.docs) {
      try {
        const data = docSnap.data();
        data.userId = newUid;
        data.migratedFrom = oldUid;
        data.migratedAt = new Date().toISOString();
        await setDoc(doc(db, 'companies', newUid), data);
        results.companies++;
      } catch (e) { results.errors.push(`Company ${docSnap.id}: ${e.message}`); }
    }

    // 5. Clean up old data
    if (results.errors.length === 0) {
      for (const docSnap of quotesSnap.docs) {
        try { await deleteDoc(doc(db, 'quotes', docSnap.id)); } catch (e) {}
      }
      for (const docSnap of clientsSnap.docs) {
        try { await deleteDoc(doc(db, 'clients', docSnap.id)); } catch (e) {}
      }
      for (const docSnap of companiesSnap.docs) {
        try { await deleteDoc(doc(db, 'companies', docSnap.id)); } catch (e) {}
      }
      try { await deleteDoc(doc(db, 'users', oldUid)); } catch (e) {}
    }

    if (results.errors.length > 0) results.success = false;
  } catch (error) {
    results.success = false;
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Scan for potentially orphaned user docs in Firestore
 */
window.scanOrphanedUsers = async function() {
  const resultDiv = document.getElementById('orphaned-scan-result');
  resultDiv.innerHTML = '<p style="color:var(--color-gray-500);">Escaneando documentos de usuarios...</p>';

  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const userList = [];
    snapshot.forEach(docSnap => userList.push({ id: docSnap.id, ...docSnap.data() }));

    if (userList.length === 0) {
      resultDiv.innerHTML = '<p style="color:var(--color-gray-500);">No se encontraron documentos de usuario.</p>';
      return;
    }

    let html = `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:12px;">
        <p style="margin:0;color:#92400e;font-weight:500;">📋 Documentos de usuario encontrados: ${userList.length}</p>
        <p style="margin:4px 0 0;font-size:0.8rem;color:#a16207;">
          Los documentos marcados pueden corresponder a cuentas eliminadas de Firebase Auth.
          Verifica manualmente si el UID tiene una cuenta Auth activa en Firebase Console.
        </p>
      </div>
    `;

    html += '<div style="max-height:300px;overflow-y:auto;">';
    html += '<table class="table" style="font-size:0.85rem;"><thead><tr><th>UID</th><th>Email</th><th>Nombre</th><th>Rol</th><th>Plan</th><th>Acciones</th></tr></thead><tbody>';

    for (const u of userList) {
      const isCurrentAdmin = auth.currentUser && u.id === auth.currentUser.uid;
      html += `
        <tr style="${isCurrentAdmin ? 'background:#f0fdf4;' : ''}">
          <td><code style="font-size:0.7rem;">${u.id.substring(0, 12)}...</code></td>
          <td>${u.email}</td>
          <td>${u.name || '-'}</td>
          <td>${u.role}</td>
          <td>${u.plan}</td>
          <td>
            ${!isCurrentAdmin ? `
              <button class="btn btn-xs btn-danger" onclick="window.deleteUserDoc('${u.id}')" title="Eliminar documento">🗑️</button>
            ` : '<small style="color:var(--color-gray-400);">Actual</small>'}
          </td>
        </tr>
      `;
    }

    html += '</tbody></table></div>';
    resultDiv.innerHTML = html;
  } catch (error) {
    resultDiv.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
      <p style="margin:0;color:#dc2626;">Error: ${error.message}</p>
    </div>`;
  }
};

/**
 * Delete a user document from Firestore (admin action)
 */
window.deleteUserDoc = async function(userId) {
  if (!confirm(`¿Eliminar el documento de usuario ${userId.substring(0, 8)}...?\n\nEsto NO elimina la cuenta Firebase Auth, solo el documento Firestore.\nAsegúrate de que el usuario tenga una copia de sus datos.`)) return;
  if (!confirm('⚠️ ESTA ACCIÓN ES IRREVERSIBLE. ¿Estás seguro?')) return;

  try {
    // First delete related data
    const quotesSnap = await getDocs(query(collection(db, 'quotes'), where('userId', '==', userId)));
    for (const docSnap of quotesSnap.docs) {
      await deleteDoc(doc(db, 'quotes', docSnap.id));
    }

    const clientsSnap = await getDocs(query(collection(db, 'clients'), where('userId', '==', userId)));
    for (const docSnap of clientsSnap.docs) {
      await deleteDoc(doc(db, 'clients', docSnap.id));
    }

    try { await deleteDoc(doc(db, 'companies', userId)); } catch (e) {}

    // Delete user doc
    await deleteDoc(doc(db, 'users', userId));

    showToast('Documento de usuario eliminado');
    document.getElementById('orphaned-scan-result').innerHTML = '';
    loadDashboard();
    loadClients();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
};
