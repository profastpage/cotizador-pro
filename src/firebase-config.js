// Firebase Configuration - SDK Modular v10+
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
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

// Planes con precios y características reales diferenciadas
export const PLANS = {
  free: {
    id: 'free',
    name: 'Gratis',
    price: 0,
    priceLabel: 'S/ 0',
    quotesPerMonth: 5,
    maxClients: 10,
    maxBankAccounts: 1,
    maxTemplates: 1,
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
      '5 cotizaciones al mes',
      '10 clientes máximo',
      '1 plantilla básica',
      'PDF estándar',
      'Historial 30 días',
      '1 cuenta bancaria'
    ],
    limitations: [
      'Sin duplicar cotizaciones',
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
    maxClients: 50,
    maxBankAccounts: 3,
    maxTemplates: 2,
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
      '20 cotizaciones al mes',
      '50 clientes',
      '2 plantillas profesionales',
      'PDF profesional con logo',
      'Historial ilimitado',
      '3 cuentas bancarias',
      'Soporte prioritario'
    ],
    limitations: [
      'Sin duplicar cotizaciones',
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
    maxClients: 200,
    maxBankAccounts: 10,
    maxTemplates: 5,
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
      '50 cotizaciones al mes',
      '200 clientes',
      '5 plantillas premium',
      'PDF premium con branding',
      'Historial ilimitado',
      '10 cuentas bancarias',
      'Duplicar cotizaciones',
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
    maxClients: -1,
    maxBankAccounts: -1,
    maxTemplates: -1,
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
      'Cotizaciones ILIMITADAS',
      'Clientes ILIMITADOS',
      'Plantillas ILIMITADAS',
      'PDF enterprise personalizado',
      'Historial ilimitado',
      'Cuentas bancarias ilimitadas',
      'Duplicar cotizaciones',
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
export { auth, db, googleProvider, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, addDoc, serverTimestamp, increment, FieldValue };
export default app;
