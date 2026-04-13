// App User Logic - SDK Modular v10+

import { auth, db, PLANS, DOCUMENT_TYPES, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';

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
  
  // Check and create demo quote if needed
  checkAndCreateDemoQuote();
}

// Check if user needs demo quote and create it
async function checkAndCreateDemoQuote() {
  try {
    const quotesRef = collection(db, 'quotes');
    const q = query(quotesRef, where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    
    // Only create demo if user has 0-2 quotes
    if (snapshot.size <= 2) {
      const hasDemo = snapshot.docs.some(doc => doc.data().isDemo);
      if (!hasDemo) {
        await createDemoQuote();
      }
    }
  } catch (error) {
    console.error('Error checking demo quote:', error);
  }
}

// Create a demo quote for the user
async function createDemoQuote() {
  try {
    const quoteNumber = await getNextQuoteNumber();
    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);
    
    const demoQuote = {
      userId: currentUser.uid,
      number: quoteNumber,
      isDemo: true,
      documentType: 'cotizacion',
      client: {
        name: 'Empresa Demo SAC',
        document: '20123456789',
        email: 'demo@empresa.com',
        phone: '987654321',
        address: 'Av. Demo 123, Lima'
      },
      items: [
        { id: '1', quantity: 2, unitPrice: 500, description: 'Servicio de consultoría' },
        { id: '2', quantity: 1, unitPrice: 1200, description: 'Implementación de sistema' },
        { id: '3', quantity: 5, unitPrice: 150, description: 'Licencias de software' }
      ],
      issueDate: today.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      subtotal: 2450,
      igv: 441,
      total: 2891,
      igvEnabled: true,
      igvType: 'apart',
      createdAt: today.toISOString()
    };
    
    await addDoc(collection(db, 'quotes'), demoQuote);
    console.log('✅ Demo quote created');
  } catch (error) {
    console.error('Error creating demo quote:', error);
  }
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

  // Exclude demo quotes from count and total
  const realQuotes = thisMonth.filter(q => !q.isDemo);
  const totalAmount = realQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
  
  document.getElementById('stat-quotes-month').textContent = realQuotes.length;
  document.getElementById('stat-total-amount').textContent = formatCurrency(totalAmount);

  const recent = quotes.slice(0, 5);
  const container = document.getElementById('dashboard-recent-quotes');
  container.innerHTML = recent.length === 0 ? `
    <div class="empty-state"><div class="empty-state-icon">📋</div><h3>No hay cotizaciones aún</h3><p>Crea tu primera cotización profesional</p></div>
  ` : recent.map((q, idx) => createQuoteCard(q, false, quotes.length - idx)).join('');
}

// ==========================================================
// HISTORY
// ==========================================================

async function loadHistory() {
  const quotes = await getUserQuotes();
  const container = document.getElementById('history-quotes-list');
  container.innerHTML = quotes.length === 0 ? `
    <div class="empty-state"><div class="empty-state-icon">📋</div><h3>No hay cotizaciones guardadas</h3></div>
  ` : quotes.map((q, idx) => createQuoteCard(q, true, quotes.length - idx)).join('');
}

