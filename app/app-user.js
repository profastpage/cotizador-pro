/* App User Logic */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userData = null;
let quoteItems = [];
let currentWizardStep = 1;

// ==========================================================
// AUTH CHECK
// ==========================================================

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = '../public/index.html';
    return;
  }
  
  currentUser = user;
  
  const userDoc = await db.collection('users').doc(user.uid).get();
  if (!userDoc.exists) {
    window.location.href = '../public/index.html';
    return;
  }
  
  userData = userDoc.data();
  
  // Check if plan is expired
  if (userData.plan !== 'free' && userData.planEndDate) {
    const endDate = new Date(userData.planEndDate);
    if (endDate < new Date()) {
      // Plan expired, reset to free
      await db.collection('users').doc(user.uid).update({
        plan: 'free',
        planStartDate: null,
        planEndDate: null,
        quotesUsedThisMonth: 0
      });
      userData.plan = 'free';
    }
  }
  
  // Check monthly reset
  const lastReset = new Date(userData.lastQuoteReset);
  const now = new Date();
  if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    await db.collection('users').doc(user.uid).update({
      quotesUsedThisMonth: 0,
      lastQuoteReset: now.toISOString()
    });
    userData.quotesUsedThisMonth = 0;
  }
  
  // Initialize UI
  initUI();
  loadDashboard();
});

// ==========================================================
// INIT UI
// ==========================================================

function initUI() {
  // User name
  document.getElementById('user-name').textContent = userData.name.split(' ')[0];
  
  // Plan badge
  const planBadge = document.getElementById('user-plan-badge');
  planBadge.className = `badge badge-${userData.plan}`;
  planBadge.textContent = getPlanName(userData.plan);
  
  // Plan progress
  updatePlanProgress();
  
  // Plan expires
  if (userData.planEndDate) {
    document.getElementById('stat-plan-expires').textContent = formatDateShort(new Date(userData.planEndDate));
  } else {
    document.getElementById('stat-plan-expires').textContent = 'Gratis';
  }
  
  // Plan banner
  if (userData.plan === 'free') {
    document.getElementById('plan-banner').classList.remove('hidden');
    document.getElementById('plan-banner-text').textContent = ' ¡Tienes 5 cotizaciones gratis este mes!';
  }
  
  // Default dates
  const today = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  document.getElementById('quote-issue-date').value = today.toISOString().split('T')[0];
  document.getElementById('quote-due-date').value = dueDate.toISOString().split('T')[0];
  
  // Navigation
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
  
  if (percent >= 90) {
    document.getElementById('plan-progress-bar').style.background = 'var(--color-danger)';
  } else if (percent >= 70) {
    document.getElementById('plan-progress-bar').style.background = 'var(--color-warning)';
  } else {
    document.getElementById('plan-progress-bar').style.background = 'var(--color-success)';
  }
}

// ==========================================================
// NAVIGATION
// ==========================================================

function setupNavigation() {
  // Sidebar nav
  document.querySelectorAll('.sidebar .nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });
  
  // Bottom nav
  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });
  
  // Close modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    });
  });
}

function navigateTo(screen) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${screen}`).classList.add('active');
  
  // Update nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.screen === screen) btn.classList.add('active');
  });
  
  // Load screen data
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
  
  // Recent quotes
  const recent = quotes.slice(0, 5);
  const container = document.getElementById('dashboard-recent-quotes');
  
  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No hay cotizaciones aún</h3>
        <p>Crea tu primera cotización profesional</p>
      </div>
    `;
  } else {
    container.innerHTML = recent.map(q => createQuoteCard(q)).join('');
  }
}

// ==========================================================
// HISTORY
// ==========================================================

