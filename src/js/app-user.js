/* App User Logic - SDK Modular v10+ */

import { auth, db, PLANS, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

let currentUser = null;
let userData = null;
let quoteItems = [];
let currentWizardStep = 1;

// ==========================================================
// AUTH CHECK - NO redirects to avoid loops
// ==========================================================

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  
  if (!user) {
    // Not logged in - show message
    document.getElementById('user-name').textContent = 'Usuario';
    return;
  }

  // User is logged in, load their data
  getDoc(doc(db, 'users', user.uid)).then((userDoc) => {
    if (!userDoc.exists()) {
      window.location.href = 'index.html';
      return;
    }

    userData = userDoc.data();

    // Check if user is active
    if (!userData.isActive) {
      showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
      signOut(auth);
      return;
    }

    // Check plan expiry
    if (userData.plan !== 'free' && userData.planEndDate) {
      const endDate = new Date(userData.planEndDate);
      if (endDate < new Date() && userData.licenseDuration !== 0) {
        updateDoc(doc(db, 'users', user.uid), {
          plan: 'free', planStartDate: null, planEndDate: null, quotesUsedThisMonth: 0
        });
        userData.plan = 'free';
      }
    }

    // Monthly reset
    const lastReset = new Date(userData.lastQuoteReset);
    const now = new Date();
    if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
      updateDoc(doc(db, 'users', user.uid), { quotesUsedThisMonth: 0, lastQuoteReset: now.toISOString() });
      userData.quotesUsedThisMonth = 0;
    }

    initUI();
    loadDashboard();
  });
});

// ==========================================================
// INIT UI
// ==========================================================

function initUI() {
  document.getElementById('user-name').textContent = userData.name.split(' ')[0];

  const planBadge = document.getElementById('user-plan-badge');
  planBadge.className = `badge badge-${userData.plan}`;
  planBadge.textContent = getPlanName(userData.plan);

  updatePlanProgress();

  if (userData.planEndDate) {
    document.getElementById('stat-plan-expires').textContent = formatDateShort(new Date(userData.planEndDate));
  } else {
    document.getElementById('stat-plan-expires').textContent = 'Gratis';
  }

  if (userData.plan === 'free') {
    document.getElementById('plan-banner').classList.remove('hidden');
    document.getElementById('plan-banner-text').textContent = '¡Tienes 5 cotizaciones gratis este mes!';
  }

  const today = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  document.getElementById('quote-issue-date').value = today.toISOString().split('T')[0];
  document.getElementById('quote-due-date').value = dueDate.toISOString().split('T')[0];

  setupNavigation();
  setupWizard();
  setupForms();
}

function updatePlanProgress() {
  const quota = getPlanQuota(userData.plan);
  const used = userData.quotesUsedThisMonth || 0;
  const percent = quota === -1 ? 0 : Math.min((used / quota) * 100, 100);

  document.getElementById('quotes-used').textContent = used;
  document.getElementById('quotes-limit').textContent = quota === -1 ? '∞' : quota;
  document.getElementById('plan-progress-bar').style.width = `${percent}%`;
  document.getElementById('plan-progress-bar').style.background = percent >= 90 ? 'var(--color-danger)' : percent >= 70 ? 'var(--color-warning)' : 'var(--color-success)';
}

// ==========================================================
// NAVIGATION
// ==========================================================

function setupNavigation() {
  document.querySelectorAll('.sidebar .nav-item, .bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    });
  });
}

function navigateTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${screen}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.screen === screen) btn.classList.add('active');
  });
  if (screen === 'dashboard') loadDashboard();
  if (screen === 'history') loadHistory();
  if (screen === 'new-quote') resetWizard();
  if (screen === 'settings') loadSettings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================
// DASHBOARD
// ==========================================================