function createQuoteCard(quote, showActions = false, position = null) {
  // Use stored number if exists, otherwise use position-based number
  const quoteNum = quote.number || position || 'N/A';
  const displayNum = typeof quoteNum === 'number' ? String(quoteNum).padStart(3, '0') : quoteNum;
  
  // Get document type info
  const docType = DOCUMENT_TYPES[quote.documentType] || DOCUMENT_TYPES.cotizacion;
  
  // DEMO badge
  const demoBadge = quote.isDemo ? '<span class="badge badge-demo" style="background:#fef3c7;color:#d97706;font-size:0.65rem;margin-left:0.5rem;">DEMO</span>' : '';
  
  // Document type icon
  const typeIcon = `<span style="margin-right:0.25rem;">${docType.icon}</span>`;

  return `
    <div class="quote-card">
      <div class="quote-card-header">
        <span class="quote-number">${typeIcon}#${displayNum}${demoBadge}</span>
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

  // Load and populate client selector
  loadClientSelector();
  
  // Load and populate document type selector
  loadDocumentTypeSelector();
}

// Load document types based on user plan
function loadDocumentTypeSelector() {
  const selector = document.getElementById('document-type-selector');
  if (!selector) return;
  
  const plan = PLANS[userData.plan];
  const allowedTypes = plan.documentTypes || ['cotizacion'];
  
  selector.innerHTML = '';
  
  allowedTypes.forEach(typeId => {
    const docType = DOCUMENT_TYPES[typeId];
    if (docType) {
      const option = document.createElement('option');
      option.value = typeId;
      option.textContent = `${docType.icon} ${docType.name}`;
      selector.appendChild(option);
    }
  });
}

// Load clients into selector dropdown
async function loadClientSelector() {
  const selector = document.getElementById('client-selector');
  if (!selector) return;
  
  const clients = await loadClients();
  selector.innerHTML = '<option value="">— Nuevo cliente —</option>';
  
  clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = `${client.name}${client.document ? ` (${client.document})` : ''}`;
    option.dataset.client = JSON.stringify(client);
    selector.appendChild(option);
  });
  
  // Handle client selection
  selector.onchange = function() {
    if (this.value) {
      const client = JSON.parse(this.options[this.selectedIndex].dataset.client);
      document.getElementById('client-name').value = client.name || '';
      document.getElementById('client-document').value = client.document || '';
      document.getElementById('client-email').value = client.email || '';
      document.getElementById('client-phone').value = client.phone || '';
      document.getElementById('client-address').value = client.address || '';
    } else {
      // Clear form for new client
      document.getElementById('client-name').value = '';
      document.getElementById('client-document').value = '';
      document.getElementById('client-email').value = '';
      document.getElementById('client-phone').value = '';
      document.getElementById('client-address').value = '';
    }
  };
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
// CLIENTS - Save and load clients
// ==========================================================

async function saveClient(clientData) {
  try {
    // Validate RUC/DNI if provided
    if (clientData.document && clientData.document.trim()) {
      const doc = clientData.document.trim();
      if (/^\d{11}$/.test(doc) && !isValidRUC(doc)) {
        showToast(`RUC "${doc}" no es válido`, 'error');
        return false;
      }
    }

    const clientsRef = collection(db, 'clients');
    const q = query(clientsRef, where('userId', '==', currentUser.uid), where('name', '==', clientData.name));
    const existing = await getDocs(q);

    if (!existing.empty) {
      const docRef = existing.docs[0].ref;
      await updateDoc(docRef, {
        ...clientData,
        userId: currentUser.uid,
        updatedAt: new Date().toISOString()
      });
    } else {
      await addDoc(clientsRef, {
        ...clientData,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    return true;
  } catch (error) {
    console.error('Error saving client:', error);
    return false;
  }
}

async function loadClients() {
  try {
    const clientsRef = collection(db, 'clients');
    const q = query(clientsRef, where('userId', '==', currentUser.uid), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const clients = [];
    snapshot.forEach(docSnap => clients.push({ id: docSnap.id, ...docSnap.data() }));
    return clients;
  } catch (error) {
    console.error('Error loading clients:', error);
    return [];
  }
}

// ==========================================================
// PDF GENERATION - Centralized
// ==========================================================

// Load jsPDF dynamically (single source of truth)
async function loadJsPDF() {
  if (window.jspdf) return window.jspdf;
  return new Promise((resolve, reject) => {
    const scriptTag = document.createElement('script');
    scriptTag.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    scriptTag.onload = () => resolve(window.jspdf);
    scriptTag.onerror = reject;
    document.head.appendChild(scriptTag);
  });
}

// Centralized PDF renderer - used by both generatePDF and downloadQuote
async function renderPDF(company, clientName, items, quoteNumber, issueDate, dueDate, subtotal, igvAmount, total, igvEnabled, igvType, documentType = 'cotizacion') {
  const { jsPDF } = await loadJsPDF();
  const pdf = new jsPDF();

  // Colors
  const BLUE = [30, 64, 175];
  const LIGHT_BLUE = [240, 244, 255];
  const GRAY_BG = [245, 247, 250];
  const GRAY_TEXT = [100, 116, 139];
  const DARK = [15, 23, 42];
  const GREEN = [5, 150, 105];

  const docTypeInfo = DOCUMENT_TYPES[documentType] || DOCUMENT_TYPES.cotizacion;

  // ==========================================
  // HEADER - Company Info + Title
  // ==========================================
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(...DARK);
  pdf.text(company.name || 'Mi Empresa', 20, 20);

  pdf.setFontSize(8);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(...GRAY_TEXT);

  let companyY = 27;
  if (company.address) { pdf.text(company.address, 20, companyY); companyY += 5; }
  if (company.email) { pdf.text(company.email, 20, companyY); companyY += 5; }
  if (company.phone) { pdf.text(company.phone, 20, companyY); companyY += 5; }

  pdf.setFontSize(22);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(...BLUE);
  pdf.text(docTypeInfo.headerTitle, 190, 20, { align: 'right' });

  pdf.setFontSize(8);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(...GRAY_TEXT);
  pdf.text(`RUC: ${company.ruc || 'N/A'}`, 190, 27, { align: 'right' });
  if (company.phone) pdf.text(`Tel: ${company.phone}`, 190, 32, { align: 'right' });
  if (company.email) pdf.text(company.email, 190, 37, { align: 'right' });

  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(1);
  pdf.line(20, 42, 190, 42);

  // ==========================================
  // QUOTE INFO BAR
  // ==========================================
  const barY = 47;
  pdf.setFillColor(...LIGHT_BLUE);
  pdf.roundedRect(20, barY, 170, 14, 2, 2, 'F');

  pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...GRAY_TEXT);
  pdf.text('NÚMERO:', 25, barY + 5);
  pdf.setFontSize(9); pdf.setTextColor(...DARK);
  pdf.text(`#${String(quoteNumber).padStart(3, '0')}`, 25, barY + 10);

  pdf.setFontSize(8); pdf.setTextColor(...GRAY_TEXT);
  pdf.text('FECHA EMISIÓN:', 65, barY + 5);
  pdf.setFontSize(9); pdf.setTextColor(...DARK);
  pdf.text(issueDate || '-', 65, barY + 10);

  pdf.setFontSize(8); pdf.setTextColor(...GRAY_TEXT);
  pdf.text('FECHA VENCIMIENTO:', 105, barY + 5);
  pdf.setFontSize(9); pdf.setTextColor(...DARK);
  pdf.text(dueDate || '-', 105, barY + 10);

  pdf.setFontSize(8); pdf.setTextColor(...GRAY_TEXT);
  pdf.text('MONEDA:', 155, barY + 5);
  pdf.setFontSize(9); pdf.setTextColor(...DARK);
  pdf.text('PEN (Soles)', 155, barY + 10);

  // ==========================================
  // CLIENT DATA SECTION
  // ==========================================
  const clientY = 68;
  pdf.setFillColor(...BLUE);
  pdf.roundedRect(20, clientY, 170, 8, 2, 2, 'F');
  pdf.setFontSize(9); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255, 255, 255);
  pdf.text('DATOS DEL CLIENTE', 25, clientY + 5.5);

  const boxY = clientY + 11;
  pdf.setFillColor(...GRAY_BG);
  pdf.roundedRect(20, boxY, 170, 28, 2, 2, 'F');

  pdf.setFontSize(8); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
  pdf.setFont(undefined, 'bold'); pdf.text('RUC/DNI:', 25, boxY + 7);
  pdf.setFont(undefined, 'normal'); pdf.text(clientName, 55, boxY + 7);

  pdf.setFont(undefined, 'bold'); pdf.text('RAZÓN SOCIAL:', 110, boxY + 7);
  pdf.setFont(undefined, 'normal'); pdf.text(clientName, 145, boxY + 7);

  // ==========================================
  // ITEMS TABLE
  // ==========================================
  let tableY = boxY + 35;
  pdf.setFillColor(...BLUE);
  pdf.rect(20, tableY, 170, 9, 'F');

  pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255, 255, 255);
  pdf.text('CANT.', 25, tableY + 6);
  pdf.text('DESCRIPCIÓN', 45, tableY + 6);
  pdf.text('P. UNIT.', 130, tableY + 6);
  pdf.text('TOTAL', 170, tableY + 6, { align: 'right' });

  pdf.setFont(undefined, 'normal'); pdf.setFontSize(8);
  tableY += 9;

  for (let rowIdx = 0; rowIdx < items.length; rowIdx++) {
    const item = items[rowIdx];
    const qty = item.quantity || 0;
    const price = item.unitPrice || 0;
    const lineTotal = qty * price;

    if (rowIdx % 2 === 0) { pdf.setFillColor(249, 250, 251); pdf.rect(20, tableY, 170, 8, 'F'); }

    pdf.setTextColor(...DARK);
    pdf.text(String(qty), 25, tableY + 5.5);
    const desc = item.description || '';
    const splitDesc = pdf.splitTextToSize(desc, 80);
    pdf.text(splitDesc[0] || '', 45, tableY + 5.5);
    pdf.text(`S/ ${price.toFixed(2)}`, 130, tableY + 5.5);
    pdf.text(`S/ ${lineTotal.toFixed(2)}`, 188, tableY + 5.5, { align: 'right' });
    tableY += 8;
  }

  // Totals
  pdf.setDrawColor(...BLUE); pdf.setLineWidth(1.5);
  pdf.line(20, tableY + 2, 190, tableY + 2);
  tableY += 8;

  pdf.setFontSize(10); pdf.setTextColor(...GRAY_TEXT);
  pdf.text('SUBTOTAL:', 120, tableY);
  pdf.setTextColor(...DARK);
  pdf.text(`S/ ${subtotal.toFixed(2)}`, 188, tableY, { align: 'right' });
  tableY += 6;

  if (igvEnabled) {
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text('IGV (18%):', 120, tableY);
    pdf.setTextColor(...DARK);
    pdf.text(`S/ ${igvAmount.toFixed(2)}`, 188, tableY, { align: 'right' });
    tableY += 4;
    if (igvType === 'included') {
      pdf.setFontSize(7); pdf.setTextColor(...GREEN);
      pdf.text('(Incluido en el precio)', 120, tableY);
      pdf.setTextColor(...DARK); pdf.setFontSize(9);
      tableY += 5;
    } else { tableY += 2; }
  }

  tableY += 2;
  pdf.line(120, tableY, 190, tableY);
  tableY += 7;
  pdf.setFontSize(14); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...BLUE);
  pdf.text('TOTAL:', 120, tableY);
  pdf.text(`S/ ${total.toFixed(2)}`, 188, tableY, { align: 'right' });

  // Footer
  pdf.setDrawColor(...BLUE); pdf.setLineWidth(1);
  pdf.line(20, 278, 190, 278);
  pdf.setFontSize(11); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...BLUE);
  pdf.text(docTypeInfo.footerText, 105, 286, { align: 'center' });
  pdf.setFontSize(7); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...GRAY_TEXT);
  pdf.text('Documento generado por CotizaPro - Sistema de Cotizaciones Profesionales', 105, 292, { align: 'center' });

  return { pdf, docTypeInfo };
}

