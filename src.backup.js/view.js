// View - Shared Quote Viewer
import { db, doc, getDoc } from '../firebase-config.js';

const urlParams = new URLSearchParams(window.location.search);
const quoteId = urlParams.get('id');
const shareToken = urlParams.get('token');

async function loadQuote() {
  const loadingEl = document.getElementById('state-loading');
  const errorEl = document.getElementById('state-error');
  const pdfEl = document.getElementById('pdf-display');
  const infoEl = document.getElementById('quote-info');
  const actionsEl = document.getElementById('header-actions');

  if (!quoteId) {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    document.getElementById('error-title').textContent = 'Cotización no encontrada';
    document.getElementById('error-message').textContent = 'No se proporcionó un ID de cotización.';
    return;
  }

  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteSnap = await getDoc(quoteRef);

    if (!quoteSnap.exists()) {
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
      document.getElementById('error-title').textContent = 'Cotización no encontrada';
      document.getElementById('error-message').textContent = 'El enlace que seguiste puede haber expirado o ser inválido.';
      return;
    }

    const quoteData = quoteSnap.data();

    // Check if quote is shared
    if (!quoteData.isShared && shareToken) {
      // Token-based access
      if (quoteData.shareToken !== shareToken) {
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        document.getElementById('error-title').textContent = 'Enlace inválido';
        document.getElementById('error-message').textContent = 'Este enlace de compartir no es válido o ha expirado.';
        return;
      }
    } else if (!quoteData.isShared && !shareToken) {
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
      document.getElementById('error-title').textContent = 'Cotización privada';
      document.getElementById('error-message').textContent = 'Esta cotización no está compartida públicamente.';
      return;
    }

    // Update header info
    const clientName = quoteData.client?.name || 'Sin cliente';
    const docType = quoteData.documentType || 'cotización';
    const docTypes = {
      cotizacion: 'Cotización',
      propuesta: 'Propuesta',
      nota_venta: 'Nota de Venta',
      orden_servicio: 'Orden de Servicio',
      factura: 'Factura',
      boleta: 'Boleta',
      recibo: 'Recibo',
      proforma: 'Proforma',
      presupuesto: 'Presupuesto',
      carta_presentacion: 'Carta de Presentación'
    };
    const typeName = docTypes[docType] || 'Cotización';
    const quoteNum = quoteData.number || quoteId.slice(0, 8);
    infoEl.textContent = `${typeName} #${quoteNum} - ${clientName}`;

    // Generate PDF blob URL and display
    const pdfBlobUrl = await generatePDFBlob(quoteData);
    if (pdfBlobUrl) {
      loadingEl.classList.add('hidden');
      pdfEl.classList.remove('hidden');
      actionsEl.classList.remove('hidden');
      pdfEl.src = pdfBlobUrl;

      // Store for download
      window._quotePdfBlobUrl = pdfBlobUrl;
      window._quoteFileName = `${typeName}_${String(quoteNum).padStart(3, '0')}_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    } else {
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
      document.getElementById('error-title').textContent = 'Error al generar PDF';
      document.getElementById('error-message').textContent = 'No se pudo generar la vista previa del documento.';
    }
  } catch (error) {
    console.error('Error loading quote:', error);
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    document.getElementById('error-title').textContent = 'Error al cargar';
    document.getElementById('error-message').textContent = 'Ocurrió un error al cargar la cotización. Intenta de nuevo.';
  }
}

async function generatePDFBlob(quoteData) {
  try {
    const { jsPDF } = await loadJsPDF();
    const doc = new jsPDF();

    const client = quoteData.client || {};
    const items = quoteData.items || [];
    const subtotal = quoteData.subtotal || 0;
    const igv = quoteData.igv || 0;
    const total = quoteData.total || 0;
    const igvEnabled = quoteData.igvEnabled !== false;
    const igvType = quoteData.igvType || 'apart';
    const issueDate = quoteData.issueDate || '-';
    const dueDate = quoteData.dueDate || '-';
    const company = quoteData.company || {};

    // Page setup
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(company.name || 'Mi Empresa', 20, 20);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);

    let yPos = 27;
    if (company.address) { doc.text(company.address, 20, yPos); yPos += 5; }
    if (company.email) { doc.text(company.email, 20, yPos); yPos += 5; }
    if (company.phone) { doc.text(company.phone, 20, yPos); yPos += 5; }

    // Header line
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(1);
    doc.line(20, 42, 190, 42);

    // Client info
    const clientName = client.name || 'Sin nombre';
    const clientDoc = client.document || '-';
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('CLIENTE:', 25, 50);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text(clientName, 25, 55);
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text('RUC/DNI: ' + clientDoc, 25, 60);
    if (client.address) doc.text('Dirección: ' + client.address, 80, 60);
    if (client.email) doc.text('Email: ' + client.email, 140, 60);
    if (client.phone) doc.text('Tel: ' + client.phone, 25, 65);

    // Dates
    doc.setFontSize(8);
    doc.text('Emisión: ' + issueDate, 150, 50);
    doc.text('Vencimiento: ' + dueDate, 150, 55);

    // Items table
    let y = 75;
    doc.setFillColor(30, 64, 175);
    doc.rect(20, y, 170, 7, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('CANT.', 25, y + 5);
    doc.text('DESCRIPCIÓN', 45, y + 5);
    doc.text('P. UNIT.', 135, y + 5);
    doc.text('TOTAL', 175, y + 5, { align: 'right' });
    y += 9;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    items.forEach((item, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const qty = item.quantity || 0;
      const price = item.unitPrice || 0;
      const lineTotal = qty * price;
      const desc = (item.description || 'Sin descripción').substring(0, 60);

      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(20, y - 2, 170, 7, 'F');
      }
      doc.text(String(qty), 25, y + 3);
      doc.text(desc, 45, y + 3);
      doc.text('S/ ' + price.toFixed(2), 135, y + 3);
      doc.text('S/ ' + lineTotal.toFixed(2), 183, y + 3, { align: 'right' });
      y += 7;
    });

    // Totals
    y += 5;
    doc.setDrawColor(30, 64, 175);
    doc.line(20, y, 190, y);
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('SUBTOTAL:', 130, y);
    doc.setTextColor(30, 41, 59);
    doc.text('S/ ' + subtotal.toFixed(2), 183, y, { align: 'right' });
    y += 6;

    if (igvEnabled) {
      doc.setTextColor(100, 116, 139);
      doc.text('IGV (18%):', 130, y);
      doc.setTextColor(30, 41, 59);
      doc.text('S/ ' + igv.toFixed(2), 183, y, { align: 'right' });
      y += 6;
    }

    doc.setLineWidth(0.5);
    doc.line(130, y, 190, y);
    y += 7;

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('TOTAL:', 130, y);
    doc.text('S/ ' + total.toFixed(2), 183, y, { align: 'right' });

    // Footer
    const footerY = Math.max(y + 20, 275);
    doc.setDrawColor(30, 64, 175);
    doc.line(20, footerY, 190, footerY);
    doc.setFontSize(8);
    doc.setTextColor(30, 64, 175);
    doc.text('Documento generado por CotizaPro', 105, footerY + 5, { align: 'center' });

    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  }
}

function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf);
    script.onerror = () => reject(new Error('Failed to load PDF library'));
    document.head.appendChild(script);
  });
}

window.downloadPDF = function() {
  if (window._quotePdfBlobUrl && window._quoteFileName) {
    const a = document.createElement('a');
    a.href = window._quotePdfBlobUrl;
    a.download = window._quoteFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

// Load quote on page load
loadQuote();
