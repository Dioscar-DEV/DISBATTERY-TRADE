# Pruebas del Sistema de Gestión de Clientes y Rutas

## Funcionalidades Implementadas

### 1. Gestión de Clientes (`/admin/clientes`)

#### Características:
- ✅ **Crear nuevos clientes** con información completa
- ✅ **Editar clientes existentes**
- ✅ **Eliminar clientes**
- ✅ **Filtros por región, sede y tipo**
- ✅ **Búsqueda por nombre, dirección o ciudad**
- ✅ **Selector de ubicación** con coordenadas manuales y predefinidas
- ✅ **Guardado en Firestore** en la colección `clientes`

#### Campos del cliente:
- Nombre del cliente
- Dirección
- Teléfono (opcional)
- Email (opcional)
- Contacto (opcional)
- Región (Centro-capital, Centro-Los llanos, Occidente, Oriente)
- Sede (GRUPO DISBATTERY, BLITZ 2000, GRUPO VICTORIA, DISBATTERY)
- Ciudad (seleccionable según la sede)
- Tipo (tienda, distribuidor, cliente_especial)
- Ubicación (latitud/longitud)
- Observaciones (opcional)

### 2. Gestión de Rutas (`/admin/rutas`)

#### Características:
- ✅ **Crear nuevas rutas** asignando mercaderistas
- ✅ **Seleccionar clientes existentes** de la base de datos
- ✅ **Agregar puntos manualmente** con ubicación en mapa
- ✅ **Visualización en mapa** de todos los puntos
- ✅ **Calendario de rutas** por fecha
- ✅ **Guardado en Firestore** en la colección `routes`

#### Flujo de trabajo:
1. Seleccionar mercaderista
2. Elegir fecha
3. Agregar puntos (clientes existentes o nuevos)
4. Visualizar en mapa
5. Crear ruta

## Cómo Probar

### Paso 1: Acceder al Panel de Administración
1. Ve a la página principal
2. Inicia sesión como administrador
3. Accede al "Panel de Administración"

### Paso 2: Crear Clientes
1. Haz clic en "Gestión de Clientes"
2. Haz clic en "Nuevo Cliente"
3. Completa el formulario:
   - Nombre: "Tienda Ejemplo"
   - Dirección: "Av. Principal 123"
   - Selecciona región y sede
   - Selecciona ciudad
   - Tipo: "tienda"
   - Usa el selector de ubicación para elegir coordenadas
4. Haz clic en "Crear Cliente"

### Paso 3: Crear una Ruta
1. Ve a "Gestión de Rutas"
2. Haz clic en "Nueva Ruta"
3. Selecciona un mercaderista
4. Elige una fecha
5. Haz clic en "Seleccionar Cliente" para agregar clientes existentes
6. Selecciona los clientes que quieres incluir
7. Visualiza la ruta en el mapa
8. Haz clic en "Crear Ruta"

### Paso 4: Verificar en Firestore
1. Ve a la consola de Firebase
2. Verifica que se crearon documentos en:
   - Colección `clientes`
   - Colección `routes`

## Estructura de Datos

### Cliente (Firestore)
```json
{
  "nombre": "string",
  "direccion": "string",
  "telefono": "string (opcional)",
  "email": "string (opcional)",
  "contacto": "string (opcional)",
  "region": "Centro-capital | Centro-Los llanos | Occidente | Oriente",
  "sede": "GRUPO DISBATTERY | BLITZ 2000 | GRUPO VICTORIA | DISBATTERY",
  "ciudad": "string",
  "position": {
    "lat": "number",
    "lng": "number"
  },
  "tipo": "tienda | distribuidor | cliente_especial",
  "estado": "activo | inactivo | pendiente",
  "observaciones": "string (opcional)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "createdBy": "string"
}
```

### Ruta (Firestore)
```json
{
  "mercaderista": "string",
  "mercaderistoId": "string",
  "date": "string (YYYY-MM-DD)",
  "points": [
    {
      "id": "string",
      "name": "string",
      "address": "string",
      "position": {
        "lat": "number",
        "lng": "number"
      },
      "type": "cliente | distribuidor | oficina",
      "estimatedTime": "number (minutos)",
      "status": "pendiente | visitado | omitido"
    }
  ],
  "status": "planificada | en_progreso | completada",
  "totalDistance": "number (km)",
  "totalTime": "number (minutos)",
  "createdAt": "timestamp",
  "createdBy": "string"
}
```

## Comandos para Ejecutar

```bash
# Navegar al directorio del proyecto
cd "download (1)"

# Instalar dependencias (si no están instaladas)
npm install

# Ejecutar en modo desarrollo
npm run dev
```

## Notas Importantes

1. **Autenticación**: El sistema requiere estar logueado como administrador
2. **Firebase**: Asegúrate de que Firebase esté configurado correctamente
3. **Mapas**: El selector de ubicación funciona con coordenadas manuales y predefinidas
4. **Datos**: Los clientes se guardan en Firestore y se pueden reutilizar en múltiples rutas
5. **Validación**: El sistema valida que no se agreguen clientes duplicados a la misma ruta

## Próximas Mejoras

- [ ] Integración completa con Google Maps API
- [ ] Cálculo automático de distancias y tiempos
- [ ] Optimización de rutas
- [ ] Reportes y estadísticas
- [ ] Notificaciones push
- [ ] Modo offline 