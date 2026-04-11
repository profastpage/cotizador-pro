/* Super Admin Panel Logic */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let allUsers = [];
let pendingUsers = [];

// Auth check
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const userDoc = await db.collection('users').doc(user.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'superadmin') {
    window.location.href = 'index.html';
    return;
  }

  // Load admin info
  document.getElementById('admin-name').textContent = userDoc.data().name;
  document.getElementById('setting-admin-email').value = SUPER_ADMIN_EMAIL;

  // Load data
  loadDashboard();
  loadPendingUsers();
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
      pending: 'Pendientes de Aprobación',
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
  const snapshot = await db.collection('users').get();
  const users = [];
  let monthlyRevenue = 0;
  let activeUsers = 0;
  let pendingCount = 0;

  snapshot.forEach(doc => {
    const user = { id: doc.id, ...doc.data() };
    users.push(user);

    if (user.role === 'superadmin') return;

    if (user.approved && user.isActive) {
      activeUsers++;
      if (user.plan !== 'free') {
        const prices = { basic: 20, business: 40, pro: 60 };
        monthlyRevenue += prices[user.plan] || 0;
      }
    }
    if (!user.approved && user.role !== 'superadmin') {
      pendingCount++;
    }
  });

  allUsers = users.filter(u => u.role !== 'superadmin');
  pendingUsers = allUsers.filter(u => !u.approved);

  // Update stats
  document.getElementById('stat-total-users').textContent = allUsers.length;
  document.getElementById('stat-active-users').textContent = activeUsers;
  document.getElementById('stat-pending-users').textContent = pendingCount;
  document.getElementById('stat-monthly-revenue').textContent = `S/ ${monthlyRevenue}`;
  document.getElementById('pending-count').textContent = pendingCount;
  document.getElementById('pending-count').style.display = pendingCount > 0 ? 'inline-block' : 'none';

  // Recent users
  const recentUsers = allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const tbody = document.getElementById('recent-users-tbody');

  tbody.innerHTML = recentUsers.map(user => `
    <tr>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td><span class="badge badge-${user.plan}">${getPlanName(user.plan)}</span></td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <span class="badge ${user.approved ? (user.isActive ? 'badge-active' : 'badge-inactive') : 'badge-pending'}">
          ${user.approved ? (user.isActive ? 'Activo' : 'Inactivo') : '⏳ Pendiente'}
        </span>
      </td>
    </tr>
  `).join('');
}

// ==========================================================
// PENDING USERS
// ==========================================================

async function loadPendingUsers() {
  const tbody = document.getElementById('pending-users-tbody');

  if (pendingUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--color-gray-500)">No hay clientes pendientes de aprobación 🎉</td></tr>';
    return;
  }

  tbody.innerHTML = pendingUsers.map(user => `
    <tr>
      <td>
        <strong>${user.name}</strong>
        ${user.providerId === 'google.com' ? '<span class="badge badge-google" style="margin-left:0.5rem">Google</span>' : ''}
      </td>
      <td>${user.email}</td>
      <td>${user.company || '-'}</td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <button class="btn btn-sm btn-success" onclick="approveUser('${user.id}')">✅ Aprobar</button>
      </td>
    </tr>
  `).join('');
}

// Approve user
function approveUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('approve-user-id').value = userId;
  document.getElementById('approve-client-info').innerHTML = `
    <p><strong>${user.name}</strong></p>
    <p>${user.email}</p>
    ${user.company ? `<p>Empresa: ${user.company}</p>` : ''}
    <p>Registrado: ${formatDate(user.createdAt)}</p>
  `;

  updateApproveSummary();
  document.getElementById('modal-approve').classList.remove('hidden');
}

