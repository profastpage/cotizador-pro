// Firebase Configuration - SDK Modular v10+
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, linkWithCredential, fetchSignInMethodsForEmail } from "firebase/auth";
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
export const SUPER_ADMIN_EMAIL = "profastpage@gmail.com";

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

// ==========================================================
// NUEVA ESTRUCTURA DE PLANES v2.0
// ==========================================================

export const PLANS = {
  free: {
    id: 'free',
    slug: 'free',
    name: 'Gratis',
    price: 0,
    priceLabel: 'Gratis',
    currency: 'PEN',
    billingCycle: 'monthly',
    quotesPerMonth: 3,
    maxCompanies: 1,
    maxClients: 10,
    maxBankAccounts: 1,
    documentTypes: ['cotizacion'],
    duplicateQuotes: false,
    exportImport: false,
    watermark: true,
    logoPersonalizado: false,
    customBranding: false,
    estadisticas: false,
    prioritySupport: false,
    historyDays: 30,
    pdfQuality: 'basico',
    soporte: 'chat',
    trialDays: 0,
    perQuotePrice: 0,
    featuresList: [
      { text: '3 cotizaciones al mes', included: true },
      { text: '10 clientes máximo', included: true },
      { text: '1 tipo: Cotización', included: true },
      { text: 'PDF estándar con marca de agua', included: true },
      { text: 'Historial 30 días', included: true },
      { text: 'Soporte por chat', included: true },
      { text: 'Logo personalizado', included: false },
      { text: 'Sin marca de agua', included: false },
      { text: 'Estadísticas', included: false }
    ],
    features: [
      '3 cotizaciones de prueba/mes',
      '10 clientes máximo',
      '1 tipo: Cotización',
      'PDF estándar',
      'Historial 30 días',
      'Soporte por chat'
    ],
    limitations: [
      'Solo Cotización básica',
      'Marca de agua en PDF',
      'Sin logo personalizado',
      'Sin estadísticas'
    ]
  },

  starter: {
    id: 'starter',
    slug: 'starter',
    name: 'Starter',
    price: 19.90,
    priceLabel: 'S/ 19.90/mes',
    currency: 'PEN',
    billingCycle: 'monthly',
    quotesPerMonth: 30,
    maxCompanies: 1,
    maxClients: 50,
    maxBankAccounts: 3,
    documentTypes: ['cotizacion', 'propuesta', 'nota_venta'],
    duplicateQuotes: false,
    exportImport: false,
    watermark: false,
    logoPersonalizado: true,
    customBranding: false,
    estadisticas: false,
    prioritySupport: false,
    historyDays: -1,
    pdfQuality: 'profesional',
    soporte: 'email',
    trialDays: 7,
    perQuotePrice: 0.66,
    featuresList: [
      { text: '30 cotizaciones al mes', included: true },
      { text: '50 clientes', included: true },
      { text: '3 tipos de documentos', included: true },
      { text: 'Logo personalizado en PDF', included: true },
      { text: 'PDF profesional sin marca de agua', included: true },
      { text: 'Historial ilimitado', included: true },
      { text: '3 cuentas bancarias', included: true },
      { text: 'Soporte por email', included: true },
      { text: 'Prueba gratis 7 días', included: true },
      { text: 'Duplicar documentos', included: false },
      { text: 'Branding personalizado', included: false },
      { text: 'Estadísticas', included: false }
    ],
    features: [
      '30 cotizaciones al mes',
      '50 clientes',
      '3 tipos: Cotización, Propuesta, Nota de Venta',
      'Logo personalizado en PDF',
      'PDF profesional sin marca de agua',
      'Historial ilimitado',
      '3 cuentas bancarias',
      'Soporte por email',
      'Prueba gratis 7 días'
    ],
    limitations: [
      'Sin duplicar documentos',
      'Sin branding personalizado',
      'Sin estadísticas'
    ]
  },

  business: {
    id: 'business',
    slug: 'business',
    name: 'Business',
    price: 35.00,
    priceLabel: 'S/ 35.00/mes',
    currency: 'PEN',
    billingCycle: 'monthly',
    quotesPerMonth: 60,
    maxCompanies: 3,
    maxClients: 200,
    maxBankAccounts: 10,
    documentTypes: ['cotizacion', 'propuesta', 'nota_venta', 'orden_servicio'],
    duplicateQuotes: true,
    exportImport: true,
    watermark: false,
    logoPersonalizado: true,
    customBranding: true,
    estadisticas: true,
    estadisticasNivel: 'basicas',
    prioritySupport: true,
    historyDays: -1,
    pdfQuality: 'premium',
    soporte: 'whatsapp_prioritario',
    trialDays: 7,
    perQuotePrice: 0.58,
    popular: true,
    featuresList: [
      { text: '60 documentos al mes', included: true },
      { text: '200 clientes', included: true },
      { text: '4 tipos de documentos', included: true },
      { text: 'Logo personalizado en PDF', included: true },
      { text: 'PDF premium con branding', included: true },
      { text: 'Branding personalizado', included: true },
      { text: 'Historial ilimitado', included: true },
      { text: '10 cuentas bancarias', included: true },
      { text: 'Duplicar documentos', included: true },
      { text: 'Exportar/Importar', included: true },
      { text: 'Estadísticas básicas', included: true },
      { text: 'Recordatorios automáticos', included: true },
      { text: 'Soporte WhatsApp prioritario', included: true },
      { text: 'Prueba gratis 7 días', included: true },
      { text: 'Multi-usuario', included: false },
      { text: 'API Access', included: false }
    ],
    features: [
      '60 documentos al mes',
      '3 empresas',
      '200 clientes',
      '4 tipos de documentos',
      'PDF premium con branding',
      'Branding personalizado',
      'Historial ilimitado',
      '10 cuentas bancarias',
      'Duplicar documentos',
      'Exportar/Importar',
      'Estadísticas básicas',
      'Recordatorios automáticos',
      'Soporte WhatsApp prioritario',
      'Prueba gratis 7 días'
    ],
    limitations: [
      'Sin multi-usuario',
      'Sin API access'
    ]
  },

  pro: {
    id: 'pro',
    slug: 'pro',
    name: 'Pro',
    price: 59.00,
    priceLabel: 'S/ 59.00/mes',
    currency: 'PEN',
    billingCycle: 'monthly',
    quotesPerMonth: -1,
    maxCompanies: 5,
    maxClients: -1,
    maxBankAccounts: -1,
    documentTypes: ['cotizacion', 'propuesta', 'nota_venta', 'orden_servicio', 'factura', 'boleta', 'recibo', 'contrato', 'garantia', 'personalizado'],
    duplicateQuotes: true,
    exportImport: true,
    watermark: true,
    logoPersonalizado: true,
    customBranding: true,
    estadisticas: true,
    estadisticasNivel: 'avanzadas',
    prioritySupport: true,
    historyDays: -1,
    pdfQuality: 'enterprise',
    soporte: 'whatsapp_prioritario',
    trialDays: 7,
    perQuotePrice: 0,
    multiUser: 3,
    apiAccess: true,
    gerenteCuenta: true,
    featuresList: [
      { text: 'Documentos ILIMITADOS', included: true },
      { text: 'Clientes ILIMITADOS', included: true },
      { text: '10 tipos de documentos + personalizados', included: true },
      { text: 'Logo personalizado en PDF', included: true },
      { text: 'PDF enterprise', included: true },
      { text: 'Branding completo', included: true },
      { text: 'Historial ilimitado', included: true },
      { text: 'Cuentas bancarias ilimitadas', included: true },
      { text: 'Duplicar documentos', included: true },
      { text: 'Exportar/Importar', included: true },
      { text: 'Estadísticas avanzadas', included: true },
      { text: 'Multi-usuario (hasta 3)', included: true },
      { text: 'API REST access', included: true },
      { text: 'Gerente de cuenta dedicado', included: true },
      { text: 'Soporte VIP 24/7', included: true },
      { text: 'Prueba gratis 7 días', included: true }
    ],
    features: [
      'Documentos ILIMITADOS',
      '5 empresas',
      'Clientes ILIMITADOS',
      '10 tipos de documentos + personalizados',
      'PDF enterprise personalizado',
      'Branding completo',
      'Historial ilimitado',
      'Cuentas bancarias ilimitadas',
      'Multi-usuario (hasta 3)',
      'API REST access',
      'Estadísticas avanzadas',
      'Gerente de cuenta dedicado',
      'Soporte VIP 24/7',
      'Prueba gratis 7 días'
    ],
    limitations: []
  },

  // LEGACY - Mantener para compatibilidad con usuarios existentes
  // NO mostrar en UI nueva, solo para migración
  basic: {
    id: 'basic',
    slug: 'basic',
    name: 'Básico (Legacy)',
    price: 35,
    priceLabel: 'S/ 35/mes',
    currency: 'PEN',
    billingCycle: 'monthly',
    quotesPerMonth: 60,
    maxCompanies: 1,
    maxClients: 50,
    maxBankAccounts: 3,
    documentTypes: ['cotizacion'],
    duplicateQuotes: false,
    exportImport: false,
    watermark: false,
    logoPersonalizado: true,
    customBranding: false,
    estadisticas: false,
    prioritySupport: true,
    historyDays: -1,
    pdfQuality: 'profesional',
    soporte: 'email',
    trialDays: 0,
    legacy: true,
    migratedTo: 'starter',
    perQuotePrice: 0.58,
    featuresList: [
      { text: '60 cotizaciones al mes', included: true },
      { text: '50 clientes', included: true },
      { text: 'Logo personalizado en PDF', included: true },
      { text: 'Historial ilimitado', included: true },
      { text: '3 cuentas bancarias', included: true },
      { text: 'Soporte prioritario', included: true }
    ],
    features: [
      '60 cotizaciones al mes',
      '50 clientes',
      'Logo personalizado en PDF',
      'Historial ilimitado',
      '3 cuentas bancarias',
      'Soporte prioritario'
    ],
    limitations: []
  }
};