// ==========================================================
// QUOTE NUMBERING
// ==========================================================

async function getNextQuoteNumber() {
  try {
    const quotesRef = collection(db, 'quotes');
    const q = query(quotesRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return 1;
    
    // Get the highest number from existing quotes
    let maxNumber = 0;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.number && data.number > maxNumber) {
        maxNumber = data.number;
      }
    });
    
    return maxNumber + 1;
  } catch (error) {
    console.error('Error getting quote number:', error);
    return 1;
  }
}

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
    const clientEmail = document.getElementById('client-email').value || '';
    const clientPhone = document.getElementById('client-phone').value || '';
    const clientAddress = document.getElementById('client-address').value || '';

    const igvEnabled = document.getElementById('igv-enabled')?.checked ?? true;
    const igvType = document.querySelector('input[name="igv-type"]:checked')?.value || 'apart';

    let subtotal = 0;
    quoteItems.forEach(item => { subtotal += (item.quantity || 0) * (item.unitPrice || 0); });

    let igvAmount = 0, grandTotal = 0;
    if (igvEnabled) {
      if (igvType === 'included') { grandTotal = subtotal; igvAmount = grandTotal - (grandTotal / 1.18); }
      else { igvAmount = subtotal * 0.18; grandTotal = subtotal + igvAmount; }
    } else { grandTotal = subtotal; }

    const quoteNumber = await getNextQuoteNumber();
    const issueDate = document.getElementById('quote-issue-date').value;
    const dueDate = document.getElementById('quote-due-date').value;

    const docTypeSelector = document.getElementById('document-type-selector');
    const documentType = docTypeSelector?.value || 'cotizacion';

    const quoteData = {
      userId: currentUser.uid,
      number: quoteNumber,
      documentType,
      client: { name: clientName, document: clientDoc, email: clientEmail, phone: clientPhone, address: clientAddress },
      items: quoteItems, issueDate, dueDate,
      subtotal, igv: igvAmount, total: grandTotal, igvEnabled, igvType,
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, 'quotes'), quoteData);
    const clientSaved = await saveClient({ name: clientName, document: clientDoc, email: clientEmail, phone: clientPhone, address: clientAddress });
    if (!clientSaved) {
      isGeneratingPDF = false;
      return;
    }
    await updateDoc(doc(db, 'users', currentUser.uid), { quotesUsedThisMonth: increment(1) });

    // Use centralized PDF renderer
    const { pdf, docTypeInfo } = await renderPDF(company, clientName, quoteItems, quoteNumber, issueDate, dueDate, subtotal, igvAmount, grandTotal, igvEnabled, igvType, documentType);

    const fileName = `Cotizacion-${String(quoteNumber).padStart(3, '0')}-${clientName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    pdf.save(fileName);

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
      if (!company.name) {
        showToast('El nombre de la empresa es obligatorio', 'error');
        return;
      }
      // RUC is now optional - only validate if provided
      if (company.ruc && !isValidRUC(company.ruc)) {
        showToast('RUC peruano inválido. Debe tener 11 dígitos y ser válido.', 'error');
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

// Validate Peruvian RUC (11 digits + Modulo 11 algorithm)
function isValidRUC(ruc) {
  if (!ruc) return false;
  ruc = ruc.trim();

  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(ruc)) return false;

  // First 2 digits validation
  const prefix = parseInt(ruc.substring(0, 2));
  const validPrefixes = [10, 15, 17, 20]; // 10=DNI, 15=Passport, 17=DNI foreign, 20=Empresa
  if (!validPrefixes.includes(prefix)) return false;

  // Modulo 11 verification
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += parseInt(ruc[i]) * weights[i];
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  const actualCheckDigit = parseInt(ruc[10]);

  return checkDigit === actualCheckDigit;
}

// Convert number to Spanish text (for invoices/receipts)
function numberToWords(n) {
  if (n === 0) return 'Cero';
  
  const units = ['', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve'];
  const teens = ['Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciséis', 'Diecisiete', 'Dieciocho', 'Diecinueve'];
  const tens = ['', 'Diez', 'Veinte', 'Treinta', 'Cuarenta', 'Cincuenta', 'Sesenta', 'Setenta', 'Ochenta', 'Noventa'];
  const hundreds = ['', 'Ciento', 'Doscientos', 'Trescientos', 'Cuatrocientos', 'Quinientos', 'Seiscientos', 'Setecientos', 'Ochocientos', 'Novecientos'];
  
  if (n === 100) return 'Cien';
  
  let result = '';
  
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    if (thousands === 1) result += 'Mil ';
    else result += numberToWords(thousands) + ' Mil ';
    n %= 1000;
  }
  
  if (n >= 100) {
    result += hundreds[Math.floor(n / 100)] + ' ';
    n %= 100;
  }
  
  if (n >= 20) {
    result += tens[Math.floor(n / 10)];
    if (n % 10 > 0) {
      if (n >= 30) result += ' y ' + units[n % 10];
      else result = result.slice(0, -1) + 'i' + units[n % 10]; // Veintiuno, etc.
    }
    result += ' ';
  } else if (n >= 10) {
    result += teens[n - 10] + ' ';
  } else if (n > 0) {
    result += units[n] + ' ';
  }
  
  return result.trim();
}

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

window.downloadQuote = async function(id) {
  try {
    showToast('Generando PDF...', 'info');

    const quoteDoc = await getDoc(doc(db, 'quotes', id));
    if (!quoteDoc.exists()) {
      showToast('Cotización no encontrada', 'error');
      return;
    }

    const quote = quoteDoc.data();

    // Verify ownership
    if (quote.userId !== currentUser.uid) {
      showToast('No tienes permiso para esta cotización', 'error');
      return;
    }

    const companySnap = await getDoc(doc(db, 'companies', currentUser.uid));
    if (!companySnap.exists()) {
      showToast('Configura los datos de tu empresa primero', 'error');
      return;
    }

    const company = companySnap.data();
    const clientName = quote.client?.name || 'Sin nombre';

    // Use centralized PDF renderer
    const { pdf } = await renderPDF(
      company,
      clientName,
      quote.items || [],
      quote.number || 0,
      quote.issueDate,
      quote.dueDate,
      quote.subtotal || 0,
      quote.igv || 0,
      quote.total || 0,
      quote.igvEnabled,
      quote.igvType || 'apart',
      quote.documentType || 'cotizacion'
    );

    pdf.save(`Cotizacion-${String(quote.number || 0).padStart(3, '0')}-${clientName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
    showToast('¡PDF descargado!');
  } catch (error) {
    console.error('Download error:', error);
    showToast('Error al generar PDF', 'error');
  }
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

