# CotizaPro SaaS - Sistema de Cotizaciones Profesionales

## 📂 Estructura del Proyecto

```
COTIZA PRO/
├── firebase-config.js       # Configuración de Firebase
├── public/                  # Landing + Login/Registro
│   ├── index.html           # Landing page
│   ├── styles-landing.css   # Estilos landing
│   └── auth.js              # Autenticación
├── admin/                   # Panel Super Administrador
│   ├── index.html           # Dashboard admin
│   ├── styles-admin.css     # Estilos admin
│   └── admin.js             # Lógica admin
├── app/                     # Panel de Usuario
│   ├── index.html           # App de cotizaciones
│   ├── styles-app.css       # Estilos app
│   └── app-user.js          # Lógica usuario
└── README.md                # Este archivo
```

## 🔧 Configuración

### 1. Firebase Setup

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita:
   - Authentication → Email/Password
   - Firestore Database
4. Copia la configuración en `firebase-config.js`

### 2. Configurar Super Admin

En `firebase-config.js`, cambia:
```javascript
const SUPER_ADMIN_EMAIL = "tu-email@gmail.com";
```

### 3. Deploy

**Cloudflare Pages (Recomendado):**
```bash
git init
git add .
git commit -m "CotizaPro SaaS v1.0"
git push origin master
```

Conecta tu repo en Cloudflare Pages.

## 📋 Planes

| Plan | Precio | Cotizaciones/mes |
|------|--------|------------------|
| Gratis | S/ 0 | 5 |
| Básico | S/ 20 | 20 |
| Business | S/ 40 | 50 |
| Pro | S/ 60 | Ilimitado |

## 🚀 Uso

### Como Super Admin:
1. Regístrate con el email configurado como SUPER_ADMIN_EMAIL
2. Automáticamente serás redirigido al panel de administración
3. Gestiona usuarios, activa planes, resetea créditos

### Como Usuario:
1. Regístrate desde la landing page
2. Configura los datos de tu empresa
3. Crea cotizaciones (respetando el límite de tu plan)
4. Genera PDFs profesionales

## 🔐 Reglas de Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users: solo el propio usuario puede leer/escribir
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Quotes: solo el propio usuario puede CRUD
    match /quotes/{quoteId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Companies: solo el propio usuario
    match /companies/{companyId} {
      allow read, write: if request.auth != null && request.auth.uid == companyId;
    }
  }
}
```

## 📱 PWA Ready

La app es 100% responsive y funciona en:
- Móvil (Android/iOS)
- Tablet
- Desktop
