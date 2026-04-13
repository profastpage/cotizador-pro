// Firebase Configuration - SDK Modular v10+
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBE61OROA5PenPM-3wKwJaKWpxa4OiEk48",
  authDomain: "cotizapro-34b07.firebaseapp.com",
  projectId: "cotizapro-34b07",
  storageBucket: "cotizapro-34b07.firebasestorage.app",
  messagingSenderId: "886349689737",
  appId: "1:886349689737:web:e2211a67c86ad958516758"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Super Admin Email (SOLO ESTE EMAIL TIENE ACCESO AL PANEL ADMIN)
export const SUPER_ADMIN_EMAIL = "admin@cotizadorpro.com";

// Tipos de documentos disponibles
export const DOCUMENT_TYPES = {
  cotizacion: {
    id: 'cotizacion',
    name: 'Cotización',
    icon: '📋',
    description: 'Cotización de productos o servicios',
    headerTitle: 'COTIZACIÓN',
    footerText: '¡GRACIAS POR SU PREFERENCIA!'
  },
  propuesta: {
    id: 'propuesta',
    name: 'Propuesta Comercial',
    icon: '💼',
    description: 'Propuesta comercial detallada',
    headerTitle: 'PROPUESTA COMERCIAL',
    footerText: '¡ESPERAMOS SU PRONTA RESPUESTA!'
  },
  nota_venta: {
    id: 'nota_venta',
    name: 'Nota de Venta',
    icon: '🧾',
    description: 'Nota de venta o comprobante',
    headerTitle: 'NOTA DE VENTA',
    footerText: '¡GRACIAS POR SU COMPRA!'
  },
  orden_servicio: {
    id: 'orden_servicio',
    name: 'Orden de Servicio',
    icon: '🔧',
    description: 'Orden de servicio o trabajo',
    headerTitle: 'ORDEN DE SERVICIO',
    footerText: '¡SERVICIO GARANTIZADO!'
  },
  factura: {
    id: 'factura',
    name: 'Factura',
    icon: '📄',
    description: 'Factura electrónica',
    headerTitle: 'FACTURA',
    footerText: 'DOCUMENTO VÁLIDO PARA TRIBUTACIÓN'
  },
  boleta: {
    id: 'boleta',
    name: 'Boleta de Venta',
    icon: '🎫',
    description: 'Boleta de venta',
    headerTitle: 'BOLETA DE VENTA',
    footerText: 'GRACIAS POR SU PREFERENCIA'
  },
  recibo: {
    id: 'recibo',
    name: 'Recibo',
    icon: '💵',
    description: 'Recibo de pago',
    headerTitle: 'RECIBO',
    footerText: 'PAGO REGISTRADO'
  },
  contrato: {
    id: 'contrato',
    name: 'Contrato',
    icon: '📝',
    description: 'Contrato de servicios',
    headerTitle: 'CONTRATO',
    footerText: 'DOCUMENTO LEGAL VÁLIDO'
  },
  garantia: {
    id: 'garantia',
    name: 'Certificado de Garantía',
    icon: '✅',
    description: 'Certificado de garantía',
    headerTitle: 'CERTIFICADO DE GARANTÍA',
    footerText: 'GARANTÍA VIGENTE'
  },
  personalizado: {
    id: 'personalizado',
    name: 'Documento Personalizado',
    icon: '✨',
    description: 'Documento con formato personalizado',
    headerTitle: 'DOCUMENTO',
    footerText: 'DOCUMENTO GENERADO POR CotizaPro'
  }
};

