/* Super Admin Panel - No redirects, no loops */

import { auth, db, SUPER_ADMIN_EMAIL, PLANS, signOut, onAuthStateChanged, collection, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, serverTimestamp, increment } from '../firebase-config.js';

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

window.logout = function() {
  signOut(auth).then(() => { window.location.href = 'index.html'; });
};