async function loadHistory() {
  const quotes = await getUserQuotes();
  const container = document.getElementById('history-quotes-list');
  
  if (quotes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No hay cotizaciones guardadas</h3>
      </div>
    `;
  } else {
    container.innerHTML = quotes.map(q => createQuoteCard(q, true)).join('');
  }
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
      ${showActions ? `
        <div class="quote-actions">
          <button class="btn btn-sm btn-primary" onclick="downloadQuote('${quote.id}')">📄 PDF</button>
          <button class="btn btn-sm btn-danger" onclick="deleteQuote('${quote.id}')">🗑️</button>
        </div>
      ` : ''}
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
      const filtered = quotes.filter(q => 
        (q.client?.name || '').toLowerCase().includes(query) ||
        (q.number || '').toLowerCase().includes(query)
      );
      document.getElementById('history-quotes-list').innerHTML = filtered.map(q => createQuoteCard(q, true)).join('');
    });
  }
});

// ==========================================================
// WIZARD
// ==========================================================

function setupWizard() {
  document.getElementById('btn-next-step').addEventListener('click', nextStep);
  document.getElementById('btn-prev-step').addEventListener('click', prevStep);
  document.getElementById('btn-generate-pdf').addEventListener('click', generatePDF);
  document.getElementById('btn-add-item').addEventListener('click', addItem);
}

function resetWizard() {
  currentWizardStep = 1;
  quoteItems = [];
  document.getElementById('form-client').reset();
  document.getElementById('items-container').innerHTML = '';
  updateWizardUI();
  updateSummary();
}

function updateWizardUI() {
  // Steps
  document.querySelectorAll('.wizard-step').forEach((step, i) => {
    step.classList.remove('active', 'completed');
    if (i + 1 === currentWizardStep) step.classList.add('active');
    else if (i + 1 < currentWizardStep) step.classList.add('completed');
  });
  
  // Content
  document.querySelectorAll('.wizard-step-content').forEach((c, i) => {
    c.classList.toggle('active', i + 1 === currentWizardStep);
  });
  
  // Progress bar
  document.getElementById('wizard-bar-progress').style.width = `${(currentWizardStep / 3) * 100}%`;
  
  // Buttons
  document.getElementById('btn-prev-step').classList.toggle('hidden', currentWizardStep === 1);
  document.getElementById('btn-next-step').classList.toggle('hidden', currentWizardStep === 3);
  document.getElementById('btn-generate-pdf').classList.toggle('hidden', currentWizardStep !== 3);
  
  if (currentWizardStep === 3) updateReview();
}

function nextStep() {
  if (currentWizardStep === 1) {
    if (!document.getElementById('client-name').value.trim()) {
      showToast('Ingresa el nombre del cliente', 'error');
      return;
    }
  }
  if (currentWizardStep === 2) {
    if (quoteItems.length === 0) {
      showToast('Agrega al menos un item', 'error');
      return;
    }
  }
  if (currentWizardStep < 3) {
    currentWizardStep++;
    updateWizardUI();
  }
}

function prevStep() {
  if (currentWizardStep > 1) {
    currentWizardStep--;
    updateWizardUI();
  }
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
        <button class="btn-remove-item" onclick="removeItem('${id}')">✕</button>
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
  
  // Events
  const card = container.querySelector(`[data-item-id="${id}"]`);
  card.querySelector('.item-qty').addEventListener('input', (e) => updateItem(id, 'quantity', parseFloat(e.target.value) || 0));
  card.querySelector('.item-price').addEventListener('input', (e) => updateItem(id, 'unitPrice', parseFloat(e.target.value) || 0));
  card.querySelector('.item-desc').addEventListener('input', (e) => updateItem(id, 'description', e.target.value));
}

function removeItem(id) {
  quoteItems = quoteItems.filter(i => i.id !== id);
  document.querySelector(`[data-item-id="${id}"]`).remove();
  renumberItems();
  updateSummary();
}

function renumberItems() {
  document.querySelectorAll('.item-number').forEach((el, i) => el.textContent = `Item ${i + 1}`);
}

function updateItem(id, field, value) {
  const item = quoteItems.find(i => i.id === id);
  if (item) {
    item[field] = value;
    const card = document.querySelector(`[data-item-id="${id}"]`);
    const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
    card.querySelector('.item-subtotal').textContent = formatCurrency(subtotal);
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
  
  let html = `
    <div class="review-section">
      <div class="review-section-title">Cliente</div>
      <p><strong>${client.name}</strong></p>
      ${client.document ? `<p>RUC/DNI: ${client.document}</p>` : ''}
    </div>
    <div class="review-section">
      <div class="review-section-title">Items</div>
      ${quoteItems.map(i => `
        <div class="review-item">
          <span>${i.quantity}x ${i.description}</span>
          <span>${formatCurrency((i.quantity || 0) * (i.unitPrice || 0))}</span>
        </div>
      `).join('')}
    </div>
    <div class="quote-summary">
      <div class="summary-row"><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
      <div class="summary-row"><span>IGV (18%):</span><span>${formatCurrency(igv)}</span></div>
      <div class="summary-row summary-total"><span>TOTAL:</span><span>${formatCurrency(total)}</span></div>
    </div>
  `;
  
  document.getElementById('quote-review').innerHTML = html;
}

// ==========================================================
// GENERATE PDF
// ==========================================================

async function generatePDF() {
  // Check quote limit
  const quota = getPlanQuota(userData.plan);
  if (quota !== -1 && userData.quotesUsedThisMonth >= quota) {
    showToast('¡Límite de cotizaciones alcanzado! Mejora tu plan.', 'error');
    showUpgradeModal();
    return;
  }
  
  // Check company data
  const companyData = await db.collection('companies').doc(currentUser.uid).get();
  if (!companyData.exists || !companyData.data().ruc) {
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
      userId: currentUser.uid,
      client,
      items: quoteItems,
      issueDate: document.getElementById('quote-issue-date').value,
      dueDate: document.getElementById('quote-due-date').value,
      subtotal, igv, total,
      createdAt: new Date().toISOString()
    };
    
    // Save to Firestore
    const docRef = await db.collection('quotes').add(quote);
    
    // Update quote count
    await db.collection('users').doc(currentUser.uid).update({
      quotesUsedThisMonth: firebase.firestore.FieldValue.increment(1)
    });
    
    // Generate PDF using jsPDF
    await loadJSPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Simple PDF layout
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
    
    // Update progress
    userData.quotesUsedThisMonth++;
    updatePlanProgress();
    
  } catch (error) {
    console.error('Error:', error);
    showToast('Error al generar PDF', 'error');
  }
}

async function loadJSPDF() {
  if (window.jspdf) return;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  await new Promise(resolve => { script.onload = resolve; document.head.appendChild(script); });
}

// ==========================================================
// SETTINGS
// ==========================================================

function loadSettings() {
  // Load company data
  db.collection('companies').doc(currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('company-name').value = data.name || '';
      document.getElementById('company-ruc').value = data.ruc || '';
      document.getElementById('company-address').value = data.address || '';
      document.getElementById('company-phone').value = data.phone || '';
      document.getElementById('company-email').value = data.email || '';
    }
  });
  
  // Current plan
  document.getElementById('current-plan-name').textContent = getPlanName(userData.plan);
  const prices = { free: 'S/ 0', basic: 'S/ 20', business: 'S/ 40', pro: 'S/ 60' };
  document.getElementById('current-plan-price').textContent = prices[userData.plan] || 'S/ 0';
  
  const descs = {
    free: '5 cotizaciones por mes',
    basic: '20 cotizaciones por mes',
    business: '50 cotizaciones por mes',
    pro: 'Cotizaciones ilimitadas'
  };
  document.getElementById('current-plan-desc').textContent = descs[userData.plan];
}

document.getElementById('form-company').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const company = {
    name: document.getElementById('company-name').value.trim(),
    ruc: document.getElementById('company-ruc').value.trim(),
    address: document.getElementById('company-address').value.trim(),
    phone: document.getElementById('company-phone').value.trim(),
    email: document.getElementById('company-email').value.trim(),
    userId: currentUser.uid,
    updatedAt: new Date().toISOString()
  };
  
  if (!company.name || !company.ruc) {
    showToast('Nombre y RUC son obligatorios', 'error');
    return;
  }
  
  await db.collection('companies').doc(currentUser.uid).set(company, { merge: true });
  showToast('Datos guardados');
});

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
  const snapshot = await db.collection('quotes')
    .where('userId', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .get();
  
  const quotes = [];
  snapshot.forEach(doc => quotes.push({ id: doc.id, ...doc.data() }));
  return quotes;
}

async function deleteQuote(id) {
  if (confirm('¿Eliminar esta cotización?')) {
    await db.collection('quotes').doc(id).delete();
    showToast('Cotización eliminada');
    loadHistory();
  }
}

function downloadQuote(id) {
  showToast('Generando PDF...', 'info');
  // Implementation similar to generatePDF but with saved data
}

function showUpgradeModal() {
  document.getElementById('modal-upgrade').classList.remove('hidden');
}

function selectPlan(plan) {
  showToast(`Plan ${getPlanName(plan)} seleccionado. Contacta al admin para activar.`, 'success');
  document.getElementById('modal-upgrade').classList.add('hidden');
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
