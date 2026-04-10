/* ==========================================================
   VALIDATORS - CotizaPro
   Validaciones para RUC, DNI, email, teléfono, etc.
   Basado en regulaciones peruanas (SUNAT)
========================================================== */

const Validators = {
  /**
   * Valida RUC peruano (11 dígitos)
   * Algoritmo oficial de SUNAT
   * @param {string} ruc 
   * @returns {boolean}
   */
  isValidRUC(ruc) {
    if (!ruc) return false;
    const cleanRUC = ruc.replace(/\s/g, '');
    
    // Debe tener exactamente 11 dígitos
    if (!/^\d{11}$/.test(cleanRUC)) return false;
    
    // Primeros 2 dígitos deben ser 10, 15, 17 o 20
    const firstTwo = cleanRUC.substring(0, 2);
    if (!['10', '15', '17', '20'].includes(firstTwo)) return false;
    
    // Algoritmo de módulo 11
    const coefficients = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanRUC[i]) * coefficients[i];
    }
    
    const remainder = sum % 11;
    const checkDigit = 11 - remainder;
    let expectedDigit;
    
    if (checkDigit >= 10) {
      expectedDigit = checkDigit - 10;
    } else {
      expectedDigit = checkDigit;
    }
    
    return parseInt(cleanRUC[10]) === expectedDigit;
  },

  /**
   * Valida DNI peruano (8 dígitos)
   * @param {string} dni 
   * @returns {boolean}
   */
  isValidDNI(dni) {
    if (!dni) return false;
    const cleanDNI = dni.replace(/\s/g, '');
    return /^\d{8}$/.test(cleanDNI);
  },

  /**
   * Valida RUC o DNI
   * @param {string} document 
   * @returns {boolean}
   */
  isValidDocument(document) {
    if (!document) return false;
    const clean = document.replace(/\s/g, '');
    if (clean.length === 11) return this.isValidRUC(clean);
    if (clean.length === 8) return this.isValidDNI(clean);
    return false;
  },

  /**
   * Valida formato de email
   * @param {string} email 
   * @returns {boolean}
   */
  isValidEmail(email) {
    if (!email) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
  },

  /**
   * Valida teléfono peruano (9 dígitos, empieza con 9)
   * @param {string} phone 
   * @returns {boolean}
   */
  isValidPhone(phone) {
    if (!phone) return false;
    const clean = phone.replace(/[\s\-\(\)]/g, '');
    // Acepta formatos: 9XXXXXXXX, +51 9XXXXXXXX, 51 9XXXXXXXX
    const regex = /^(\+?51\s?)?9\d{8}$/;
    return regex.test(clean);
  },

  /**
   * Valida número positivo
   * @param {number} value 
   * @returns {boolean}
   */
  isPositiveNumber(value) {
    if (value === null || value === undefined || value === '') return false;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  },

  /**
   * Sanitiza string para prevenir XSS
   * @param {string} str 
   * @returns {string}
   */
  sanitize(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Valida objeto de cliente
   * @param {Object} client 
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateClient(client) {
    const errors = [];
    
    if (!client.name || client.name.trim().length < 3) {
      errors.push('El nombre del cliente debe tener al menos 3 caracteres');
    }
    
    if (client.document) {
      const doc = client.document.replace(/\s/g, '');
      if (doc.length === 11 && !this.isValidRUC(doc)) {
        errors.push('El RUC ingresado no es válido');
      } else if (doc.length === 8 && !this.isValidDNI(doc)) {
        errors.push('El DNI ingresado no es válido');
      } else if (![8, 11].includes(doc.length) && doc.length > 0) {
        errors.push('El documento debe tener 8 dígitos (DNI) o 11 dígitos (RUC)');
      }
    }
    
    if (client.email && !this.isValidEmail(client.email)) {
      errors.push('El email ingresado no es válido');
    }
    
    if (client.phone && !this.isValidPhone(client.phone)) {
      errors.push('El teléfono debe ser un número peruano válido (9 dígitos, empieza con 9)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Valida objeto de cotización
   * @param {Object} quote 
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateQuote(quote) {
    const errors = [];
    
    // Validar cliente
    const clientValidation = this.validateClient(quote.client);
    if (!clientValidation.valid) {
      errors.push(...clientValidation.errors);
    }
    
    // Validar items
    if (!quote.items || quote.items.length === 0) {
      errors.push('Debe agregar al menos un item a la cotización');
    } else {
      quote.items.forEach((item, index) => {
        if (!item.description || item.description.trim().length < 3) {
          errors.push(`Item ${index + 1}: La descripción debe tener al menos 3 caracteres`);
        }
        if (!this.isPositiveNumber(item.quantity) || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: La cantidad debe ser mayor a 0`);
        }
        if (!this.isPositiveNumber(item.unitPrice)) {
          errors.push(`Item ${index + 1}: El precio unitario debe ser mayor o igual a 0`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Valida datos de empresa
   * @param {Object} company 
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateCompany(company) {
    const errors = [];
    
    if (!company.name || company.name.trim().length < 3) {
      errors.push('El nombre de la empresa debe tener al menos 3 caracteres');
    }
    
    if (company.ruc) {
      if (!this.isValidRUC(company.ruc)) {
        errors.push('El RUC de la empresa no es válido');
      }
    } else {
      errors.push('El RUC de la empresa es requerido');
    }
    
    if (company.email && !this.isValidEmail(company.email)) {
      errors.push('El email de la empresa no es válido');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Exportar como módulo ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validators;
}
