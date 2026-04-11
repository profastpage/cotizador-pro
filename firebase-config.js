// Firebase Configuration
// Reemplaza con tus credenciales de Firebase Console
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Super Admin Email (SOLO ESTE EMAIL TIENE ACCESO AL PANEL ADMIN)
const SUPER_ADMIN_EMAIL = "tu-email@gmail.com";

// Planes disponibles con límites reales
const PLANS = {
  free: {
    id: 'free',
    name: 'Prueba Gratuita',
    price: 0,
    quotesPerMonth: 5,
    bankAccounts: 1,
    duplicateQuotes: false,
    exportImport: false,
    watermark: false,
    multiUser: false,
    support: 'básico',
    historyDays: 30,
    features: [
      '5 cotizaciones al mes',
      'PDF básico',
      '1 cuenta bancaria',
      'Historial 30 días'
    ]
  },
  basic: {
    id: 'basic',
    name: 'Básico',
    price: 20,
    quotesPerMonth: 20,
    bankAccounts: 3,
    duplicateQuotes: false,
    exportImport: false,
    watermark: false,
    multiUser: false,
    support: 'email',
    historyDays: -1,
    features: [
      '20 cotizaciones al mes',
      'PDF profesional',
      '3 cuentas bancarias',
      'Historial completo',
      'Soporte por email'
    ]
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 40,
    quotesPerMonth: 50,
    bankAccounts: -1,
    duplicateQuotes: true,
    exportImport: true,
    watermark: false,
    multiUser: false,
    support: 'prioritario',
    historyDays: -1,
    features: [
      '50 cotizaciones al mes',
      'PDF premium',
      'Cuentas bancarias ilimitadas',
      'Historial completo',
      'Duplicar cotizaciones',
      'Exportar/Importar datos',
      'Soporte prioritario'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 60,
    quotesPerMonth: -1,
    bankAccounts: -1,
    duplicateQuotes: true,
    exportImport: true,
    watermark: true,
    multiUser: true,
    support: 'VIP 24/7',
    historyDays: -1,
    features: [
      'Cotizaciones ILIMITADAS',
      'PDF premium personalizado',
      'Cuentas bancarias ilimitadas',
      'Historial ilimitado',
      'Duplicar cotizaciones',
      'Exportar/Importar datos',
      'Marca de agua personalizada',
      'Soporte VIP 24/7',
      'Multi-usuario'
    ]
  }
};

// Duraciones de licencia disponibles
const LICENSE_DURATIONS = {
  1: { label: '1 Mes', multiplier: 1 },
  3: { label: '3 Meses (Trimestral)', multiplier: 3, discount: 0.10 },
  6: { label: '6 Meses (Semestral)', multiplier: 6, discount: 0.15 },
  12: { label: '12 Meses (Anual)', multiplier: 12, discount: 0.20 },
  0: { label: 'Ilimitado', multiplier: 0, discount: 0 }
};
