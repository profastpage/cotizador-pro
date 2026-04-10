/* ==========================================================
   DATA MANAGER - CotizaPro
   Gestión de datos con localStorage
   Persistencia de cotizaciones, clientes y configuración
========================================================== */

const DataManager = {
  // Claves de almacenamiento
  KEYS: {
    COMPANY: 'cotizapro_company',
    CLIENTS: 'cotizapro_clients',
    QUOTES: 'cotizapro_quotes',
    SETTINGS: 'cotizapro_settings',
    QUOTE_COUNTER: 'cotizapro_quote_counter'
  },

  // ==========================================================
  // UTILIDADES DE ALMACENAMIENTO
  // ==========================================================

  /**
   * Guarda datos en localStorage
   * @param {string} key 
   * @param {*} data 
   */
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error guardando datos:', error);
      return false;
    }
  },

  /**
   * Obtiene datos de localStorage
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {*}
   */
  load(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error('Error cargando datos:', error);
      return defaultValue;
    }
  },

  /**
   * Elimina datos de localStorage
   * @param {string} key 
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error eliminando datos:', error);
      return false;
    }
  },

  // ==========================================================
  // GESTIÓN DE EMPRESA
  // ==========================================================

  /**
   * Obtiene datos de la empresa
   * @returns {Object}
   */
  getCompany() {
    return this.load(this.KEYS.COMPANY, {
      name: '',
      ruc: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      bankAccounts: [],
      paymentTerms: 'Contado',
      quoteValidity: 30,
      igvRate: 0.18,
      logo: null
    });
  },

  /**
   * Guarda datos de la empresa
   * @param {Object} company 
   */
  saveCompany(company) {
    return this.save(this.KEYS.COMPANY, company);
  },

  // ==========================================================
  // GESTIÓN DE CLIENTES
  // ==========================================================

  /**
   * Obtiene lista de clientes
   * @returns {Array}
   */
  getClients() {
    return this.load(this.KEYS.CLIENTS, []);
  },

  /**
   * Guarda lista de clientes
   * @param {Array} clients 
   */
  saveClients(clients) {
    return this.save(this.KEYS.CLIENTS, clients);
  },

  /**
   * Agrega o actualiza un cliente
   * @param {Object} client 
   */
  upsertClient(client) {
    const clients = this.getClients();
    const index = clients.findIndex(c => c.id === client.id);
    
    if (index >= 0) {
      clients[index] = { ...clients[index], ...client, updatedAt: new Date().toISOString() };
    } else {
      clients.push({
        ...client,
        id: client.id || Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    return this.saveClients(clients);
  },

  /**
   * Busca cliente por documento
   * @param {string} document 
   * @returns {Object|null}
   */
  findClientByDocument(document) {
    const clients = this.getClients();
    return clients.find(c => c.document === document) || null;
  },

  /**
   * Elimina un cliente
   * @param {string} clientId 
   */
  deleteClient(clientId) {
    const clients = this.getClients();
    const filtered = clients.filter(c => c.id !== clientId);
    return this.saveClients(filtered);
  },

  // ==========================================================
  // GESTIÓN DE COTIZACIONES
  // ==========================================================

  /**
   * Obtiene todas las cotizaciones
   * @returns {Array}
   */
  getQuotes() {
    return this.load(this.KEYS.QUOTES, []);
  },

  /**
   * Guarda todas las cotizaciones
   * @param {Array} quotes 
   */
  saveQuotes(quotes) {
    return this.save(this.KEYS.QUOTES, quotes);
  },

  /**
   * Obtiene el siguiente número de cotización
   * @returns {string}
   */
  getNextQuoteNumber() {
    let counter = this.load(this.KEYS.QUOTE_COUNTER, 0);
    counter++;
    this.save(this.KEYS.QUOTE_COUNTER, counter);
    return String(counter).padStart(6, '0');
  },

  /**
   * Guarda una cotización
   * @param {Object} quote 
   * @returns {Object} quote guardada
   */
  saveQuote(quote) {
    const quotes = this.getQuotes();
    
    // Si no tiene ID, es nueva
    if (!quote.id) {
      quote.id = Date.now().toString();
      quote.number = this.getNextQuoteNumber();
      quote.createdAt = new Date().toISOString();
    }
    
    quote.updatedAt = new Date().toISOString();
    
    const index = quotes.findIndex(q => q.id === quote.id);
    if (index >= 0) {
      quotes[index] = quote;
    } else {
      quotes.unshift(quote);
    }
    
    this.saveQuotes(quotes);
    
    // Guardar cliente automáticamente
    if (quote.client) {
      this.upsertClient({
        ...quote.client,
        lastQuoteDate: new Date().toISOString()
      });
    }
    
    return quote;
  },

  /**
   * Obtiene una cotización por ID
   * @param {string} quoteId 
   * @returns {Object|null}
   */
  getQuote(quoteId) {
    const quotes = this.getQuotes();
    return quotes.find(q => q.id === quoteId) || null;
  },

  /**
   * Elimina una cotización
   * @param {string} quoteId 
   */
  deleteQuote(quoteId) {
    const quotes = this.getQuotes();
    const filtered = quotes.filter(q => q.id !== quoteId);
    return this.saveQuotes(filtered);
  },

  /**
   * Duplica una cotización
   * @param {string} quoteId 
   * @returns {Object} nueva cotización
   */
  duplicateQuote(quoteId) {
    const original = this.getQuote(quoteId);
    if (!original) return null;
    
    const copy = JSON.parse(JSON.stringify(original));
    delete copy.id;
    delete copy.number;
    delete copy.createdAt;
    delete copy.updatedAt;
    
    copy.issueDate = new Date().toISOString().split('T')[0];
    copy.dueDate = this.calculateDueDate(7).toISOString().split('T')[0];
    
    return this.saveQuote(copy);
  },

  // ==========================================================
  // CONFIGURACIÓN
  // ==========================================================

  /**
   * Obtiene configuración de la app
   * @returns {Object}
   */
  getSettings() {
    return this.load(this.KEYS.SETTINGS, {
      darkMode: false,
      currency: 'PEN',
      currencySymbol: 'S/',
      defaultIgv: 0.18,
      defaultValidity: 30,
      defaultPaymentTerms: 'Contado',
      defaultDueDays: 7,
      watermark: false,
      watermarkText: '',
      includeTerms: true,
      includeBankAccounts: true
    });
  },

  /**
   * Guarda configuración
   * @param {Object} settings 
   */
  saveSettings(settings) {
    return this.save(this.KEYS.SETTINGS, settings);
  },

  // ==========================================================
  // ESTADÍSTICAS
  // ==========================================================

  /**
   * Obtiene estadísticas del mes actual
   * @returns {Object}
   */
  getMonthStats() {
    const quotes = this.getQuotes();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthQuotes = quotes.filter(q => {
      const date = new Date(q.createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    
    const totalAmount = monthQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
    
    return {
      totalQuotes: monthQuotes.length,
      totalAmount: totalAmount,
      avgAmount: monthQuotes.length > 0 ? totalAmount / monthQuotes.length : 0
    };
  },

  /**
   * Obtiene últimas cotizaciones
   * @param {number} limit 
   * @returns {Array}
   */
  getRecentQuotes(limit = 10) {
    const quotes = this.getQuotes();
    return quotes.slice(0, limit);
  },

  /**
   * Busca cotizaciones por texto
   * @param {string} query 
   * @returns {Array}
   */
  searchQuotes(query) {
    if (!query) return this.getQuotes();
    
    const lowerQuery = query.toLowerCase();
    return this.getQuotes().filter(q => {
      return (
        q.number?.toLowerCase().includes(lowerQuery) ||
        q.client?.name?.toLowerCase().includes(lowerQuery) ||
        q.client?.document?.toLowerCase().includes(lowerQuery) ||
        q.items?.some(item => item.description?.toLowerCase().includes(lowerQuery))
      );
    });
  },

  // ==========================================================
  // EXPORTAR / IMPORTAR DATOS
  // ==========================================================

  /**
   * Exporta todos los datos como JSON
   * @returns {Object}
   */
  exportAllData() {
    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      company: this.getCompany(),
      clients: this.getClients(),
      quotes: this.getQuotes(),
      settings: this.getSettings(),
      quoteCounter: this.load(this.KEYS.QUOTE_COUNTER, 0)
    };
  },

  /**
   * Importa datos desde JSON
   * @param {Object} data 
   */
  importAllData(data) {
    if (data.company) this.saveCompany(data.company);
    if (data.clients) this.saveClients(data.clients);
    if (data.quotes) this.saveQuotes(data.quotes);
    if (data.settings) this.saveSettings(data.settings);
    if (data.quoteCounter) this.save(this.KEYS.QUOTE_COUNTER, data.quoteCounter);
  },

  // ==========================================================
  // UTILIDADES
  // ==========================================================

  /**
   * Calcula fecha de vencimiento
   * @param {number} days 
   * @returns {Date}
   */
  calculateDueDate(days = 7) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  },

  /**
   * Formatea fecha para mostrar
   * @param {string|Date} date 
   * @returns {string}
   */
  formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  /**
   * Formatea fecha corta
   * @param {string|Date} date 
   * @returns {string}
   */
  formatDateShort(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('es-PE');
  },

  /**
   * Formatea moneda
   * @param {number} amount 
   * @param {string} currency 
   * @returns {string}
   */
  formatCurrency(amount, currency = 'PEN') {
    const settings = this.getSettings();
    const symbol = settings.currencySymbol || 'S/';
    return `${symbol} ${parseFloat(amount || 0).toFixed(2)}`;
  },

  /**
   * Calcula subtotal de un item
   * @param {number} quantity 
   * @param {number} unitPrice 
   * @returns {number}
   */
  calcItemTotal(quantity, unitPrice) {
    return (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  },

  /**
   * Calcula totales de una cotización
   * @param {Array} items 
   * @param {number} igvRate 
   * @returns {Object} { subtotal, igv, total }
   */
  calcQuoteTotals(items, igvRate = 0.18) {
    const subtotal = items.reduce((sum, item) => {
      return sum + this.calcItemTotal(item.quantity, item.unitPrice);
    }, 0);
    
    const igv = subtotal * igvRate;
    const total = subtotal + igv;
    
    return { subtotal, igv, total };
  }
};

// Exportar como módulo ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataManager;
}
