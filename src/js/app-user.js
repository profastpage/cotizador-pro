// App User Logic - SDK Modular v10+

import { auth, db, PLANS, DOCUMENT_TYPES, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';
import { protectRoute, logout } from './auth.js';

let currentUser = null;
let userData = null;
let quoteItems = [];
let currentWizardStep = 1;
let isGeneratingPDF = false;

// Demo account detection (ONLY for these specific demo emails)
const DEMO_EMAILS = ['demo.pro@cotizapro.com', 'demo.business@cotizapro.com', 'demo.basico@cotizapro.com'];
function isDemoAccount() {
  return currentUser && DEMO_EMAILS.includes((currentUser.email || '').toLowerCase());
}

// Default clauses for new clients
const DEFAULT_PAYMENT_CONDITION = 'Contado';
const DEFAULT_CLAUSES = `Esta cotización tiene una validez de 30 días calendario.\nLos precios están expresados en Soles (PEN) e incluyen IGV.\nLa forma de pago y plazos están detallados en la sección de condiciones de pago.\nEsta cotización está sujeta a disponibilidad de stock al momento de la orden de compra.\nPara consultas, comuníquese a los datos de contacto indicados en el encabezado.`;

// Bank account types
const BANK_TYPES = [
  { id: 'bcp', name: 'BCP', label: 'BCP', logo: 'BCP', placeholder: '193-1234567-0-42' },
  { id: 'bbva', name: 'BBVA', label: 'BBVA', logo: 'BBVA', placeholder: '0011-0020-0123456789' },
  { id: 'interbank', name: 'Interbank', label: 'Interbank', logo: 'IBK', placeholder: '2001-1234567890' },
  { id: 'yape', name: 'Yape', label: 'Yape', logo: 'Y', placeholder: '987654321' },
  { id: 'plin', name: 'Plin', label: 'Plin', logo: 'PL', placeholder: '987654321' },
  { id: 'other', name: 'Otro', label: 'Otro Banco', logo: '...', placeholder: 'Número de cuenta' }
];

let currentPreviewQuoteId = null;
let currentPreviewBlob = null;

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

  if (isDemoAccount()) {
    const demoExpiry = new Date();
    demoExpiry.setMonth(demoExpiry.getMonth() + 12);
    document.getElementById('stat-plan-expires').textContent = formatDateShort(demoExpiry);
  } else if (userData.planEndDate) {
    document.getElementById('stat-plan-expires').textContent = formatDateShort(new Date(userData.planEndDate));
  } else {
    document.getElementById('stat-plan-expires').textContent = 'Gratis';
  }

  if (userData.plan === 'free') {
    document.getElementById('sidebar-upgrade-btn').style.display = 'block';
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

  // Update sidebar progress bar (visual only)
  const progressBar = document.getElementById('plan-progress-bar');
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (progressBar) progressBar.style.background = percent >= 90 ? 'var(--color-danger)' : percent >= 70 ? 'var(--color-warning)' : 'var(--color-success)';
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
      document.querySelectorAll('.modal, .pdf-preview-modal').forEach(m => m.classList.add('hidden'));
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
  if (screen === 'finances') loadFinances();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================
// DASHBOARD
// ==========================================================

async function loadDashboard() {
  const quotes = await getUserQuotes();
  // For demo accounts: use ALL history quotes for realistic demo
  // For real accounts: only this month, excluding demo quotes
  let statsQuotes;
  if (isDemoAccount()) {
    statsQuotes = quotes; // ALL quotes from history
  } else {
    const thisMonth = quotes.filter(q => {
      const d = new Date(q.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    statsQuotes = thisMonth.filter(q => !q.isDemo);
  }
  const totalAmount = statsQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
  
  document.getElementById('stat-quotes-month').textContent = statsQuotes.length;
  document.getElementById('stat-total-amount').textContent = formatCurrency(totalAmount);

  // Update remaining quotes widget
  const quota = getPlanQuota(userData.plan);
  const used = userData.quotesUsedThisMonth || 0;
  const remaining = quota === -1 ? '∞' : Math.max(0, quota - used);
  const remainingEl = document.getElementById('remaining-quotes-count');
  if (remainingEl) remainingEl.textContent = remaining;

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

  // Approve button (green check) - only in history view
  const isApproved = quote.approved === true;
  const approveBtn = showActions ? `
    <button class="btn-approve-quote ${isApproved ? 'approved' : ''}" 
            onclick="event.stopPropagation();window.toggleApproveQuote('${quote.id}')" 
            title="${isApproved ? 'Desaprobar cotización' : 'Aprobar cotización - Registrar como ingreso'}">
      ✓
    </button>` : '';

  return `
    <div class="quote-card" style="display:flex;gap:0.75rem;align-items:flex-start;${showActions ? '' : 'cursor:pointer;'}" ${showActions ? '' : `onclick="window.downloadQuote('${quote.id}')"`}>
      <div style="flex:1;min-width:0;">
        <div class="quote-card-header">
          <span class="quote-number">${typeIcon}#${displayNum}${demoBadge}</span>
          <span class="quote-date">${formatDateShort(new Date(quote.createdAt))}</span>
        </div>
        <div class="quote-client">${quote.client?.name || 'Sin cliente'}</div>
        <div class="quote-amount">${formatCurrency(quote.total)}</div>
        ${showActions ? `<div class="quote-actions">
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();window.previewQuote('${quote.id}')">👁️ Ver</button>
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();window.downloadQuote('${quote.id}')">📄 PDF</button>
          <button class="btn-link-share" onclick="event.stopPropagation();window.generateShareLink('${quote.id}')">🔗 Enlace</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();window.deleteQuote('${quote.id}')">🗑️</button>
        </div>` : ''}
      </div>
      ${approveBtn}
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

  // Load and populate item catalog
  renderItemCatalog();

  // Initialize item catalog toggle
  initItemCatalogToggle();
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
// ITEM CATALOG - Save/load previously used items
// ==========================================================

async function saveItemCatalog(items) {
  try {
    if (!items || items.length === 0) return;
    const catalogRef = collection(db, 'itemCatalog');
    for (const item of items) {
      if (!item.description || !item.description.trim()) continue;
      const desc = item.description.trim();
      const q = query(catalogRef, where('userId', '==', currentUser.uid), where('description', '==', desc));
      const existing = await getDocs(q);
      if (!existing.empty) {
        await updateDoc(existing.docs[0].ref, {
          unitPrice: item.unitPrice || 0,
          lastUsedAt: new Date().toISOString()
        });
      } else {
        await addDoc(catalogRef, {
          userId: currentUser.uid,
          description: desc,
          unitPrice: item.unitPrice || 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error saving item catalog:', error);
  }
}

async function loadItemCatalog() {
  try {
    const catalogRef = collection(db, 'itemCatalog');
    const q = query(catalogRef, where('userId', '==', currentUser.uid), orderBy('lastUsedAt', 'desc'));
    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
    return items;
  } catch (error) {
    console.error('Error loading item catalog:', error);
    return [];
  }
}

async function renderItemCatalog() {
  const wrapper = document.getElementById('item-catalog-wrapper');
  const list = document.getElementById('item-catalog-list');
  if (!wrapper || !list) return;

  const items = await loadItemCatalog();
  if (items.length === 0) {
    wrapper.style.display = 'none';
    return;
  }

  wrapper.style.display = 'block';
  list.innerHTML = '';

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'item-catalog-item';
    el.innerHTML = `
      <div class="item-catalog-item-info">
        <div class="item-catalog-item-name">${escapeHtml(item.description)}</div>
        <div class="item-catalog-item-price">S/ ${(item.unitPrice || 0).toFixed(2)}</div>
      </div>
      <button class="item-catalog-item-add" type="button">+ Agregar</button>
    `;
    el.querySelector('.item-catalog-item-add').addEventListener('click', (e) => {
      e.stopPropagation();
      addItemWithDefaults(item.description, item.unitPrice || 0);
    });
    el.addEventListener('click', () => {
      addItemWithDefaults(item.description, item.unitPrice || 0);
    });
    list.appendChild(el);
  });
}

function addItemWithDefaults(description, unitPrice) {
  const itemId = Date.now().toString();
  quoteItems.push({ id: itemId, quantity: 1, unitPrice: unitPrice, description: description });
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
            <input type="number" class="form-input item-price" value="${unitPrice}" min="0" step="0.01" inputmode="decimal">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <input type="text" class="form-input item-desc" value="${escapeAttr(description)}" placeholder="Descripción del producto/servicio">
        </div>
        <div class="item-subtotal">S/ ${unitPrice.toFixed(2)}</div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);

  const card = container.querySelector(`[data-item-id="${itemId}"]`);
  card.querySelector('.item-qty').addEventListener('input', (e) => updateItem(itemId, 'quantity', parseFloat(e.target.value) || 0));
  card.querySelector('.item-price').addEventListener('input', (e) => updateItem(itemId, 'unitPrice', parseFloat(e.target.value) || 0));
  card.querySelector('.item-desc').addEventListener('input', (e) => updateItem(itemId, 'description', e.target.value));
  updateSummary();

  // Scroll to the new item
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  card.querySelector('.item-qty').focus();
  card.style.borderColor = 'var(--color-primary)';
  setTimeout(() => { card.style.borderColor = ''; }, 1500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initItemCatalogToggle() {
  const btn = document.getElementById('btn-toggle-item-catalog');
  const panel = document.getElementById('item-catalog-panel');
  const arrow = document.getElementById('item-catalog-arrow');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.classList.toggle('open', !isOpen);
    btn.style.borderRadius = isOpen ? '' : 'var(--radius-lg) var(--radius-lg) 0 0';
  });
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
async function renderPDF(company, clientName, items, quoteNumber, issueDate, dueDate, subtotal, igvAmount, total, igvEnabled, igvType, documentType = 'cotizacion', clientDocument = '') {
  const { jsPDF } = await loadJsPDF();
  const pdf = new jsPDF();

  // Set PDF metadata for sharing preview (WhatsApp, etc.)
  const paddedNum = String(quoteNumber).padStart(3, '0');
  const docTypeInfo = DOCUMENT_TYPES[documentType] || DOCUMENT_TYPES.cotizacion;
  pdf.setProperties({
    title: `${company.name || 'Cotización'} - ${paddedNum}`,
    author: company.name || 'CotizaPro',
    subject: `${docTypeInfo.headerTitle} #${paddedNum} - ${clientName}`,
    creator: 'CotizaPro - Sistema de Cotizaciones Profesionales'
  });

  // Dynamic color theme from user config
  const colorId = company.templateColor || 'blue';
  const COLOR = getTemplateColor(colorId);
  const BLUE = COLOR.primary;
  const LIGHT_BLUE = COLOR.light;
  const GRAY_BG = [245, 247, 250];
  const GRAY_TEXT = [100, 116, 139];
  const DARK = [15, 23, 42];
  const GREEN = [5, 150, 105];

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
  // CLIENT DATA SECTION - Compact
  // ==========================================
  const clientY = 68;
  pdf.setFillColor(...BLUE);
  pdf.roundedRect(20, clientY, 170, 7, 2, 2, 'F');
  pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255, 255, 255);
  pdf.text('DATOS DEL CLIENTE', 25, clientY + 5);

  const boxY = clientY + 9;
  pdf.setFillColor(...GRAY_BG);
  pdf.roundedRect(20, boxY, 170, 12, 2, 2, 'F');

  pdf.setFontSize(8); pdf.setTextColor(...DARK);
  // Left side: RUC/DNI
  pdf.setFont(undefined, 'bold'); pdf.text('RUC/DNI:', 25, boxY + 7);
  pdf.setFont(undefined, 'normal');
  const docText = clientDocument || '-';
  const splitDoc = pdf.splitTextToSize(docText, 40);
  pdf.text(splitDoc[0] || docText, 48, boxY + 7);
  // Right side: Razón Social
  pdf.setFont(undefined, 'bold'); pdf.text('RAZÓN SOCIAL:', 100, boxY + 7);
  pdf.setFont(undefined, 'normal');
  const nameText = clientName || '-';
  const splitName = pdf.splitTextToSize(nameText, 65);
  pdf.text(splitName[0] || nameText, 122, boxY + 7);

  // ==========================================
  // ITEMS TABLE
  // ==========================================
  let tableY = boxY + 16;
  pdf.setFillColor(...BLUE);
  pdf.rect(20, tableY, 170, 9, 'F');

  pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255, 255, 255);
  pdf.text('CANT.', 25, tableY + 5);
  pdf.text('DESCRIPCIÓN', 45, tableY + 5);
  pdf.text('P. UNIT.', 130, tableY + 5);
  pdf.text('TOTAL', 170, tableY + 5, { align: 'right' });

  pdf.setFont(undefined, 'normal'); pdf.setFontSize(8);
  tableY += 7;

  for (let rowIdx = 0; rowIdx < items.length; rowIdx++) {
    const item = items[rowIdx];
    const qty = item.quantity || 0;
    const price = item.unitPrice || 0;
    const lineTotal = qty * price;

    if (rowIdx % 2 === 0) { pdf.setFillColor(249, 250, 251); pdf.rect(20, tableY, 170, 7, 'F'); }

    pdf.setTextColor(...DARK);
    pdf.text(String(qty), 25, tableY + 4.5);
    const desc = item.description || '';
    const splitDesc = pdf.splitTextToSize(desc, 80);
    pdf.text(splitDesc[0] || '', 45, tableY + 4.5);
    pdf.text(`S/ ${formatNumberWithCommas(price)}`, 130, tableY + 4.5);
    pdf.text(`S/ ${formatNumberWithCommas(lineTotal)}`, 188, tableY + 4.5, { align: 'right' });
    tableY += 7;
  }

  // Totals - Compact
  pdf.setDrawColor(...BLUE); pdf.setLineWidth(1);
  pdf.line(20, tableY + 1, 190, tableY + 1);
  tableY += 6;

  pdf.setFontSize(9); pdf.setTextColor(...GRAY_TEXT);
  pdf.text('SUBTOTAL:', 120, tableY);
  pdf.setTextColor(...DARK);
  pdf.text(`S/ ${formatNumberWithCommas(subtotal)}`, 188, tableY, { align: 'right' });
  tableY += 5;

  if (igvEnabled) {
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text('IGV (18%):', 120, tableY);
    pdf.setTextColor(...DARK);
    pdf.text(`S/ ${formatNumberWithCommas(igvAmount)}`, 188, tableY, { align: 'right' });
    tableY += 4;
    if (igvType === 'included') {
      pdf.setFontSize(7); pdf.setTextColor(...GREEN);
      pdf.text('(Incluido en el precio)', 120, tableY);
      pdf.setTextColor(...DARK); pdf.setFontSize(9);
      tableY += 4;
    } else { tableY += 1; }
  }

  tableY += 1;
  pdf.line(120, tableY, 190, tableY);
  tableY += 6;
  pdf.setFontSize(13); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...BLUE);
  pdf.text('TOTAL:', 120, tableY);
  pdf.text(`S/ ${formatNumberWithCommas(total)}`, 188, tableY, { align: 'right' });

  // Written total text (Son: Tres Mil Noventa y Un Soles con 60/100)
  tableY += 5;
  const writtenText = totalToWrittenText(total);
  pdf.setFontSize(7); pdf.setFont(undefined, 'italic'); pdf.setTextColor(...GRAY_TEXT);
  const splitWritten = pdf.splitTextToSize(writtenText, 160);
  pdf.text(splitWritten, 25, tableY);
  tableY += splitWritten.length * 3.5 + 1;

  // ==========================================
  // DOCUMENT-TYPE SPECIFIC SECTIONS + FOOTER
  // ==========================================
  const paymentCondition = company.paymentCondition || DEFAULT_PAYMENT_CONDITION;
  const clausesText = company.clauses || DEFAULT_CLAUSES;
  const clauseLines = clausesText.split('\n').filter(l => l.trim() !== '');
  const bankAccounts = company.bankAccounts || [];
  let docY = tableY + 6;
  docY = renderDocTypeSections(pdf, documentType, company, clientName, issueDate, dueDate, paymentCondition, clauseLines, bankAccounts, items, docY, igvEnabled, colorId);

  // Footer with clickable link
  const finalFooterY = Math.max(docY + 6, 275);
  pdf.setDrawColor(...BLUE); pdf.setLineWidth(1);
  pdf.line(20, finalFooterY, 190, finalFooterY);
  pdf.setFontSize(11); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...BLUE);
  pdf.text(docTypeInfo.footerText, 105, finalFooterY + 7, { align: 'center' });

  // Clickable hyperlink to CotizaPro website
  pdf.setFontSize(7); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...BLUE);
  const footerLinkText = 'Documento generado por CotizaPro - Sistema de Cotizaciones Profesionales';
  pdf.textWithLink(footerLinkText, 105, finalFooterY + 13, { align: 'center', url: 'https://cotizador-pro.pages.dev/' });

  return { pdf, docTypeInfo };
}

