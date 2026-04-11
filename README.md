# CotizaPro SaaS - Sistema de Cotizaciones Profesionales

## 🚀 Deploy en Cloudflare Pages

### Paso 1: Crear repo en GitHub
```bash
cd "C:\dev\COTIZA PRO"
git remote add origin git@github.com:profastpage/cotizador-pro.git
git push -u origin master
```

### Paso 2: Conectar en Cloudflare Pages
1. Ve a [Cloudflare Pages](https://pages.cloudflare.com/)
2. "Create a project" → "Connect to Git"
3. Selecciona tu repo `cotizador-pro`
4. Build settings: dejar vacío (es estático)
5. ¡Deploy!

## 📂 Estructura del Proyecto

```
COTIZA PRO/
├── index.html              # Landing + Login/Registro (con Google Sign-In)
├── superadmin.html         # Panel Super Administrador (/superadmin)
├── app.html                # Panel de Usuario (cotizaciones) (/app)
├── firebase-config.js      # Configuración de Firebase
├── auth.js                 # Autenticación (Google + Email)
├── superadmin.js           # Lógica del super admin
├── app-user.js             # Lógica de usuario
├── styles-*.css            # Estilos
├── firestore.rules         # Reglas de Firestore
└── README.md               # Este archivo
```

## 🔧 Configuración

### 1. Firebase Setup

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita:
   - **Authentication** → Email/Password + **Google Sign-In**
   - **Firestore Database**
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
git commit -m "CotizaPro SaaS v2.0"
git push origin master
```

Conecta tu repo en Cloudflare Pages.

### 4. Configurar Firestore Rules

Copia el contenido de `firestore.rules` en:
Firebase Console → Firestore → Rules

## 📋 Planes

| Plan | Precio | Cotizaciones/mes | Características |
|------|--------|------------------|-----------------|
| Gratis | S/ 0 | 5 | PDF básico, 1 cuenta bancaria |
| Básico | S/ 20 | 20 | PDF profesional, 3 cuentas bancarias |
| Business | S/ 40 | 50 | PDF premium, ilimitado, duplicar |
| Pro | S/ 60 | Ilimitado | Todo incluido, multi-usuario |

### Licencias

| Duración | Descuento |
|----------|-----------|
| 1 Mes | Precio base |
| 3 Meses (Trimestral) | -10% |
| 6 Meses (Semestral) | -15% |
| 12 Meses (Anual) | -20% |
| Ilimitado | Personalizado |

## 🚀 Uso

### Como Super Admin:
1. Regístrate con el email configurado como SUPER_ADMIN_EMAIL
2. Automáticamente serás redirigido al panel de administración: `/superadmin`
3. **Aprobar manualmente** a cada cliente registrado
4. Asigna planes y licencias (mensual, trimestral, semestral, anual o ilimitado)
5. Gestiona usuarios, resetea créditos

### Como Usuario:
1. Regístrate desde la landing page (con email o Google)
2. Tu cuenta quedará **pendiente de aprobación** del administrador
3. Una vez aprobado, accede a `/app` para crear cotizaciones
4. Configura los datos de tu empresa
5. Crea cotizaciones (respetando el límite de tu plan)
6. Genera PDFs profesionales

## 🔐 Flujo de Registro

1. Usuario se registra (email/Google)
2. Cuenta queda **pendiente de aprobación**
3. Super admin revisa y **aprueba manualmente**
4. Super admin asigna plan y licencia
5. Usuario recibe acceso a la app

## 🔐 Reglas de Firestore

Ver `firestore.rules` para las reglas completas.

## 📱 PWA Ready

La app es 100% responsive y funciona en:
- Móvil (Android/iOS)
- Tablet
- Desktop

## ✨ Novedades v2.0

- ✅ **Google Sign-In** para login y registro
- ✅ **Aprobación manual** de clientes por el admin
- ✅ **Panel Super Admin** completo (`/superadmin`)
- ✅ **Ojito de mostrar/ocultar** contraseña
- ✅ **Doble confirmación** de contraseña en registro
- ✅ **Licencias** mensual, trimestral, semestral, anual o ilimitada
- ✅ **Descuentos** automáticos por duración de licencia
- ✅ **Panel de clientes** con búsqueda y gestión
- ✅ **Resumen de pedido** al aprobar un cliente
