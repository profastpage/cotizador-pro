/* Super Admin Panel Logic - SDK Modular v10+ */

import { auth, db, SUPER_ADMIN_EMAIL, PLANS, LICENSE_DURATIONS, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

let allUsers = [];
let pendingUsers = [];

// Auth check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists() || userDoc.data().role !== 'superadmin') {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('admin-name').textContent = userDoc.data().name;
  const settingEmail = document.getElementById('setting-admin-email');
  if (settingEmail) settingEmail.value = SUPER_ADMIN_EMAIL;

  loadDashboard();
  loadClients();
});

// Tab navigation
document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    const titles = {
      dashboard: 'Dashboard',
      clients: 'Clientes',
      plans: 'Planes',
      settings: 'Configuración'
    };
    document.getElementById('page-title').textContent = titles[tab];
  });
});

// Close modals
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  });
});

// ==========================================================
// DASHBOARD
// ==========================================================

async function loadDashboard() {
  const snapshot = await getDocs(collection(db, 'users'));
  const users = [];
  let monthlyRevenue = 0;
  let activeUsers = 0;
  let freeUsers = 0;
  let paidUsers = 0;

  snapshot.forEach(docSnap => {
    const user = { id: docSnap.id, ...docSnap.data() };
    users.push(user);

    if (user.role === 'superadmin') return;

    if (user.isActive) {
      activeUsers++;
      if (user.plan === 'free') {
        freeUsers++;
      } else {
        paidUsers++;
        const prices = { basic: 20, business: 40, pro: 60 };
        monthlyRevenue += prices[user.plan] || 0;
      }
    }
  });

  allUsers = users.filter(u => u.role !== 'superadmin');

  document.getElementById('stat-total-users').textContent = allUsers.length;
  document.getElementById('stat-active-users').textContent = activeUsers;
  document.getElementById('stat-free-users').textContent = freeUsers;
  document.getElementById('stat-paid-users').textContent = paidUsers;
  document.getElementById('stat-monthly-revenue').textContent = `S/ ${monthlyRevenue}`;

  const recentUsers = allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  const tbody = document.getElementById('recent-users-tbody');
  if (tbody) {
    tbody.innerHTML = recentUsers.map(user => `
      <tr>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td><span class="badge badge-${user.plan}">${getPlanName(user.plan)}</span></td>
        <td>${formatDate(user.createdAt)}</td>
        <td>
          <span class="badge ${user.isActive ? 'badge-active' : 'badge-inactive'}">
            ${user.isActive ? 'Activo' : 'Inactivo'}
          </span>
        </td>
      </tr>
    `).join('');
  }
}

// ==========================================================
// CLIENTS
// ==========================================================

async function loadClients() {
  renderClients(allUsers);
}

function renderClients(users) {
  const tbody = document.getElementById('clients-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--color-gray-500)">No hay clientes registrados</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => {
    const planEndDate = user.planEndDate ? new Date(user.planEndDate) : null;
    const isExpired = planEndDate && planEndDate < new Date() && user.licenseDuration !== 0;
    return `
      <tr>
        <td><strong>${user.name}</strong>${user.company ? `<br><small style="color:var(--color-gray-500)">${user.company}</small>` : ''}</td>
        <td>${user.email}</td>
        <td><span class="badge badge-${user.plan}">${getPlanName(user.plan)}</span></td>
        <td>${user.licenseDuration === 0 ? '<span class="license-badge unlimited">∞ Ilimitado</span>' : planEndDate && !isExpired ? `<span class="license-badge">${formatDateShort(planEndDate)}</span>` : isExpired ? '<span class="license-badge expired">Vencido</span>' : '<span class="license-badge">Gratis</span>'}</td>
        <td>${user.quotesUsedThisMonth || 0} / ${getPlanQuota(user.plan)}</td>
        <td><span class="badge ${user.isActive && !isExpired ? 'badge-active' : 'badge-inactive'}">${user.isActive ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="window.editClient('${user.id}')">✏️</button>
          <button class="btn btn-sm btn-warning" onclick="window.toggleClient('${user.id}', ${!user.isActive})">${user.isActive ? '⏸️' : '▶️'}</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Search
const searchClients = document.getElementById('search-clients');
if (searchClients) {
  searchClients.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    renderClients(allUsers.filter(u => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || (u.company && u.company.toLowerCase().includes(query))));
  });
}

// Edit client
function editClient(userId) {
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
}
window.editClient = editClient;

// Save client
const formEditClient = document.getElementById('form-edit-client');
if (formEditClient) {
  formEditClient.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('edit-client-id').value;
    const plan = document.getElementById('edit-client-plan').value;
    const duration = parseInt(document.getElementById('edit-client-duration').value) || 0;
    const isActive = document.getElementById('edit-client-active').value === 'true';
    const quotesUsed = parseInt(document.getElementById('edit-client-quotes-used').value) || 0;
    const now = new Date();
    let planEndDate = duration > 0 ? new Date(now.setMonth(now.getMonth() + duration)).toISOString() : null;

    try {
      await updateDoc(doc(db, 'users', userId), {
        plan, isActive, licenseDuration: duration,
        planStartDate: new Date().toISOString(), planEndDate,
        quotesUsedThisMonth: quotesUsed, lastQuoteReset: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast('Cliente actualizado ✅');
      document.getElementById('modal-edit-client').classList.add('hidden');
      loadDashboard(); loadClients();
    } catch (error) {
      showToast('Error al actualizar', 'error');
    }
  });
}

// Reset quotes
const btnResetQuotes = document.getElementById('btn-reset-quotes');
if (btnResetQuotes) {
  btnResetQuotes.addEventListener('click', async () => {
    const userId = document.getElementById('edit-client-id').value;
    try {
      await updateDoc(doc(db, 'users', userId), { quotesUsedThisMonth: 0, lastQuoteReset: new Date().toISOString() });
      document.getElementById('edit-client-quotes-used').value = 0;
      showToast('Cotizaciones reseteadas');
    } catch (error) {
      showToast('Error al resetear', 'error');
    }
  });
}

// Toggle client
window.toggleClient = async function(userId, newState) {
  try {
    await updateDoc(doc(db, 'users', userId), { isActive: newState, updatedAt: new Date().toISOString() });
    showToast(`Cliente ${newState ? 'activado' : 'desactivado'}`);
    loadDashboard(); loadClients();
  } catch (error) {
    showToast('Error', 'error');
  }
};

// ==========================================================
// HELPERS
// ==========================================================

function getPlanName(plan) {
  return { free: '🆓 Gratis', basic: '📋 Básico', business: '💼 Business', pro: '🚀 Pro' }[plan] || plan;
}

function getPlanQuota(plan) {
  return { free: '5', basic: '20', business: '50', pro: '∞' }[plan] || '0';
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