// ==========================================================
// PAQUETES DE CRÉDITOS (Pay-as-you-go)
// ==========================================================

export const CREDIT_PACKAGES = [
  { id: 'pack_5', credits: 5, price: 7.50, unitPrice: 1.50, label: '5 créditos', priceLabel: 'S/ 7.50', unitLabel: 'S/ 1.50/cot' },
  { id: 'pack_15', credits: 15, price: 18.00, unitPrice: 1.20, label: '15 créditos', priceLabel: 'S/ 18.00', unitLabel: 'S/ 1.20/cot', discount: '20%' },
  { id: 'pack_30', credits: 30, price: 30.00, unitPrice: 1.00, label: '30 créditos', priceLabel: 'S/ 30.00', unitLabel: 'S/ 1.00/cot', discount: '33%', recommended: true },
  { id: 'pack_60', credits: 60, price: 48.00, unitPrice: 0.80, label: '60 créditos', priceLabel: 'S/ 48.00', unitLabel: 'S/ 0.80/cot', discount: '47%' }
];

export const CREDIT_PLAN_INFO = {
  id: 'credits',
  slug: 'credits',
  name: 'Créditos Flexibles',
  type: 'prepaid',
  currency: 'PEN',
  minCredits: 5,
  sinVencimiento: true,
  metodosPago: ['yape', 'plin', 'tarjeta'],
  features: [
    'Sin vencimiento - usa cuando quieras',
    'Pago inmediato con Yape/Plin/Tarjeta',
    'Saldo disponible al instante',
    'Mínimo 5 créditos por compra',
    '1 crédito = 1 cotización PDF'
  ]
};

