/* ==========================================================
   PDF GENERATOR - CotizaPro
   Generación de PDF profesional usando jsPDF
   Diseño basado en cotizaciones profesionales peruanas
========================================================== */

const PDFGenerator = {
  /**
   * Genera PDF de cotización profesional
   * @param {Object} quote - Datos de la cotización
   * @param {Object} company - Datos de la empresa
   * @param {Object} settings - Configuración
   * @returns {Promise<Blob>}
   */
  async generateQuotePDF(quote, company, settings) {
    // Cargar jsPDF desde CDN
    if (!window.jspdf) {
      await this.loadJSPDF();
    }
    
    const { jsPDF } = window.jspdf;
    
    // Crear documento A4
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Colores
    const primaryColor = [30, 64, 175]; // Azul corporativo
    const secondaryColor = [100, 116, 139]; // Gris
    const lightGray = [241, 245, 249];
    const darkGray = [51, 65, 85];
    const borderColor = [203, 213, 225];
    
    let yPos = margin;
    
    // ==========================================================
    // HELPER FUNCTIONS
    // ==========================================================
    
    const checkPageBreak = (needed) => {
      if (yPos + needed > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };
    
    const addLine = (color = borderColor, width = 0.5) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(width);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 3;
    };
    
    const drawRect = (x, y, w, h, fillColor, strokeColor = null) => {
      if (fillColor) {
        doc.setFillColor(...fillColor);
        doc.rect(x, y, w, h, 'F');
      }
      if (strokeColor) {
        doc.setDrawColor(...strokeColor);
        doc.rect(x, y, w, h, 'S');
      }
    };
    
    const formatCurrency = (amount) => {
      return `S/ ${parseFloat(amount).toFixed(2)}`;
    };
    
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };
    
    // ==========================================================
    // HEADER - Logo y datos de empresa
    // ==========================================================
    
    // Logo (si existe)
    if (company.logo) {
      try {
        doc.addImage(company.logo, 'PNG', margin, yPos, 30, 20);
      } catch (e) {
        console.warn('No se pudo agregar el logo:', e);
      }
    }
    
    // Datos de la empresa (centro-derecha)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('COTIZACIÓN', pageWidth - margin, yPos + 6, { align: 'right' });
    
    yPos += 12;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    doc.text(company.name || 'Empresa', margin + 32, yPos, { maxWidth: 90 });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryColor);
    
    if (company.ruc) {
      doc.text(`RUC: ${company.ruc}`, pageWidth - margin, yPos, { align: 'right' });
    }
    yPos += 4;
    
    if (company.address) {
      doc.text(company.address, margin + 32, yPos, { maxWidth: 90 });
    }
    if (company.phone) {
      doc.text(`Tel: ${company.phone}`, pageWidth - margin, yPos, { align: 'right' });
    }
    yPos += 4;
    
    if (company.email) {
      doc.text(company.email, margin + 32, yPos, { maxWidth: 90 });
    }
    if (company.website) {
      doc.text(company.website, pageWidth - margin, yPos, { align: 'right' });
    }
    yPos += 8;
    
    addLine(primaryColor, 1.5);
    
    // ==========================================================
    // INFO DE COTIZACIÓN (Número, fechas, moneda)
    // ==========================================================
    
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryColor);
    
    // Número
    doc.text('NÚMERO:', margin + 5, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.text(`#${quote.number || 'N/A'}`, margin + 5, yPos + 12);
    
    // Fecha emisión
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryColor);
    doc.text('FECHA EMISIÓN:', margin + 55, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.text(formatDate(quote.issueDate), margin + 55, yPos + 12);
    
    // Fecha vencimiento
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryColor);
    doc.text('FECHA VENCIMIENTO:', margin + 105, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.text(formatDate(quote.dueDate), margin + 105, yPos + 12);
    
    // Moneda
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryColor);
    doc.text('MONEDA:', margin + 150, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.text('PEN (Soles)', margin + 150, yPos + 12);
    
    yPos += 24;
    
    // ==========================================================
    // DATOS DEL CLIENTE
    // ==========================================================
    
    doc.setFillColor(...primaryColor);
    doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', margin + 5, yPos + 5.5);
    yPos += 12;
    
    // Fondo gris claro para datos del cliente
    const clientBoxHeight = quote.client.email || quote.client.phone ? 26 : 22;
    drawRect(margin, yPos, contentWidth, clientBoxHeight, lightGray, borderColor);
    
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    
    // Documento
    doc.setFont('helvetica', 'bold');
    doc.text('RUC/DNI:', margin + 5, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.client.document || '-', margin + 25, yPos + 6);
    
    // Razón Social / Nombre
    doc.setFont('helvetica', 'bold');
    doc.text('RAZÓN SOCIAL:', margin + 90, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.client.name || '-', margin + 125, yPos + 6, { maxWidth: 55 });
    
    if (quote.client.email) {
      doc.setFont('helvetica', 'bold');
      doc.text('EMAIL:', margin + 5, yPos + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.client.email, margin + 25, yPos + 12, { maxWidth: 80 });
    }
    
    if (quote.client.phone) {
      const phoneX = quote.client.email ? 90 : 5;
      doc.setFont('helvetica', 'bold');
      doc.text('TELÉFONO:', phoneX, yPos + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.client.phone, phoneX + 20, yPos + 12, { maxWidth: 55 });
    }
    
    if (quote.client.address) {
      doc.setFont('helvetica', 'bold');
      doc.text('DIRECCIÓN:', margin + 5, yPos + 18);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.client.address, margin + 25, yPos + 18, { maxWidth: 150 });
    }
    
    yPos += clientBoxHeight + 8;
    
    // ==========================================================
    // TABLA DE ITEMS
    // ==========================================================
    
    // Header de tabla
    doc.setFillColor(...primaryColor);
    doc.rect(margin, yPos, contentWidth, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    const colX = {
      num: margin + 3,
      qty: margin + 18,
      desc: margin + 33,
      unit: margin + 125,
      total: margin + 150
    };
    
    doc.text('CANT.', colX.qty, yPos + 6);
    doc.text('DESCRIPCIÓN', colX.desc, yPos + 6);
    doc.text('P. UNIT.', colX.unit, yPos + 6, { align: 'right' });
    doc.text('TOTAL', colX.total, yPos + 6, { align: 'right' });
    
    yPos += 9;
    
    // Filas de items
    doc.setFontSize(8);
    quote.items.forEach((item, index) => {
      const rowHeight = 8;
      
      // Verificar si necesitamos nueva página
      checkPageBreak(rowHeight + 30); // +30 para totales
      
      // Alternar colores de fondo
      if (index % 2 === 0) {
        doc.setFillColor(...lightGray);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
      }
      
      // Bordes
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      
      const itemTotal = item.quantity * item.unitPrice;
      
      // Contenido de la fila
      doc.setTextColor(...darkGray);
      doc.setFont('helvetica', 'normal');
      doc.text(String(index + 1), colX.num, yPos + 5.5);
      doc.text(String(item.quantity), colX.qty, yPos + 5.5);
      doc.text(item.description || '-', colX.desc, yPos + 5.5, { maxWidth: 88 });
      doc.text(formatCurrency(item.unitPrice), colX.unit, yPos + 5.5, { align: 'right' });
      doc.text(formatCurrency(itemTotal), colX.total, yPos + 5.5, { align: 'right' });
      
      yPos += rowHeight;
    });
    
    // Borde inferior de tabla
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 3;
    
    // ==========================================================
    // TOTALES
    // ==========================================================
    
    const totalsBoxWidth = 70;
    const totalsX = pageWidth - margin - totalsBoxWidth;
    
    doc.setFontSize(8);
    
    // Subtotal
    doc.setTextColor(...secondaryColor);
    doc.setFont('helvetica', 'normal');
    doc.text('SUBTOTAL:', totalsX, yPos + 5);
    doc.text(formatCurrency(quote.subtotal), pageWidth - margin - 5, yPos + 5, { align: 'right' });
    yPos += 6;
    
    // IGV
    doc.text(`IGV (${(quote.igvRate * 100).toFixed(0)}%):`, totalsX, yPos + 5);
    doc.text(formatCurrency(quote.igv), pageWidth - margin - 5, yPos + 5, { align: 'right' });
    yPos += 6;
    
    // Línea separadora
    addLine(primaryColor, 1);
    
    // Total
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('TOTAL:', totalsX, yPos + 7);
    doc.text(formatCurrency(quote.total), pageWidth - margin - 5, yPos + 7, { align: 'right' });
    
    yPos += 18;
    
    // ==========================================================
    // CONDICIONES DE PAGO
    // ==========================================================
    
    if (quote.paymentTerms || company.paymentTerms) {
      checkPageBreak(25);
      
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('CONDICIONES DE PAGO', margin + 5, yPos + 5.5);
      yPos += 12;
      
      doc.setTextColor(...darkGray);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.paymentTerms || company.paymentTerms || 'Contado', margin + 5, yPos + 4, { maxWidth: contentWidth - 10 });
      yPos += 12;
    }
    
    // ==========================================================
    // CUENTAS BANCARIAS
    // ==========================================================
    
    if (company.bankAccounts && company.bankAccounts.length > 0 && settings.includeBankAccounts !== false) {
      checkPageBreak(20 + (company.bankAccounts.length * 12));
      
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('CUENTAS BANCARIAS', margin + 5, yPos + 5.5);
      yPos += 12;
      
      company.bankAccounts.forEach((account, index) => {
        doc.setTextColor(...darkGray);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`${account.bank} - ${account.accountType}`, margin + 5, yPos + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(`N° ${account.accountNumber}`, margin + 5, yPos + 10);
        if (account.cci) {
          doc.text(`CCI: ${account.cci}`, margin + 70, yPos + 5);
        }
        if (account.holder) {
          doc.text(`Titular: ${account.holder}`, margin + 70, yPos + 10);
        }
        yPos += 14;
      });
    }
    
    // ==========================================================
    // VALIDEZ Y TÉRMINOS
    // ==========================================================
    
    if (settings.includeTerms !== false) {
      checkPageBreak(30);
      yPos += 3;
      
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, 'F');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('TÉRMINOS Y CONDICIONES', margin + 5, yPos + 5.5);
      yPos += 12;
      
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      
      const terms = [
        `• Esta cotización tiene una validez de ${quote.validity || company.quoteValidity || 30} días calendario.`,
        '• Los precios están expresados en Soles (PEN) e incluyen IGV.',
        '• La forma de pago y plazos están detallados en la sección de condiciones de pago.',
        '• Esta cotización está sujeta a disponibilidad de stock al momento de la orden de compra.',
        '• Para consultas, comuníquese a los datos de contacto indicados en el encabezado.'
      ];
      
      terms.forEach(term => {
        doc.text(term, margin + 5, yPos + 4, { maxWidth: contentWidth - 10 });
        yPos += 5;
      });
    }
    
    // ==========================================================
    // FOOTER
    // ==========================================================
    
    // Posicionar footer al final de la página
    yPos = pageHeight - 25;
    addLine(primaryColor, 0.5);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('¡GRACIAS POR SU PREFERENCIA!', pageWidth / 2, yPos + 6, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryColor);
    doc.text('Documento generado por CotizaPro - Sistema de Cotizaciones Profesionales', pageWidth / 2, yPos + 11, { align: 'center' });
    
    // Marca de agua (opcional)
    if (settings.watermark && settings.watermarkText) {
      doc.setTextColor(220, 220, 220);
      doc.setFontSize(50);
      doc.setFont('helvetica', 'bold');
      doc.text(settings.watermarkText, pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45
      });
    }
    
    // ==========================================================
    // GENERAR BLOB
    // ==========================================================
    
    const blob = doc.output('blob');
    return blob;
  },

  /**
   * Carga jsPDF desde CDN
   * @returns {Promise}
   */
  loadJSPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  /**
   * Descarga el PDF
   * @param {Blob} blob 
   * @param {string} filename 
   */
  downloadPDF(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Genera nombre de archivo para PDF
   * @param {Object} quote 
   * @returns {string}
   */
  generateFilename(quote) {
    const clientName = (quote.client?.name || 'cliente')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9\-]/g, '')
      .substring(0, 30);
    const number = quote.number || 'N/A';
    return `Cotizacion-${number}-${clientName}.pdf`;
  },

  /**
   * Comparte por WhatsApp
   * @param {Object} quote 
   */
  shareWhatsApp(quote) {
    const phone = quote.client?.phone?.replace(/\D/g, '') || '';
    const cleanPhone = phone.startsWith('51') ? phone : `51${phone}`;
    
    const message = this.generateWhatsAppMessage(quote);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  },

  /**
   * Genera mensaje para WhatsApp
   * @param {Object} quote 
   * @returns {string}
   */
  generateWhatsAppMessage(quote) {
    const settings = DataManager.getSettings();
    const company = DataManager.getCompany();
    
    return `¡Hola ${quote.client?.name || ''}! 👋

Te enviamos la cotización *#${quote.number}* por un total de *${settings.currencySymbol} ${quote.total.toFixed(2)}*.

📅 Fecha de emisión: ${DataManager.formatDate(quote.issueDate)}
⏰ Fecha de vencimiento: ${DataManager.formatDate(quote.dueDate)}

El PDF detallado te lo estamos enviando por este medio.

${company.name || 'Nuestra empresa'}
${company.phone || ''}
${company.email || ''}

¡Gracias por tu preferencia! 🙏`;
  },

  /**
   * Comparte por email
   * @param {Object} quote 
   */
  shareEmail(quote) {
    const company = DataManager.getCompany();
    const subject = `Cotización #${quote.number} - ${company.name}`;
    const body = this.generateEmailBody(quote);
    
    window.location.href = `mailto:${quote.client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  /**
   * Genera cuerpo de email
   * @param {Object} quote 
   * @returns {string}
   */
  generateEmailBody(quote) {
    const company = DataManager.getCompany();
    
    return `Estimado(a) ${quote.client?.name || ''},

Es un placer saludarle. Adjunto encontrará la cotización #${quote.number} solicitada.

RESUMEN DE LA COTIZACIÓN:
${quote.items.map((item, i) => `${i + 1}. ${item.description} - Cant: ${item.quantity} - ${DataManager.formatCurrency(item.quantity * item.unitPrice)}`).join('\n')}

SUBTOTAL: ${DataManager.formatCurrency(quote.subtotal)}
IGV: ${DataManager.formatCurrency(quote.igv)}
TOTAL: ${DataManager.formatCurrency(quote.total)}

Fecha de emisión: ${DataManager.formatDate(quote.issueDate)}
Fecha de vencimiento: ${DataManager.formatDate(quote.dueDate)}

Quedamos a su disposición para cualquier consulta.

Saludos cordiales,
${company.name}
${company.phone}
${company.email}`;
  }
};

// Exportar como módulo ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PDFGenerator;
}
