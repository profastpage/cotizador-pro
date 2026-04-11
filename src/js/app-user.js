// App User Logic - SDK Modular v10+

import { auth, db, PLANS, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

let currentUser = null;
let userData = null;
let quoteItems = [];
let currentWizardStep = 1;
let isGeneratingPDF = false;

// ==========================================================
// AUTH CHECK - NO redirects to avoid loops
// ==========================================================

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  
  if (!user) {
    document.getElementById('user-name').textContent = 'Usuario';
    return;
  }

  getDoc(doc(db, 'users', user.uid)).then((userDoc) => {
    if (!userDoc.exists()) {
      window.location.href = 'index.html';
      return;
    }

    userData = userDoc.data();

    if (!userData.isActive) {
      showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
      signOut(auth);
      return;
    }

    if (userData.plan !== 'free' && userData.planEndDate) {
      const endDate = new Date(userData.planEndDate);
      if (endDate < new Date() && userData.licenseDuration !== 0) {
        updateDoc(doc(db, 'users', user.uid), {
          plan: 'free', planStartDate: null, planEndDate: null, quotesUsedThisMonth: 0
        });
        userData.plan = 'free';
      }
    }

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
    document.getElementById('plan-banner-text').textContent = `¡Tienes ${getPlanQuota(userData.plan)} cotizaciones gratis este mes!`;
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
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const screen = btn.dataset.screen;
      if (screen) navigateTo(screen);
    };
  });
  
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    };
  });
}