// Update approval summary
function updateApproveSummary() {
  const plan = document.querySelector('input[name="approve-plan"]:checked').value;
  const duration = parseInt(document.querySelector('input[name="approve-duration"]:checked').value);
  const prices = { free: 0, basic: 20, business: 40, pro: 60 };
  const planName = getPlanName(plan);
  const basePrice = prices[plan];
  const discounts = { 1: 0, 3: 0.10, 6: 0.15, 12: 0.20, 0: 0 };
  const discount = discounts[duration];
  const months = duration === 0 ? 'Ilimitado' : `${duration} mes${duration > 1 ? 'es' : ''}`;

  let subtotal = duration === 0 ? basePrice : basePrice * duration;
  let discountAmount = subtotal * discount;
  let total = subtotal - discountAmount;

  document.getElementById('approve-summary').innerHTML = `
    <div class="summary-line">
      <span>Plan:</span>
      <span>${planName}</span>
    </div>
    <div class="summary-line">
      <span>Duración:</span>
      <span>${months}</span>
    </div>
    ${duration > 0 ? `
    <div class="summary-line">
      <span>Precio base:</span>
      <span>S/ ${basePrice.toFixed(2)} × ${duration} = S/ ${subtotal.toFixed(2)}</span>
    </div>
    ${discount > 0 ? `
    <div class="summary-line">
      <span>Descuento (${discount * 100}%):</span>
      <span class="discount">- S/ ${discountAmount.toFixed(2)}</span>
    </div>
    ` : ''}
    ` : `
    <div class="summary-line">
      <span>Tipo:</span>
      <span>Licencia ilimitada</span>
    </div>
    `}
    <div class="summary-line total">
      <span>Total:</span>
      <span>S/ ${total.toFixed(2)}</span>
    </div>
  `;
}

// Listen for plan/duration changes
document.querySelectorAll('input[name="approve-plan"], input[name="approve-duration"]').forEach(input => {
  input.addEventListener('change', updateApproveSummary);
});

// Approve form submit
document.getElementById('form-approve').addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('approve-user-id').value;
  const plan = document.querySelector('input[name="approve-plan"]:checked').value;
  const duration = parseInt(document.querySelector('input[name="approve-duration"]:checked').value);

  const now = new Date();
  let planEndDate = null;

  if (duration > 0) {
    planEndDate = new Date(now);
    planEndDate.setMonth(planEndDate.getMonth() + duration);
  }

  try {
    await db.collection('users').doc(userId).update({
      approved: true,
      isActive: true,
      plan,
      planStartDate: now.toISOString(),
      planEndDate: planEndDate ? planEndDate.toISOString() : null,
      licenseDuration: duration,
      quotesUsedThisMonth: 0,
      lastQuoteReset: now.toISOString(),
      updatedAt: now.toISOString()
    });

    showToast('Cliente aprobado y licencia activada ✅');
    document.getElementById('modal-approve').classList.add('hidden');

    loadDashboard();
    loadPendingUsers();
    loadClients();
  } catch (error) {
    console.error('Error:', error);
    showToast('Error al aprobar cliente', 'error');
  }
});