// Duraciones de licencia disponibles
export const LICENSE_DURATIONS = {
  1: { label: '1 Mes', multiplier: 1 },
  3: { label: '3 Meses (Trimestral)', multiplier: 3, discount: 0.10 },
  6: { label: '6 Meses (Semestral)', multiplier: 6, discount: 0.15 },
  12: { label: '12 Meses (Anual)', multiplier: 12, discount: 0.20 },
  0: { label: 'Ilimitado', multiplier: 0, discount: 0 }
};

// Plan recomendado según frecuencia de uso
export const PLAN_RECOMMENDATION = {
  headline: 'Elige el plan que se adapte a tu negocio',
  subheadline: 'Paga solo por lo que usas o suscríbete y ahorra',
  guide: [
    { frequency: '1-3 veces/mes', plan: 'free', label: 'FREE' },
    { frequency: '5-10 veces/mes', plan: 'credits', label: 'Créditos' },
    { frequency: '1-2/semana', plan: 'starter', label: 'STARTER' },
    { frequency: '3-4/semana', plan: 'business', label: 'BUSINESS' },
    { frequency: 'Diario', plan: 'pro', label: 'PRO' }
  ]
};

// UPSELL messages configuration
export const UPSELL_CONFIG = {
  free_limit: {
    message: 'Desbloquea más con STARTER desde S/19.90/mes',
    trigger: 'on_limit',
    maxPerSession: 1
  },
  credits_80: {
    message: '¿Usas mucho? El plan STARTER te sale a S/0.66/cotización. ¡Ahorra 56%!',
    trigger: 'credits_80_percent',
    maxPerSession: 1
  },
  subscription_limit: {
    message: '¿Necesitas más? Cambia a BUSINESS o compra créditos extra',
    trigger: 'near_subscription_limit',
    maxPerSession: 1
  }
};

// Export Firebase instances and methods
export { auth, db, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, linkWithCredential, fetchSignInMethodsForEmail, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue };
export default app;
