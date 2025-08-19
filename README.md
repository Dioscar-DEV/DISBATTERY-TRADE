# Proyecto Disbattery Trade

Este es un proyecto web desarrollado con Next.js, diseñado para la gestión de rutas y visitas de mercaderistas. La aplicación está construida para funcionar tanto online como offline, utilizando Firebase para la gestión de datos y autenticación.

## Estructura de Archivos

La estructura del proyecto se ha organizado para separar claramente las responsabilidades y facilitar el mantenimiento. A continuación se describen los directorios más importantes:

-   **/src**: Contiene todo el código fuente de la aplicación.
    -   **/src/app**: Aquí se encuentran todas las páginas y rutas de la aplicación, siguiendo el sistema de enrutamiento de Next.js (App Router). Cada carpeta representa una ruta en la URL.
    -   **/src/components**: Almacena componentes de React reutilizables.
        -   **/ui**: Componentes de interfaz de usuario genéricos como botones, tarjetas, etc.
    -   **/src/services**: Módulos encargados de la lógica de negocio y la comunicación con servicios externos como Firebase (autenticación, base de datos, sincronización offline, etc.).
    -   **/src/hooks**: Contiene los custom hooks de React, que encapsulan lógica y estado reutilizable.
    -   **/src/lib**: Funciones de utilidad y helpers genéricos que se pueden usar en cualquier parte de la aplicación.
    -   **/src/firebase**: Configuración e inicialización del cliente de Firebase.
    -   **/src/types**: Definiciones de tipos de TypeScript para asegurar la consistencia de los datos en todo el proyecto.
-   **/public**: Almacena todos los archivos estáticos que se sirven directamente al navegador, como imágenes, iconos, `manifest.json` y los Service Workers para la funcionalidad PWA y offline.
-   **Archivos de Configuración (Raíz)**:
    -   `next.config.ts`: Archivo de configuración principal de Next.js.
    -   `tailwind.config.ts`: Configuración para el framework de CSS Tailwind.
    -   `tsconfig.json`: Configuración del compilador de TypeScript.
    -   `package.json`: Define los scripts del proyecto y gestiona las dependencias de Node.js.

## Cómo Empezar

Para ejecutar el proyecto en tu entorno de desarrollo local, sigue estos pasos:

### 1. Instalar Dependencias

Abre una terminal en la raíz del proyecto y ejecuta el siguiente comando para instalar todas las librerías necesarias:

```bash
npm install
```

### 2. Ejecutar el Servidor de Desarrollo

Una vez instaladas las dependencias, puedes iniciar la aplicación en modo de desarrollo. Esto te permitirá ver los cambios en tiempo real mientras editas el código.

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:9002](http://localhost:9002).

### 3. Crear una Compilación de Producción

Cuando estés listo para desplegar la aplicación, necesitas crear una versión optimizada para producción. El siguiente comando generará una carpeta `out` con los archivos estáticos listos para ser desplegados.

```bash
npm run build
```
