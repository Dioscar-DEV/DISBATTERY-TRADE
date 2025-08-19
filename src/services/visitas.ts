import { collection, addDoc, doc, updateDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/clientApp';
import { Visita, CreateVisitaData, mapearParaSheet } from '@/types/visitas';
import { updateRoutePointStatus, updateEventStatus, autoUpdateRouteStatus } from './routes';
import { format } from 'date-fns';

// URL del webhook N8N desde variables de entorno o configuración directa
let N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://n8n.con-visas.com/webhook/Disbattery-Trade-app';

// Configurar URL del webhook N8N
export const setN8NWebhookURL = (url: string) => {
  N8N_WEBHOOK_URL = url;
};

// Crear una nueva visita
export const crearVisita = async (data: CreateVisitaData): Promise<string> => {
  try {
    console.log('🔥 INICIANDO crearVisita con datos:', data);
    console.log('🎯 RIF recibido:', data.rifCliente);
    console.log('🎯 Nombre recibido:', data.nombreEstablecimiento);
    console.log('🎯 Ubicación recibida:', data.ubicacion);
    
    // 1. Preparar datos para Firestore
    const visitaData: Omit<Visita, 'id'> = {
      marcaTemporal: new Date(),
      direccionCorreo: (data.correoMercaderista || '').toLowerCase(),
      rifCliente: data.rifCliente,
      nombreEstablecimiento: data.nombreEstablecimiento,
      tipoVisita: data.tipoVisita,
      mercaderista: data.mercaderista,
      ubicacion: data.ubicacion,
      sucursal: data.sucursal,
      respuestas: data.respuestas,
      observacionesAdicionales: data.observacionesAdicionales || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      sincronizadoN8N: false
      // errorSync se omite inicialmente, solo se agrega si hay error
    };

    console.log('📄 Datos preparados para Firestore:', {
      rifCliente: visitaData.rifCliente,
      nombreEstablecimiento: visitaData.nombreEstablecimiento,
      ubicacion: visitaData.ubicacion,
      mercaderista: visitaData.mercaderista
    });

    // 2. Guardar en Firestore
    const docRef = await addDoc(collection(db, 'visitas'), visitaData);
    console.log('✅ Visita guardada en Firestore con ID:', docRef.id);
    console.log('✅ RIF guardado en Firestore:', visitaData.rifCliente);
    console.log('✅ Nombre guardado en Firestore:', visitaData.nombreEstablecimiento);

    // 2.1. Actualizar documento del cliente: lastVisitDate y señalización (si aplica)
    if (data.rifCliente) {
      const rifNormalizado = data.rifCliente.trim().toUpperCase();
      const clientesQuery = query(collection(db, 'clientes'), where('rif', '==', rifNormalizado));
      const querySnapshot = await getDocs(clientesQuery);
      if (!querySnapshot.empty) {
        const clienteDoc = querySnapshot.docs[0];
        const clienteRef = doc(db, 'clientes', clienteDoc.id);
        const nowIso = new Date().toISOString();

        // Derivar señalización desde respuestas (Merchandising)
        let tieneSenalizacion: boolean | undefined = undefined;
        let fotoSenalizacion: string | undefined = undefined;
        
        console.log('🚩🚩🚩 === DEBUGGING SEÑALIZACIÓN EN VISITAS.TS ===');
        console.log('🚩 data COMPLETO:', JSON.stringify(data, null, 2));
        console.log('🚩 data.respuestas:', JSON.stringify(data.respuestas, null, 2));
        console.log('🚩 data.respuestas.clientePoseeSeñalizacion:', (data.respuestas as any)?.clientePoseeSeñalizacion);
        console.log('🚩 data.respuestas.fotoSeñalizacion:', (data.respuestas as any)?.fotoSeñalizacion);
        console.log('🚩 data.respuestas.datosSheet:', JSON.stringify((data.respuestas as any)?.datosSheet, null, 2));
        
        try {
          const resp: any = data.respuestas || {};
          // Estructura nueva: respuestas.datosSheet
          const ds: any = (resp && resp.datosSheet) ? resp.datosSheet : resp;
          // Chequeos directos con logging detallado
          const directos = [
            { key: 'clientePoseeSeñalizacion', value: resp.clientePoseeSeñalizacion },
            { key: 'señalizacion', value: resp.señalizacion },
            { key: 'signage', value: resp.signage },
            { key: 'hasSignage', value: resp.hasSignage },
            { key: 'ds.señalizacion', value: ds?.señalizacion },
            { key: 'ds.signage', value: ds?.signage },
            { key: 'ds.hasSignage', value: ds?.hasSignage },
            // ✅ AGREGAR BÚSQUEDA ESPECÍFICA DEL CAMPO DE GOOGLE SHEETS
            { key: 'ds["¿El cliente posee señalización?"]', value: ds?.["¿El cliente posee señalización?"] },
          ];
          
          console.log('🚩 REVISANDO VALORES DIRECTOS:');
          for (const item of directos) {
            console.log(`   - ${item.key}:`, item.value, `(tipo: ${typeof item.value})`);
            if (item.value !== undefined && item.value !== null && String(item.value).trim() !== '') {
              const s = String(item.value).toLowerCase().trim();
              const esPositivo = (item.value === true) || s === 'true' || s === 'sí' || s === 'si' || s === 'yes' || s === '1';
              const esNegativo = (item.value === false) || s === 'false' || s === 'no' || s === '0';
              console.log(`     🎯 DETECTADO EN ${item.key}: valor="${item.value}", esPositivo=${esPositivo}, esNegativo=${esNegativo}`);
              if (esPositivo) {
                tieneSenalizacion = true;
                break;
              } else if (esNegativo) {
                tieneSenalizacion = false;
                break;
              }
            }
          }
          // Foto de señalización en estructuras conocidas con logging
          const fuentesFoto = [
            { key: 'resp.fotoSeñalizacion', value: resp.fotoSeñalizacion },
            { key: 'ds["Foto de la señalización"]', value: ds?.['Foto de la señalización'] },
            { key: 'ds["Foto señalización"]', value: ds?.['Foto señalización'] },
            { key: 'ds["Foto de señalizacion"]', value: ds?.['Foto de señalizacion'] },
            { key: 'resp.signagePhoto', value: resp.signagePhoto },
            { key: 'ds.signagePhoto', value: ds?.signagePhoto },
          ];
          
          console.log('🚩 BUSCANDO FOTO DE SEÑALIZACIÓN:');
          for (const fuente of fuentesFoto) {
            console.log(`   - ${fuente.key}:`, fuente.value ? 'ENCONTRADA' : 'NO ENCONTRADA');
            if (fuente.value && typeof fuente.value === 'string' && fuente.value.trim() !== '' && fuente.value !== 'No capturada') {
              fotoSenalizacion = fuente.value;
              console.log(`     ✅ FOTO ENCONTRADA EN ${fuente.key}`);
              break;
            }
          }
          // Si no se halló en directos, revisa texto libre en datosSheet
          if (tieneSenalizacion === undefined && ds && typeof ds === 'object') {
            const texto = JSON.stringify(ds).toLowerCase();
            if (/señaliz|signage|letrero|cartel/.test(texto)) {
              if (/\b(sí|si|yes|true|presente|instalada|colocada)\b/.test(texto)) tieneSenalizacion = true;
              if (/\b(no|false|ausente|falta|sin|missing)\b/.test(texto)) tieneSenalizacion = false;
            }
          }
        } catch (e) {
          console.warn('⚠️ No se pudo derivar señalización desde respuestas:', e);
        }

        console.log('🚩 RESULTADO DETECCIÓN SEÑALIZACIÓN:');
        console.log('🚩 tieneSenalizacion:', tieneSenalizacion);
        console.log('🚩 fotoSenalizacion:', fotoSenalizacion);

        const updatePayload: any = {
          lastVisitDate: nowIso,
          updatedAt: new Date(),
          updatedBy: data.correoMercaderista || data.mercaderista || 'mercaderista',
        };
        
        // ✅ LÓGICA MEJORADA: SI HAY FOTO, HAY SEÑALIZACIÓN
        // Si no se detectó señalización directamente, pero sí hay foto válida, asumir que hay señalización
        if (tieneSenalizacion === undefined && fotoSenalizacion && fotoSenalizacion.trim() !== '' && fotoSenalizacion !== 'No capturada') {
          console.log('🚩 NO SE DETECTÓ SEÑALIZACIÓN DIRECTA, PERO HAY FOTO VÁLIDA - ASUMIENDO SEÑALIZACIÓN POSITIVA');
          tieneSenalizacion = true;
        }
        
        if (tieneSenalizacion !== undefined) {
          updatePayload.signage = tieneSenalizacion ? 'con' : 'sin';
          updatePayload.signageUpdatedAt = new Date();
          console.log('🚩 ACTUALIZANDO SIGNAGE EN CLIENTE:', updatePayload.signage);
          
          // ✅ SIEMPRE actualizar signagePhoto cuando se actualice signage
          if (fotoSenalizacion && fotoSenalizacion.trim() !== '' && fotoSenalizacion !== 'No capturada') {
            updatePayload.signagePhoto = fotoSenalizacion;
            console.log('🚩 ACTUALIZANDO FOTO SEÑALIZACIÓN:', fotoSenalizacion);
          } else {
            updatePayload.signagePhoto = 'No capturada';
            console.log('🚩 NO HAY FOTO VÁLIDA - ESTABLECIENDO "No capturada"');
          }
        } else {
          console.log('🚩 NO SE DETECTÓ SEÑALIZACIÓN NI FOTO - NO SE ACTUALIZA');
          console.log('🚩 VALORES FINALES: tieneSenalizacion =', tieneSenalizacion, ', fotoSenalizacion =', fotoSenalizacion ? 'PRESENTE' : 'AUSENTE');
        }

        // Actualizar coordenadas GPS del cliente si se capturaron y son válidas
        try {
          const lat = Number((data.ubicacion as any)?.lat ?? (data.ubicacion as any)?.latitude ?? 0);
          const lng = Number((data.ubicacion as any)?.lng ?? (data.ubicacion as any)?.longitude ?? 0);
          if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
            updatePayload.position = { lat, lng };
            updatePayload.gpsUpdatedAt = new Date();
            updatePayload.gpsUpdatedInField = true;
          }
        } catch {}

        console.log('🚩 PAYLOAD FINAL PARA ACTUALIZAR CLIENTE:');
        console.log('   - signage:', updatePayload.signage);
        console.log('   - signagePhoto:', updatePayload.signagePhoto);
        console.log('   - signageUpdatedAt:', updatePayload.signageUpdatedAt);
        console.log('   - lastVisitDate:', updatePayload.lastVisitDate);
        console.log('   - position:', updatePayload.position);

        await updateDoc(clienteRef, updatePayload);
        console.log('[clientes] actualizado', rifNormalizado, '->', updatePayload);
      } else {
        console.warn('[clientes] No se encontró cliente con RIF', rifNormalizado, 'para actualizar lastVisitDate/señalización');
      }
    }

    // 2.2. Actualizar estado del punto específico en la ruta del mercaderista
    if (data.rifCliente && data.correoMercaderista) {
      try {
        // Obtener el UID del mercaderista desde localStorage
        const currentUser = localStorage.getItem('currentUser');
        let mercaderistoId = '';
        
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          mercaderistoId = userData.uid;
        }
        
        // ✅ CRÍTICO: Obtener pointId específico desde localStorage
        const clienteDataString = localStorage.getItem('clienteData');
        let pointId = '';
        
        if (clienteDataString) {
          const clienteData = JSON.parse(clienteDataString);
          pointId = clienteData.pointId || '';
          console.log('🎯 [crearVisita] PointId obtenido desde localStorage:', pointId);
          console.log('🎯 [crearVisita] ClienteData completo:', clienteData);
          console.log('🎯 [crearVisita] RIF del cliente desde localStorage:', clienteData.rif);
          console.log('🎯 [crearVisita] Nombre del cliente desde localStorage:', clienteData.nombre);
        } else {
          console.warn('⚠️ [crearVisita] No se encontró clienteData en localStorage');
        }
        
        // ✅ NUEVO: Si el pointId del localStorage está vacío, buscarlo en la base de datos
        if (!pointId) {
          console.warn('⚠️ [crearVisita] PointId vacío en localStorage, buscando en base de datos...');
          
          // Buscar el pointId en las rutas de la base de datos usando el RIF
          try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const routesRef = collection(db, 'routes');
            const q = query(
              routesRef,
              where('mercaderistoId', '==', mercaderistoId),
              where('date', '==', today)
            );
            
            const snapshot = await getDocs(q);
            const rifNormalizado = data.rifCliente.trim().toUpperCase();
            
            console.log('🔍 [crearVisita] Buscando pointId en', snapshot.docs.length, 'rutas para RIF:', rifNormalizado);
            
            for (const routeDoc of snapshot.docs) {
              const routeData = routeDoc.data();
              const points = routeData.points || [];
              
              // Buscar el punto que coincida con el RIF
              const matchingPoint = points.find((point: any) => 
                point.rif && point.rif.trim().toUpperCase() === rifNormalizado
              );
              
              if (matchingPoint && matchingPoint.id) {
                pointId = matchingPoint.id;
                console.log('✅ [crearVisita] PointId encontrado en base de datos:', pointId);
                console.log('✅ [crearVisita] Punto encontrado:', matchingPoint.name);
                break;
              }
            }
            
            if (!pointId) {
              console.warn('⚠️ [crearVisita] PointId no encontrado en base de datos para RIF:', rifNormalizado);
            }
          } catch (error) {
            console.error('❌ [crearVisita] Error buscando pointId en base de datos:', error);
          }
        }
        
        if (!pointId) {
          console.warn('⚠️ [crearVisita] ADVERTENCIA: pointId está vacío, se usará solo RIF como fallback');
        } else {
          console.log('✅ [crearVisita] PointId final a usar:', pointId);
        }
        
        if (mercaderistoId) {
          const today = format(new Date(), 'yyyy-MM-dd');
          const rifNormalizado = data.rifCliente.trim().toUpperCase();
          
          console.log('🎯 [crearVisita] === PREPARANDO ACTUALIZACIÓN DE PUNTO ===');
          console.log('🎯 [crearVisita] MercaderistoId:', mercaderistoId);
          console.log('🎯 [crearVisita] Fecha:', today);
          console.log('🎯 [crearVisita] PointId a actualizar:', pointId);
          console.log('🎯 [crearVisita] RIF Cliente normalizado:', rifNormalizado);
          console.log('🎯 [crearVisita] Estado a aplicar: visitado');
          
          const result = await updateRoutePointStatus(
            mercaderistoId,
            today,
            pointId, // ✅ USAR POINT ID ESPECÍFICO (desde localStorage o base de datos)
            'visitado',
            rifNormalizado
          );
          
          if (result.updated) {
            console.log('✅ [crearVisita] Estado del punto de ruta actualizado exitosamente:', result.reason);
            // ✅ Asegurar que la ruta quede en "en_progreso" al registrar la primera visita
            try {
              const startRes = await autoUpdateRouteStatus(mercaderistoId, today, 'start');
              console.log('🚀 [crearVisita] Auto-start de ruta tras visita:', startRes);
            } catch (e) {
              console.warn('⚠️ [crearVisita] No se pudo auto-iniciar la ruta:', e);
            }
          } else {
            console.log('ℹ️ [crearVisita] No se actualizó punto de ruta:', result.reason);
          }
        } else {
          console.warn('⚠️ [crearVisita] No se pudo obtener mercaderistoId para actualizar punto de ruta');
        }
      } catch (error) {
        console.error('❌ Error actualizando punto de ruta:', error);
        // No fallar toda la operación por este error
      }
    }

    // ✅ SIMPLIFICADO: Actualizar estado del evento si es un evento
    try {
      // Detectar si es un evento por el nombre (sin RIF) y tipo de visita
      const esEvento = data.nombreEstablecimiento && 
                      !data.rifCliente && 
                      data.tipoVisita === 'Trade (Eventos)';
      
      console.log('🎪 [crearVisita] === DETECTANDO EVENTO ===');
      console.log('🎪 [crearVisita] Nombre:', data.nombreEstablecimiento);
      console.log('🎪 [crearVisita] RIF:', data.rifCliente);
      console.log('🎪 [crearVisita] Tipo:', data.tipoVisita);
      console.log('🎪 [crearVisita] Es evento:', esEvento);
      
      if (esEvento) {
        console.log('🎪 [crearVisita] ✅ EVENTO DETECTADO - Actualizando estado...');
        
        // Buscar el evento en la colección 'eventos'
        const eventosRef = collection(db, 'eventos');
        const eventosQuery = query(eventosRef, where('nombreEvento', '==', data.nombreEstablecimiento));
        const eventosSnapshot = await getDocs(eventosQuery);
        
        if (!eventosSnapshot.empty) {
          const eventoDoc = eventosSnapshot.docs[0];
          const eventoId = eventoDoc.id;
          console.log('🎪 [crearVisita] ✅ Evento encontrado:', eventoId);
          
          // Actualizar directamente en la base de datos
          await updateDoc(doc(db, 'eventos', eventoId), {
            status: 'completado',
            completadoAt: new Date(),
            updatedAt: new Date()
          });
          
          console.log('✅ [crearVisita] Evento marcado como completado');
        } else {
          console.warn('⚠️ [crearVisita] No se encontró evento:', data.nombreEstablecimiento);
        }
      }
    } catch (error) {
      console.error('❌ Error actualizando evento:', error);
    }

    // 3. Preparar datos para N8N/Sheet
    const visitaCompleta: any = {
      id: docRef.id,
      ...visitaData
    };

    // 4. Enviar a N8N en background (no bloquea) - PASAR datosN8N DIRECTAMENTE
    await enviarANBN(visitaCompleta, data.datosN8N).catch(error => {
      console.error('Error enviando a N8N:', error);
      // Marcar como error de sincronización pero no fallar
      updateDoc(doc(db, 'visitas', docRef.id), {
        sincronizadoN8N: false,
        errorSync: error.message,
        updatedAt: new Date()
      });
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creando visita:', error);
    throw new Error('Error al guardar la visita');
  }
};