async function loadDashboard() {
  const quotes = await getUserQuotes();
  const thisMonth = quotes.filter(q => {
    const d = new Date(q.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalAmount = thisMonth.reduce((sum, q) => sum + (q.total || 0), 0);
  document.getElementById('stat-quotes-month').textContent = thisMonth.length;
  document.getElementById('stat-total-amount').textContent = formatCurrency(totalAmount);

  const recent = quotes.slice(0, 5);
  const container = document.getElementById('dashboard-recent-quotes');
  container.innerHTML = recent.length === 0 ? `
    <div class="empty-state"><div class="empty-state-icon">📋</div><h3>No hay cotizaciones aún</h3><p>Crea tu primera cotización profesional</p></div>
  ` : recent.map(q => createQuoteCard(q)).join('');
}

// ==========================================================
// HISTORY
// ==========================================================

async function loadHistory() {
  const quotes = await getUserQuotes();
  const container = document.getElementById('history-quotes-list');
  container.innerHTML = quotes.length === 0 ? `
    <div class="empty-state"><div class="empty-state-icon">📋</div><h3>No hay cotizaciones guardadas</h3></div>
  ` : quotes.map(q => createQuoteCard(q, true)).join('');
}

function createQuoteCard(quote, showActions = false) {
  return `
    <div class="quote-card">
      <div class="quote-card-header">
        <span class="quote-number">#${quote.number || 'N/A'}</span>
        <span class="quote-date">${formatDateShort(new Date(quote.createdAt))}</span>
      </div>
      <div class="quote-client">${quote.client?.name || 'Sin cliente'}</div>
      <div class="quote-amount">${formatCurrency(quote.total)}</div>
      ${showActions ? `<div class="quote-actions">
        <button class="btn btn-sm btn-primary" onclick="window.downloadQuote('${quote.id}')">📄 PDF</button>
        <button class="btn btn-sm btn-danger" onclick="window.deleteQuote('${quote.id}')">🗑️</button>
      </div>` : ''}
    </div>
  `;
}

// Search
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-quotes');
  if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.toLowerCase();
      const quotes = await getUserQuotes();
      const filtered = quotes.filter(q => (q.client?.name || '').toLowerCase().includes(query) || (q.number || '').toLowerCase().includes(query));
      document.getElementById('history-quotes-list').innerHTML = filtered.map(q => createQuoteCard(q, true)).join('');
    });
  }
});

// ==========================================================
// WIZARD
// ==========================================================

function setupWizard() {
  document.getElementById('btn-next-step')?.addEventListener('click', nextStep);
  document.getElementById('btn-prev-step')?.addEventListener('click', prevStep);
  document.getElementById('btn-generate-pdf')?.addEventListener('click', generatePDF);
  document.getElementById('btn-add-item')?.addEventListener('click', addItem);
}

function resetWizard() {
  currentWizardStep = 1;
  quoteItems = [];
  document.getElementById('form-client')?.reset();
  document.getElementById('items-container').innerHTML = '';
  updateWizardUI();
  updateSummary();
}

function updateWizardUI() {
  document.querySelectorAll('.wizard-step').forEach((step, i) => {
    step.classList.remove('active', 'completed');
    if (i + 1 === currentWizardStep) step.classList.add('active');
    else if (i + 1 < currentWizardStep) step.classList.add('completed');
  });
  document.querySelectorAll('.wizard-step-content').forEach((c, i) => {
    c.classList.toggle('active', i + 1 === currentWizardStep);
  });
  document.getElementById('wizard-bar-progress').style.width = `${(currentWizardStep / 3) * 100}%`;
  document.getElementById('btn-prev-step')?.classList.toggle('hidden', currentWizardStep === 1);
  document.getElementById('btn-next-step')?.classList.toggle('hidden', currentWizardStep === 3);
  document.getElementById('btn-generate-pdf')?.classList.toggle('hidden', currentWizardStep !== 3);
  if (currentWizardStep === 3) updateReview();
}

function nextStep() {
  if (currentWizardStep === 1 && !document.getElementById('client-name').value.trim()) {
    showToast('Ingresa el nombre del cliente', 'error');
    return;
  }
  if (currentWizardStep === 2 && quoteItems.length === 0) {
    showToast('Agrega al menos un item', 'error');
    return;
  }
  if (currentWizardStep < 3) { currentWizardStep++; updateWizardUI(); }
}

function prevStep() {
  if (currentWizardStep > 1) { currentWizardStep--; updateWizardUI(); }
}

// ==========================================================
// ITEMS
// ==========================================================