// Planes con precios y características reales diferenciadas
export const PLANS = {
  free: {
    id: 'free',
    name: 'Gratis',
    price: 0,
    priceLabel: 'S/ 0',
    quotesPerMonth: 3,
    maxCompanies: 1,
    maxClients: 10,
    maxBankAccounts: 1,
    maxTemplates: 1,
    documentTypes: ['cotizacion'],
    duplicateQuotes: false,
    exportImport: false,
    watermark: false,
    multiUser: false,
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
    historyDays: 30,
    pdfQuality: 'básico',
    features: [
      '3 cotizaciones de prueba/mes',
      '1 empresa',
      '10 clientes máximo',
      '1 tipo: Cotización',
      'PDF estándar',
      'Historial 30 días',
      '1 cuenta bancaria'
    ],
    limitations: [
      'Solo Cotización básica',
      'Sin duplicar documentos',
      'Sin exportar/importar',
      'Sin marca personalizada',
      'Soporte básico por email'
    ]
  },
  basic: {
    id: 'basic',
    name: 'Básico',
    price: 35,
    priceLabel: 'S/ 35/mes',
    quotesPerMonth: 60,
    maxCompanies: 1,
    maxClients: 50,
    maxBankAccounts: 3,
    maxTemplates: 1,
    documentTypes: ['cotizacion'],
    duplicateQuotes: false,
    exportImport: false,
    watermark: false,
    multiUser: false,
    customBranding: false,
    apiAccess: false,
    prioritySupport: true,
    historyDays: -1,
    pdfQuality: 'profesional',
    features: [
      '60 cotizaciones al mes',
      '1 empresa',
      '50 clientes',
      '1 tipo: Cotización profesional',
      'PDF profesional con logo',
      'Historial ilimitado',
      '3 cuentas bancarias',
      'Soporte prioritario'
    ],
    limitations: [
      'Solo Cotización',
      'Sin duplicar documentos',
      'Sin exportar/importar',
      'Sin API access'
    ]
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 59,
    priceLabel: 'S/ 59/mes',
    quotesPerMonth: 200,
    maxCompanies: 3,
    maxClients: 200,
    maxBankAccounts: 10,
    maxTemplates: 4,
    documentTypes: ['cotizacion', 'propuesta', 'nota_venta', 'orden_servicio'],
    duplicateQuotes: true,
    exportImport: true,
    watermark: false,
    multiUser: false,
    customBranding: true,
    apiAccess: false,
    prioritySupport: true,
    historyDays: -1,
    pdfQuality: 'premium',
    features: [
      '200 documentos al mes',
      '3 empresas',
      '200 clientes',
      '4 tipos: Cotización, Propuesta, Nota de Venta, Orden de Servicio',
      'PDF premium con branding',
      'Historial ilimitado',
      '10 cuentas bancarias',
      'Duplicar documentos',
      'Exportar/Importar Excel',
      'Marca personalizada',
      'Soporte prioritario 24/7'
    ],
    limitations: [
      'Sin API access',
      'Máximo 1 usuario'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 99,
    priceLabel: 'S/ 99/mes',
    quotesPerMonth: -1,
    maxCompanies: 5,
    maxClients: -1,
    maxBankAccounts: -1,
    maxTemplates: 10,
    documentTypes: ['cotizacion', 'propuesta', 'nota_venta', 'orden_servicio', 'factura', 'boleta', 'recibo', 'contrato', 'garantia', 'personalizado'],
    duplicateQuotes: true,
    exportImport: true,
    watermark: true,
    multiUser: true,
    customBranding: true,
    apiAccess: true,
    prioritySupport: true,
    historyDays: -1,
    pdfQuality: 'enterprise',
    features: [
      'Documentos ILIMITADOS',
      '5 empresas',
      'Clientes ILIMITADOS',
      '10 tipos de documentos + personalizados',
      'Cotización, Propuesta, Nota de Venta, Orden de Servicio',
      'Factura, Boleta, Recibo, Contrato, Garantía',
      'PDF enterprise personalizado',
      'Historial ilimitado',
      'Cuentas bancarias ilimitadas',
      'Duplicar documentos',
      'Exportar/Importar Excel y CSV',
      'Marca de agua personalizada',
      'Multi-usuario (hasta 5)',
      'API REST access',
      'Soporte VIP 24/7',
      'Integraciones personalizadas',
      'Reportes avanzados'
    ],
    limitations: []
  }
};

// Duraciones de licencia disponibles
export const LICENSE_DURATIONS = {
  1: { label: '1 Mes', multiplier: 1 },
  3: { label: '3 Meses (Trimestral)', multiplier: 3, discount: 0.10 },
  6: { label: '6 Meses (Semestral)', multiplier: 6, discount: 0.15 },
  12: { label: '12 Meses (Anual)', multiplier: 12, discount: 0.20 },
  0: { label: 'Ilimitado', multiplier: 0, discount: 0 }
};

// Export Firebase instances and methods
export { auth, db, googleProvider, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue };
export default app;