function navigateTo(screen) {
  if (!screen) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const targetScreen = document.getElementById(`screen-${screen}`);
  if (targetScreen) targetScreen.classList.add('active');
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

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-quotes');
  if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
      const queryStr = e.target.value.toLowerCase();
      const quotes = await getUserQuotes();
      const filtered = quotes.filter(q => (q.client?.name || '').toLowerCase().includes(queryStr) || (q.number || '').toLowerCase().includes(queryStr));
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
  
  const igvCheckbox = document.getElementById('igv-enabled');
  if (igvCheckbox) {
    igvCheckbox.addEventListener('change', updateSummary);
  }
  document.querySelectorAll('input[name="igv-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const opts = document.getElementById('igv-type-options');
      if (opts) opts.style.display = document.getElementById('igv-enabled').checked ? '' : 'none';
      updateSummary();
    });
  });
  
  const igvTypeOpts = document.getElementById('igv-type-options');
  if (igvTypeOpts && document.getElementById('igv-enabled')) {
    igvTypeOpts.style.display = document.getElementById('igv-enabled').checked ? '' : 'none';
  }
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
  document.querySelectorAll('.wizard-step').forEach((step, idx) => {
    step.classList.remove('active', 'completed');
    if (idx + 1 === currentWizardStep) step.classList.add('active');
    else if (idx + 1 < currentWizardStep) step.classList.add('completed');
  });
  document.querySelectorAll('.wizard-step-content').forEach((c, idx) => {
    c.classList.toggle('active', idx + 1 === currentWizardStep);
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
  const itemId = Date.now().toString();
  quoteItems.push({ id: itemId, quantity: 1, unitPrice: 0, description: '' });
  const container = document.getElementById('items-container');
  const html = `
    <div class="item-card" data-item-id="${itemId}">
      <div class="item-header">
        <span class="item-number">Item ${quoteItems.length}</span>
        <button class="btn-remove-item" onclick="window.removeItem('${itemId}')">✕</button>
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

  const card = container.querySelector(`[data-item-id="${itemId}"]`);
  card.querySelector('.item-qty').addEventListener('input', (e) => updateItem(itemId, 'quantity', parseFloat(e.target.value) || 0));
  card.querySelector('.item-price').addEventListener('input', (e) => updateItem(itemId, 'unitPrice', parseFloat(e.target.value) || 0));
  card.querySelector('.item-desc').addEventListener('input', (e) => updateItem(itemId, 'description', e.target.value));
}

function removeItem(id) {
  quoteItems = quoteItems.filter(item => item.id !== id);
  document.querySelector(`[data-item-id="${id}"]`)?.remove();
  renumberItems();
  updateSummary();
}
window.removeItem = removeItem;

function renumberItems() {
  document.querySelectorAll('.item-number').forEach((el, idx) => el.textContent = `Item ${idx + 1}`);
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
  const igvEnabled = document.getElementById('igv-enabled')?.checked ?? true;
  const igvType = document.querySelector('input[name="igv-type"]:checked')?.value || 'apart';
  
  let subtotal = 0;
  for (let idx = 0; idx < quoteItems.length; idx++) {
    subtotal += (quoteItems[idx].quantity || 0) * (quoteItems[idx].unitPrice || 0);
  }
  
  let igv = 0;
  let total = 0;
  
  if (igvEnabled) {
    if (igvType === 'included') {
      total = subtotal;
      igv = total - (total / 1.18);
    } else {
      igv = subtotal * 0.18;
      total = subtotal + igv;
    }
  } else {
    total = subtotal;
  }

  document.getElementById('summary-subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('summary-igv').textContent = formatCurrency(igv);
  document.getElementById('summary-total').textContent = formatCurrency(total);
  
  const igvRow = document.getElementById('summary-igv-row');
  if (igvRow) igvRow.style.display = igvEnabled ? '' : 'none';
  
  const note = document.getElementById('summary-note');
  if (note) {
    if (!igvEnabled) {
      note.textContent = 'Precios sin IGV';
      note.style.color = 'var(--color-gray-500)';
    } else if (igvType === 'included') {
      note.textContent = 'Precios incluyen IGV';
      note.style.color = 'var(--color-success)';
    } else {
      note.textContent = 'IGV se agrega al subtotal';
      note.style.color = 'var(--color-gray-500)';
    }
  }
}

function updateReview() {
  const clientName = document.getElementById('client-name').value;
  const clientDoc = document.getElementById('client-document').value;
  
  let subtotal = 0;
  for (let idx = 0; idx < quoteItems.length; idx++) {
    subtotal += (quoteItems[idx].quantity || 0) * (quoteItems[idx].unitPrice || 0);
  }
  
  const igvEnabled = document.getElementById('igv-enabled')?.checked ?? true;
  const igvType = document.querySelector('input[name="igv-type"]:checked')?.value || 'apart';
  let igv = 0, total = 0;
  if (igvEnabled) {
    if (igvType === 'included') { total = subtotal; igv = total - (total / 1.18); }
    else { igv = subtotal * 0.18; total = subtotal + igv; }
  } else { total = subtotal; }

  document.getElementById('quote-review').innerHTML = `
    <div class="review-section"><div class="review-section-title">Cliente</div>
      <p><strong>${clientName}</strong></p>${clientDoc ? `<p>RUC/DNI: ${clientDoc}</p>` : ''}
    </div>
    <div class="review-section"><div class="review-section-title">Items</div>
      ${quoteItems.map(item => `<div class="review-item"><span>${item.quantity}x ${item.description}</span><span>${formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</span></div>`).join('')}
    </div>
    <div class="quote-summary">
      <div class="summary-row"><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
      <div class="summary-row"><span>IGV (18%):</span><span>${formatCurrency(igv)}</span></div>
      <div class="summary-row summary-total"><span>TOTAL:</span><span>${formatCurrency(total)}</span></div>
    </div>
  `;
}

// ==========================================================
// GENERATE PDF - Fixed version
// ==========================================================

async function generatePDF() {
  if (isGeneratingPDF) return;
  isGeneratingPDF = true;
  
  try {
    const quota = getPlanQuota(userData.plan);
    if (quota !== -1 && userData.quotesUsedThisMonth >= quota) {
      showToast('¡Límite alcanzado! Mejora tu plan.', 'error');
      showUpgradeModal();
      isGeneratingPDF = false;
      return;
    }

    const companySnap = await getDoc(doc(db, 'companies', currentUser.uid));
    if (!companySnap.exists() || !companySnap.data().ruc) {
      showToast('Configura los datos de tu empresa primero', 'error');
      navigateTo('settings');
      isGeneratingPDF = false;
      return;
    }

    showToast('Generando PDF...', 'info');
    const company = companySnap.data();
    
    const clientName = document.getElementById('client-name').value || 'Sin nombre';
    const clientDoc = document.getElementById('client-document').value || '';
    
    const igvEnabled = document.getElementById('igv-enabled')?.checked ?? true;
    const igvType = document.querySelector('input[name="igv-type"]:checked')?.value || 'apart';
    
    let subtotal = 0;
    for (let idx = 0; idx < quoteItems.length; idx++) {
      subtotal += (quoteItems[idx].quantity || 0) * (quoteItems[idx].unitPrice || 0);
    }
    
    let igvAmount = 0, grandTotal = 0;
    if (igvEnabled) {
      if (igvType === 'included') { grandTotal = subtotal; igvAmount = grandTotal - (grandTotal / 1.18); }
      else { igvAmount = subtotal * 0.18; grandTotal = subtotal + igvAmount; }
    } else { grandTotal = subtotal; }

    const quoteData = {
      userId: currentUser.uid,
      client: {
        name: clientName, document: clientDoc,
        email: document.getElementById('client-email').value || '',
        phone: document.getElementById('client-phone').value || '',
        address: document.getElementById('client-address').value || ''
      },
      items: quoteItems,
      issueDate: document.getElementById('quote-issue-date').value,
      dueDate: document.getElementById('quote-due-date').value,
      subtotal, igv: igvAmount, total: grandTotal,
      igvEnabled, igvType,
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, 'quotes'), quoteData);
    await updateDoc(doc(db, 'users', currentUser.uid), { quotesUsedThisMonth: increment(1) });

    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const scriptTag = document.createElement('script');
        scriptTag.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        scriptTag.onload = resolve;
        scriptTag.onerror = reject;
        document.head.appendChild(scriptTag);
      });
    }
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    pdf.setFontSize(20); pdf.setFont(undefined, 'bold');
    pdf.text('COTIZACIÓN', 105, 20, { align: 'center' });
    
    pdf.setFontSize(10); pdf.setFont(undefined, 'normal');
    pdf.text(company.name || '', 20, 35);
    if (company.ruc) pdf.text(`RUC: ${company.ruc}`, 20, 42);
    if (company.address) pdf.text(company.address, 20, 48);
    if (company.phone) pdf.text(`Tel: ${company.phone}`, 20, 54);
    
    pdf.setFontSize(11);
    const quoteNum = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
    pdf.text(`N° ${quoteNum}`, 190, 35, { align: 'right' });
    pdf.text(`Fecha: ${quoteData.issueDate}`, 190, 42, { align: 'right' });
    pdf.text(`Vence: ${quoteData.dueDate}`, 190, 49, { align: 'right' });
    
    pdf.setFillColor(240, 240, 240);
    pdf.rect(20, 70, 170, 25, 'F');
    pdf.setFontSize(11); pdf.setFont(undefined, 'bold');
    pdf.text('CLIENTE', 25, 78);
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(10);
    pdf.text(clientName, 25, 86);
    if (clientDoc) pdf.text(`RUC/DNI: ${clientDoc}`, 25, 92);
    
    let tableY = 105;
    pdf.setFillColor(30, 64, 175);
    pdf.rect(20, tableY, 170, 8, 'F');
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(9); pdf.setFont(undefined, 'bold');
    pdf.text('DESCRIPCIÓN', 25, tableY + 6);
    pdf.text('CANT', 115, tableY + 6);
    pdf.text('P.UNIT', 140, tableY + 6);
    pdf.text('TOTAL', 188, tableY + 6, { align: 'right' });
    
    pdf.setTextColor(0, 0, 0); pdf.setFont(undefined, 'normal');
    for (let rowIdx = 0; rowIdx < quoteItems.length; rowIdx++) {
      const qty = quoteItems[rowIdx].quantity || 0;
      const price = quoteItems[rowIdx].unitPrice || 0;
      const lineTotal = qty * price;
      tableY += 8;
      pdf.setFontSize(9);
      pdf.text(`${rowIdx + 1}. ${quoteItems[rowIdx].description || ''}`, 25, tableY);
      pdf.text(String(qty), 117, tableY);
      pdf.text(`S/${price.toFixed(2)}`, 140, tableY);
      pdf.text(`S/${lineTotal.toFixed(2)}`, 188, tableY, { align: 'right' });
    }
    
    tableY += 12;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(120, tableY, 190, tableY);
    tableY += 6;
    
    pdf.setFontSize(10);
    pdf.text('Subtotal:', 120, tableY);
    pdf.text(`S/${subtotal.toFixed(2)}`, 188, tableY, { align: 'right' });
    tableY += 6;
    
    if (igvEnabled) {
      pdf.text('IGV (18%):', 120, tableY);
      pdf.text(`S/${igvAmount.toFixed(2)}`, 188, tableY, { align: 'right' });
      tableY += 4;
      if (igvType === 'included') {
        pdf.setFontSize(8); pdf.setTextColor(5, 150, 105);
        pdf.text('(Incluido en el precio)', 120, tableY);
        pdf.setTextColor(0, 0, 0);
        tableY += 5;
      } else { tableY += 2; }
    }
    
    tableY += 2;
    pdf.line(120, tableY, 190, tableY);
    tableY += 7;
    pdf.setFontSize(12); pdf.setFont(undefined, 'bold');
    pdf.text('TOTAL:', 120, tableY);
    pdf.text(`S/${grandTotal.toFixed(2)}`, 188, tableY, { align: 'right' });
    
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(8); pdf.setTextColor(120, 120, 120);
    if (company.email) pdf.text(company.email, 105, 285, { align: 'center' });

    pdf.save(`Cotizacion-${clientName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
    showToast('¡PDF generado exitosamente!');
    resetWizard();
    navigateTo('dashboard');
    userData.quotesUsedThisMonth++;
    updatePlanProgress();
    
  } catch (error) {
    console.error('PDF Error:', error);
    showToast('Error: ' + error.message, 'error');
  } finally {
    isGeneratingPDF = false;
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
  document.getElementById('current-plan-price').textContent = getPlanPrice(userData.plan);
  document.getElementById('current-plan-desc').textContent = getPlanDesc(userData.plan);
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
  return { free: 3, basic: 60, business: 200, pro: -1 }[plan] || 3;
}

function getPlanName(plan) {
  return { free: 'Gratis', basic: 'Básico', business: 'Business', pro: 'Pro' }[plan] || 'Gratis';
}

function getPlanPrice(plan) {
  return { free: 'S/ 0', basic: 'S/ 35', business: 'S/ 59', pro: 'S/ 99' }[plan] || 'S/ 0';
}

function getPlanDesc(plan) {
  const descs = {
    free: '3 cotizaciones de prueba/mes • 1 empresa',
    basic: '60 cotizaciones por mes • 1 empresa',
    business: '200 cotizaciones por mes • 3 empresas',
    pro: 'Cotizaciones ilimitadas • 5 empresas'
  };
  return descs[plan] || descs.free;
}

function formatCurrency(amount) {
  return `S/ ${(amount || 0).toFixed(2)}`;
}

function formatDateShort(date) {
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

async function getUserQuotes() {
  try {
    const q = query(collection(db, 'quotes'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const quotes = [];
    snapshot.forEach(docSnap => quotes.push({ id: docSnap.id, ...docSnap.data() }));
    return quotes;
  } catch (error) {
    console.error('Error fetching quotes:', error);
    if (error.code === 'failed-precondition') {
      showToast('Crea el índice en Firebase Console (userId + createdAt)', 'error');
    }
    return [];
  }
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
  showToast(`Plan ${getPlanName(plan)} seleccionado. Contacta al admin.`, 'success');
  document.getElementById('modal-upgrade').classList.add('hidden');
};

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
