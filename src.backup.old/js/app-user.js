// App User Logic - SDK Modular v10+

import { auth, db, PLANS, DOCUMENT_TYPES, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from '../firebase-config.js';
import { protectRoute, logout } from './auth.js';

let currentUser = null;
let userData = null;
let quoteItems = [];
let currentWizardStep = 1;
let isGeneratingPDF = false;

// ==========================================================
// LOCAL STORAGE FALLBACK - Cuando Firestore falla por permisos
// ==========================================================

function getLocalStorageKey(collection) {
  return `cotizapro_${currentUser?.uid || 'anon'}_${collection}`;
}

function saveToLocal(collection, data) {
  try {
    const key = getLocalStorageKey(collection);
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    if (data.id) {
      const idx = existing.findIndex(item => item.id === data.id);
      if (idx >= 0) existing[idx] = data;
      else existing.unshift(data);
    } else {
      existing.unshift(data);
    }
    localStorage.setItem(key, JSON.stringify(existing));
    return data;
  } catch (e) {
    console.error('localStorage save error:', e);
    return null;
  }
}

function loadFromLocal(collection) {
  try {
    return JSON.parse(localStorage.getItem(getLocalStorageKey(collection)) || '[]');
  } catch (e) {
    return [];
  }
}

function deleteFromLocal(collection, docId) {
  try {
    const key = getLocalStorageKey(collection);
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = existing.filter(item => item.id !== docId);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    console.error('localStorage delete error:', e);
  }
}

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

  // Mostrar cotizaciones restantes reales en Dashboard
  const quota = getPlanQuota(userData.plan);
  const used = userData.quotesUsedThisMonth || 0;
  const remaining = quota === -1 ? -1 : quota - used;
  const remainingEl = document.getElementById('stat-remaining-quotes');
  if (remainingEl) {
    remainingEl.textContent = remaining === -1 ? '∞' : remaining;
    remainingEl.style.color = (remaining >= 0 && remaining <= 1) ? 'var(--color-error, #ef4444)' : 'var(--color-primary)';
  }

  // Mostrar cotizaciones restantes en Configuración
  const planRemainingCount = document.getElementById('plan-remaining-count');
  if (planRemainingCount) {
    planRemainingCount.textContent = remaining === -1 ? '∞' : remaining;
    planRemainingCount.style.color = (remaining >= 0 && remaining <= 1) ? 'var(--color-error, #ef4444)' : 'var(--color-primary)';
  }

  // Show plan banner for ALL plans with remaining count
  if (userData.plan === 'free') {
    document.getElementById('plan-banner').classList.remove('hidden');
    if (remaining > 0) {
      document.getElementById('plan-banner-text').textContent = `Te quedan ${remaining} cotización${remaining !== 1 ? 'es' : ''} gratis este mes`;
    } else {
      document.getElementById('plan-banner-text').textContent = `¡Agotaste tus ${quota} cotizaciones gratis este mes!`;
    }
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
  quoteItems.push({ id: itemId, quantity: 1, unitPrice: 0, description: '', isOptional: false, optionalPrice: 0 });
  const container = document.getElementById('items-container');
  const html = `
    <div class="item-card" data-item-id="${itemId}">
      <div class="item-header">
        <span class="item-number">Item ${quoteItems.length}</span>
        <label class="optional-toggle" title="Marcar como producto/servicio opcional">
          <input type="checkbox" class="item-optional-check" onchange="window.toggleOptional('${itemId}', this.checked)">
          <span class="optional-toggle-slider"></span>
          <span class="optional-toggle-label">⭐ Opcional</span>
        </label>
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
        <div class="item-optional-fields hidden" data-optional-fields="${itemId}">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">💰 Precio con opcional</label>
              <input type="number" class="form-input item-optional-price" value="0" min="0" step="0.01" inputmode="decimal" placeholder="Precio si el cliente incluye este opcional">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción del Producto/Servicio <span class="desc-hint">Puedes usar emojis para detallar mejor</span></label>
          <textarea class="form-input item-desc item-desc-textarea" rows="3" placeholder="Ej: 💻 Desarrollo de página web responsive\n   Incluye diseño, maquetación y programación\n   Entrega en 5 días hábiles"></textarea>
        </div>
        <div class="item-subtotal-row">
          <span class="item-subtotal-label">Subtotal:</span>
          <span class="item-subtotal">S/ 0.00</span>
          <span class="item-optional-badge hidden" data-optional-badge="${itemId}">⭐ +S/ 0.00 si incluye opcional</span>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);

  const card = container.querySelector(`[data-item-id="${itemId}"]`);
  card.querySelector('.item-qty').addEventListener('input', (e) => updateItem(itemId, 'quantity', parseFloat(e.target.value) || 0));
  card.querySelector('.item-price').addEventListener('input', (e) => updateItem(itemId, 'unitPrice', parseFloat(e.target.value) || 0));
  card.querySelector('.item-optional-price').addEventListener('input', (e) => updateItem(itemId, 'optionalPrice', parseFloat(e.target.value) || 0));
  card.querySelector('.item-desc').addEventListener('input', (e) => {
    updateItem(itemId, 'description', e.target.value);
    autoResizeTextarea(e.target);
  });
  // Auto-resize al cargar
  const textarea = card.querySelector('.item-desc-textarea');
  if (textarea) autoResizeTextarea(textarea);
}

// Toggle item optional status
window.toggleOptional = function(id, checked) {
  const item = quoteItems.find(i => i.id === id);
  if (!item) return;
  item.isOptional = checked;
  const card = document.querySelector(`[data-item-id="${id}"]`);
  const optFields = card.querySelector(`[data-optional-fields="${id}"]`);
  const optBadge = card.querySelector(`[data-optional-badge="${id}"]`);
  if (checked) {
    card.classList.add('item-card-optional');
    optFields.classList.remove('hidden');
    optBadge.classList.remove('hidden');
    if (!item.optionalPrice || item.optionalPrice <= item.unitPrice) {
      item.optionalPrice = (item.unitPrice || 0) + (item.unitPrice * 0.20);
      card.querySelector('.item-optional-price').value = item.optionalPrice.toFixed(2);
    }
  } else {
    card.classList.remove('item-card-optional');
    optFields.classList.add('hidden');
    optBadge.classList.add('hidden');
  }
  updateItemDisplay(id);
  updateSummary();
};

// Update individual item display
function updateItemDisplay(id) {
  const item = quoteItems.find(i => i.id === id);
  if (!item) return;
  const card = document.querySelector(`[data-item-id="${id}"]`);
  const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
  card.querySelector('.item-subtotal').textContent = formatCurrency(lineTotal);
  if (item.isOptional) {
    const optLineTotal = (item.quantity || 0) * (item.optionalPrice || 0);
    const diff = optLineTotal - lineTotal;
    card.querySelector(`[data-optional-badge="${id}"]`).textContent = `⭐ +S/ ${diff.toFixed(2)} si incluye opcional`;
  }
}

// Auto-resize textarea para que crezca con el contenido
function autoResizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(textarea.scrollHeight, 72) + 'px';
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
    updateItemDisplay(id);
    updateSummary();
  }
}

function updateSummary() {
  const igvEnabled = document.getElementById('igv-enabled')?.checked ?? true;
  const igvType = document.querySelector('input[name="igv-type"]:checked')?.value || 'apart';
  
  // Separar items base y opcionales
  let subtotalBase = 0;
  let subtotalOptional = 0;
  
  for (let idx = 0; idx < quoteItems.length; idx++) {
    const item = quoteItems[idx];
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
    if (item.isOptional) {
      subtotalBase += lineTotal;
      const optLineTotal = (item.quantity || 0) * (item.optionalPrice || 0);
      subtotalOptional += (optLineTotal - lineTotal);
    } else {
      subtotalBase += lineTotal;
    }
  }
  
  const subtotal = subtotalBase;
  const subtotalWithOptional = subtotalBase + subtotalOptional;
  const isIGVIncluded = igvEnabled && igvType === 'included';
  
  // Calcular IGV y totales
  let igv = 0;
  let total = 0;
  let igvFull = 0;
  let totalFull = 0;
  let displaySubtotal = subtotal;
  
  if (igvEnabled) {
    if (igvType === 'included') {
      // Cuando IGV esta incluido: total = subtotal (precio con IGV)
      // Mostrar base neta como subtotal, IGV desglosado, total = precio ingresado
      total = subtotal;
      igv = total - (total / 1.18);
      displaySubtotal = total / 1.18; // Base neta sin IGV
      totalFull = subtotalWithOptional;
      igvFull = totalFull - (totalFull / 1.18);
    } else {
      igv = subtotal * 0.18;
      total = subtotal + igv;
      igvFull = subtotalWithOptional * 0.18;
      totalFull = subtotalWithOptional + igvFull;
    }
  } else {
    total = subtotal;
    totalFull = subtotalWithOptional;
  }

  const hasOptional = quoteItems.some(i => i.isOptional);
  
  // Actualizar labels segun tipo IGV
  const subtotalLabel = document.getElementById('summary-subtotal').parentElement.querySelector('span:first-child');
  if (subtotalLabel) subtotalLabel.textContent = isIGVIncluded ? 'Subtotal (base):' : 'Subtotal:';
  const igvLabel = document.getElementById('summary-igv').parentElement.querySelector('span:first-child');
  if (igvLabel) igvLabel.textContent = isIGVIncluded ? 'IGV (18% incl.):' : 'IGV (18%):';
  
  document.getElementById('summary-subtotal').textContent = formatCurrency(displaySubtotal);
  document.getElementById('summary-igv').textContent = formatCurrency(igv);
  document.getElementById('summary-total').textContent = formatCurrency(total);
  
  // Mostrar/ocultar sección de opcionales
  const optSection = document.getElementById('summary-optional-section');
  const optRow = document.getElementById('summary-optional-row');
  const optTotalRow = document.getElementById('summary-optional-total-row');
  
  if (hasOptional) {
    if (optSection) optSection.classList.remove('hidden');
    if (optRow) {
      optRow.classList.remove('hidden');
      optRow.querySelector('#summary-optional-extra').textContent = formatCurrency(subtotalOptional);
    }
    if (optTotalRow) {
      optTotalRow.classList.remove('hidden');
      optTotalRow.querySelector('#summary-total-with-optional').textContent = formatCurrency(totalFull);
    }
  } else {
    if (optSection) optSection.classList.add('hidden');
    if (optRow) optRow.classList.add('hidden');
    if (optTotalRow) optTotalRow.classList.add('hidden');
  }
  
  const igvRow = document.getElementById('summary-igv-row');
  if (igvRow) igvRow.style.display = igvEnabled ? '' : 'none';
  
  const note = document.getElementById('summary-note');
  if (note) {
    if (hasOptional) {
      note.textContent = '⭐ Los items opcionales se agregan al total si el cliente los incluye';
      note.style.color = 'var(--color-warning)';
    } else if (!igvEnabled) {
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
  const clientEmail = document.getElementById('client-email').value;
  const clientPhone = document.getElementById('client-phone').value;
  const clientAddress = document.getElementById('client-address').value;
  
  const igvEnabled = document.getElementById('igv-enabled')?.checked ?? true;
  const igvType = document.querySelector('input[name="igv-type"]:checked')?.value || 'apart';
  
  // Calcular totales separando base y opcionales
  let subtotalBase = 0, subtotalOptional = 0;
  for (let idx = 0; idx < quoteItems.length; idx++) {
    const item = quoteItems[idx];
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
    if (item.isOptional) {
      subtotalBase += lineTotal;
      subtotalOptional += ((item.quantity || 0) * (item.optionalPrice || 0)) - lineTotal;
    } else {
      subtotalBase += lineTotal;
    }
  }
  const subtotal = subtotalBase;
  const subtotalWithOpt = subtotalBase + subtotalOptional;
  
  const isIGVIncluded = igvEnabled && igvType === 'included';
  let igv = 0, total = 0, totalFull = 0, displaySubtotal = subtotal;
  if (igvEnabled) {
    if (igvType === 'included') {
      total = subtotal;
      igv = total - (total / 1.18);
      displaySubtotal = total / 1.18;
      totalFull = subtotalWithOpt;
    } else {
      igv = subtotal * 0.18;
      total = subtotal + igv;
      totalFull = subtotalWithOpt * 1.18;
    }
  } else { total = subtotal; totalFull = subtotalWithOpt; }
  
  const hasOptional = quoteItems.some(i => i.isOptional);
  const formatDesc = (desc) => {
    if (!desc) return '<em style="color:var(--color-text-muted);">Sin descripción</em>';
    return desc.replace(/\n/g, '<br>');
  };

  document.getElementById('quote-review').innerHTML = `
    <div class="review-section"><div class="review-section-title">Cliente</div>
      <p><strong>${clientName}</strong></p>
      ${clientDoc ? `<p>RUC/DNI: ${clientDoc}</p>` : ''}
      ${clientEmail ? `<p>Email: ${clientEmail}</p>` : ''}
      ${clientPhone ? `<p>Tel: ${clientPhone}</p>` : ''}
      ${clientAddress ? `<p>Dirección: ${clientAddress}</p>` : ''}
    </div>
    <div class="review-section"><div class="review-section-title">Items (${quoteItems.length})</div>
      ${quoteItems.map(item => `
        <div class="review-item-full ${item.isOptional ? 'review-item-optional' : ''}">
          <div class="review-item-header">
            <span class="review-item-qty">${item.isOptional ? '⭐' : ''}${item.quantity}x</span>
            <span class="review-item-desc">${item.isOptional ? '<span class="optional-tag">OPCIONAL</span>' : ''}${formatDesc(item.description)}</span>
            <span class="review-item-price">${formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</span>
          </div>
          ${item.isOptional ? `<div class="review-optional-info">💰 Si incluye opcional: ${formatCurrency((item.quantity || 0) * (item.optionalPrice || 0))}</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div class="quote-summary">
      <div class="summary-row"><span>${isIGVIncluded ? 'Subtotal (base):' : 'Subtotal:'}</span><span>${formatCurrency(displaySubtotal)}</span></div>
      ${igvEnabled ? `<div class="summary-row"><span>${isIGVIncluded ? 'IGV (18% incl.):' : 'IGV (18%):'}</span><span>${formatCurrency(igv)}</span></div>` : ''}
      <div class="summary-row summary-total"><span>TOTAL:</span><span>${formatCurrency(total)}</span></div>
      ${hasOptional ? `
        <div class="summary-optional-divider"></div>
        <div class="summary-row summary-optional-row"><span>⭐ Extras opcionales:</span><span>${formatCurrency(subtotalOptional)}</span></div>
        <div class="summary-row summary-total summary-total-full"><span>TOTAL CON OPCIONALES:</span><span>${formatCurrency(totalFull)}</span></div>
      ` : ''}
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
    showToast('Error al guardar el cliente: ' + error.message, 'error');
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
    // Sincronizar con localStorage
    if (clients.length > 0) {
      try { localStorage.setItem(getLocalStorageKey('clients'), JSON.stringify(clients)); } catch(e) {}
    }
    if (clients.length === 0) {
      const localClients = loadFromLocal('clients');
      if (localClients.length > 0) return localClients;
    }
    return clients;
  } catch (error) {
    console.warn('Firestore clients no disponible, usando localStorage:', error.message);
    return loadFromLocal('clients');
  }
}

// ==========================================================
// PDF GENERATION - Centralized
// ==========================================================

// Load html2pdf.js for emoji support and professional PDF layout
async function loadPdfLib() {
  if (window.html2pdf) return;
  return new Promise((resolve, reject) => {
    const scriptTag = document.createElement('script');
    scriptTag.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
    const timeoutId = setTimeout(() => {
      reject(new Error('Tiempo de espera agotado al cargar la librería PDF. Verifica tu conexión a internet.'));
    }, 20000);
    scriptTag.onload = () => {
      clearTimeout(timeoutId);
      if (window.html2pdf) resolve();
      else reject(new Error('La librería PDF no se cargó correctamente. Intenta recargar la página.'));
    };
    scriptTag.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('Error al cargar la librería PDF. Verifica tu conexión a internet.'));
    };
    document.head.appendChild(scriptTag);
  });
}

