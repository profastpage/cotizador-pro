# CotizaPro SaaS - Sistema de Cotizaciones Profesionales

## 🚀 Deploy Automático en Cloudflare Pages

### Configuración Inicial (Solo la primera vez)

#### 1. Configurar Secrets en GitHub
Ve a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions** y agrega:

| Secret | Valor |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | Tu API Token de Cloudflare ([Crear aquí](https://dash.cloudflare.com/profile/api-tokens)) |
| `CLOUDFLARE_ACCOUNT_ID` | Tu Account ID de Cloudflare (en el dashboard) |

Para crear el API Token:
1. Ir a Cloudflare Dashboard → My Profile → API Tokens
2. "Create Token" → "Custom token"
3. Permisos: `Account` → `Cloudflare Pages` → `Edit`
4. Recursos: `Include` → `All accounts`

#### 2. Conectar el repositorio en Cloudflare Pages (Solo la primera vez)
1. Ve a [Cloudflare Pages](https://pages.cloudflare.com/)
2. "Create a project" → "Connect to Git"
3. Selecciona tu repo `cotizador-pro`
4. Build command: `npm run build`
5. Build output directory: `dist`
6. Framework preset: `None`

**Después de esto, cada push a `main` hará deploy automático** via GitHub Actions.

### Deploy Manual (Alternativa)
```bash
npm install
npm run build
# Subir la carpeta /dist a Cloudflare Pages
```

## 📂 Estructura del Proyecto

```
cotizador-pro/
├── .github/workflows/
│   └── deploy.yml          # CI/CD - Deploy automático a Cloudflare Pages
├── src/
│   ├── index.html          # Landing + Login/Registro (con Google Sign-In)
│   ├── superadmin.html     # Panel Super Administrador
│   ├── app.html            # Panel de Usuario (cotizaciones)
│   ├── js/
│   │   ├── auth.js         # Autenticación con sistema de recuperación
│   │   ├── superadmin.js   # Lógica del super admin + herramientas de migración
│   │   ├── app-user.js     # Lógica de usuario
│   │   └── firebase-config.js  # Configuración de Firebase
│   └── css/                # Estilos
├── public/                 # Assets estáticos, PWA
├── firestore.rules         # Reglas de seguridad de Firestore
├── firestore.indexes.json  # Índices compuestos de Firestore
├── vite.config.js          # Configuración de Vite
└── package.json
```

## 🔧 Configuración

### 1. Firebase Setup
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Habilita: **Authentication** (Email/Password + Google Sign-In) + **Firestore Database**
3. Copia la configuración en `src/firebase-config.js`

### 2. Firestore Rules
Copia el contenido de `firestore.rules` en Firebase Console → Firestore → Rules.

### 3. Firestore Indexes
Copia el contenido de `firestore.indexes.json` en Firebase Console → Firestore → Indexes → "Create from JSON".

### 4. Configurar Super Admin
En `src/firebase-config.js`:
```javascript
export const SUPER_ADMIN_EMAIL = "admin@cotizadorpro.com";
```
Cualquier persona que se registre con este email obtendrá automáticamente el rol de **Super Admin**.

## 🔐 Recuperación de Cuentas (NUEVO v2.1)

### Problema resuelto
Cuando las cuentas de Firebase Auth son eliminadas, los datos en Firestore quedan huérfanos.
El sistema ahora detecta automáticamente datos huérfanos y los migra al registrar de nuevo.

### Flujo automático:
1. Usuario intenta iniciar sesión → Error "No existe cuenta"
2. Se muestra modal de **recuperación** con opción de crear cuenta nueva
3. Al registrarse, el sistema busca datos previos por email
4. Si encuentra datos huérfanos, los **migra automáticamente** al nuevo uid
5. Se muestra resumen de la migración al usuario

### Herramienta de migración manual (Super Admin):
En **Configuración** → **Herramienta de Migración de Datos**:
- **Buscar datos huérfanos**: Busca por email y muestra datos existentes
- **Migración manual**: Migra datos entre dos UIDs específicos
- **Escanear usuarios huérfanos**: Lista todos los documentos de usuario

## 📋 Planes

| Plan | Precio | Cotizaciones/mes | Características |
|------|--------|------------------|-----------------|
| Gratis | S/ 0 | 3 | PDF estándar, 1 cuenta bancaria |
| Básico | S/ 35 | 60 | PDF profesional, 3 cuentas bancarias |
| Business | S/ 59 | 200 | PDF premium, duplicar, exportar |
| Pro | S/ 99 | Ilimitado | Todo incluido, multi-usuario, API |

## 📱 PWA Ready
La app es 100% responsive y funciona en móvil, tablet y desktop.

## ✨ Novedades v2.1

- 🔧 **Sistema de recuperación de cuentas** - Migración automática de datos huérfanos
- 📊 **Herramienta de migración** en panel de Super Admin
- 🔄 **Búsqueda por email** para encontrar datos de cuentas eliminadas
- 🚀 **Deploy automático** via GitHub Actions a Cloudflare Pages
- 🛡️ **Firestore rules mejoradas** para permitir búsqueda y migración
- 📋 **Índices compuestos** preconfigurados para Firestore
