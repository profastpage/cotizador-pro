/* ==========================================================
   APP.JS - CotizaPro
   Main application logic - Navigation, Forms, State Management
========================================================== */

const App = {
  currentScreen: 'dashboard',
  currentWizardStep: 1,
  quoteItems: [],
  editingQuoteId: null,
  
  // ==========================================================
  // INITIALIZATION
  // ==========================================================
  
  init() {
    console.log('CotizaPro - Initializing...');
    
    // Register Service Worker
    this.registerServiceWorker();
    
    // Load settings
    this.loadSettings();
    
    // Setup event listeners
    this.setupNavigation();
    this.setupForms();
    this.setupQuoteWizard();
    this.setupSettings();
    this.setupDarkMode();
    this.setupExportImport();
    
    // Setup FAB
    this.setupFAB();
    
    // Load dashboard data
    this.loadDashboard();
    
    // Hide splash screen
    setTimeout(() => {
      document.getElementById('splash-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
    }, 1500);
    
    // Setup search
    this.setupSearch();
    
    console.log('CotizaPro - Ready!');
  },
  
  // ==========================================================
  // SERVICE WORKER
  // ==========================================================
  
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(registration => {
            console.log('[SW] Registered successfully');
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this.showToast('Actualización disponible', 'Recarga la página para obtener la última versión', 'info');
                }
              });
            });
          })
          .catch(error => {
            console.log('[SW] Registration failed:', error);
          });
      });
    }
  },
  
  // ==========================================================
  // NAVIGATION
  // ==========================================================
  
  setupNavigation() {
    // Bottom nav buttons
    document.querySelectorAll('[data-screen]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const screen = e.currentTarget.dataset.screen;
        this.navigateTo(screen);
      });
    });
    
    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModal();
      });
    });
  },
  
  navigateTo(screen) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    // Show target screen
    const targetScreen = document.getElementById(`screen-${screen}`);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }
    
    // Update nav buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.screen === screen) {
        btn.classList.add('active');
      }
    });
    
    this.currentScreen = screen;
    
    // Load screen data
    if (screen === 'dashboard') {
      this.loadDashboard();
    } else if (screen === 'history') {
      this.loadHistory();
    } else if (screen === 'new-quote') {
      this.resetQuoteWizard();
    } else if (screen === 'settings') {
      this.loadSettingsForm();
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  
  // ==========================================================
  // DASHBOARD
  // ==========================================================
  
  loadDashboard() {
    const stats = DataManager.getMonthStats();
    const recentQuotes = DataManager.getRecentQuotes(5);
    
    // Update stats
    document.getElementById('stat-total-quotes').textContent = stats.totalQuotes;
    document.getElementById('stat-total-amount').textContent = DataManager.formatCurrency(stats.totalAmount);
    document.getElementById('stat-avg-amount').textContent = DataManager.formatCurrency(stats.avgAmount);
    
    // Update recent quotes list
    const container = document.getElementById('dashboard-recent-quotes');
    
    if (recentQuotes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3 class="empty-state-title">No hay cotizaciones aún</h3>
          <p class="empty-state-subtitle">Crea tu primera cotización profesional</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = recentQuotes.map(quote => this.createQuoteCard(quote)).join('');
  },
  
  // ==========================================================
  // HISTORY
  // ==========================================================
  
  loadHistory() {
    const quotes = DataManager.getQuotes();
    this.renderQuotesList(quotes);
  },
  
  renderQuotesList(quotes) {
    const container = document.getElementById('history-quotes-list');
    
    if (quotes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3 class="empty-state-title">No hay cotizaciones guardadas</h3>
          <p class="empty-state-subtitle">Las cotizaciones que generes aparecerán aquí</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = quotes.map(quote => this.createQuoteCard(quote, true)).join('');
  },
  
  createQuoteCard(quote, showActions = false) {
    const clientName = quote.client?.name || 'Sin cliente';
    const amount = DataManager.formatCurrency(quote.total);
    const date = DataManager.formatDateShort(quote.createdAt);
    const number = `#${quote.number || 'N/A'}`;
    
    return `
      <div class="quote-card" data-quote-id="${quote.id}">
        <div class="quote-card-header">
          <span class="quote-number">${number}</span>
          <span class="quote-date">${date}</span>
        </div>
        <div class="quote-client">${clientName}</div>
        <div class="quote-amount">${amount}</div>
        ${showActions ? `
          <div class="quote-actions">
            <button class="btn btn-sm btn-primary" onclick="App.viewQuote('${quote.id}')">👁️ Ver</button>
            <button class="btn btn-sm btn-success" onclick="App.downloadQuotePDF('${quote.id}')">📄 PDF</button>
            <button class="btn btn-sm btn-outline" onclick="App.duplicateQuote('${quote.id}')">📋 Duplicar</button>
            <button class="btn btn-sm btn-danger" onclick="App.deleteQuote('${quote.id}')">🗑️</button>
          </div>
        ` : ''}
      </div>
    `;
  },
  
  // ==========================================================
  // SEARCH
  // ==========================================================
  
  setupSearch() {
    const searchInput = document.getElementById('search-quotes');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const query = e.target.value.trim();
          const results = DataManager.searchQuotes(query);
          this.renderQuotesList(results);
        }, 300);
      });
    }
  },
  
  // ==========================================================
  // QUOTE WIZARD
  // ==========================================================
  
  setupQuoteWizard() {
    // Navigation buttons
    document.getElementById('btn-next-step').addEventListener('click', () => {
      this.nextWizardStep();
    });
    
    document.getElementById('btn-prev-step').addEventListener('click', () => {
      this.prevWizardStep();
    });
    
    document.getElementById('btn-generate-pdf').addEventListener('click', () => {
      this.generateQuotePDF();
    });
    
    // Add item button
    document.getElementById('btn-add-item').addEventListener('click', () => {
      this.addQuoteItem();
    });
    
    // Search client button
    document.getElementById('btn-search-client').addEventListener('click', () => {
      this.searchClient();
    });
    
    // Client document input - show search button
    document.getElementById('client-document').addEventListener('input', (e) => {
      const btn = document.getElementById('btn-search-client');
      if (e.target.value.length >= 8) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    });
    
    // Set default dates
    this.setDefaultDates();
  },
  
  resetQuoteWizard() {
    this.currentWizardStep = 1;
    this.quoteItems = [];
    this.editingQuoteId = null;
    
    // Reset form
    document.getElementById('form-client').reset();
    
    // Reset wizard UI
    this.updateWizardUI();
    
    // Clear items container
    document.getElementById('items-container').innerHTML = '';
    
    // Reset summary
    this.updateQuoteSummary();
    
    // Set default dates
    this.setDefaultDates();
  },
  
  setDefaultDates() {
    const today = new Date();
    const settings = DataManager.getSettings();
    const dueDate = DataManager.calculateDueDate(settings.defaultDueDays);
    
    document.getElementById('quote-issue-date').value = today.toISOString().split('T')[0];
    document.getElementById('quote-due-date').value = dueDate.toISOString().split('T')[0];
    
    // Set default payment terms
    document.getElementById('quote-payment-terms').value = settings.defaultPaymentTerms;
  },
  
  updateWizardUI() {
    // Update step indicators
    document.querySelectorAll('.wizard-step').forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove('active', 'completed');
      
      if (stepNum === this.currentWizardStep) {
        step.classList.add('active');
      } else if (stepNum < this.currentWizardStep) {
        step.classList.add('completed');
      }
    });
    
    // Update step content visibility
    document.querySelectorAll('.wizard-step-content').forEach((content, index) => {
      content.classList.toggle('active', index + 1 === this.currentWizardStep);
    });
    
    // Update progress bar
    const progress = (this.currentWizardStep / 3) * 100;
    document.getElementById('wizard-bar-progress').style.width = `${progress}%`;
    
    // Update buttons
    const prevBtn = document.getElementById('btn-prev-step');
    const nextBtn = document.getElementById('btn-next-step');
    const generateBtn = document.getElementById('btn-generate-pdf');
    
    prevBtn.classList.toggle('hidden', this.currentWizardStep === 1);
    
    if (this.currentWizardStep === 3) {
      nextBtn.classList.add('hidden');
      generateBtn.classList.remove('hidden');
      this.updateReviewSection();
    } else {
      nextBtn.classList.remove('hidden');
      generateBtn.classList.add('hidden');
    }
  },
  
  nextWizardStep() {
    if (this.currentWizardStep === 1) {
      if (!this.validateClientStep()) return;
    } else if (this.currentWizardStep === 2) {
      if (!this.validateItemsStep()) return;
    }
    
    if (this.currentWizardStep < 3) {
      this.currentWizardStep++;
      this.updateWizardUI();
    }
  },
  
  prevWizardStep() {
    if (this.currentWizardStep > 1) {
      this.currentWizardStep--;
      this.updateWizardUI();
    }
  },
  
  validateClientStep() {
    const client = this.getClientData();
    const validation = Validators.validateClient(client);
    
    // Clear errors
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    
    if (!validation.valid) {
      validation.errors.forEach(error => {
        this.showToast('Error de validación', error, 'error');
      });
      return false;
    }
    
    return true;
  },
  
  validateItemsStep() {
    if (this.quoteItems.length === 0) {
      this.showToast('Error', 'Debes agregar al menos un item', 'error');
      return false;
    }
    
    return true;
  },
  
  // ==========================================================
  // CLIENT DATA
  // ==========================================================
  
  getClientData() {
    return {
      name: document.getElementById('client-name').value.trim(),
      document: document.getElementById('client-document').value.trim(),
      email: document.getElementById('client-email').value.trim(),
      phone: document.getElementById('client-phone').value.trim(),
      address: document.getElementById('client-address').value.trim()
    };
  },
  
  searchClient() {
    const doc = document.getElementById('client-document').value.trim();
    if (!doc) return;
    
    const client = DataManager.findClientByDocument(doc);
    if (client) {
      document.getElementById('client-name').value = client.name || '';
      document.getElementById('client-email').value = client.email || '';
      document.getElementById('client-phone').value = client.phone || '';
      document.getElementById('client-address').value = client.address || '';
      
      this.showToast('Cliente encontrado', `Datos de ${client.name} cargados`, 'success');
    } else {
      this.showToast('Cliente no encontrado', 'No se encontró un cliente con ese documento', 'warning');
    }
  },
  
  // ==========================================================
  // QUOTE ITEMS
  // ==========================================================
  
  addQuoteItem() {
    const itemId = Date.now().toString();
    const item = { id: itemId, quantity: 1, unitPrice: 0, description: '' };
    this.quoteItems.push(item);
    
    this.renderItemCard(item, this.quoteItems.length);
    this.updateQuoteSummary();
  },
  
  renderItemCard(item, index) {
    const container = document.getElementById('items-container');
    const html = `
      <div class="item-card" data-item-id="${item.id}">
        <div class="item-header">
          <span class="item-number">Item ${index}</span>
          <button class="btn-remove-item" onclick="App.removeQuoteItem('${item.id}')" aria-label="Eliminar item">
            ✕
          </button>
        </div>
        <div class="item-fields">
          <div class="item-field-row">
            <div class="form-group">
              <label class="form-label">Cantidad</label>
              <input type="number" class="form-input item-quantity" data-item-id="${item.id}" 
                     value="${item.quantity}" min="1" step="1" inputmode="numeric">
            </div>
            <div class="form-group">
              <label class="form-label">Descripción</label>
              <input type="text" class="form-input item-description" data-item-id="${item.id}" 
                     value="${item.description}" placeholder="Descripción del producto o servicio">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Precio Unitario (S/)</label>
            <input type="number" class="form-input item-unit-price" data-item-id="${item.id}" 
                   value="${item.unitPrice}" min="0" step="0.01" inputmode="decimal">
          </div>
          <div class="item-subtotal">
            Subtotal: S/ ${(item.quantity * item.unitPrice).toFixed(2)}
          </div>
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
    
    // Add event listeners
    const card = container.querySelector(`[data-item-id="${item.id}"]`);
    
    card.querySelector('.item-quantity').addEventListener('input', (e) => {
      this.updateItemField(item.id, 'quantity', parseFloat(e.target.value) || 0);
    });
    
    card.querySelector('.item-description').addEventListener('input', (e) => {
      this.updateItemField(item.id, 'description', e.target.value);
    });
    
    card.querySelector('.item-unit-price').addEventListener('input', (e) => {
      this.updateItemField(item.id, 'unitPrice', parseFloat(e.target.value) || 0);
    });
  },
  
  removeQuoteItem(itemId) {
    this.quoteItems = this.quoteItems.filter(item => item.id !== itemId);
    
    // Remove from DOM
    const card = document.querySelector(`[data-item-id="${itemId}"]`);
    if (card) card.remove();
    
    // Renumber items
    this.renumberItems();
    this.updateQuoteSummary();
  },
  
  renumberItems() {
    document.querySelectorAll('.item-number').forEach((el, index) => {
      el.textContent = `Item ${index + 1}`;
    });
  },
  
  updateItemField(itemId, field, value) {
    const item = this.quoteItems.find(i => i.id === itemId);
    if (item) {
      item[field] = value;
      
      // Update subtotal in card
      const card = document.querySelector(`[data-item-id="${itemId}"]`);
      if (card) {
        const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
        card.querySelector('.item-subtotal').textContent = `Subtotal: S/ ${subtotal.toFixed(2)}`;
      }
      
      this.updateQuoteSummary();
    }
  },
  
  updateQuoteSummary() {
    const settings = DataManager.getSettings();
    const igvRate = settings.defaultIgv;
    const totals = DataManager.calcQuoteTotals(this.quoteItems, igvRate);
    
    document.getElementById('summary-subtotal').textContent = DataManager.formatCurrency(totals.subtotal);
    document.getElementById('summary-igv').textContent = DataManager.formatCurrency(totals.igv);
    document.getElementById('summary-total').textContent = DataManager.formatCurrency(totals.total);
  },
  
  // ==========================================================
  // REVIEW SECTION
  // ==========================================================
  
  updateReviewSection() {
    const client = this.getClientData();
    const container = document.getElementById('quote-review');
    
    const totals = DataManager.calcQuoteTotals(this.quoteItems, DataManager.getSettings().defaultIgv);
    
    let html = `
      <div class="review-section">
        <div class="review-section-title">Cliente</div>
        <div class="review-section-content">
          <strong>${client.name}</strong><br>
          ${client.document ? `RUC/DNI: ${client.document}<br>` : ''}
          ${client.email ? `Email: ${client.email}<br>` : ''}
          ${client.phone ? `Teléfono: ${client.phone}<br>` : ''}
          ${client.address ? `Dirección: ${client.address}` : ''}
        </div>
      </div>
      
      <div class="review-section">
        <div class="review-section-title">Items (${this.quoteItems.length})</div>
        <div class="review-items">
    `;
    
    this.quoteItems.forEach(item => {
      const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
      html += `
        <div class="review-item">
          <span class="review-item-qty">${item.quantity}x</span>
          <span class="review-item-desc">${item.description}</span>
          <span class="review-item-total">S/ ${subtotal.toFixed(2)}</span>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
      
      <div class="quote-summary">
        <div class="summary-row">
          <span class="summary-label">Subtotal:</span>
          <span class="summary-value">S/ ${totals.subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">IGV (${(DataManager.getSettings().defaultIgv * 100).toFixed(0)}%):</span>
          <span class="summary-value">S/ ${totals.igv.toFixed(2)}</span>
        </div>
        <div class="summary-row summary-total">
          <span class="summary-label">TOTAL:</span>
          <span class="summary-value">S/ ${totals.total.toFixed(2)}</span>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  },
  
  // ==========================================================
  // GENERATE PDF
  // ==========================================================
  
  async generateQuotePDF() {
    try {
      // Show loading
      this.showToast('Generando PDF', 'Por favor espera...', 'info');
      
      const company = DataManager.getCompany();
      const settings = DataManager.getSettings();
      
      // Validate company data
      const companyValidation = Validators.validateCompany(company);
      if (!companyValidation.valid) {
        this.showToast('Error', 'Debes configurar los datos de la empresa en Ajustes', 'error');
        this.navigateTo('settings');
        return;
      }
      
      // Build quote object
      const client = this.getClientData();
      const totals = DataManager.calcQuoteTotals(this.quoteItems, settings.defaultIgv);
      
      const quote = {
        id: this.editingQuoteId || undefined,
        client,
        items: this.quoteItems,
        issueDate: document.getElementById('quote-issue-date').value,
        dueDate: document.getElementById('quote-due-date').value,
        paymentTerms: document.getElementById('quote-payment-terms').value,
        subtotal: totals.subtotal,
        igv: totals.igv,
        total: totals.total,
        igvRate: settings.defaultIgv,
        validity: settings.defaultValidity
      };
      
      // Generate PDF
      const blob = await PDFGenerator.generateQuotePDF(quote, company, settings);
      
      // Save quote
      DataManager.saveQuote(quote);
      
      // Download PDF
      const filename = PDFGenerator.generateFilename(quote);
      PDFGenerator.downloadPDF(blob, filename);
      
      this.showToast('¡PDF generado!', `Archivo descargado: ${filename}`, 'success');
      
      // Reset wizard
      this.resetQuoteWizard();
      this.navigateTo('dashboard');
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      this.showToast('Error', 'No se pudo generar el PDF. Intenta nuevamente.', 'error');
    }
  },
  
  // ==========================================================
  // VIEW/DOWNLOAD/DUPLICATE/DELETE QUOTES
  // ==========================================================
  
  viewQuote(quoteId) {
    const quote = DataManager.getQuote(quoteId);
    if (!quote) return;
    
    // Open in new wizard for viewing
    this.editingQuoteId = quoteId;
    this.quoteItems = quote.items || [];
    
    // Fill client data
    if (quote.client) {
      document.getElementById('client-name').value = quote.client.name || '';
      document.getElementById('client-document').value = quote.client.document || '';
      document.getElementById('client-email').value = quote.client.email || '';
      document.getElementById('client-phone').value = quote.client.phone || '';
      document.getElementById('client-address').value = quote.client.address || '';
    }
    
    // Fill dates
    document.getElementById('quote-issue-date').value = quote.issueDate || '';
    document.getElementById('quote-due-date').value = quote.dueDate || '';
    document.getElementById('quote-payment-terms').value = quote.paymentTerms || '';
    
    // Render items
    document.getElementById('items-container').innerHTML = '';
    this.quoteItems.forEach((item, index) => {
      this.renderItemCard(item, index + 1);
    });
    
    this.updateQuoteSummary();
    this.navigateTo('new-quote');
  },
  
  async downloadQuotePDF(quoteId) {
    const quote = DataManager.getQuote(quoteId);
    if (!quote) return;
    
    try {
      this.showToast('Generando PDF', 'Por favor espera...', 'info');
      
      const company = DataManager.getCompany();
      const settings = DataManager.getSettings();
      
      const blob = await PDFGenerator.generateQuotePDF(quote, company, settings);
      const filename = PDFGenerator.generateFilename(quote);
      PDFGenerator.downloadPDF(blob, filename);
      
      this.showToast('¡PDF descargado!', filename, 'success');
    } catch (error) {
      console.error('Error:', error);
      this.showToast('Error', 'No se pudo generar el PDF', 'error');
    }
  },
  
  duplicateQuote(quoteId) {
    const newQuote = DataManager.duplicateQuote(quoteId);
    if (newQuote) {
      this.showToast('Cotización duplicada', 'Se creó una copia de la cotización', 'success');
      this.loadHistory();
    }
  },
  
  deleteQuote(quoteId) {
    this.showModal(
      'Eliminar Cotización',
      '¿Estás seguro de eliminar esta cotización? Esta acción no se puede deshacer.',
      () => {
        DataManager.deleteQuote(quoteId);
        this.showToast('Cotización eliminada', '', 'success');
        this.loadHistory();
      }
    );
  },
  
  // ==========================================================
  // FORMS
  // ==========================================================
  
  setupForms() {
    // Company form
    document.getElementById('form-company').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCompanyData();
    });
    
    // App settings form
    document.getElementById('form-app-settings').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAppSettings();
    });
    
    // Watermark toggle
    document.getElementById('settings-watermark').addEventListener('change', (e) => {
      document.getElementById('watermark-text-group').classList.toggle('hidden', !e.target.checked);
    });
    
    // Bank accounts
    document.getElementById('btn-add-bank-account').addEventListener('click', () => {
      this.addBankAccount();
    });
  },
  
  saveCompanyData() {
    const company = {
      name: document.getElementById('company-name').value.trim(),
      ruc: document.getElementById('company-ruc').value.trim(),
      address: document.getElementById('company-address').value.trim(),
      phone: document.getElementById('company-phone').value.trim(),
      email: document.getElementById('company-email').value.trim(),
      website: document.getElementById('company-website').value.trim(),
      bankAccounts: this.getBankAccounts(),
      paymentTerms: DataManager.getCompany().paymentTerms,
      quoteValidity: DataManager.getCompany().quoteValidity,
      igvRate: DataManager.getCompany().igvRate,
      logo: DataManager.getCompany().logo
    };
    
    const validation = Validators.validateCompany(company);
    if (!validation.valid) {
      this.showToast('Error de validación', validation.errors[0], 'error');
      return;
    }
    
    DataManager.saveCompany(company);
    this.showToast('Datos guardados', 'Información de la empresa actualizada', 'success');
  },
  
  loadSettingsForm() {
    const company = DataManager.getCompany();
    const settings = DataManager.getSettings();
    
    // Fill company form
    document.getElementById('company-name').value = company.name || '';
    document.getElementById('company-ruc').value = company.ruc || '';
    document.getElementById('company-address').value = company.address || '';
    document.getElementById('company-phone').value = company.phone || '';
    document.getElementById('company-email').value = company.email || '';
    document.getElementById('company-website').value = company.website || '';
    
    // Fill app settings
    document.getElementById('settings-igv').value = (settings.defaultIgv * 100) || 18;
    document.getElementById('settings-validity').value = settings.defaultValidity || 30;
    document.getElementById('settings-payment-terms').value = settings.defaultPaymentTerms || '';
    document.getElementById('settings-due-days').value = settings.defaultDueDays || 7;
    document.getElementById('settings-watermark').checked = settings.watermark || false;
    document.getElementById('settings-watermark-text').value = settings.watermarkText || '';
    
    document.getElementById('watermark-text-group').classList.toggle('hidden', !settings.watermark);
    
    // Load bank accounts
    this.renderBankAccounts();
  },
  
  saveAppSettings() {
    const settings = {
      ...DataManager.getSettings(),
      defaultIgv: (parseFloat(document.getElementById('settings-igv').value) || 18) / 100,
      defaultValidity: parseInt(document.getElementById('settings-validity').value) || 30,
      defaultPaymentTerms: document.getElementById('settings-payment-terms').value || 'Contado',
      defaultDueDays: parseInt(document.getElementById('settings-due-days').value) || 7,
      watermark: document.getElementById('settings-watermark').checked,
      watermarkText: document.getElementById('settings-watermark-text').value
    };
    
    DataManager.saveSettings(settings);
    this.showToast('Configuración guardada', '', 'success');
  },
  
  // ==========================================================
  // BANK ACCOUNTS
  // ==========================================================
  
  getBankAccounts() {
    const cards = document.querySelectorAll('.bank-account-card');
    const accounts = [];
    
    cards.forEach(card => {
      const id = card.dataset.accountId;
      const bank = card.querySelector('.bank-name')?.value || '';
      const accountType = card.querySelector('.bank-account-type')?.value || '';
      const accountNumber = card.querySelector('.bank-account-number')?.value || '';
      const cci = card.querySelector('.bank-cci')?.value || '';
      const holder = card.querySelector('.bank-holder')?.value || '';
      
      accounts.push({ id, bank, accountType, accountNumber, cci, holder });
    });
    
    return accounts;
  },
  
  addBankAccount() {
    const id = Date.now().toString();
    const container = document.getElementById('bank-accounts-container');
    
    const html = `
      <div class="bank-account-card" data-account-id="${id}">
        <div class="bank-account-header">
          <h4 class="bank-account-title">Nueva Cuenta</h4>
          <button class="btn-remove-account" onclick="App.removeBankAccount('${id}')">✕</button>
        </div>
        <div class="bank-account-fields">
          <div class="form-group">
            <label class="form-label">Banco</label>
            <input type="text" class="form-input bank-name" placeholder="BCP, Interbank, BBVA">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de Cuenta</label>
            <input type="text" class="form-input bank-account-type" placeholder="Ahorras, Corriente, CTS">
          </div>
          <div class="form-group">
            <label class="form-label">Número de Cuenta</label>
            <input type="text" class="form-input bank-account-number" placeholder="123-456789-0-12" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">CCI (20 dígitos)</label>
            <input type="text" class="form-input bank-cci" placeholder="002-123456789012345678" maxlength="20" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">Titular</label>
            <input type="text" class="form-input bank-holder" placeholder="Nombre del titular">
          </div>
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
  },
  
  removeBankAccount(accountId) {
    const card = document.querySelector(`[data-account-id="${accountId}"]`);
    if (card) card.remove();
  },
  
  renderBankAccounts() {
    const company = DataManager.getCompany();
    const container = document.getElementById('bank-accounts-container');
    
    if (!company.bankAccounts || company.bankAccounts.length === 0) {
      container.innerHTML = '<p class="text-center" style="color: var(--text-tertiary);">No hay cuentas bancarias configuradas</p>';
      return;
    }
    
    container.innerHTML = company.bankAccounts.map(account => `
      <div class="bank-account-card" data-account-id="${account.id || Date.now().toString()}">
        <div class="bank-account-header">
          <h4 class="bank-account-title">${account.bank || 'Sin nombre'}</h4>
          <button class="btn-remove-account" onclick="App.removeBankAccount('${account.id}')">✕</button>
        </div>
        <div class="bank-account-fields">
          <div class="form-group">
            <label class="form-label">Banco</label>
            <input type="text" class="form-input bank-name" value="${account.bank || ''}" placeholder="BCP, Interbank, BBVA">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de Cuenta</label>
            <input type="text" class="form-input bank-account-type" value="${account.accountType || ''}" placeholder="Ahorras, Corriente, CTS">
          </div>
          <div class="form-group">
            <label class="form-label">Número de Cuenta</label>
            <input type="text" class="form-input bank-account-number" value="${account.accountNumber || ''}" placeholder="123-456789-0-12" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">CCI (20 dígitos)</label>
            <input type="text" class="form-input bank-cci" value="${account.cci || ''}" placeholder="002-123456789012345678" maxlength="20" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">Titular</label>
            <input type="text" class="form-input bank-holder" value="${account.holder || ''}" placeholder="Nombre del titular">
          </div>
        </div>
      </div>
    `).join('');
  },
  
  // ==========================================================
  // SETTINGS
  // ==========================================================
  
  loadSettings() {
    const settings = DataManager.getSettings();
    
    // Apply dark mode
    if (settings.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  },
  
  setupSettings() {
    // Clear data button
    document.getElementById('btn-clear-data').addEventListener('click', () => {
      this.showModal(
        'Eliminar Todos los Datos',
        '¿Estás seguro? Se eliminarán todas las cotizaciones, clientes y configuraciones. Esta acción no se puede deshacer.',
        () => {
          localStorage.clear();
          this.showToast('Datos eliminados', 'La app se recargará en 2 segundos', 'success');
          setTimeout(() => location.reload(), 2000);
        }
      );
    });
  },
  
  // ==========================================================
  // EXPORT / IMPORT
  // ==========================================================
  
  setupExportImport() {
    document.getElementById('btn-export').addEventListener('click', () => {
      const data = DataManager.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CotizaPro-Backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showToast('Datos exportados', 'Respaldo descargado correctamente', 'success');
    });
    
    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    
    document.getElementById('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          DataManager.importAllData(data);
          this.showToast('Datos importados', 'La app se recargará en 2 segundos', 'success');
          setTimeout(() => location.reload(), 2000);
        } catch (error) {
          this.showToast('Error', 'El archivo no es válido', 'error');
        }
      };
      reader.readAsText(file);
    });
  },
  
  // ==========================================================
  // DARK MODE
  // ==========================================================
  
  setupDarkMode() {
    const btn = document.getElementById('btn-dark-mode');
    btn.addEventListener('click', () => {
      const settings = DataManager.getSettings();
      const newMode = !settings.darkMode;
      
      settings.darkMode = newMode;
      DataManager.saveSettings(settings);
      
      document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
      
      // Toggle icons
      document.querySelector('.icon-dark').classList.toggle('hidden', newMode);
      document.querySelector('.icon-light').classList.toggle('hidden', !newMode);
      
      this.showToast(newMode ? 'Modo oscuro activado' : 'Modo claro activado', '', 'success');
    });
    
    // Set initial icon state
    const settings = DataManager.getSettings();
    if (settings.darkMode) {
      document.querySelector('.icon-dark').classList.add('hidden');
      document.querySelector('.icon-light').classList.remove('hidden');
    }
  },
  
  // ==========================================================
  // FAB
  // ==========================================================
  
  setupFAB() {
    document.getElementById('fab-new-quote').addEventListener('click', () => {
      this.navigateTo('new-quote');
    });
  },
  
  // ==========================================================
  // TOAST NOTIFICATIONS
  // ==========================================================
  
  showToast(title, message = '', type = 'info') {
    const container = document.getElementById('toast-container');
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 1 second
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 1000);
  },
  
  // ==========================================================
  // MODAL
  // ==========================================================
  
  showModal(title, message, onConfirm) {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    
    modal.classList.remove('hidden');
    
    const confirmBtn = document.getElementById('modal-confirm-btn');
    confirmBtn.onclick = () => {
      this.closeModal();
      onConfirm();
    };
  },
  
  closeModal() {
    const modal = document.getElementById('modal-confirm');
    modal.classList.add('hidden');
  }
};

// ==========================================================
// INITIALIZE APP ON DOM READY
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