// Centralized PDF renderer - uses html2pdf.js for emoji + professional layout
async function renderPDF(company, client, items, quoteNumber, issueDate, dueDate, subtotal, igvAmount, total, igvEnabled, igvType, documentType = 'cotizacion', fileName = 'documento.pdf') {
  await loadPdfLib();

  const docTypeInfo = DOCUMENT_TYPES[documentType] || DOCUMENT_TYPES.cotizacion;

  // Fix client data: support both string (legacy) and object
  const clientObj = typeof client === 'string' ? { name: client, document: '', email: '', phone: '', address: '' } : (client || {});
  const clientName = clientObj.name || 'Sin nombre';
  const clientDoc = clientObj.document || '';
  const clientEmail = clientObj.email || '';
  const clientPhone = clientObj.phone || '';
  const clientAddress = clientObj.address || '';

  // Calculate correct display values for IGV included
  const isIGVIncluded = igvEnabled && igvType === 'included';
  const displaySubtotal = isIGVIncluded ? total / 1.18 : subtotal;
  const displayIGV = isIGVIncluded ? total - (total / 1.18) : igvAmount;
  const displayTotal = total;

  // Calculate optional items
  let subtotalOptional = 0;
  items.forEach(item => {
    if (item.isOptional) {
      subtotalOptional += ((item.quantity || 0) * (item.optionalPrice || 0)) - ((item.quantity || 0) * (item.unitPrice || 0));
    }
  });
  const hasOptional = subtotalOptional > 0;
  const totalWithOptional = displayTotal + (hasOptional ? (igvEnabled && igvType === 'apart' ? subtotalOptional * 1.18 : subtotalOptional) : 0);

  // Build items HTML
  const itemsHTML = items.map((item, idx) => {
    const qty = item.quantity || 0;
    const price = item.unitPrice || 0;
    const lineTotal = qty * price;
    const isOpt = item.isOptional === true;
    const desc = (item.description || 'Sin descripción').replace(/\n/g, '<br>');
    const optPrice = isOpt ? (item.optionalPrice || 0) : 0;
    const optLineTotal = isOpt ? qty * optPrice : 0;
    const rowClass = isOpt ? 'row-optional' : idx % 2 === 0 ? 'row-even' : 'row-odd';

    return `
      <tr class="${rowClass}">
        <td style="text-align:center;padding:5px 4px;font-size:9px;width:28px;border:1px solid #e2e8f0;vertical-align:top;">${qty}</td>
        <td style="padding:5px 6px;font-size:9px;border:1px solid #e2e8f0;line-height:1.35;">
          ${isOpt ? '<span style="background:#f59e0b;color:#fff;padding:0px 5px;border-radius:3px;font-size:7px;font-weight:700;margin-right:4px;">OPCIONAL</span>' : ''}
          ${desc}
          ${isOpt && optPrice > 0 ? `<div style="font-size:7.5px;color:#92400e;margin-top:2px;">Si incluye: S/ ${optPrice.toFixed(2)} c/u = S/ ${optLineTotal.toFixed(2)}</div>` : ''}
        </td>
        <td style="text-align:right;padding:5px 6px;font-size:9px;width:50px;border:1px solid #e2e8f0;white-space:nowrap;">S/ ${price.toFixed(2)}</td>
        <td style="text-align:right;padding:5px 6px;font-size:9px;width:50px;border:1px solid #e2e8f0;font-weight:600;white-space:nowrap;">S/ ${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join('');

  // Build HTML template
  const templateHTML = `
    <div style="width:210mm;padding:8mm 12mm;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1e293b;line-height:1.35;box-sizing:border-box;">
      
      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:800;color:#1e3a8a;margin-bottom:1px;">${company.name || 'Mi Empresa'}</div>
          ${company.ruc ? `<div style="font-size:8px;color:#64748b;">RUC: ${company.ruc}</div>` : ''}
          ${company.address ? `<div style="font-size:8px;color:#64748b;">${company.address}</div>` : ''}
          <div style="font-size:8px;color:#64748b;">${[company.phone, company.email].filter(Boolean).join(' | ')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:20px;font-weight:900;color:#1e3a8a;letter-spacing:1px;">${docTypeInfo.headerTitle}</div>
          <div style="font-size:11px;color:#3b82f6;font-weight:700;margin-top:1px;">N° ${String(quoteNumber).padStart(3, '0')}</div>
        </div>
      </div>

      <!-- Blue gradient line -->
      <div style="height:2.5px;background:linear-gradient(90deg,#1e3a8a,#3b82f6,#60a5fa);margin-bottom:5px;border-radius:2px;"></div>

      <!-- INFO BAR -->
      <div style="display:flex;flex-wrap:wrap;gap:6px 18px;background:#eff6ff;padding:5px 10px;border-radius:5px;margin-bottom:5px;font-size:8.5px;border:1px solid #bfdbfe;">
        <div><span style="color:#64748b;">Emisión:</span> <strong>${issueDate || '-'}</strong></div>
        <div><span style="color:#64748b;">Vencimiento:</span> <strong>${dueDate || '-'}</strong></div>
        <div><span style="color:#64748b;">Moneda:</span> <strong>PEN Soles</strong></div>
        <div><span style="color:#64748b;">IGV:</span> <strong>${igvEnabled ? (igvType === 'included' ? 'Incluido 18%' : '18%') : 'Exento'}</strong></div>
      </div>

      <!-- CLIENT DATA -->
      <div style="margin-bottom:5px;">
        <div style="font-size:9px;font-weight:700;color:#fff;background:#1e3a8a;padding:3px 10px;border-radius:4px 4px 0 0;margin-bottom:0;">DATOS DEL CLIENTE</div>
        <div style="background:#f8fafc;padding:5px 10px;border-radius:0 0 4px 4px;border:1px solid #e2e8f0;border-top:none;">
          <div style="display:flex;gap:20px;flex-wrap:wrap;">
            <div style="flex:1;min-width:120px;"><span style="color:#64748b;font-size:7.5px;">RAZÓN SOCIAL</span><br><strong style="font-size:9.5px;">${clientName}</strong></div>
            ${clientDoc ? `<div style="min-width:100px;"><span style="color:#64748b;font-size:7.5px;">RUC/DNI</span><br><strong style="font-size:9.5px;">${clientDoc}</strong></div>` : ''}
          </div>
          <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:2px;">
            ${clientEmail ? `<div><span style="color:#64748b;font-size:7.5px;">EMAIL</span><br><span style="font-size:8.5px;">${clientEmail}</span></div>` : ''}
            ${clientPhone ? `<div><span style="color:#64748b;font-size:7.5px;">TELÉFONO</span><br><span style="font-size:8.5px;">${clientPhone}</span></div>` : ''}
            ${clientAddress ? `<div style="flex:1;min-width:120px;"><span style="color:#64748b;font-size:7.5px;">DIRECCIÓN</span><br><span style="font-size:8.5px;">${clientAddress}</span></div>` : ''}
          </div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:5px;">
        <thead>
          <tr style="background:#1e3a8a;color:#fff;">
            <th style="padding:4px 4px;text-align:center;font-size:8px;font-weight:700;width:28px;border:1px solid #1e3a8a;">CANT.</th>
            <th style="padding:4px 6px;text-align:left;font-size:8px;font-weight:700;border:1px solid #1e3a8a;">DESCRIPCIÓN</th>
            <th style="padding:4px 6px;text-align:right;font-size:8px;font-weight:700;width:50px;border:1px solid #1e3a8a;">P. UNIT.</th>
            <th style="padding:4px 6px;text-align:right;font-size:8px;font-weight:700;width:50px;border:1px solid #1e3a8a;">IMPORTE</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>

      <!-- TOTALS SECTION -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:6px;">
        <div style="width:185px;">
          <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:9px;">
            <span style="color:#64748b;">Subtotal${isIGVIncluded ? ' (base):' : ':'}</span>
            <span style="font-weight:600;">S/ ${displaySubtotal.toFixed(2)}</span>
          </div>
          ${igvEnabled ? `
          <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:9px;color:#64748b;">
            <span>IGV (18%):</span>
            <span>S/ ${displayIGV.toFixed(2)}</span>
          </div>
          ${isIGVIncluded ? `<div style="font-size:7px;color:#059669;padding:0 0 2px 0;">Incluido en el precio</div>` : ''}
          ` : ''}
          <div style="height:1.5px;background:linear-gradient(90deg,#1e3a8a,#3b82f6);margin:3px 0;border-radius:1px;"></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;">
            <span style="font-weight:900;color:#1e3a8a;">TOTAL:</span>
            <span style="font-weight:900;color:#1e3a8a;">S/ ${displayTotal.toFixed(2)}</span>
          </div>
          ${hasOptional ? `
          <div style="margin-top:4px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fbbf24;border-radius:5px;padding:4px 8px;">
            <div style="display:flex;justify-content:space-between;font-size:7.5px;color:#92400e;">
              <span>Extras opcionales:</span>
              <span>+S/ ${igvEnabled && igvType === 'apart' ? (subtotalOptional * 1.18).toFixed(2) : subtotalOptional.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#92400e;margin-top:1px;">
              <span style="font-weight:700;">TOTAL CON OPCIONALES:</span>
              <span style="font-weight:900;">S/ ${totalWithOptional.toFixed(2)}</span>
            </div>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- FOOTER -->
      <div style="border-top:2px solid #1e3a8a;padding-top:5px;text-align:center;">
        <div style="font-size:13px;font-weight:800;color:#1e3a8a;">${docTypeInfo.footerText}</div>
        <div style="font-size:7px;color:#94a3b8;margin-top:1px;">Documento generado por CotizaPro &mdash; Sistema de Cotizaciones Profesionales</div>
      </div>
    </div>
  `;

  // Create temporary container for rendering
  const container = document.createElement('div');
  container.id = 'pdf-temp-render';
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;z-index:-1;background:#fff;';
  container.innerHTML = templateHTML;
  document.body.appendChild(container);

  // Style for table rows
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #pdf-temp-render .row-even td { background: #f8fafc; }
    #pdf-temp-render .row-odd td { background: #ffffff; }
    #pdf-temp-render .row-optional td { background: #fffbeb !important; }
  `;
  container.insertBefore(styleEl, container.firstChild);

  try {
    const opt = {
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().from(container.firstElementChild).set(opt).save();
  } finally {
    // Always clean up
    container.remove();
  }

  return docTypeInfo;
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
    if (!companySnap.exists() || !companySnap.data().name) {
      showToast('Configura los datos de tu empresa primero (al menos el nombre)', 'error');
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

    const clientData = { name: clientName, document: clientDoc, email: clientEmail, phone: clientPhone, address: clientAddress };

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
      client: clientData,
      items: quoteItems, issueDate, dueDate,
      subtotal, igv: igvAmount, total: grandTotal, igvEnabled, igvType,
      createdAt: new Date().toISOString()
    };

    // Guardar cotizacion en Firestore
    let quoteId = `local_${Date.now()}`;
    try {
      const docRef = await addDoc(collection(db, 'quotes'), quoteData);
      quoteId = docRef.id;
      quoteData.id = quoteId;
    } catch (quoteErr) {
      console.warn('No se pudo guardar la cotizacion en Firestore:', quoteErr);
      // Fallback: guardar en localStorage
      quoteData.id = quoteId;
      saveToLocal('quotes', quoteData);
    }

    // Guardar cliente en Firestore y localStorage (no bloqueante)
    try {
      await saveClient(clientData);
    } catch (clientErr) {
      console.warn('No se pudo guardar el cliente en Firestore:', clientErr);
    }
    // Siempre guardar en localStorage como respaldo
    saveToLocal('clients', { id: `local_${Date.now()}`, ...clientData, userId: currentUser.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    // Actualizar contador de cotizaciones usadas (no bloqueante)
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { quotesUsedThisMonth: increment(1) });
    } catch (counterErr) {
      console.warn('No se pudo actualizar contador:', counterErr);
    }

    // Use centralized PDF renderer (saves directly)
    const fileName = `Cotizacion-${String(quoteNumber).padStart(3, '0')}-${clientName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    await renderPDF(company, clientData, quoteItems, quoteNumber, issueDate, dueDate, subtotal, igvAmount, grandTotal, igvEnabled, igvType, documentType, fileName);

    showToast('¡PDF generado exitosamente!');
    resetWizard();
    navigateTo('dashboard');
    userData.quotesUsedThisMonth++;
    updatePlanProgress();
    updateRemainingQuotes();

  } catch (error) {
    console.error('PDF Error:', error);
    showToast('Error al generar PDF: ' + error.message, 'error');
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
  // Actualizar banner
  if (userData.plan === 'free') {
    const bannerText = document.getElementById('plan-banner-text');
    if (bannerText) {
      if (remaining > 0) {
        bannerText.textContent = `Te quedan ${remaining} cotización${remaining !== 1 ? 'es' : ''} gratis este mes`;
      } else {
        bannerText.textContent = `¡Agotaste tus ${quota} cotizaciones gratis este mes!`;
      }
    }
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

function formatCurrency(amount) {
  return `S/ ${(amount || 0).toFixed(2)}`;
}

function formatDateShort(date) {
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

async function getUserQuotes() {
  // Intentar Firestore primero
  try {
    const q = query(collection(db, 'quotes'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const quotes = [];
    snapshot.forEach(docSnap => quotes.push({ id: docSnap.id, ...docSnap.data() }));
    // Si Firestore retorna datos, sincronizar con localStorage
    if (quotes.length > 0) {
      try {
        localStorage.setItem(getLocalStorageKey('quotes'), JSON.stringify(quotes));
      } catch (e) { /* ignore */ }
    }
    // Si Firestore esta vacio pero localStorage tiene datos, usar localStorage
    if (quotes.length === 0) {
      const localQuotes = loadFromLocal('quotes');
      if (localQuotes.length > 0) return localQuotes;
    }
    return quotes;
  } catch (error) {
    console.warn('Firestore quotes no disponible, usando localStorage:', error.message);
    return loadFromLocal('quotes');
  }
}

window.deleteQuote = async function(id) {
  if (confirm('¿Eliminar esta cotización?')) {
    // Intentar borrar de Firestore
    try { await deleteDoc(doc(db, 'quotes', id)); } catch (e) { console.warn('No se pudo borrar de Firestore:', e.message); }
    // Siempre borrar de localStorage
    deleteFromLocal('quotes', id);
    showToast('Cotización eliminada');
    loadHistory();
  }
};

window.downloadQuote = async function(id) {
  try {
    showToast('Generando PDF...', 'info');

    let quote = null;

    // Intentar leer desde Firestore
    try {
      const quoteDoc = await getDoc(doc(db, 'quotes', id));
      if (quoteDoc.exists()) quote = quoteDoc.data();
    } catch (firestoreErr) {
      console.warn('No se pudo leer de Firestore, intentando localStorage:', firestoreErr.message);
    }

    // Si no esta en Firestore, buscar en localStorage
    if (!quote) {
      const localQuotes = loadFromLocal('quotes');
      quote = localQuotes.find(q => q.id === id);
    }

    if (!quote) {
      showToast('Cotizacion no encontrada', 'error');
      return;
    }

    // Verify ownership
    if (quote.userId !== currentUser.uid) {
      showToast('No tienes permiso para esta cotizacion', 'error');
      return;
    }

    let company = null;
    // Intentar leer empresa desde Firestore
    try {
      const companySnap = await getDoc(doc(db, 'companies', currentUser.uid));
      if (companySnap.exists()) company = companySnap.data();
    } catch (companyErr) {
      console.warn('No se pudo leer empresa de Firestore:', companyErr.message);
    }

    // Si no hay empresa en Firestore, buscar en localStorage
    if (!company) {
      const localCompanies = loadFromLocal('companies');
      company = localCompanies.find(c => c.userId === currentUser.uid) || localCompanies[0];
    }

    if (!company || !company.name) {
      showToast('Configura los datos de tu empresa primero (Nombre, RUC, etc.)', 'error');
      navigateTo('settings');
      return;
    }

    const clientName = quote.client?.name || 'Sin nombre';
    const clientData = {
      name: clientName,
      document: quote.client?.document || '',
      email: quote.client?.email || '',
      phone: quote.client?.phone || '',
      address: quote.client?.address || ''
    };

    // Use centralized PDF renderer (saves directly)
    const fileName = `Cotizacion-${String(quote.number || 0).padStart(3, '0')}-${clientName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    await renderPDF(
      company,
      clientData,
      quote.items || [],
      quote.number || 0,
      quote.issueDate,
      quote.dueDate,
      quote.subtotal || 0,
      quote.igv || 0,
      quote.total || 0,
      quote.igvEnabled,
      quote.igvType || 'apart',
      quote.documentType || 'cotizacion',
      fileName
    );

    showToast('PDF generado exitosamente');
  } catch (error) {
    console.error('Download error:', error);
    showToast('Error al generar PDF: ' + error.message, 'error');
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
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'info' ? '⏳' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
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
    isCompanyConfigured = snap.exists() && snap.data().name;
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

protectRoute(true);
