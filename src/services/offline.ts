/**
 * Solicita que el almacenamiento del sitio (Cache API, IndexedDB) sea marcado como "persistente".
 * Esto evita que el navegador borre los datos automáticamente en situaciones de poco espacio.
 * 
 * @returns {Promise<boolean>} True si el almacenamiento es persistente, false en caso contrario.
 */
export const solicitarAlmacenamientoPersistente = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const esPersistente = await navigator.storage.persisted();
      if (esPersistente) {
        console.log('✅ El almacenamiento ya es persistente.');
        return true;
      }
      
      console.log('🔄 Solicitando permiso para almacenamiento persistente...');
      const resultado = await navigator.storage.persist();
      
      if (resultado) {
        console.log('✅ Permiso de almacenamiento persistente concedido.');
      } else {
        console.warn('⚠️ El permiso de almacenamiento persistente no fue concedido.');
      }
      return resultado;

    } catch (error) {
      console.error('❌ Error al solicitar almacenamiento persistente:', error);
      return false;
    }
  }
  console.warn('⚠️ La API de Almacenamiento Persistente no está soportada en este navegador.');
  return false;
};

/**
 * Componente o función para inicializar las capacidades offline de la aplicación.
 */
export const inicializarCapacidadesOffline = () => {
  if (typeof window !== 'undefined') {
    solicitarAlmacenamientoPersistente();
    // Aquí se podrían añadir otras inicializaciones offline en el futuro.
  }
};