// ==========================================================
// PWA INSTALL STATUS CHECK (UI only - install prompt handled in HTML)
// ==========================================================

let deferredPrompt = null;
let isCompanyConfigured = false;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registrado:', reg.scope);
        checkInstallStatus();
      })
      .catch((err) => console.log('[PWA] Error registrando SW:', err));
  });
}

function checkInstallStatus() {
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                      window.matchMedia('(display-mode: fullscreen)').matches ||
                      navigator.standalone ||
                      document.referrer.includes('android-app://');
  const section = document.getElementById('install-app-section');
  
  if (isInstalled) {
    if (section) {
      section.innerHTML = `
        <div style="display:flex;align-items:center;gap:1rem;padding:0.5rem 0;">
          <div style="width:48px;height:48px;background:var(--color-success);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:1.5rem;">✅</span>
          </div>
          <div>
            <h4 style="margin:0;font-size:1rem;">App Instalada</h4>
            <p style="margin:0.25rem 0 0;font-size:0.8rem;color:var(--color-gray-500);">CotizaPro ya está en tu dispositivo</p>
          </div>
        </div>
      `;
    }
  }
}

function setupPWAInstall() {
  // Install prompt is now handled by the inline script in app.html
  // This function just checks if already installed
  checkInstallStatus();
}

// ==========================================================
// HELP TOGGLE
// ==========================================================

function setupHelpToggle() {
  const btn = document.getElementById('btn-help-toggle');
  const content = document.getElementById('help-content');
  if (btn && content) {
    btn.addEventListener('click', () => {
      content.classList.toggle('hidden');
      btn.textContent = content.classList.contains('hidden') ? '❓ Ayuda / Guía de Uso' : '❌ Cerrar Ayuda';
    });
  }
}

// ==========================================================
// COMPANY CONFIG
// ==========================================================

async function checkCompanyConfig() {
  try {
    const snap = await getDoc(doc(db, 'companies', currentUser.uid));
    isCompanyConfigured = snap.exists() && snap.data().ruc;
    const w = document.getElementById('company-warning');
    if (w) {
      if (!isCompanyConfigured) w.classList.remove('hidden');
      else w.classList.add('hidden');
    }
  } catch (e) { console.error('Company check error:', e); }
}

// Update initUI to call these
const originalInitUI = initUI;
initUI = function() {
  originalInitUI();
  setupPWAInstall();
  setupHelpToggle();
  checkCompanyConfig();
};
