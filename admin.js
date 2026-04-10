/* Admin Panel Logic */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let allUsers = [];

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
  
  // Load dashboard
  loadDashboard();
  loadUsers();
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
      users: 'Usuarios',
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
  let premiumUsers = 0;
  
  snapshot.forEach(doc => {
    const user = doc.data();
    users.push({ id: doc.id, ...user });
    
    if (user.plan !== 'free' && user.isActive) {
      premiumUsers++;
      const prices = { basic: 20, business: 40, pro: 60 };
      monthlyRevenue += prices[user.plan] || 0;
    }
  });
  
  allUsers = users;
  
  // Update stats
  document.getElementById('stat-total-users').textContent = users.length;
  document.getElementById('stat-monthly-revenue').textContent = `S/ ${monthlyRevenue}`;
  document.getElementById('stat-premium-users').textContent = premiumUsers;
  
  // Recent users
  const recentUsers = users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const tbody = document.getElementById('recent-users-tbody');
  
  tbody.innerHTML = recentUsers.map(user => `
    <tr>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td><span class="badge badge-${user.plan}">${getPlanName(user.plan)}</span></td>
      <td>${formatDate(user.createdAt)}</td>
      <td><span class="badge ${user.isActive ? 'badge-active' : 'badge-inactive'}">${user.isActive ? 'Activo' : 'Inactivo'}</span></td>
    </tr>
  `).join('');
}

// ==========================================================
// USERS
// ==========================================================

async function loadUsers() {
  renderUsers(allUsers);
}

function renderUsers(users) {
  const tbody = document.getElementById('users-tbody');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--color-gray-500)">No hay usuarios</td></tr>';
    return;
  }
  
  tbody.innerHTML = users.map(user => {
    const planEndDate = user.planEndDate ? new Date(user.planEndDate) : null;
    const isExpired = planEndDate && planEndDate < new Date();
    
    return `
      <tr>
        <td>
          <strong>${user.name}</strong>
          ${user.company ? `<br><small style="color:var(--color-gray-500)">${user.company}</small>` : ''}
        </td>
        <td>${user.email}</td>
        <td><span class="badge badge-${user.plan}">${getPlanName(user.plan)}</span></td>
        <td>${user.quotesUsedThisMonth || 0} / ${getPlanQuota(user.plan)}</td>
        <td>${planEndDate ? formatDateShort(planEndDate) : '-'}</td>
        <td>
          <span class="badge ${user.isActive && !isExpired ? 'badge-active' : 'badge-inactive'}">
            ${user.isActive && !isExpired ? 'Activo' : (isExpired ? 'Vencido' : 'Inactivo')}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editUser('${user.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="toggleUser('${user.id}', ${!user.isActive})">${user.isActive ? '⏸️' : '▶️'}</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Search users
document.getElementById('search-users').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allUsers.filter(u => 
    u.name.toLowerCase().includes(query) || 
    u.email.toLowerCase().includes(query) ||
    (u.company && u.company.toLowerCase().includes(query))
  );
  renderUsers(filtered);
});

// Edit user
function editUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  
  document.getElementById('edit-user-id').value = userId;
  document.getElementById('edit-user-name').value = user.name;
  document.getElementById('edit-user-email').value = user.email;
  document.getElementById('edit-user-plan').value = user.plan;
  document.getElementById('edit-user-active').value = user.isActive.toString();
  
  document.getElementById('modal-edit-user').classList.remove('hidden');
}

// Save user changes
document.getElementById('form-edit-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userId = document.getElementById('edit-user-id').value;
  const plan = document.getElementById('edit-user-plan').value;
  const duration = parseInt(document.getElementById('edit-user-duration').value) || 1;
  const isActive = document.getElementById('edit-user-active').value === 'true';
  
  const planEndDate = new Date();
  planEndDate.setMonth(planEndDate.getMonth() + duration);
  
  try {
    await db.collection('users').doc(userId).update({
      plan,
      planStartDate: new Date().toISOString(),
      planEndDate: planEndDate.toISOString(),
      isActive,
      quotesUsedThisMonth: 0,
      lastQuoteReset: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    showToast('Usuario actualizado');
    document.getElementById('modal-edit-user').classList.add('hidden');
    
    // Reload data
    loadDashboard();
    loadUsers();
  } catch (error) {
    console.error('Error:', error);
    showToast('Error al actualizar', 'error');
  }
});

// Reset quotes
document.getElementById('btn-reset-quotes').addEventListener('click', async () => {
  const userId = document.getElementById('edit-user-id').value;
  
  try {
    await db.collection('users').doc(userId).update({
      quotesUsedThisMonth: 0,
      lastQuoteReset: new Date().toISOString()
    });
    showToast('Cotizaciones reseteadas');
  } catch (error) {
    showToast('Error al resetear', 'error');
  }
});

// Toggle user active/inactive
async function toggleUser(userId, newState) {
  try {
    await db.collection('users').doc(userId).update({
      isActive: newState,
      updatedAt: new Date().toISOString()
    });
    showToast(`Usuario ${newState ? 'activado' : 'desactivado'}`);
    loadDashboard();
    loadUsers();
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
  }, 2000);
}
