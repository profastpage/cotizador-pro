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

// Planes disponibles
const PLANS = {
  free: {
    id: 'free',
    name: 'Prueba Gratuita',
    price: 0,
    quotesPerMonth: 5,
    features: [
      '5 cotizaciones al mes',
      'PDF básico',
      '1 cuenta bancaria'
    ]
  },
  basic: {
    id: 'basic',
    name: 'Básico',
    price: 20,
    quotesPerMonth: 20,
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
    quotesPerMonth: -1, // -1 = ilimitado
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