// Reject client
async function rejectClient() {
  const userId = document.getElementById('approve-user-id').value;

  if (!confirm('¿Rechazar este cliente? Se eliminará su cuenta.')) return;

  try {
    // Delete user doc (auth user stays, but can't access)
    await db.collection('users').doc(userId).delete();

    showToast('Cliente rechazado');
    document.getElementById('modal-approve').classList.add('hidden');

    loadDashboard();
    loadPendingUsers();
    loadClients();
  } catch (error) {
    console.error('Error:', error);
    showToast('Error al rechazar', 'error');
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

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--color-gray-500)">No hay clientes registrados</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => {
    const planEndDate = user.planEndDate ? new Date(user.planEndDate) : null;
    const isExpired = planEndDate && planEndDate < new Date() && user.licenseDuration !== 0;
    const isApproved = user.approved;

    return `
      <tr>
        <td>
          <strong>${user.name}</strong>
          ${user.company ? `<br><small style="color:var(--color-gray-500)">${user.company}</small>` : ''}
          ${user.providerId === 'google.com' ? '<span class="badge badge-google" style="margin-left:0.5rem">Google</span>' : ''}
        </td>
        <td>${user.email}</td>
        <td><span class="badge badge-${user.plan}">${getPlanName(user.plan)}</span></td>
        <td>
          ${!isApproved ? '<span class="license-badge expired">⏳ Pendiente</span>' :
            user.licenseDuration === 0 ? '<span class="license-badge unlimited">∞ Ilimitado</span>' :
            isExpired ? '<span class="license-badge expired">Vencido</span>' :
            planEndDate ? `<span class="license-badge">${formatDateShort(planEndDate)}</span>` :
            '<span class="license-badge">-</span>'}
        </td>
        <td>${user.quotesUsedThisMonth || 0} / ${getPlanQuota(user.plan)}</td>
        <td>
          <span class="badge ${isApproved && user.isActive && !isExpired ? 'badge-active' : 'badge-inactive'}">
            ${isApproved ? (user.isActive ? 'Activo' : 'Inactivo') : 'Pendiente'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editClient('${user.id}')">✏️</button>
          ${isApproved ? `<button class="btn btn-sm btn-warning" onclick="toggleClient('${user.id}', ${!user.isActive})">${user.isActive ? '⏸️' : '▶️'}</button>` :
            `<button class="btn btn-sm btn-success" onclick="approveUser('${user.id}')">✅</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

// Search clients
document.getElementById('search-clients').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allUsers.filter(u =>
    u.name.toLowerCase().includes(query) ||
    u.email.toLowerCase().includes(query) ||
    (u.company && u.company.toLowerCase().includes(query))
  );
  renderClients(filtered);
});

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

// Save client changes
document.getElementById('form-edit-client').addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('edit-client-id').value;
  const plan = document.getElementById('edit-client-plan').value;
  const duration = parseInt(document.getElementById('edit-client-duration').value) || 0;
  const isActive = document.getElementById('edit-client-active').value === 'true';
  const quotesUsed = parseInt(document.getElementById('edit-client-quotes-used').value) || 0;

  const now = new Date();
  let planEndDate = null;

  if (duration > 0) {
    planEndDate = new Date(now);
    planEndDate.setMonth(planEndDate.getMonth() + duration);
  }

  try {
    await db.collection('users').doc(userId).update({
      plan,
      isActive,
      licenseDuration: duration,
      planStartDate: now.toISOString(),
      planEndDate: planEndDate ? planEndDate.toISOString() : null,
      quotesUsedThisMonth: quotesUsed,
      lastQuoteReset: now.toISOString(),
      approved: true,
      updatedAt: now.toISOString()
    });

    showToast('Cliente actualizado ✅');
    document.getElementById('modal-edit-client').classList.add('hidden');

    loadDashboard();
    loadPendingUsers();
    loadClients();
  } catch (error) {
    console.error('Error:', error);
    showToast('Error al actualizar', 'error');
  }
});

// Reset quotes
document.getElementById('btn-reset-quotes').addEventListener('click', async () => {
  const userId = document.getElementById('edit-client-id').value;

  try {
    await db.collection('users').doc(userId).update({
      quotesUsedThisMonth: 0,
      lastQuoteReset: new Date().toISOString()
    });
    document.getElementById('edit-client-quotes-used').value = 0;
    showToast('Cotizaciones reseteadas');
  } catch (error) {
    showToast('Error al resetear', 'error');
  }
});

// Toggle client active/inactive
async function toggleClient(userId, newState) {
  try {
    await db.collection('users').doc(userId).update({
      isActive: newState,
      updatedAt: new Date().toISOString()
    });
    showToast(`Cliente ${newState ? 'activado' : 'desactivado'}`);
    loadDashboard();
    loadPendingUsers();
    loadClients();
  } catch (error) {
    showToast('Error', 'error');
  }
}

// ==========================================================
// HELPERS
// ==========================================================

function getPlanName(plan) {
  const names = {
    free: '🆓 Gratis',
    basic: '📋 Básico',
    business: '💼 Business',
    pro: '🚀 Pro'
  };
  return names[plan] || plan;
}

function getPlanQuota(plan) {
  const quotas = {
    free: '5',
    basic: '20',
    business: '50',
    pro: '∞'
  };
  return quotas[plan] || '0';
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
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function logout() {
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
}
