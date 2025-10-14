# 📋 Guía de Deploy - Disbattery Trade PWA

## 🎯 **Proceso Correcto de Deploy**

### **Prerequisitos:**
- Node.js instalado
- Firebase CLI instalado y autenticado
- Proyecto configurado en Firebase Console

---

## 🚀 **Pasos para Deploy:**

### **1. Navegar a la carpeta del proyecto:**
```bash
cd "download (1)"
```

### **2. Instalar dependencias (solo primera vez):**
```bash
npm install
```

### **3. Hacer build de producción:**
```bash
npm run build
```

**⚠️ IMPORTANTE:** 
- Debe generar la carpeta `out/` con archivos estáticos
- Si no se genera `out/`, verificar que `next.config.ts` tenga `output: 'export'`

### **4. Deploy a Firebase:**
```bash
# Opción A: Deploy desde download (1)
firebase deploy --only hosting

# Opción B: Deploy desde root
cd ..
firebase deploy --only hosting
```

### **5. Verificar deploy:**
- URL: `https://disbattery-trade.web.app`
- Verificar que los cambios se reflejen
- Si no se ven cambios, limpiar cache del navegador

---

## 🔧 **Configuración Importante:**

### **next.config.ts debe tener:**
```typescript
const nextConfig: NextConfig = {
  output: 'export', // ← CRÍTICO para Firebase Hosting
  images: {
    unoptimized: true,
  },
  // ... resto de configuración
};
```

### **firebase.json correcto:**
```json
{
  "hosting": {
    "public": "download (1)/out", // Desde root
    // O solo "out" si se hace deploy desde download (1)
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

---

## 🧹 **Limpiar Cache (si los cambios no se ven):**

### **Navegador:**
```
1. Ctrl + Shift + R (forzar recarga)
2. Ctrl + Shift + N (modo incógnito)
3. F12 → Application → Storage → Clear Storage
```

### **Build limpio:**
```bash
cd "download (1)"
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue
npm run build
```

---

## ✅ **Checklist de Deploy:**

- [ ] Cambios hechos en archivos `src/`
- [ ] `npm run build` ejecutado sin errores
- [ ] Carpeta `out/` generada correctamente
- [ ] `firebase deploy --only hosting` exitoso
- [ ] Verificar cambios en `https://disbattery-trade.web.app`
- [ ] Limpiar cache si es necesario

---

## 🚨 **Errores Comunes:**

### **"Directory 'out' does not exist"**
- **Causa:** Falta `output: 'export'` en `next.config.ts`
- **Solución:** Agregar `output: 'export'` y hacer build nuevamente

### **"Los cambios no se ven"**
- **Causa:** Cache del navegador o Service Worker
- **Solución:** Limpiar cache o usar modo incógnito

### **"Import error en components"**
- **Causa:** Error en sintaxis de componentes React
- **Solución:** Verificar imports y sintaxis de JSX

---

## 🎉 **Deploy Exitoso = PWA Funcionando:**

Una vez deployado correctamente, deberías ver:
- ✅ **Banner de instalación PWA** (azul-rojo) en la parte superior
- ✅ **Indicador "Modo Offline"** cuando no hay internet
- ✅ **Login offline** funcionando con credenciales guardadas
- ✅ **Funcionalidad completa sin internet**

---

*Última actualización: Enero 2025* 