// Enviar datos a N8N webhook
const enviarANBN = async (visita: any, datosN8N?: any): Promise<void> => {
  if (!N8N_WEBHOOK_URL) {
    throw new Error('URL de webhook N8N no configurada');
  }

  console.log('🚀 INICIANDO ENVÍO A N8N:', N8N_WEBHOOK_URL);

  try {
    // 🎯 USAR LA ESTRUCTURA ORGANIZADA (NO LA FUNCIÓN ANTIGUA mapearParaSheet)
    let datosSheet: Record<string, any> = {};
    
    // 🔥 PRIORIDAD MÁXIMA: Datos completos de N8N pasados directamente (CON IMÁGENES)
    if (datosN8N && datosN8N.datosSheet) {
      datosSheet = datosN8N.datosSheet;
      console.log('🎯 USANDO DATOS COMPLETOS DE N8N PASADOS DIRECTAMENTE (CON IMÁGENES):', Object.keys(datosSheet).length, 'campos');
    }
    // Si no hay datos N8N, usar las respuestas normales
    else if (visita.respuestas && typeof visita.respuestas === 'object') {
      const respuestas = visita.respuestas as any;
      
      // 🎯 PRIORIDAD 1: Usar datosSheet si existe (estructura nueva)
      if (respuestas.datosSheet && typeof respuestas.datosSheet === 'object') {
        datosSheet = respuestas.datosSheet;
        console.log('✅ USANDO ESTRUCTURA ORGANIZADA NUEVA:', Object.keys(datosSheet).length, 'campos');
      }
      // PRIORIDAD 2: Convertir observaciones organizadas a datosSheet
      else if (Array.isArray(respuestas.observaciones)) {
        respuestas.observaciones.forEach((observacion: string) => {
          if (observacion.includes(':')) {
            const [pregunta, respuesta] = observacion.split(':');
            datosSheet[pregunta.trim()] = respuesta.trim();
          }
        });
        
        // Agregar datos básicos si no están
        if (!datosSheet['Marca temporal']) {
          datosSheet = {
            'Marca temporal': visita.marcaTemporal.toISOString(),
            'Dirección de correo electrónico': visita.direccionCorreo || '',
            'RIF del cliente:': visita.rifCliente,
            'Nombre del establecimiento:': visita.nombreEstablecimiento,
            'Desde que sucursal se realiza el registro': visita.sucursal,
            ...datosSheet
          };
        }
        console.log('✅ USANDO OBSERVACIONES ORGANIZADAS:', Object.keys(datosSheet).length, 'campos');
      } else {
        // Fallback a la función antigua
        datosSheet = mapearParaSheet(visita);
        console.log('⚠️ USANDO ESTRUCTURA ANTIGUA (fallback):', Object.keys(datosSheet).length, 'campos');
      }
    } else {
      // Fallback a la función antigua solo si no hay estructura nueva
      datosSheet = mapearParaSheet(visita);
      console.log('⚠️ USANDO ESTRUCTURA ANTIGUA (sin respuestas):', Object.keys(datosSheet).length, 'campos');
    }
    
    // Payload para N8N
    const payload = {
      // Datos originales para Firestore reference
      visita: {
        id: visita.id,
        tipo: visita.tipoVisita,
        rif: visita.rifCliente,
        nombre: visita.nombreEstablecimiento,
        mercaderista: visita.mercaderista,
        timestamp: visita.marcaTemporal.toISOString(),
        // 🗺️ AGREGAR COORDENADAS EXPLÍCITAMENTE
        ubicacion: visita.ubicacion,
        latitud: visita.ubicacion?.latitude || visita.ubicacion?.lat || null,
        longitud: visita.ubicacion?.longitude || visita.ubicacion?.lng || null,
        direccion: visita.ubicacion?.address || null
      },
      // Datos formateados para Sheet con estructura ORGANIZADA
      datosSheet: {
        ...datosSheet,
        // 🗺️ ASEGURAR QUE LAS COORDENADAS ESTÉN EN DATOSSHEET TAMBIÉN
        'Latitud:': visita.ubicacion?.latitude || visita.ubicacion?.lat || 'No capturada',
        'Longitud:': visita.ubicacion?.longitude || visita.ubicacion?.lng || 'No capturada',
        'Dirección GPS:': visita.ubicacion?.address || visita.ubicacion?.direccion || 'No disponible',
        'Coordenadas completas:': visita.ubicacion ? JSON.stringify(visita.ubicacion) : 'No disponibles',
        'Estado de coordenadas:': (visita.ubicacion?.lat === 0 && visita.ubicacion?.lng === 0) ? 'No capturadas correctamente' : 'Capturadas correctamente'
      } as Record<string, any>,
      // Metadatos
      metadata: {
        source: 'disbattery-trade-app',
        version: '1.0',
        timestamp: new Date().toISOString()
      }
    };

    console.log('📤 PAYLOAD PREPARADO PARA N8N:');
    console.log('- URL:', N8N_WEBHOOK_URL);
    console.log('- Visita ID:', payload.visita.id);
    console.log('- Tipo:', payload.visita.tipo);
    console.log('- RIF:', payload.visita.rif);
    console.log('- Cliente:', payload.visita.nombre);
    console.log('🗺️ COORDENADAS EN PAYLOAD:');
    console.log('- Ubicación completa:', payload.visita.ubicacion);
    console.log('- Latitud:', payload.visita.latitud);
    console.log('- Longitud:', payload.visita.longitud);
    console.log('- Dirección:', payload.visita.direccion);
    console.log('- Campos en datosSheet:', Object.keys(payload.datosSheet).length);
    console.log('- RIF en datosSheet:', (payload.datosSheet as any)['Rif del cliente:']);
    console.log('- Nombre en datosSheet:', (payload.datosSheet as any)['Nombre del establecimiento:']);
    console.log('🗺️ COORDENADAS EN DATOSSHEET:');
    console.log('- Latitud en datosSheet:', (payload.datosSheet as any)['Latitud:']);
    console.log('- Longitud en datosSheet:', (payload.datosSheet as any)['Longitud:']);
    console.log('- Dirección GPS en datosSheet:', (payload.datosSheet as any)['Dirección GPS:']);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 RESPUESTA DEL WEBHOOK N8N:');
    console.log('- Status:', response.status);
    console.log('- Status Text:', response.statusText);
    console.log('- OK:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ERROR EN RESPUESTA N8N:', errorText);
      throw new Error(`N8N webhook error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Marcar como sincronizado
    await updateDoc(doc(db, 'visitas', visita.id), {
      sincronizadoN8N: true,
      errorSync: null,
      updatedAt: new Date()
    });

    // Verificar si el payload incluye fotos
    const tieneFotos = payload.datosSheet && Object.values(payload.datosSheet).some((valor: any) => 
      typeof valor === 'string' && valor.startsWith('data:image/')
    );
    
    console.log('🎉 DATOS ENVIADOS EXITOSAMENTE A N8N CON ESTRUCTURA ORGANIZADA');
    console.log('📊 Campos enviados:', Object.keys(payload.datosSheet).slice(0, 10), '... (total:', Object.keys(payload.datosSheet).length, ')');
    console.log(`📸 Fotos incluidas en el envío: ${tieneFotos ? '✅ SÍ' : '❌ NO'}`);
    
    if (tieneFotos) {
      const fotosCount = Object.values(payload.datosSheet).filter((valor: any) => 
        typeof valor === 'string' && valor.startsWith('data:image/')
      ).length;
      console.log(`📷 Total de fotos base64 enviadas: ${fotosCount}`);
    }
  } catch (error) {
    console.error('Error enviando a N8N:', error);
    throw error;
  }
};

// Obtener visitas con filtros
export const obtenerVisitas = async (filtros?: {
  rifCliente?: string;
  tipoVisita?: string;
  mercaderista?: string;
  correoMercaderista?: string; // filtro por email del mercaderista
  fechaDesde?: Date;
  fechaHasta?: Date;
}): Promise<Visita[]> => {
  try {
    let q = query(collection(db, 'visitas'), orderBy('createdAt', 'desc'));

    // Aplicar filtros si se proporcionan
    if (filtros?.rifCliente) {
      q = query(q, where('rifCliente', '==', filtros.rifCliente));
    }
    
    if (filtros?.tipoVisita) {
      q = query(q, where('tipoVisita', '==', filtros.tipoVisita));
    }
    
    if (filtros?.mercaderista) {
      q = query(q, where('mercaderista', '==', filtros.mercaderista));
    }

    if (filtros?.correoMercaderista) {
      q = query(q, where('direccionCorreo', '==', filtros.correoMercaderista));
    }

    const querySnapshot = await getDocs(q);
    const visitas: Visita[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      visitas.push({
        id: doc.id,
        ...data,
        marcaTemporal: data.marcaTemporal?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Visita);
    });

    return visitas;
  } catch (error) {
    console.error('Error obteniendo visitas:', error);
    throw new Error('Error al obtener las visitas');
  }
};

// Reintentar sincronización con N8N para visitas fallidas
export const reintentarSincronizacion = async (visitaId: string): Promise<void> => {
  try {
    // Obtener la visita de Firestore
    const visitasQuery = query(
      collection(db, 'visitas'), 
      where('__name__', '==', visitaId)
    );
    const querySnapshot = await getDocs(visitasQuery);
    
    if (querySnapshot.empty) {
      throw new Error('Visita no encontrada');
    }

    const doc = querySnapshot.docs[0];
    const visitaData = doc.data();
    const visita: Visita = {
      id: doc.id,
      ...visitaData,
      marcaTemporal: visitaData.marcaTemporal?.toDate() || new Date(),
      createdAt: visitaData.createdAt?.toDate() || new Date(),
      updatedAt: visitaData.updatedAt?.toDate() || new Date(),
    } as Visita;

    // Reintentar envío a N8N
    await enviarANBN(visita, null);
    console.log('Sincronización exitosa para visita:', visitaId);
  } catch (error) {
    console.error('Error en reintento de sincronización:', error);
    throw error;
  }
};

// Obtener estadísticas de sincronización
export const obtenerEstadisticasSync = async (): Promise<{
  total: number;
  sincronizadas: number;
  fallidas: number;
  pendientes: number;
}> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'visitas'));
    
    let total = 0;
    let sincronizadas = 0;
    let fallidas = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      total++;
      
      if (data.sincronizadoN8N === true) {
        sincronizadas++;
      } else if (data.errorSync) {
        fallidas++;
      }
    });

    return {
      total,
      sincronizadas,
      fallidas,
      pendientes: total - sincronizadas - fallidas
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    throw error;
  }
}; 

// Obtener la última visita de un usuario específico
export const obtenerUltimaVisitaUsuario = async (correoMercaderista: string): Promise<Visita | null> => {
  try {
    const q = query(
      collection(db, 'visitas'), 
      where('direccionCorreo', '==', correoMercaderista),
      orderBy('createdAt', 'desc'),
      // limit(1) - Firebase Web SDK no tiene limit, usaremos solo la primera
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      marcaTemporal: data.marcaTemporal?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Visita;
  } catch (error) {
    console.error('Error obteniendo última visita del usuario:', error);
    return null;
  }
};

// Obtener las últimas visitas de múltiples usuarios de una vez
export const obtenerUltimasVisitasUsuarios = async (correosMercaderistas: string[]): Promise<Record<string, Visita | null>> => {
  const resultado: Record<string, Visita | null> = {};
  
  // Inicializar todos como null
  correosMercaderistas.forEach(correo => {
    resultado[correo] = null;
  });

  if (correosMercaderistas.length === 0) {
    return resultado;
  }

  try {
    // Obtener todas las visitas de estos usuarios
    const q = query(
      collection(db, 'visitas'),
      where('direccionCorreo', 'in', correosMercaderistas.slice(0, 10)), // Firestore limita a 10 elementos en 'in'
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    // Agrupar por correo y tomar solo la más reciente de cada uno
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const correo = data.direccionCorreo;
      
      // Solo tomar la primera (más reciente) de cada usuario
      if (resultado[correo] === null) {
        resultado[correo] = {
          id: doc.id,
          ...data,
          marcaTemporal: data.marcaTemporal?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Visita;
      }
    });

    // Si hay más de 10 usuarios, hacer consultas adicionales
    if (correosMercaderistas.length > 10) {
      for (let i = 10; i < correosMercaderistas.length; i += 10) {
        const batch = correosMercaderistas.slice(i, i + 10);
        const batchQ = query(
          collection(db, 'visitas'),
          where('direccionCorreo', 'in', batch),
          orderBy('createdAt', 'desc')
        );
        
        const batchSnapshot = await getDocs(batchQ);
        batchSnapshot.forEach((doc) => {
          const data = doc.data();
          const correo = data.direccionCorreo;
          
          if (resultado[correo] === null) {
            resultado[correo] = {
              id: doc.id,
              ...data,
              marcaTemporal: data.marcaTemporal?.toDate() || new Date(),
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as Visita;
          }
        });
      }
    }

    return resultado;
  } catch (error) {
    console.error('Error obteniendo últimas visitas de usuarios:', error);
    return resultado;
  }
}; 