function addItem() {
  const id = Date.now().toString();
  quoteItems.push({ id, quantity: 1, unitPrice: 0, description: '' });
  const container = document.getElementById('items-container');
  const html = `
    <div class="item-card" data-item-id="${id}">
      <div class="item-header">
        <span class="item-number">Item ${quoteItems.length}</span>
        <button class="btn-remove-item" onclick="window.removeItem('${id}')">✕</button>
      </div>
      <div class="item-fields">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cantidad</label>
            <input type="number" class="form-input item-qty" value="1" min="1" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">Precio Unitario</label>
            <input type="number" class="form-input item-price" value="0" min="0" step="0.01" inputmode="decimal">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <input type="text" class="form-input item-desc" placeholder="Descripción del producto/servicio">
        </div>
        <div class="item-subtotal">S/ 0.00</div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);

  const card = container.querySelector(`[data-item-id="${id}"]`);
  card.querySelector('.item-qty').addEventListener('input', (e) => updateItem(id, 'quantity', parseFloat(e.target.value) || 0));
  card.querySelector('.item-price').addEventListener('input', (e) => updateItem(id, 'unitPrice', parseFloat(e.target.value) || 0));
  card.querySelector('.item-desc').addEventListener('input', (e) => updateItem(id, 'description', e.target.value));
}

function removeItem(id) {
  quoteItems = quoteItems.filter(i => i.id !== id);
  document.querySelector(`[data-item-id="${id}"]`)?.remove();
  renumberItems();
  updateSummary();
}
window.removeItem = removeItem;

function renumberItems() {
  document.querySelectorAll('.item-number').forEach((el, i) => el.textContent = `Item ${i + 1}`);
}

function updateItem(id, field, value) {
  const item = quoteItems.find(i => i.id === id);
  if (item) {
    item[field] = value;
    const card = document.querySelector(`[data-item-id="${id}"]`);
    card.querySelector('.item-subtotal').textContent = formatCurrency((item.quantity || 0) * (item.unitPrice || 0));
    updateSummary();
  }
}

function updateSummary() {
  const subtotal = quoteItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const igv = subtotal * 0.18;
  const total = subtotal + igv;
  document.getElementById('summary-subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('summary-igv').textContent = formatCurrency(igv);
  document.getElementById('summary-total').textContent = formatCurrency(total);
}

function updateReview() {
  const client = {
    name: document.getElementById('client-name').value,
    document: document.getElementById('client-document').value,
    email: document.getElementById('client-email').value,
    phone: document.getElementById('client-phone').value,
    address: document.getElementById('client-address').value
  };
  const subtotal = quoteItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const igv = subtotal * 0.18;
  const total = subtotal + igv;

  document.getElementById('quote-review').innerHTML = `
    <div class="review-section"><div class="review-section-title">Cliente</div>
      <p><strong>${client.name}</strong></p>${client.document ? `<p>RUC/DNI: ${client.document}</p>` : ''}
    </div>
    <div class="review-section"><div class="review-section-title">Items</div>
      ${quoteItems.map(i => `<div class="review-item"><span>${i.quantity}x ${i.description}</span><span>${formatCurrency((i.quantity || 0) * (i.unitPrice || 0))}</span></div>`).join('')}
    </div>
    <div class="quote-summary">
      <div class="summary-row"><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
      <div class="summary-row"><span>IGV (18%):</span><span>${formatCurrency(igv)}</span></div>
      <div class="summary-row summary-total"><span>TOTAL:</span><span>${formatCurrency(total)}</span></div>
    </div>
  `;
}

// ==========================================================
// GENERATE PDF
// ==========================================================

async function generatePDF() {
  const quota = getPlanQuota(userData.plan);
  if (quota !== -1 && userData.quotesUsedThisMonth >= quota) {
    showToast('¡Límite alcanzado! Mejora tu plan.', 'error');
    showUpgradeModal();
    return;
  }

  const companyData = await getDoc(doc(db, 'companies', currentUser.uid));
  if (!companyData.exists() || !companyData.data().ruc) {
    showToast('Configura los datos de tu empresa primero', 'error');
    navigateTo('settings');
    return;
  }

  try {
    showToast('Generando PDF...', 'info');
    const company = companyData.data();
    const client = {
      name: document.getElementById('client-name').value,
      document: document.getElementById('client-document').value,
      email: document.getElementById('client-email').value,
      phone: document.getElementById('client-phone').value,
      address: document.getElementById('client-address').value
    };
    const subtotal = quoteItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const igv = subtotal * 0.18;
    const total = subtotal + igv;

    const quote = {
      userId: currentUser.uid, client, items: quoteItems,
      issueDate: document.getElementById('quote-issue-date').value,
      dueDate: document.getElementById('quote-due-date').value,
      subtotal, igv, total, createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, 'quotes'), quote);
    await updateDoc(doc(db, 'users', currentUser.uid), { quotesUsedThisMonth: increment(1) });

    // Load jsPDF dynamically
    if (!window.jspdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      await new Promise(resolve => { script.onload = resolve; document.head.appendChild(script); });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('COTIZACIÓN', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`N° ${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`, 20, 40);
    doc.text(`Fecha: ${quote.issueDate}`, 20, 50);
    doc.text('CLIENTE:', 20, 70);
    doc.setFontSize(10);
    doc.text(client.name, 20, 80);
    if (client.document) doc.text(`RUC/DNI: ${client.document}`, 20, 88);
    doc.setFontSize(12);
    doc.text('ITEMS:', 20, 110);

    let y = 120;
    quoteItems.forEach((item, i) => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${item.description}`, 20, y);
      doc.text(`${item.quantity} x S/${item.unitPrice.toFixed(2)} = S/${itemTotal.toFixed(2)}`, 150, y);
      y += 10;
    });

    y += 10;
    doc.setFontSize(12);
    doc.text(`Subtotal: S/${subtotal.toFixed(2)}`, 150, y); y += 8;
    doc.text(`IGV (18%): S/${igv.toFixed(2)}`, 150, y); y += 8;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: S/${total.toFixed(2)}`, 150, y);

    doc.save(`Cotizacion-${client.name.replace(/\s+/g, '-')}.pdf`);
    showToast('¡PDF generado exitosamente!');
    resetWizard();
    navigateTo('dashboard');
    userData.quotesUsedThisMonth++;
    updatePlanProgress();
  } catch (error) {
    console.error('Error:', error);
    showToast('Error al generar PDF', 'error');
  }
}

// ==========================================================
// SETTINGS
// ==========================================================

function loadSettings() {
  getDoc(doc(db, 'companies', currentUser.uid)).then(docSnap => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById('company-name').value = data.name || '';
      document.getElementById('company-ruc').value = data.ruc || '';
      document.getElementById('company-address').value = data.address || '';
      document.getElementById('company-phone').value = data.phone || '';
      document.getElementById('company-email').value = data.email || '';
    }
  });

  document.getElementById('current-plan-name').textContent = getPlanName(userData.plan);
  const prices = { free: 'S/ 0', basic: 'S/ 20', business: 'S/ 40', pro: 'S/ 60' };
  document.getElementById('current-plan-price').textContent = prices[userData.plan] || 'S/ 0';
  const descs = { free: '5 cotizaciones por mes', basic: '20 cotizaciones por mes', business: '50 cotizaciones por mes', pro: 'Cotizaciones ilimitadas' };
  document.getElementById('current-plan-desc').textContent = descs[userData.plan];
}

function setupForms() {
  const formCompany = document.getElementById('form-company');
  if (formCompany) {
    formCompany.addEventListener('submit', async (e) => {
      e.preventDefault();
      const company = {
        name: document.getElementById('company-name').value.trim(),
        ruc: document.getElementById('company-ruc').value.trim(),
        address: document.getElementById('company-address').value.trim(),
        phone: document.getElementById('company-phone').value.trim(),
        email: document.getElementById('company-email').value.trim(),
        userId: currentUser.uid, updatedAt: new Date().toISOString()
      };
      if (!company.name || !company.ruc) {
        showToast('Nombre y RUC son obligatorios', 'error');
        return;
      }
      await setDoc(doc(db, 'companies', currentUser.uid), company, { merge: true });
      showToast('Datos guardados');
    });
  }
}

// ==========================================================
// HELPERS
// ==========================================================

function getPlanQuota(plan) {
  return { free: 5, basic: 20, business: 50, pro: -1 }[plan] || 5;
}

function getPlanName(plan) {
  return { free: 'Gratis', basic: 'Básico', business: 'Business', pro: 'Pro' }[plan] || 'Gratis';
}

function formatCurrency(amount) {
  return `S/ ${(amount || 0).toFixed(2)}`;
}

function formatDateShort(date) {
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

async function getUserQuotes() {
  const q = query(collection(db, 'quotes'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const quotes = [];
  snapshot.forEach(docSnap => quotes.push({ id: docSnap.id, ...docSnap.data() }));
  return quotes;
}

window.deleteQuote = async function(id) {
  if (confirm('¿Eliminar esta cotización?')) {
    await deleteDoc(doc(db, 'quotes', id));
    showToast('Cotización eliminada');
    loadHistory();
  }
};

window.downloadQuote = function(id) {
  showToast('Generando PDF...', 'info');
};

window.showUpgradeModal = function() {
  document.getElementById('modal-upgrade').classList.remove('hidden');
};

window.selectPlan = function(plan) {
  showToast(`Plan ${getPlanName(plan)} seleccionado. Contacta al admin para activar.`, 'success');
  document.getElementById('modal-upgrade').classList.add('hidden');
};

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
}

window.logout = function() {
  signOut(auth).then(() => { window.location.href = 'index.html'; });
};