// ==========================================================
// DOCUMENT TYPE SPECIFIC RENDERER - Differentiated templates
// ==========================================================
function renderDocTypeSections(pdf, docType, company, clientName, issueDate, dueDate, paymentCondition, clauseLines, bankAccounts, items, startY, igvEnabled, colorId) {
  const COLOR = getTemplateColor(colorId || 'blue');
  const BLUE = COLOR.primary;
  const LIGHT_BLUE = COLOR.light;
  const GRAY_BG = [245, 247, 250];
  const DARK = [15, 23, 42];
  const GRAY_TEXT = [100, 116, 139];
  const GREEN = [5, 150, 105];
  let y = startY;

  function newPageIfNeeded(needed) { if (y + needed > 275) { pdf.addPage(); y = 20; } }

  function drawSectionHeader(title) {
    newPageIfNeeded(20);
    pdf.setFillColor(...BLUE);
    pdf.roundedRect(20, y, 170, 8, 2, 2, 'F');
    pdf.setFontSize(9); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255, 255, 255);
    pdf.text(title, 25, y + 5.5);
    y += 12;
  }

  function drawInfoBox(rows, h) {
    newPageIfNeeded(h + 4);
    pdf.setFillColor(...GRAY_BG);
    pdf.roundedRect(20, y, 170, h, 2, 2, 'F');
    rows.forEach(function(r) {
      pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...GRAY_TEXT);
      pdf.text(r[0], 25, y + r[2]);
      pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text(r[1] || '-', r[3] || 85, y + r[2]);
    });
    y += h + 4;
  }

  function drawBulletList(lines) {
    lines.forEach(function(line, i) {
      newPageIfNeeded(6);
      if (i % 2 === 0) {
        pdf.setFillColor(...LIGHT_BLUE);
        pdf.roundedRect(20, y - 3.5, 170, 6, 1, 1, 'F');
      }
      pdf.setTextColor(...BLUE); pdf.setFontSize(8); pdf.text('\u2022', 25, y);
      pdf.setTextColor(...DARK);
      var split = pdf.splitTextToSize(line, 140);
      pdf.text(split[0] || line, 30, y);
      y += 5.5;
    });
  }

  function drawBankAccounts() {
    if (bankAccounts.length === 0) return;
    y += 4;
    newPageIfNeeded(20);
    drawSectionHeader('DATOS BANCARIOS PARA PAGO');
    bankAccounts.forEach(function(bank, i) {
      if (!bank || !bank.number) return;
      newPageIfNeeded(16);
      // Draw a proper card-like box for each bank
      var boxHeight = 12;
      if (i % 2 === 0) {
        pdf.setFillColor(...LIGHT_BLUE);
        pdf.roundedRect(20, y - 1, 170, boxHeight, 2, 2, 'F');
      } else {
        pdf.setFillColor(...GRAY_BG);
        pdf.roundedRect(20, y - 1, 170, boxHeight, 2, 2, 'F');
      }
      // Bank name and type - first row
      var label = bank.name || 'Cuenta Bancaria';
      if (bank.accountType) label += ' - ' + bank.accountType;
      pdf.setFontSize(9); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...BLUE);
      pdf.text(label, 25, y + 3);
      // Account number and holder - second row with proper spacing
      var detail = 'N\u00B0 Cuenta: ' + bank.number;
      if (bank.holder) detail += '  |  Titular: ' + bank.holder;
      pdf.setFontSize(8); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text(detail, 25, y + 8);
      y += boxHeight + 4;
    });
  }

  switch (docType) {
    case 'cotizacion':
    case 'personalizado':
    default: {
      drawSectionHeader('CONDICIONES DE PAGO');
      pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text(paymentCondition, 25, y); y += 8;
      drawSectionHeader('T\u00C9RMINOS Y CONDICIONES');
      drawBulletList(clauseLines);
      drawBankAccounts();
      break;
    }

    case 'propuesta': {
      drawSectionHeader('OBJETIVO DE LA PROPUESTA');
      newPageIfNeeded(16);
      pdf.setFontSize(8); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      var obj = 'La presente propuesta tiene por objeto ofrecer los servicios y/o productos detallados en el cuadro anterior, cumpliendo con los est\u00E1ndares de calidad y plazos establecidos.';
      var splitObj = pdf.splitTextToSize(obj, 160);
      pdf.text(splitObj, 25, y); y += splitObj.length * 4 + 6;
      drawSectionHeader('PLAZO DE ENTREGA / EJECUCI\u00D3N');
      drawInfoBox([
        ['Fecha Inicio:', issueDate || 'Por acordar', 5, 75],
        ['Fecha Entrega:', dueDate || 'Por acordar', 5, 150],
        ['Vigencia:', '30 d\u00EDas calendario', 11, 75]
      ], 18);
      drawSectionHeader('ALCANCE DEL PROYECTO');
      newPageIfNeeded(12);
      if (items.length > 0) {
        pdf.setFontSize(8); pdf.setTextColor(...DARK);
        items.forEach(function(item, i) {
          newPageIfNeeded(6);
          var desc = (i+1) + '. ' + (item.description || 'Servicio') + ' - Cant: ' + item.quantity + ' - P.Unit: S/ ' + (item.unitPrice||0).toFixed(2);
          var splitDesc = pdf.splitTextToSize(desc, 160);
          pdf.text(splitDesc, 25, y); y += splitDesc.length * 4 + 2;
        });
        y += 2;
      }
      drawSectionHeader('CONDICIONES DE LA PROPUESTA');
      drawBulletList(clauseLines);
      drawBankAccounts();
      break;
    }

    case 'nota_venta': {
      drawSectionHeader('CONDICIONES DE LA VENTA');
      drawInfoBox([
        ['Forma de Pago:', paymentCondition, 5, 75],
        ['Fecha Emisi\u00F3n:', issueDate || '-', 5, 150],
        ['Vigencia:', '5 d\u00EDas calendario', 11, 75]
      ], 18);
      newPageIfNeeded(12);
      y += 2;
      pdf.setFillColor(255, 243, 205);
      pdf.roundedRect(20, y, 170, 10, 2, 2, 'F');
      pdf.setFontSize(7); pdf.setFont(undefined, 'bold'); pdf.setTextColor(146, 64, 14);
      pdf.text('\u26A0 NOTA: Este documento no tiene valor tributario. Para efectos fiscales solicite Factura o Boleta electr\u00F3nica.', 105, y + 6, { align: 'center' });
      y += 16;
      drawBankAccounts();
      break;
    }

    case 'orden_servicio': {
      drawSectionHeader('DATOS DEL SERVICIO');
      drawInfoBox([
        ['Fecha Inicio:', issueDate || '-', 5, 75],
        ['Fecha Fin:', dueDate || '-', 5, 150],
        ['Lugar del Servicio:', 'Sitio del cliente', 11, 75],
        ['Responsable:', company.name || '-', 11, 150],
        ['Estado:', 'PENDIENTE', 17, 75],
        ['IGV:', igvEnabled ? 'Incluido (18%)' : 'No aplicable', 17, 150]
      ], 25);
      drawSectionHeader('DESCRIPCI\u00D3N DEL TRABAJO');
      newPageIfNeeded(12);
      if (items.length > 0) {
        pdf.setFontSize(8); pdf.setTextColor(...DARK);
        items.forEach(function(item, i) {
          newPageIfNeeded(8);
          var desc = (i+1) + '. ' + (item.description || 'Servicio') + ' (Cantidad: ' + item.quantity + ')';
          var splitDesc = pdf.splitTextToSize(desc, 160);
          pdf.text(splitDesc, 25, y); y += splitDesc.length * 4 + 2;
        });
      } else {
        pdf.setFontSize(8); pdf.setTextColor(...DARK);
        pdf.text('Ver detalle de servicios en el cuadro superior.', 25, y); y += 6;
      }
      y += 2;
      drawSectionHeader('CONDICIONES DEL SERVICIO');
      drawBulletList(clauseLines);
      drawBankAccounts();
      break;
    }

    case 'factura': {
      drawSectionHeader('INFORMACI\u00D3N TRIBUTARIA');
      drawInfoBox([
        ['RUC Emisor:', company.ruc || '-', 5, 80],
        ['Raz\u00F3n Social:', company.name || '-', 5, 110],
        ['Direcci\u00F3n:', company.address || '-', 11, 80],
        ['RUC Cliente:', '-', 17, 80],
        ['Cliente:', clientName, 17, 110]
      ], 25);
      drawSectionHeader('CONDICIONES DE PAGO');
      pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text(paymentCondition, 25, y); y += 8;
      drawSectionHeader('T\u00C9RMINOS Y CONDICIONES');
      drawBulletList(clauseLines);
      drawBankAccounts();
      newPageIfNeeded(10);
      y += 4;
      pdf.setFontSize(7); pdf.setTextColor(...GRAY_TEXT);
      pdf.text('Representaci\u00F3n impresa de la FACTURA ELECTR\u00D3NICA. Consulte su documento en: https://www.sunat.gob.pe', 105, y, { align: 'center' });
      y += 6;
      break;
    }

    case 'boleta': {
      drawSectionHeader('DATOS DEL COMPRADOR');
      drawInfoBox([
        ['Cliente:', clientName, 5, 80],
        ['DNI / RUC:', 'Consumidor Final', 5, 150],
        ['Direcci\u00F3n:', '-', 11, 80]
      ], 18);
      drawSectionHeader('CONDICIONES DE PAGO');
      pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text(paymentCondition, 25, y); y += 8;
      drawBankAccounts();
      newPageIfNeeded(10);
      y += 4;
      pdf.setFontSize(7); pdf.setTextColor(...GRAY_TEXT);
      pdf.text('Representaci\u00F3n impresa de la BOLETA DE VENTA ELECTR\u00D3NICA. Usuario final: Consumidor final.', 105, y, { align: 'center' });
      y += 6;
      break;
    }

    case 'recibo': {
      var totalAmount = items.reduce(function(s, i) { return s + ((i.quantity||0) * (i.unitPrice||0)); }, 0);
      drawSectionHeader('DATOS DEL PAGO');
      drawInfoBox([
        ['Concepto:', 'Pago por servicios y/o productos', 5, 90],
        ['Forma de Pago:', paymentCondition, 5, 105],
        ['Fecha de Pago:', issueDate || new Date().toISOString().split('T')[0], 11, 90],
        ['Moneda:', 'PEN (Soles)', 11, 105],
        ['Recib\u00ED de:', clientName, 17, 90],
        ['Monto Total:', 'S/ ' + totalAmount.toFixed(2), 17, 105]
      ], 25);
      drawSectionHeader('CERTIFICACI\u00D3N');
      newPageIfNeeded(12);
      pdf.setFontSize(8); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text('Por medio de la presente se certifica que se ha recibido el pago arriba indicado en su totalidad.', 25, y);
      y += 12;
      newPageIfNeeded(28);
      y += 4;
      pdf.setDrawColor(...GRAY_TEXT); pdf.setLineWidth(0.5);
      pdf.line(25, y + 16, 95, y + 16);
      pdf.line(115, y + 16, 185, y + 16);
      pdf.setFontSize(7); pdf.setTextColor(...GRAY_TEXT);
      pdf.text('Firma del Recibido', 60, y + 20, { align: 'center' });
      pdf.text('Firma del Entregado', 150, y + 20, { align: 'center' });
      y += 28;
      break;
    }

    case 'contrato': {
      drawSectionHeader('PARTES CONTRATANTES');
      newPageIfNeeded(28);
      pdf.setFillColor(...GRAY_BG);
      pdf.roundedRect(20, y, 170, 26, 2, 2, 'F');
      pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...BLUE);
      pdf.text('EL PRESTADOR:', 25, y + 5);
      pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text(company.name || '-', 25, y + 10);
      pdf.text('RUC: ' + (company.ruc||'-') + ' | ' + (company.address||''), 25, y + 16);
      pdf.setFont(undefined, 'bold'); pdf.setTextColor(...BLUE);
      pdf.text('EL CLIENTE:', 105, y + 5);
      pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text(clientName, 105, y + 10);
      pdf.text('Fecha: ' + (issueDate||'-'), 105, y + 16);
      pdf.setFont(undefined, 'bold'); pdf.text('Ref.:', 25, y + 22);
      pdf.setFont(undefined, 'normal'); pdf.text('Contrato de Prestaci\u00F3n de Servicios', 50, y + 22);
      y += 32;

      drawSectionHeader('CL\u00C1USULAS CONTRACTUALES');
      drawBulletList([
        'PRIMERA: OBJETO - El Prestador se compromete a proveer los servicios/productos detallados en el presente documento.',
        'SEGUNDA: PLAZO - El plazo de ejecuci\u00F3n es desde ' + (issueDate||'---') + ' hasta ' + (dueDate||'---') + '.',
        'TERCERA: MONTO - El monto total es el indicado en el cuadro de detalle, ' + (igvEnabled ? 'incluye IGV del 18%.' : 'sin IGV.'),
        'CUARTA: FORMA DE PAGO - ' + paymentCondition + '.',
        'QUINTA: CONFIDENCIALIDAD - Ambas partes se comprometen a mantener la confidencialidad de toda informaci\u00F3n compartida.',
        'SEXTA: GARANT\u00CDA - El Prestador garantiza la calidad por un per\u00EDodo de 90 d\u00EDas calendario.',
        'S\u00C9PTIMA: RESOLUCI\u00D3N - Cualquiera podr\u00E1 resolver el contrato con 15 d\u00EDas de aviso escrito en caso de incumplimiento.',
        'OCTAVA: JURISDICCI\u00D3N - Para controversias, las partes se someten a los Juzgados de Lima, legislaci\u00F3n peruana vigente.'
      ]);

      y += 4;
      drawSectionHeader('VIGENCIA DEL CONTRATO');
      newPageIfNeeded(12);
      pdf.setFontSize(8); pdf.setFont(undefined, 'normal'); pdf.setTextColor(...DARK);
      pdf.text('El presente contrato tiene vigencia desde el ' + (issueDate||'---') + ' hasta el ' + (dueDate||'---') + '.', 25, y);
      y += 14;

      newPageIfNeeded(32);
      y += 4;
      pdf.setDrawColor(...GRAY_TEXT); pdf.setLineWidth(0.5);
      pdf.line(25, y + 20, 95, y + 20);
      pdf.line(115, y + 20, 185, y + 20);
      pdf.setFontSize(7); pdf.setTextColor(...GRAY_TEXT);
      pdf.text('________________________', 60, y + 10, { align: 'center' });
      pdf.text(company.name || 'EL PRESTADOR', 60, y + 24, { align: 'center' });
      pdf.text('DNI/RUC: ' + (company.ruc||'-'), 60, y + 28, { align: 'center' });
      pdf.text('________________________', 150, y + 10, { align: 'center' });
      pdf.text(clientName, 150, y + 24, { align: 'center' });
      pdf.text('DNI/RUC: _______________', 150, y + 28, { align: 'center' });
      y += 36;
      break;
    }

    case 'garantia': {
      var mainItem = items.length > 0 ? items[0] : null;
      drawSectionHeader('DATOS DEL PRODUCTO / SERVICIO');
      drawInfoBox([
        ['Producto/Servicio:', mainItem ? mainItem.description : '-', 5, 90],
        ['Fecha Compra:', issueDate || '-', 5, 150],
        ['Cliente:', clientName, 11, 90],
        ['Cantidad:', mainItem ? String(mainItem.quantity) : '-', 11, 150],
        ['Vendedor:', company.name || '-', 17, 90],
        ['RUC Vendedor:', company.ruc || '-', 17, 150]
      ], 25);

      drawSectionHeader('COBERTURA DE GARANT\u00CDA');
      drawInfoBox([
        ['Per\u00EDodo:', 'Desde ' + (issueDate||'---') + ' hasta ' + (dueDate||'---'), 5, 80],
        ['Tipo:', 'Garant\u00EDa por defectos de fabricaci\u00F3n y funcionamiento', 11, 80],
        ['Alcance:', 'Reparaci\u00F3n o reemplazo del producto/servicio', 17, 80]
      ], 25);

      drawSectionHeader('CONDICIONES DE LA GARANT\u00CDA');
      var warrantyClauses = clauseLines.length > 0 ? clauseLines : [
        'La garant\u00EDa cubre defectos de fabricaci\u00F3n y funcionamiento normal del producto.',
        'NO cubre da\u00F1os por mal uso, modificaciones no autorizadas o desgaste natural.',
        'Para validar la garant\u00EDa, presente este certificado junto con el comprobante de compra.',
        'El tiempo de reparaci\u00F3n o reemplazo no exceder\u00E1 los 30 d\u00EDas calendario.',
        'Esta garant\u00EDa es transferible al nuevo propietario dentro del per\u00EDodo de vigencia.',
        'Se rige por el C\u00F3digo de Protecci\u00F3n y Defensa del Consumidor (Ley N\u00B0 29571).'
      ];
      drawBulletList(warrantyClauses);
      break;
    }
  }

  return y;
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
    // Save items to catalog for quick reuse
    await saveItemCatalog(quoteItems);
    await updateDoc(doc(db, 'users', currentUser.uid), { quotesUsedThisMonth: increment(1) });

    // Use centralized PDF renderer
    const { pdf, docTypeInfo } = await renderPDF(company, clientName, quoteItems, quoteNumber, issueDate, dueDate, subtotal, igvAmount, grandTotal, igvEnabled, igvType, documentType, clientDoc);

    const fileName = `${(company.name || 'Cotizacion').replace(/[^a-zA-Z0-9\s]/g, '').trim()}-${String(quoteNumber).padStart(3, '0')}.pdf`;
    pdf.save(fileName);

    showToast('¡PDF generado exitosamente!');
    resetWizard();
    navigateTo('dashboard');
    userData.quotesUsedThisMonth++;
    updatePlanProgress();
    updateRemainingQuotes();

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
      // Load clauses settings
      const paymentCond = data.paymentCondition || DEFAULT_PAYMENT_CONDITION;
      const clausesText = data.clauses || DEFAULT_CLAUSES;
      const paySelect = document.getElementById('company-payment-condition');
      const customGroup = document.getElementById('custom-payment-group');
      const customInput = document.getElementById('company-payment-custom');
      if (paySelect) {
        // Check if value matches any option
        let found = false;
        for (let opt of paySelect.options) {
          if (opt.value === paymentCond) { found = true; break; }
        }
        if (found) {
          paySelect.value = paymentCond;
          if (customGroup) customGroup.style.display = 'none';
        } else {
          paySelect.value = 'custom';
          if (customGroup) customGroup.style.display = 'block';
          if (customInput) customInput.value = paymentCond;
        }
      }
      const clausesTA = document.getElementById('company-clauses');
      if (clausesTA) clausesTA.value = clausesText;
      // Load bank accounts
      renderBankAccounts(data.bankAccounts || []);
      // Load template color
      loadTemplateColorPicker(data.templateColor || 'blue');
    } else {
      // New user - set defaults
      const clausesTA = document.getElementById('company-clauses');
      if (clausesTA) clausesTA.value = DEFAULT_CLAUSES;
      renderBankAccounts([]);
      loadTemplateColorPicker('blue');
    }
  });
  document.getElementById('current-plan-name').textContent = getPlanName(userData.plan);
  document.getElementById('current-plan-price').textContent = getPlanPrice(userData.plan);
  document.getElementById('current-plan-desc').textContent = getPlanDesc(userData.plan);
  updateRemainingQuotes();
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

  // Payment condition select - show/hide custom input
  const paySelect = document.getElementById('company-payment-condition');
  const customGroup = document.getElementById('custom-payment-group');
  if (paySelect) {
    paySelect.addEventListener('change', () => {
      if (paySelect.value === 'custom') {
        customGroup.style.display = 'block';
      } else {
        customGroup.style.display = 'none';
      }
    });
  }

  // Save clauses button
  const btnSaveClauses = document.getElementById('btn-save-clauses');
  if (btnSaveClauses) {
    btnSaveClauses.addEventListener('click', async () => {
      const paySelect2 = document.getElementById('company-payment-condition');
      let paymentCondition = paySelect2.value;
      if (paymentCondition === 'custom') {
        paymentCondition = document.getElementById('company-payment-custom').value.trim();
      }
      if (!paymentCondition) {
        showToast('Ingresa la condición de pago', 'error');
        return;
      }
      const clausesText = document.getElementById('company-clauses').value.trim();
      await setDoc(doc(db, 'companies', currentUser.uid), {
        paymentCondition,
        clauses: clausesText,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast('Cláusulas guardadas correctamente');
    });
  }

  // Reset clauses to defaults
  const btnResetClauses = document.getElementById('btn-reset-clauses');
  if (btnResetClauses) {
    btnResetClauses.addEventListener('click', async () => {
      const paySelect2 = document.getElementById('company-payment-condition');
      const customGroup2 = document.getElementById('custom-payment-group');
      const customInput2 = document.getElementById('company-payment-custom');
      const clausesTA2 = document.getElementById('company-clauses');
      if (paySelect2) paySelect2.value = DEFAULT_PAYMENT_CONDITION;
      if (customGroup2) customGroup2.style.display = 'none';
      if (customInput2) customInput2.value = '';
      if (clausesTA2) clausesTA2.value = DEFAULT_CLAUSES;
      await setDoc(doc(db, 'companies', currentUser.uid), {
        paymentCondition: DEFAULT_PAYMENT_CONDITION,
        clauses: DEFAULT_CLAUSES,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast('Cláusulas restauradas a valores por defecto');
    });
  }

  // Bank accounts setup
  setupBankAccounts();

  // Template color picker setup
  setupTemplateColorPicker();
}

// ==========================================================
// TEMPLATE COLOR PICKER - Settings UI
// ==========================================================

let selectedTemplateColor = 'blue';

function loadTemplateColorPicker(selectedColor) {
  const container = document.getElementById('template-color-picker');
  if (!container) return;
  selectedTemplateColor = selectedColor || 'blue';
  container.innerHTML = '';

  Object.keys(TEMPLATE_COLORS).forEach(function(colorId) {
    const color = TEMPLATE_COLORS[colorId];
    const rgb = color.primary;
    const hex = '#' + rgb.map(function(c) { return c.toString(16).padStart(2, '0'); }).join('');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'template-color-btn' + (selectedTemplateColor === colorId ? ' active' : '');
    btn.dataset.color = colorId;
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.35rem;padding:0.6rem 1rem;border-radius:10px;border:2px solid ' + (selectedTemplateColor === colorId ? hex : 'var(--color-border)') + ';background:var(--color-card);cursor:pointer;transition:all 0.2s;min-width:70px;';

    btn.innerHTML = '<div style="width:32px;height:32px;border-radius:50%;background:' + hex + ';border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);"></div><span style="font-size:0.7rem;font-weight:600;color:var(--color-text-primary);">' + color.name + '</span>';

    btn.addEventListener('click', function() {
      selectedTemplateColor = colorId;
      // Update all buttons styling
      container.querySelectorAll('.template-color-btn').forEach(function(b) {
        const cid = b.dataset.color;
        const c = TEMPLATE_COLORS[cid];
        const h = '#' + c.primary.map(function(x) { return x.toString(16).padStart(2, '0'); }).join('');
        b.style.borderColor = selectedTemplateColor === cid ? h : 'var(--color-border)';
        b.className = 'template-color-btn' + (selectedTemplateColor === cid ? ' active' : '');
      });
    });

    btn.addEventListener('mouseenter', function() {
      if (selectedTemplateColor !== colorId) {
        btn.style.borderColor = hex;
        btn.style.transform = 'scale(1.05)';
      }
    });
    btn.addEventListener('mouseleave', function() {
      if (selectedTemplateColor !== colorId) {
        btn.style.borderColor = 'var(--color-border)';
        btn.style.transform = 'scale(1)';
      }
    });

    container.appendChild(btn);
  });
}

function setupTemplateColorPicker() {
  const btnSave = document.getElementById('btn-save-template-color');
  if (btnSave) {
    btnSave.addEventListener('click', async function() {
      try {
        await setDoc(doc(db, 'companies', currentUser.uid), {
          templateColor: selectedTemplateColor,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        const colorName = TEMPLATE_COLORS[selectedTemplateColor]?.name || 'Azul';
        showToast('Color de plantilla "' + colorName + '" guardado correctamente');
      } catch (error) {
        console.error('Error saving template color:', error);
        showToast('Error al guardar color de plantilla', 'error');
      }
    });
  }
}

// ==========================================================
// BANK ACCOUNTS - Settings UI + PDF
// ==========================================================

function renderBankAccounts(accounts) {
  const container = document.getElementById('bank-accounts-container');
  if (!container) return;
  
  if (!accounts || accounts.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);font-size:0.85rem;padding:1rem;">No hay cuentas bancarias configuradas</p>';
    return;
  }
  
  container.innerHTML = accounts.map((acc, idx) => {
    const bankType = BANK_TYPES.find(b => b.id === acc.bankId) || BANK_TYPES[5];
    const accountTypeOptions = ['Cuenta Corriente', 'Cuenta de Ahorros', 'Cuenta Interbank', 'Cuenta DNI', 'Cuenta Celular'];
    const isDigital = acc.bankId === 'yape' || acc.bankId === 'plin';
    const typeLabel = isDigital ? '' : acc.accountType || '';
    
    return `
      <div class="bank-account-entry bank-${acc.bankId || 'other'}" data-bank-idx="${idx}">
        <div class="bank-header">
          <h4><span class="bank-logo">${bankType.logo}</span> ${bankType.label}${typeLabel ? ' - ' + typeLabel : ''}</h4>
          <button class="btn-remove-bank" onclick="removeBankAccount(${idx})" title="Eliminar cuenta">✕</button>
        </div>
        <div class="bank-fields">
          <div class="form-group">
            <label class="form-label">Banco</label>
            <select class="form-input form-select bank-type-select" data-idx="${idx}">
              ${BANK_TYPES.map(bt => `<option value="${bt.id}" ${bt.id === acc.bankId ? 'selected' : ''}>${bt.label}</option>`).join('')}
            </select>
          </div>
          ${!isDigital ? `
          <div class="form-group">
            <label class="form-label">Tipo de Cuenta</label>
            <select class="form-input form-select bank-account-type" data-idx="${idx}">
              <option value="">Seleccionar...</option>
              ${accountTypeOptions.map(t => `<option value="${t}" ${t === acc.accountType ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>` : ''}
          <div class="form-group">
            <label class="form-label">${isDigital ? 'Número de ${bankType.label}' : 'Número de Cuenta'}</label>
            <input type="text" class="form-input bank-number" data-idx="${idx}" value="${acc.number || ''}" placeholder="${bankType.placeholder}">
          </div>
          <div class="form-group">
            <label class="form-label">Titular (opcional)</label>
            <input type="text" class="form-input bank-holder" data-idx="${idx}" value="${acc.holder || ''}" placeholder="Nombre del titular">
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add change listeners for bank type select
  container.querySelectorAll('.bank-type-select').forEach(sel => {
    sel.addEventListener('change', () => {
      // Re-render with updated bank type
      collectAndSaveBankAccounts(false);
    });
  });
}

window.removeBankAccount = function(idx) {
  const container = document.getElementById('bank-accounts-container');
  const entries = container.querySelectorAll('.bank-account-entry');
  if (entries[idx]) {
    entries[idx].remove();
  }
};

function setupBankAccounts() {
  const btnAddBank = document.getElementById('btn-add-bank');
  if (btnAddBank) {
    btnAddBank.addEventListener('click', () => {
      const accounts = collectBankAccountsFromUI();
      accounts.push({ bankId: 'bcp', name: 'BCP', accountType: '', number: '', holder: '' });
      renderBankAccounts(accounts);
    });
  }
  
  const btnSaveBanks = document.getElementById('btn-save-banks');
  if (btnSaveBanks) {
    btnSaveBanks.addEventListener('click', () => {
      collectAndSaveBankAccounts(true);
    });
  }
}

function collectBankAccountsFromUI() {
  const container = document.getElementById('bank-accounts-container');
  if (!container) return [];
  
  const accounts = [];
  container.querySelectorAll('.bank-account-entry').forEach(entry => {
    const bankId = entry.querySelector('.bank-type-select')?.value || 'other';
    const bankType = BANK_TYPES.find(b => b.id === bankId) || BANK_TYPES[5];
    const accountType = entry.querySelector('.bank-account-type')?.value || '';
    const number = entry.querySelector('.bank-number')?.value?.trim() || '';
    const holder = entry.querySelector('.bank-holder')?.value?.trim() || '';
    
    if (number) {
      accounts.push({
        bankId,
        name: bankType.name,
        label: bankType.label,
        accountType,
        number,
        holder
      });
    }
  });
  
  return accounts;
}

async function collectAndSaveBankAccounts(showToastMsg) {
  const accounts = collectBankAccountsFromUI();
  try {
    await setDoc(doc(db, 'companies', currentUser.uid), {
      bankAccounts: accounts,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    if (showToastMsg) showToast('Cuentas bancarias guardadas');
  } catch (error) {
    console.error('Error saving bank accounts:', error);
    if (showToastMsg) showToast('Error al guardar cuentas bancarias', 'error');
  }
}

// ==========================================================
// PDF PREVIEW + SHAREABLE LINK
// ==========================================================

window.previewQuote = async function(id) {
  try {
    showToast('Generando vista previa...', 'info');

    const quoteDoc = await getDoc(doc(db, 'quotes', id));
    if (!quoteDoc.exists()) {
      showToast('Cotización no encontrada', 'error');
      return;
    }

    const quote = quoteDoc.data();
    if (quote.userId !== currentUser.uid) {
      showToast('No tienes permiso', 'error');
      return;
    }

    const companySnap = await getDoc(doc(db, 'companies', currentUser.uid));
    if (!companySnap.exists()) {
      showToast('Configura tu empresa primero', 'error');
      return;
    }

    const company = companySnap.data();
    const clientName = quote.client?.name || 'Sin nombre';
    const clientDoc = quote.client?.document || '';

    // For demo accounts: fill missing dates with reasonable values
    let prevIssue = quote.issueDate;
    let prevDue = quote.dueDate;
    if (isDemoAccount() && (!prevIssue || !prevDue)) {
      const created = new Date(quote.createdAt);
      const cDate = isNaN(created.getTime()) ? new Date(2025, 5, 15) : created;
      prevIssue = prevIssue || cDate.toISOString().split('T')[0];
      const dDate = new Date(cDate);
      dDate.setDate(dDate.getDate() + 15);
      prevDue = prevDue || dDate.toISOString().split('T')[0];
    }

    const { pdf } = await renderPDF(
      company, clientName, quote.items || [],
      quote.number || 0, prevIssue, prevDue,
      quote.subtotal || 0, quote.igv || 0, quote.total || 0,
      quote.igvEnabled, quote.igvType || 'apart',
      quote.documentType || 'cotizacion', clientDoc
    );

    currentPreviewQuoteId = id;
    currentPreviewBlob = pdf.output('blob');
    
    // Use data URL for better browser compatibility
    const dataUrl = pdf.output('datauristring');
    const iframe = document.getElementById('pdf-preview-iframe');
    if (iframe) {
      iframe.src = dataUrl;
    }
    
    document.getElementById('modal-pdf-preview').classList.remove('hidden');
  } catch (error) {
    console.error('Preview error:', error);
    showToast('Error al generar vista previa', 'error');
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
    const clientDoc = quote.client?.document || '';

    // For demo accounts: fill missing dates with reasonable values
    let dlIssue = quote.issueDate;
    let dlDue = quote.dueDate;
    if (isDemoAccount() && (!dlIssue || !dlDue)) {
      const created = new Date(quote.createdAt);
      const cDate = isNaN(created.getTime()) ? new Date(2025, 5, 15) : created;
      dlIssue = dlIssue || cDate.toISOString().split('T')[0];
      const dDate = new Date(cDate);
      dDate.setDate(dDate.getDate() + 15);
      dlDue = dlDue || dDate.toISOString().split('T')[0];
    }

    // Use centralized PDF renderer
    const { pdf } = await renderPDF(
      company, clientName, quote.items || [],
      quote.number || 0, dlIssue, dlDue,
      quote.subtotal || 0, quote.igv || 0, quote.total || 0,
      quote.igvEnabled, quote.igvType || 'apart',
      quote.documentType || 'cotizacion', clientDoc
    );

    pdf.save(`${(company.name || 'Cotizacion').replace(/[^a-zA-Z0-9\s]/g, '').trim()}-${String(quote.number || 0).padStart(3, '0')}.pdf`);
    showToast('¡PDF descargado!');
  } catch (error) {
    console.error('Download error:', error);
    showToast('Error al generar PDF', 'error');
  }
};

// Share service API base URL (configurable for production deployment)
// Local dev: uses the gateway proxy with XTransformPort
// Production: point to your deployed share service URL
const SHARE_SERVICE_URL = '/api/share';

// Generate shareable link for a quote
window.generateShareLink = async function(id) {
  try {
    showToast('Generando enlace compartible...', 'info');

    const quoteDoc = await getDoc(doc(db, 'quotes', id));
    if (!quoteDoc.exists()) {
      showToast('Cotización no encontrada', 'error');
      return;
    }

    const quote = quoteDoc.data();
    if (quote.userId !== currentUser.uid) {
      showToast('No tienes permiso', 'error');
      return;
    }

    const companySnap = await getDoc(doc(db, 'companies', currentUser.uid));
    if (!companySnap.exists()) {
      showToast('Configura tu empresa primero', 'error');
      return;
    }

    const company = companySnap.data();
    const clientName = quote.client?.name || 'Sin nombre';

    // For demo accounts: fill missing dates with reasonable values
    let shareIssueDate = quote.issueDate;
    let shareDueDate = quote.dueDate;
    if (isDemoAccount() && (!shareIssueDate || !shareDueDate)) {
      const created = new Date(quote.createdAt);
      const cDate = isNaN(created.getTime()) ? new Date(2025, 5, 15) : created;
      shareIssueDate = shareIssueDate || cDate.toISOString().split('T')[0];
      const dDate = new Date(cDate);
      dDate.setDate(dDate.getDate() + 15);
      shareDueDate = shareDueDate || dDate.toISOString().split('T')[0];
    }

    // Build company slug and quote number for clean URL
    const companySlug = (company.name || 'Empresa').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '-');
    const quoteNum = String(quote.number || 0).padStart(3, '0');
    const shareId = `${companySlug}_${quoteNum}`;

    // Build the shared data payload
    const sharedData = {
      id: shareId,
      userId: currentUser.uid,
      clientName,
      clientDocument: quote.client?.document || '',
      clientEmail: quote.client?.email || '',
      clientPhone: quote.client?.phone || '',
      clientAddress: quote.client?.address || '',
      quoteNumber: quote.number || 0,
      documentType: quote.documentType || 'cotizacion',
      items: quote.items || [],
      issueDate: shareIssueDate || '',
      dueDate: shareDueDate || '',
      subtotal: quote.subtotal || 0,
      igv: quote.igv || 0,
      total: quote.total || 0,
      igvEnabled: quote.igvEnabled || false,
      igvType: quote.igvType || 'apart',
      company: {
        name: company.name || '',
        ruc: company.ruc || '',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
        paymentCondition: company.paymentCondition || DEFAULT_PAYMENT_CONDITION,
        clauses: company.clauses || DEFAULT_CLAUSES,
        bankAccounts: company.bankAccounts || [],
        templateColor: company.templateColor || 'blue'
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    };

    var shareUrl = '';
    var cleanUrlUsed = false;

    // Strategy 1: Share Service API (preferred - clean URL)
    try {
      const apiUrl = `${SHARE_SERVICE_URL}?XTransformPort=3020`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sharedData)
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Clean URL: company name + quote number
          const companyName = (company.name || 'Empresa').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
          const paddedNum = String(quote.number || 0).padStart(3, '0');
          shareUrl = `${window.location.origin}/view.html?c=${encodeURIComponent(companyName)}&n=${encodeURIComponent(paddedNum)}`;
          cleanUrlUsed = true;
        }
      }
    } catch (apiError) {
      console.warn('Share service unavailable, trying Firestore...', apiError.message);
    }

    // Strategy 2: Firestore direct write (fallback)
    if (!shareUrl) {
      try {
        await setDoc(doc(db, 'shared_quotes', shareId), sharedData);
        const companyName = (company.name || 'Empresa').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
        const paddedNum = String(quote.number || 0).padStart(3, '0');
        shareUrl = `${window.location.origin}/view.html?c=${encodeURIComponent(companyName)}&n=${encodeURIComponent(paddedNum)}`;
        cleanUrlUsed = true;
      } catch (firestoreError) {
        console.warn('Firestore share failed, using compact URL fallback:', firestoreError.message);
      }
    }

    // Strategy 3: Compact base64 URL fallback (always works)
    if (!shareUrl) {
      const sharePayload = {
        n: quote.number || 0,
        dt: quote.documentType || 'cotizacion',
        cn: clientName,
        cd: quote.client?.document || '',
        items: (quote.items || []).map(i => ({ q: i.quantity, p: i.unitPrice, d: i.description })),
        id: shareIssueDate || '',
        dd: shareDueDate || '',
        s: quote.subtotal || 0,
        i: quote.igv || 0,
        t: quote.total || 0,
        ie: quote.igvEnabled || false,
        it: quote.igvType || 'apart',
        co: {
          n: company.name || '',
          r: company.ruc || '',
          a: company.address || '',
          ph: company.phone || '',
          e: company.email || '',
          pc: company.paymentCondition || DEFAULT_PAYMENT_CONDITION,
          cl: company.clauses || DEFAULT_CLAUSES,
          ba: (company.bankAccounts || []).map(b => ({ n: b.name, t: b.accountType, h: b.holder, num: b.number })),
          tc: company.templateColor || 'blue'
        }
      };
      const jsonStr = JSON.stringify(sharePayload);
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      shareUrl = `${window.location.origin}/view.html#data=${encoded}`;
    }

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(cleanUrlUsed ? '✅ Enlace limpio copiado' : '✅ Enlace copiado al portapapeles');
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast(cleanUrlUsed ? '✅ Enlace limpio copiado' : '✅ Enlace copiado al portapapeles');
    }
  } catch (error) {
    console.error('Share error:', error);
    showToast('Error al generar enlace: ' + error.message, 'error');
  }
};

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

// Convert total to written Spanish text for PDF
function totalToWrittenText(amount) {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);
  
  let text = 'Son: ' + numberToWords(integerPart);
  
  if (integerPart === 1) {
    text += ' Sol';
  } else {
    text += ' Soles';
  }
  
  if (decimalPart > 0) {
    text += ' con ' + decimalPart.toString().padStart(2, '0') + '/100';
  }
  
  return text;
}

// Color presets for PDF templates
const TEMPLATE_COLORS = {
  blue:   { primary: [30, 64, 175],    light: [240, 244, 255], name: 'Azul',   icon: '🔵' },
  red:    { primary: [185, 28, 28],    light: [254, 242, 242], name: 'Rojo',   icon: '🔴' },
  black:  { primary: [24, 24, 27],     light: [244, 244, 245], name: 'Negro',  icon: '⚫' },
  green:  { primary: [21, 128, 61],    light: [240, 253, 244], name: 'Verde',  icon: '🟢' },
  purple: { primary: [109, 40, 217],   light: [245, 243, 255], name: 'Morado', icon: '🟣' },
  orange: { primary: [194, 65, 12],    light: [255, 247, 237], name: 'Naranja', icon: '🟠' }
};

function getTemplateColor(colorId) {
  return TEMPLATE_COLORS[colorId] || TEMPLATE_COLORS.blue;
}

function updateRemainingQuotes() {
  const quota = getPlanQuota(userData.plan);
  const used = userData.quotesUsedThisMonth || 0;
  const remaining = quota === -1 ? -1 : quota - used;
  const remainingEl = document.getElementById('stat-remaining-quotes');
  if (remainingEl) {
    remainingEl.textContent = remaining === -1 ? '∞' : remaining;
    remainingEl.style.color = (remaining >= 0 && remaining <= 1) ? 'var(--color-error, #ef4444)' : 'var(--color-primary)';
  }
  const planRemainingCount = document.getElementById('plan-remaining-count');
  if (planRemainingCount) {
    planRemainingCount.textContent = remaining === -1 ? '∞' : remaining;
    planRemainingCount.style.color = (remaining >= 0 && remaining <= 1) ? 'var(--color-error, #ef4444)' : 'var(--color-primary)';
  }
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

function formatNumberWithCommas(n) {
  const parts = (n || 0).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function formatCurrency(amount) {
  return `S/ ${formatNumberWithCommas(amount)}`;
}

function formatDateShort(date) {
  if (!date || isNaN(new Date(date).getTime())) {
    if (isDemoAccount()) return '15 jun 2025';
    return '—';
  }
  return new Date(date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
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

window.showUpgradeModal = function() {
  document.getElementById('modal-upgrade').classList.remove('hidden');
};

// Plan data with full benefits for WhatsApp message
const PLAN_WHATSAPP_DATA = {
  basic: {
    name: 'Plan Básico',
    price: 'S/ 35/mes',
    benefits: [
      '60 cotizaciones por mes',
      '1 empresa registrada',
      'Tipos de documento básicos (Cotización)',
      'Clientes guardados automáticamente',
      'Soporte por WhatsApp'
    ]
  },
  business: {
    name: 'Plan Business',
    price: 'S/ 59/mes',
    benefits: [
      '200 cotizaciones por mes',
      '3 empresas registradas',
      'Todos los tipos de documento (Cotización, Factura, Boleta, Nota de Venta)',
      'Soporte prioritario',
      'Clientes guardados automáticamente',
      'Descarga de PDF profesional'
    ]
  },
  pro: {
    name: 'Plan Pro',
    price: 'S/ 99/mes',
    benefits: [
      'Cotizaciones ilimitadas',
      '5 empresas registradas',
      'Todos los tipos de documento',
      'Soporte dedicado',
      'Personalización de cláusulas y documentos',
      'Clientes ilimitados',
      'Descarga de PDF profesional',
      'Acceso anticipado a nuevas funciones'
    ]
  }
};

window.selectPlan = function(plan) {
  const planDetails = {
    basic: {
      name: 'Básico',
      price: 'S/ 35/mes',
      features: [
        '60 cotizaciones al mes',
        '1 empresa',
        '50 clientes',
        'Cotización profesional',
        'PDF profesional con logo',
        'Historial ilimitado',
        '3 cuentas bancarias',
        'Soporte prioritario'
      ]
    },
    business: {
      name: 'Business',
      price: 'S/ 59/mes',
      features: [
        '200 documentos al mes',
        '3 empresas',
        '200 clientes',
        '4 tipos de documentos (Cotización, Propuesta, Nota de Venta, Orden de Servicio)',
        'PDF premium con branding',
        'Historial ilimitado',
        '10 cuentas bancarias',
        'Duplicar documentos',
        'Exportar/Importar Excel',
        'Marca personalizada',
        'Soporte prioritario 24/7'
      ]
    },
    pro: {
      name: 'Pro',
      price: 'S/ 99/mes',
      features: [
        'Documentos ILIMITADOS',
        '5 empresas',
        'Clientes ILIMITADOS',
        '10 tipos de documentos + personalizados',
        'PDF enterprise personalizado',
        'Cuentas bancarias ilimitadas',
        'Multi-usuario (hasta 5)',
        'API REST access',
        'Marca de agua personalizada',
        'Reportes avanzados',
        'Soporte VIP 24/7',
        'Integraciones personalizadas'
      ]
    }
  };

  const selected = planDetails[plan];
  if (!selected) return;

  const featuresText = selected.features.map((f, i) => `${i + 1}. ${f}`).join('\n');
  const message = `¡Hola! Me interesa activar el plan *${selected.name}* de CotizaPro (${selected.price}).\n\n📋 *Beneficios del plan ${selected.name}:*\n${featuresText}\n\nMi correo: ${currentUser?.email || 'No especificado'}\n\n¡Gracias!`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/51933667414?text=${encodedMessage}`;

  window.open(whatsappUrl, '_blank');
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

// ==========================================================
// FINANCES - Ingresos y Gastos
// ==========================================================

const EXPENSE_CATEGORIES = {
  materiales: { icon: '🧱', label: 'Materiales' },
  servicios: { icon: '🔧', label: 'Servicios' },
  transporte: { icon: '🚗', label: 'Transporte' },
  alimentacion: { icon: '🍔', label: 'Alimentación' },
  alquiler: { icon: '🏠', label: 'Alquiler' },
  software: { icon: '💻', label: 'Software' },
  marketing: { icon: '📢', label: 'Marketing' },
  impuestos: { icon: '🧾', label: 'Impuestos' },
  salarios: { icon: '👥', label: 'Salarios' },
  otros: { icon: '📦', label: 'Otros' }
};

// Toggle approve/unapprove a quote (registers as income)
window.toggleApproveQuote = async function(quoteId) {
  try {
    const quoteDoc = await getDoc(doc(db, 'quotes', quoteId));
    if (!quoteDoc.exists()) {
      showToast('Cotización no encontrada', 'error');
      return;
    }

    const quote = quoteDoc.data();
    const newApproved = !quote.approved;

    await updateDoc(doc(db, 'quotes', quoteId), {
      approved: newApproved,
      approvedAt: newApproved ? new Date().toISOString() : null
    });

    showToast(newApproved ? '✅ Cotización aprobada - Registrada como ingreso' : '❌ Cotización desaprobada');
    loadHistory();
  } catch (error) {
    console.error('Error toggling approval:', error);
    showToast('Error al cambiar estado: ' + error.message, 'error');
  }
};

// Load all finances data
async function loadFinances() {
  try {
    // Set default date for expense form
    const dateInput = document.getElementById('expense-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Load approved quotes and expenses in parallel
    const [quotes, expenses] = await Promise.all([
      getUserQuotes(),
      getUserExpenses()
    ]);

    const approvedQuotes = quotes.filter(q => q.approved === true && !q.isDemo);
    const totalIncome = approvedQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalIncome - totalExpenses;
    const profitPercent = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

    // Update summary cards
    document.getElementById('finance-total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('finance-income-count').textContent = `${approvedQuotes.length} cotización${approvedQuotes.length !== 1 ? 'es' : ''} aprobada${approvedQuotes.length !== 1 ? 's' : ''}`;
    document.getElementById('finance-total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('finance-expense-count').textContent = `${expenses.length} gasto${expenses.length !== 1 ? 's' : ''} registrado${expenses.length !== 1 ? 's' : ''}`;
    document.getElementById('finance-net-profit').textContent = formatCurrency(netProfit);
    document.getElementById('finance-profit-percent').textContent = `${profitPercent}% margen`;

    // Render approved quotes list
    renderApprovedQuotes(approvedQuotes);

    // Render expenses list
    renderExpensesList(expenses);

    // Render weekly summary
    renderWeeklySummary(approvedQuotes, expenses);

  } catch (error) {
    console.error('Error loading finances:', error);
    showToast('Error al cargar finanzas', 'error');
  }
}

// Get all user expenses from Firestore
async function getUserExpenses() {
  try {
    const q = query(collection(db, 'expenses'), where('userId', '==', currentUser.uid), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const expenses = [];
    snapshot.forEach(docSnap => expenses.push({ id: docSnap.id, ...docSnap.data() }));
    return expenses;
  } catch (error) {
    console.error('Error fetching expenses:', error);
    if (error.code === 'failed-precondition') {
      showToast('Crea el índice en Firebase Console (userId + date)', 'error');
    }
    return [];
  }
}

// Render approved quotes in finance section
function renderApprovedQuotes(approvedQuotes) {
  const container = document.getElementById('finance-approved-list');

  if (approvedQuotes.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:1.5rem;">
        <p style="color:var(--color-text-muted);font-size:0.85rem;">No hay cotizaciones aprobadas aún</p>
      </div>`;
    return;
  }

  container.innerHTML = approvedQuotes.map(q => {
    const num = typeof q.number === 'number' ? String(q.number).padStart(3, '0') : (q.number || 'N/A');
    const date = q.approvedAt ? formatDateShort(new Date(q.approvedAt)) : formatDateShort(new Date(q.createdAt));

    return `
      <div class="finance-approved-item">
        <div class="finance-approved-left">
          <div class="finance-approved-check">✓</div>
          <div class="finance-approved-info">
            <div class="finance-approved-name">#${num} - ${q.client?.name || 'Sin cliente'}</div>
            <div class="finance-approved-date">${date}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;">
          <span class="finance-approved-amount">+${formatCurrency(q.total)}</span>
          <button class="finance-approved-unapprove" onclick="window.toggleApproveQuote('${q.id}')" title="Desaprobar">✕</button>
        </div>
      </div>`;
  }).join('');
}

// Render expenses list
function renderExpensesList(expenses) {
  const container = document.getElementById('finance-expenses-list');

  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:1.5rem;">
        <p style="color:var(--color-text-muted);font-size:0.85rem;">No hay gastos registrados aún</p>
      </div>`;
    return;
  }

  container.innerHTML = expenses.map(e => {
    const cat = EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.otros;
    const dateStr = e.date ? formatDateShort(new Date(e.date)) : 'Sin fecha';

    return `
      <div class="finance-expense-item">
        <div class="finance-expense-left">
          <div class="finance-expense-category">${cat.icon}</div>
          <div class="finance-expense-info">
            <div class="finance-expense-desc">${e.description || 'Sin descripción'}</div>
            <div class="finance-expense-meta">${cat.label} · ${dateStr}</div>
          </div>
        </div>
        <div class="finance-expense-right">
          <span class="finance-expense-amount">-${formatCurrency(e.amount)}</span>
          <button class="finance-expense-delete" onclick="window.deleteExpense('${e.id}')" title="Eliminar gasto">✕</button>
        </div>
      </div>`;
  }).join('');
}

// Render weekly summary
function renderWeeklySummary(approvedQuotes, expenses) {
  const container = document.getElementById('finance-weekly-summary');

  if (approvedQuotes.length === 0 && expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:1.5rem;">
        <p style="color:var(--color-text-muted);font-size:0.85rem;">No hay datos suficientes para generar resumen semanal</p>
      </div>`;
    return;
  }

  // Group data by week
  const weeklyData = {};

  // Add approved quotes to weeks
  approvedQuotes.forEach(q => {
    const date = q.approvedAt ? new Date(q.approvedAt) : new Date(q.createdAt);
    const weekKey = getWeekKey(date);
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { income: 0, expenses: 0, label: getWeekLabel(date) };
    }
    weeklyData[weekKey].income += (q.total || 0);
  });

  // Add expenses to weeks
  expenses.forEach(e => {
    const date = e.date ? new Date(e.date) : new Date(e.createdAt);
    const weekKey = getWeekKey(date);
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { income: 0, expenses: 0, label: getWeekLabel(date) };
    }
    weeklyData[weekKey].expenses += (e.amount || 0);
  });

  // Sort weeks descending
  const sortedWeeks = Object.keys(weeklyData).sort((a, b) => b.localeCompare(a));

  let totalIncome = 0, totalExpenses = 0, totalProfit = 0;

  const rows = sortedWeeks.map(weekKey => {
    const week = weeklyData[weekKey];
    const profit = week.income - week.expenses;
    totalIncome += week.income;
    totalExpenses += week.expenses;
    totalProfit += profit;
    const profitClass = profit >= 0 ? 'finance-weekly-profit-positive' : 'finance-weekly-profit-negative';

    return `
      <tr>
        <td>${week.label}</td>
        <td style="color:#059669;">+${formatCurrency(week.income)}</td>
        <td style="color:#dc2626;">-${formatCurrency(week.expenses)}</td>
        <td class="${profitClass}">${profit >= 0 ? '+' : ''}${formatCurrency(profit)}</td>
      </tr>`;
  }).join('');

  const totalProfitClass = totalProfit >= 0 ? 'finance-weekly-profit-positive' : 'finance-weekly-profit-negative';

  container.innerHTML = `
    <table class="finance-weekly-table">
      <thead>
        <tr>
          <th>Semana</th>
          <th>Ingresos</th>
          <th>Gastos</th>
          <th>Ganancia</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="border-top:2px solid var(--color-primary, #1e40af);font-weight:700;">
          <td style="font-weight:700;">TOTAL</td>
          <td style="color:#059669;font-weight:700;">+${formatCurrency(totalIncome)}</td>
          <td style="color:#dc2626;font-weight:700;">-${formatCurrency(totalExpenses)}</td>
          <td class="${totalProfitClass}" style="font-size:0.95rem;">${totalProfit >= 0 ? '+' : ''}${formatCurrency(totalProfit)}</td>
        </tr>
      </tbody>
    </table>`;
}

// Get week key (ISO week number + year)
function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday of current week decides the year
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Get human-readable week label
function getWeekLabel(date) {
  const d = new Date(date);
  // Get Monday of this week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const opts = { day: '2-digit', month: 'short' };
  return `${monday.toLocaleDateString('es-PE', opts)} - ${sunday.toLocaleDateString('es-PE', opts)}`;
}

// Add new expense
window.addExpense = async function(expenseData) {
  try {
    await addDoc(collection(db, 'expenses'), {
      ...expenseData,
      userId: currentUser.uid,
      createdAt: new Date().toISOString()
    });
    showToast('Gasto registrado correctamente');
    return true;
  } catch (error) {
    console.error('Error adding expense:', error);
    showToast('Error al registrar gasto: ' + error.message, 'error');
    return false;
  }
};

// Delete expense
window.deleteExpense = async function(expenseId) {
  if (!confirm('¿Eliminar este gasto?')) return;
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
    showToast('Gasto eliminado');
    loadFinances();
  } catch (error) {
    console.error('Error deleting expense:', error);
    showToast('Error al eliminar gasto', 'error');
  }
};

// Setup expense form
function setupExpenseForm() {
  const form = document.getElementById('form-add-expense');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const description = document.getElementById('expense-description').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const category = document.getElementById('expense-category').value;
    const date = document.getElementById('expense-date').value;

    if (!description) {
      showToast('Ingresa la descripción del gasto', 'error');
      return;
    }

    if (!amount || amount <= 0) {
      showToast('Ingresa un monto válido', 'error');
      return;
    }

    const success = await window.addExpense({
      description,
      amount,
      category,
      date: date || new Date().toISOString().split('T')[0]
    });

    if (success) {
      form.reset();
      const dateInput = document.getElementById('expense-date');
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      loadFinances();
    }
  });
}

window.logout = logout;

// ==========================================================
// PWA INSTALL STATUS CHECK (UI only - install prompt handled in HTML inline script)
// ==========================================================

let isCompanyConfigured = false;

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
  // Install prompt is handled by inline script in app.html
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
  setupExpenseForm();
  
  // PDF Preview modal handlers
  const btnDownloadFromPreview = document.getElementById('btn-download-from-preview');
  if (btnDownloadFromPreview) {
    btnDownloadFromPreview.addEventListener('click', () => {
      if (currentPreviewBlob) {
        const url = URL.createObjectURL(currentPreviewBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Cotizacion-${String(Date.now()).padStart(3, '0')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (currentPreviewQuoteId) {
        window.downloadQuote(currentPreviewQuoteId);
      }
    });
  }
  
  const btnCopyLink = document.getElementById('btn-copy-link');
  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
      if (currentPreviewQuoteId) {
        window.generateShareLink(currentPreviewQuoteId);
      }
    });
  }
};

protectRoute(true);
