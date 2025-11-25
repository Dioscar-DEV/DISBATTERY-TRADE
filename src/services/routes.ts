import {
  doc,
  updateDoc,
  Timestamp,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { getFirestoreClient } from "@/firebase/clientApp";
import { offlineManager } from "./offlineManager";
import type { Route, RoutePoint } from "@/types/routes";
import { format } from "date-fns";
import { sendNotificationToAdmins } from "./notifications";
import { sendRutaCompletadaEmail } from "./emailNotifications";

// Interfaz para admin info
interface AdminInfo {
  fullName: string;
  email: string;
  sede: string;
}

/**
 * Obtiene los emails de administradores de una sede específica
 */
const getAdminEmailsBySede = async (sede: string): Promise<AdminInfo[]> => {
  try {
    console.log(`🔍 Buscando administradores para sede: ${sede}`);

    // Consultar usuarios con roles de administrador
    const usersRef = collection(getFirestoreClient(), "users");
    const q = query(
      usersRef,
      where("role", "in", ["Administrador", "AdminMaster", "Supervisor"])
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("⚠️ No se encontraron administradores en la base de datos");
      return [];
    }

    const admins: AdminInfo[] = [];

    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      const userSede = userData.sede || "GRUPO DISBATTERY";

      // Incluir AdminMaster (acceso a todas las sedes) o admins de la sede específica
      if (userData.role === "AdminMaster" || userSede === sede) {
        if (userData.email && userData.fullName) {
          admins.push({
            fullName: userData.fullName,
            email: userData.email,
            sede: userSede,
          });
          console.log(
            `✅ Admin encontrado: ${userData.fullName} (${userData.email}) - Sede: ${userSede}`
          );
        }
      }
    });

    console.log(
      `📊 Total administradores encontrados para ${sede}: ${admins.length}`
    );
    return admins;
  } catch (error) {
    console.error("❌ Error obteniendo emails de administradores:", error);
    return [];
  }
};

// Servicio para gestión de estados de rutas en tiempo real

/**
 * Actualiza el estado de una ruta específica
 */
export const updateRouteStatus = async (
  routeId: string,
  newStatus: Route["status"],
  mercaderistoId?: string
): Promise<void> => {
  try {
    console.log(
      `🔄 [RouteService] Cambiando status de ruta ${routeId} a: ${newStatus}`
    );

    const routeRef = doc(getFirestoreClient(), "routes", routeId);

    const updateData: any = {
      status: newStatus,
      updatedAt: Timestamp.now(),
    };

    // Agregar timestamp específico del estado
    updateData[`${newStatus}At`] = Timestamp.now();

    // Si se proporciona mercaderistoId, validar que sea el correcto
    if (mercaderistoId) {
      updateData["lastUpdatedBy"] = mercaderistoId;
    }

    await updateDoc(routeRef, updateData);
    // ✅ Mantener coherencia local en IndexedDB para estrategia offline-first
    try {
      await offlineManager.updateOfflineRouteStatus(routeId, newStatus);
    } catch {}
    console.log(`✅ [RouteService] Status actualizado a: ${newStatus}`);
  } catch (error: any) {
    console.error("❌ [RouteService] Error actualizando status:", error);
    throw new Error(
      `No se pudo cambiar el estado de la ruta: ${
        error?.message || "Error desconocido"
      }`
    );
  }
};

/**
 * Actualiza el estado de un punto específico de una ruta
 */
export const updateRoutePointStatus = async (
  mercaderistoId: string,
  date: string,
  pointId: string,
  newStatus: RoutePoint["status"],
  rifCliente?: string
): Promise<{ updated: boolean; reason: string }> => {
  try {
    console.log(
      `🎯 [RouteService] === INICIANDO ACTUALIZACIÓN DE PUNTO ESPECÍFICO ===`
    );
    console.log(`🎯 [RouteService] PointId: "${pointId}"`);
    console.log(`🎯 [RouteService] Nuevo estado: "${newStatus}"`);
    console.log(`🎯 [RouteService] Mercaderista: "${mercaderistoId}"`);
    console.log(`🎯 [RouteService] Fecha ESPECÍFICA: "${date}"`);
    console.log(`🎯 [RouteService] RIF Cliente: "${rifCliente}"`);

    // ✅ CORRECCIÓN CRÍTICA: Obtener SOLO las rutas del mercaderista para la fecha EXACTA
    const routesRef = collection(getFirestoreClient(), "routes");
    const q = query(
      routesRef,
      where("mercaderistoId", "==", mercaderistoId),
      where("date", "==", date) // ✅ FILTRO CRÍTICO: Solo rutas de la fecha específica
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(
        "⚠️ [RouteService] No se encontraron rutas para la fecha específica"
      );
      return {
        updated: false,
        reason: `No se encontraron rutas para la fecha ${date}`,
      };
    }

    console.log(
      `🎯 [RouteService] Encontradas ${snapshot.docs.length} rutas SOLO para la fecha ${date}`
    );

    let pointUpdated = false;
    let routeFound = false;

    // Buscar el punto SOLO en las rutas de la fecha específica
    for (const routeDoc of snapshot.docs) {
      const routeData = routeDoc.data();
      const points = routeData.points || [];

      console.log(
        `🎯 [RouteService] === ANALIZANDO RUTA ${routeDoc.id} (Fecha: ${routeData.date}) ===`
      );
      console.log(`🎯 [RouteService] Ruta tiene ${points.length} puntos`);

      // ✅ CORRECCIÓN: PRIORIDAD ABSOLUTA al ID específico del punto
      let pointIndex = -1;

      // PRIORIDAD 1: Buscar EXCLUSIVAMENTE por pointId (más preciso y específico)
      if (pointId) {
        pointIndex = points.findIndex(
          (point: RoutePoint) => point.id === pointId
        );
        console.log(
          `🎯 [RouteService] Búsqueda EXACTA por pointId "${pointId}": ${
            pointIndex >= 0
              ? `ENCONTRADO en índice ${pointIndex}`
              : "NO ENCONTRADO"
          }`
        );

        if (pointIndex >= 0) {
          console.log(
            `🎯 [RouteService] ✅ PUNTO ENCONTRADO EXACTAMENTE: "${points[pointIndex].name}" con estado actual "${points[pointIndex].status}"`
          );
          routeFound = true;

          // ✅ ACTUALIZAR SOLO SI ES NECESARIO
          if (points[pointIndex].status !== newStatus) {
            const updatedPoints = [...points];
            updatedPoints[pointIndex] = {
              ...updatedPoints[pointIndex],
              status: newStatus,
            };

            // Actualizar la ruta en Firestore
            await updateDoc(doc(getFirestoreClient(), "routes", routeDoc.id), {
              points: updatedPoints,
              updatedAt: Timestamp.now(),
            });

            console.log(
              `✅ [RouteService] Punto actualizado exitosamente: "${points[pointIndex].name}" → "${newStatus}"`
            );
            pointUpdated = true;
          } else {
            console.log(
              `ℹ️ [RouteService] Punto ya tiene el estado "${newStatus}", no se requiere actualización`
            );
            pointUpdated = true; // Consideramos exitoso si ya tiene el estado correcto
          }
          break; // ✅ IMPORTANTE: Salir inmediatamente una vez encontrado por ID
        }
      }

      // ✅ ELIMINAMOS EL FALLBACK POR RIF - Solo usar ID específico para evitar confusiones
      console.log(
        `🎯 [RouteService] No se usará búsqueda por RIF para evitar confusiones entre rutas`
      );
    }

    if (!routeFound) {
      console.log(
        `⚠️ [RouteService] === PUNTO NO ENCONTRADO EN LA FECHA ESPECÍFICA ===`
      );
      console.log(
        `⚠️ [RouteService] No se encontró el punto con ID: "${pointId}" en rutas del ${date}`
      );
      return {
        updated: false,
        reason: `Punto no encontrado en las rutas del ${date}`,
      };
    }

    const result = {
      updated: pointUpdated,
      reason: pointUpdated
        ? `Punto actualizado exitosamente para la fecha ${date}`
        : `No se pudo actualizar el punto para la fecha ${date}`,
    };

    console.log(`🎯 [RouteService] === RESULTADO FINAL ===`);
    console.log(`🎯 [RouteService] Resultado:`, result);

    return result;
  } catch (error: any) {
    console.error("❌ [RouteService] Error actualizando punto de ruta:", error);
    throw new Error(
      `No se pudo actualizar el punto de ruta: ${
        error?.message || "Error desconocido"
      }`
    );
  }
};

/**
 * Inicia una ruta (cambia de 'planificada' a 'en_progreso')
 * Típicamente llamada cuando el mercaderista comienza su jornada
 */
export const startRoute = async (
  routeId: string,
  mercaderistoId: string
): Promise<void> => {
  console.log(
    `🚀 [RouteService] Iniciando ruta ${routeId} para mercaderista ${mercaderistoId}`
  );
  await updateRouteStatus(routeId, "en_progreso", mercaderistoId);
};

/**
 * Completa una ruta (cambia a 'completada')
 * Típicamente llamada cuando se completan todos los puntos de la ruta
 */
export const completeRoute = async (
  routeId: string,
  mercaderistoId: string
): Promise<void> => {
  console.log(
    `🏁 [RouteService] Completando ruta ${routeId} para mercaderista ${mercaderistoId}`
  );
  await updateRouteStatus(routeId, "completada", mercaderistoId);
};

/**
 * Reinicia una ruta a planificada (útil para correcciones)
 */
export const resetRouteToPlanned = async (routeId: string): Promise<void> => {
  console.log(`↺ [RouteService] Reiniciando ruta ${routeId} a planificada`);
  await updateRouteStatus(routeId, "planificada");
};

/**
 * Obtiene las rutas de un mercaderista para una fecha específica
 * Con listener en tiempo real
 */
export const listenToMercaderistaRoutes = (
  mercaderistoId: string,
  date: string,
  callback: (routes: Route[]) => void,
  onError?: (error: Error) => void
) => {
  console.log(
    `👂 [RouteService] Configurando listener para mercaderista ${mercaderistoId} en fecha ${date}`
  );

  const routesRef = collection(getFirestoreClient(), "routes");
  const q = query(
    routesRef,
    where("mercaderistoId", "==", mercaderistoId),
    where("date", "==", date)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const routes: Route[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        routes.push({
          id: doc.id,
          mercaderista: data.mercaderista,
          mercaderistoId: data.mercaderistoId,
          date: data.date,
          points: data.points || [],
          status: data.status || "planificada",
          totalDistance: data.totalDistance || 0,
          totalTime: data.totalTime || 0,
          createdAt: data.createdAt?.toDate(),
          createdBy: data.createdBy,
        });
      });

      console.log(
        `📊 [RouteService] ${routes.length} rutas actualizadas para ${mercaderistoId}`
      );
      callback(routes);
    },
    (error) => {
      console.error("❌ [RouteService] Error en listener de rutas:", error);
      if (onError) {
        onError(new Error(`Error escuchando rutas: ${error.message}`));
      }
    }
  );

  return unsubscribe; // Retorna función para limpiar el listener
};

/**
 * Función automática que se puede llamar cuando un mercaderista:
 * 1. Abre la app por primera vez en el día -> inicia la ruta
 * 2. Completa todas las visitas -> completa la ruta
 */
export const autoUpdateRouteStatus = async (
  mercaderistoId: string,
  date: string,
  action: "start" | "complete"
): Promise<{ updated: boolean; reason: string; routesFound: number }> => {
  try {
    console.log(
      `🔄 [RouteService] === INICIANDO AUTO-ACTUALIZACIÓN DE RUTA ===`
    );
    console.log(`🔄 [RouteService] Parámetros recibidos:`);
    console.log(`   👤 MercaderistaId: "${mercaderistoId}"`);
    console.log(`   📅 Fecha: "${date}"`);
    console.log(`   🎯 Acción: "${action}"`);
    console.log(`   🕐 Timestamp: ${new Date().toISOString()}`);

    // Validar parámetros de entrada
    if (!mercaderistoId || !date || !action) {
      const error = `Parámetros inválidos: mercaderistoId="${mercaderistoId}", date="${date}", action="${action}"`;
      console.error(`❌ [RouteService] ${error}`);
      return { updated: false, reason: error, routesFound: 0 };
    }

    // Obtener las rutas del mercaderista para hoy
    const routesRef = collection(getFirestoreClient(), "routes");
    const q = query(
      routesRef,
      where("mercaderistoId", "==", mercaderistoId),
      where("date", "==", date)
    );

    console.log(`🔍 [RouteService] Ejecutando consulta a Firestore...`);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`⚠️ [RouteService] === NO SE ENCONTRARON RUTAS ===`);
      console.log(`⚠️ [RouteService] Posibles causas:`);
      console.log(`   1. MercaderistaId no coincide exactamente`);
      console.log(`   2. Fecha no coincide exactamente (formato: ${date})`);
      console.log(
        `   3. No hay rutas creadas para este mercaderista en esta fecha`
      );
      return {
        updated: false,
        reason: `No se encontraron rutas para ${mercaderistoId} en fecha ${date}`,
        routesFound: 0,
      };
    }

    console.log(
      `📊 [RouteService] ✅ Encontradas ${snapshot.docs.length} rutas para evaluar`
    );

    // Mostrar detalles de cada ruta encontrada
    snapshot.docs.forEach((doc, index) => {
      const route = doc.data();
      console.log(`📍 [RouteService] Ruta ${index + 1}:`);
      console.log(`   🆔 ID: ${doc.id}`);
      console.log(`   👤 Mercaderista: ${route.mercaderista}`);
      console.log(`   📅 Fecha: ${route.date}`);
      console.log(`   📊 Estado actual: "${route.status || "planificada"}"`);
      console.log(`   📍 Puntos: ${route.points?.length || 0}`);
    });

    let routesUpdated = 0;
    const updatePromises = snapshot.docs.map(async (doc: any) => {
      const route = doc.data();
      const currentStatus = route.status || "planificada";

      console.log(`📍 [RouteService] === EVALUANDO RUTA ${doc.id} ===`);
      console.log(`📍 [RouteService] Mercaderista: ${route.mercaderista}`);
      console.log(`📍 [RouteService] Estado actual: "${currentStatus}"`);
      console.log(`📍 [RouteService] Acción solicitada: "${action}"`);

      let shouldUpdate = false;
      let newStatus: Route["status"] | undefined = undefined;
      let updateReason = "";

      if (action === "start" && currentStatus === "planificada") {
        shouldUpdate = true;
        newStatus = "en_progreso";
        updateReason = "Iniciando ruta: planificada → en_progreso";
        console.log(`🚀 [RouteService] ✅ ${updateReason}`);
      } else if (action === "complete") {
        console.log(`🏁 [RouteService] Procesando completación de ruta...`);
        console.log(`🏁 [RouteService] Estado actual: "${currentStatus}"`);

        if (currentStatus === "en_progreso") {
          shouldUpdate = true;
          newStatus = "completada";
          updateReason = "Completando ruta: en_progreso → completada";
          console.log(`🏁 [RouteService] ✅ ${updateReason}`);

          // 📧 Enviar EMAIL a administradores cuando se completa la ruta
          try {
            console.log(`🎉 === RUTA COMPLETADA - ENVIANDO EMAILS ===`);
            console.log(
              `👤 Mercaderista: ${route.mercaderista} (ID: ${mercaderistoId})`
            );
            console.log(`📅 Fecha: ${route.date}`);
            console.log(`📍 Puntos: ${route.points?.length || 0}`);

            // Determinar sede, con fallbacks inteligentes
            let sede = route.sede || "GRUPO DISBATTERY";

            if (!route.sede) {
              console.log(
                "⚠️ Ruta sin sede asignada, usando sede por defecto:",
                sede
              );
            }

            console.log(`🏢 Buscando administradores para sede: ${sede}`);

            // Obtener emails de administradores para esta sede
            const adminEmails = await getAdminEmailsBySede(sede);

            console.log(
              `📊 Administradores encontrados: ${adminEmails.length}`
            );

            if (adminEmails.length > 0) {
              console.log(
                `📧 Preparando envío a ${adminEmails.length} administradores:`
              );
              adminEmails.forEach((admin) => {
                console.log(
                  `   👤 ${admin.fullName} (${admin.email}) - Sede: ${admin.sede}`
                );
              });

              // Enviar email a cada administrador
              const emailPromises = adminEmails.map((admin) => {
                const emailData = {
                  admin_nombre: admin.fullName,
                  admin_email: admin.email,
                  mercaderista_nombre: route.mercaderista,
                  mercaderista_email: "", // Se puede agregar después si está disponible
                  fecha_ruta: format(new Date(route.date), "dd/MM/yyyy"),
                  hora_finalizacion: format(new Date(), "HH:mm"),
                  sede: sede,
                };

                console.log(
                  `📤 Enviando email a: ${admin.fullName} (${admin.email})`
                );
                console.log(`📋 Datos del email:`, emailData);
                return sendRutaCompletadaEmail(emailData);
              });

              const results = await Promise.allSettled(emailPromises);

              // Mostrar resultados detallados
              results.forEach((result, index) => {
                const admin = adminEmails[index];
                if (result.status === "fulfilled") {
                  if (result.value === true) {
                    console.log(
                      `✅ Email enviado exitosamente a: ${admin.fullName}`
                    );
                  } else {
                    console.log(`❌ Error enviando email a: ${admin.fullName}`);
                  }
                } else {
                  console.log(
                    `❌ Promise rechazado para: ${admin.fullName}`,
                    result.reason
                  );
                }
              });

              const successCount = results.filter(
                (result) =>
                  result.status === "fulfilled" && result.value === true
              ).length;

              if (successCount > 0) {
                console.log(
                  `🎉 RESUMEN: Email de ruta completada enviado a ${successCount}/${adminEmails.length} administradores`
                );
              } else {
                console.log(
                  "💥 PROBLEMA: No se pudo enviar email a ningún administrador"
                );
                console.log("🔍 Revisar logs anteriores para más detalles");
              }
            } else {
              console.log(
                "💥 PROBLEMA: No se encontraron administradores para enviar email"
              );
              console.log("💡 POSIBLES CAUSAS:");
              console.log("   1. No hay administradores en la base de datos");
              console.log("   2. Los administradores no tienen emails válidos");
              console.log(
                "   3. Los administradores no pertenecen a la sede:",
                sede
              );
            }
          } catch (notificationError) {
            console.error(
              "❌ Error enviando notificación de ruta completada:",
              notificationError
            );
            console.error("❌ Detalles:", {
              mercaderista: route.mercaderista,
              mercaderistoId: mercaderistoId,
              fecha: route.date,
              sede: route.sede,
              error:
                notificationError instanceof Error
                  ? notificationError.message
                  : "Error desconocido",
            });
            // No fallar la completación si falla la notificación
            console.log(
              "✅ Ruta marcada como completada exitosamente (sin notificación)"
            );
          }
        } else if (currentStatus === "completada") {
          updateReason =
            "Ruta ya está completada, no se requiere actualización";
          console.log(`✅ [RouteService] ${updateReason}`);
        } else {
          updateReason = `Ruta en estado "${currentStatus}", no se puede completar directamente`;
          console.log(`⏭️ [RouteService] ${updateReason}`);
        }
      } else if (action === "start" && currentStatus !== "planificada") {
        updateReason = `Ruta en estado "${currentStatus}", no se puede iniciar`;
        console.log(`⏭️ [RouteService] ${updateReason}`);
      } else {
        updateReason = `Ruta ya está en estado "${currentStatus}", no requiere cambio para "${action}"`;
        console.log(`⏭️ [RouteService] ${updateReason}`);
      }

      console.log(
        `🔄 [RouteService] Decisión final: shouldUpdate = ${shouldUpdate}`
      );
      console.log(`🔄 [RouteService] Razón: ${updateReason}`);

      if (shouldUpdate && newStatus) {
        try {
          console.log(
            `🔄 [RouteService] Ejecutando actualización: ${doc.id} → ${newStatus}`
          );
          await updateRouteStatus(doc.id, newStatus, mercaderistoId);
          routesUpdated++;
          console.log(
            `✅ [RouteService] Ruta ${doc.id} actualizada exitosamente a "${newStatus}"`
          );
        } catch (updateError) {
          console.error(
            `❌ [RouteService] Error actualizando ruta ${doc.id}:`,
            updateError
          );
          throw updateError; // Re-lanzar el error para que se maneje arriba
        }
      } else {
        console.log(
          `⏭️ [RouteService] No se actualizará la ruta ${doc.id}: ${updateReason}`
        );
      }

      return shouldUpdate;
    });

    await Promise.all(updatePromises);

    console.log(`🎉 [RouteService] === RESUMEN DE AUTO-ACTUALIZACIÓN ===`);
    console.log(`📊 Rutas encontradas: ${snapshot.docs.length}`);
    console.log(`✅ Rutas actualizadas: ${routesUpdated}`);
    console.log(`📈 Tasa de éxito: ${routesUpdated}/${snapshot.docs.length}`);

    const result = {
      updated: routesUpdated > 0,
      reason:
        routesUpdated > 0
          ? `${routesUpdated} de ${snapshot.docs.length} rutas actualizadas exitosamente`
          : `No se actualizaron rutas. Se encontraron ${snapshot.docs.length} rutas pero ninguna requirió cambios para la acción "${action}"`,
      routesFound: snapshot.docs.length,
    };

    console.log(`🎉 [RouteService] Resultado final:`, result);

    // Si no se actualizó ninguna ruta, mostrar diagnóstico adicional
    if (routesUpdated === 0 && snapshot.docs.length > 0) {
      console.log(
        `🔍 [RouteService] === DIAGNÓSTICO: ¿Por qué no se actualizaron rutas? ===`
      );
      snapshot.docs.forEach((doc, index) => {
        const route = doc.data();
        const currentStatus = route.status || "planificada";
        console.log(`📍 Ruta ${index + 1} (${doc.id}):`);
        console.log(`   Estado actual: "${currentStatus}"`);
        console.log(`   Acción solicitada: "${action}"`);
        if (action === "complete" && currentStatus !== "en_progreso") {
          console.log(
            `   ❌ No se puede completar porque no está en "en_progreso"`
          );
        } else if (action === "start" && currentStatus !== "planificada") {
          console.log(
            `   ❌ No se puede iniciar porque no está en "planificada"`
          );
        }
      });
    }

    return result;
  } catch (error: any) {
    console.error("❌ [RouteService] Error en auto-actualización:", error);
    throw new Error(
      `No se pudo actualizar automáticamente: ${
        error?.message || "Error desconocido"
      }`
    );
  }
};

/**
 * Función de migración para actualizar retroactivamente los estados de los puntos de ruta
 * basándose en las visitas existentes
 */
export const updateRoutePointsFromExistingVisits = async (
  mercaderistoId: string,
  date: string
): Promise<{ updated: boolean; pointsUpdated: number; reason: string }> => {
  try {
    console.log(
      `🔄 [Migration] Actualizando puntos de ruta retroactivamente para mercaderista: ${mercaderistoId}, fecha: ${date}`
    );

    // 1. Obtener las rutas del mercaderista para la fecha específica
    const routesRef = collection(getFirestoreClient(), "routes");
    const routesQuery = query(
      routesRef,
      where("mercaderistoId", "==", mercaderistoId),
      where("date", "==", date)
    );

    const routesSnapshot = await getDocs(routesQuery);

    if (routesSnapshot.empty) {
      console.log("⚠️ [Migration] No se encontraron rutas para actualizar");
      return {
        updated: false,
        pointsUpdated: 0,
        reason: "No se encontraron rutas para la fecha",
      };
    }

    // 2. Obtener todas las visitas del mercaderista para la fecha
    const visitasRef = collection(getFirestoreClient(), "visitas");
    const visitasQuery = query(visitasRef, where("direccionCorreo", "!=", ""));
    const visitasSnapshot = await getDocs(visitasQuery);

    // Filtrar visitas por fecha y mercaderista
    const visitasDelDia = visitasSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((visita: any) => {
        const visitaDate = visita.createdAt?.toDate();
        if (!visitaDate) return false;

        const visitaDateString = format(visitaDate, "yyyy-MM-dd");
        return visitaDateString === date;
      });

    console.log(
      `📊 [Migration] Encontradas ${visitasDelDia.length} visitas para el día ${date}`
    );

    // 3. Actualizar cada ruta
    let totalPointsUpdated = 0;
    let routesUpdated = 0;

    for (const routeDoc of routesSnapshot.docs) {
      const routeData = routeDoc.data();
      const points = routeData.points || [];
      let routePointsUpdated = 0;

      console.log(
        `🔄 [Migration] Procesando ruta ${routeDoc.id} con ${points.length} puntos`
      );

      const updatedPoints = points.map((point: RoutePoint) => {
        // Buscar si existe una visita para este punto
        const visitaDelPunto = visitasDelDia.find((visita: any) => {
          if (point.rif && visita.rifCliente) {
            return (
              point.rif.trim().toUpperCase() ===
              visita.rifCliente.trim().toUpperCase()
            );
          }
          return false;
        });

        if (visitaDelPunto && point.status === "pendiente") {
          console.log(
            `✅ [Migration] Actualizando punto ${point.name} de pendiente a visitado`
          );
          routePointsUpdated++;
          return { ...point, status: "visitado" as RoutePoint["status"] };
        }

        return point;
      });

      // Solo actualizar si hubo cambios
      if (routePointsUpdated > 0) {
        await updateDoc(doc(getFirestoreClient(), "routes", routeDoc.id), {
          points: updatedPoints,
          updatedAt: Timestamp.now(),
        });

        routesUpdated++;
        totalPointsUpdated += routePointsUpdated;
        console.log(
          `✅ [Migration] Ruta ${routeDoc.id} actualizada con ${routePointsUpdated} puntos`
        );
      }
    }

    const result = {
      updated: totalPointsUpdated > 0,
      pointsUpdated: totalPointsUpdated,
      reason: `${totalPointsUpdated} puntos actualizados en ${routesUpdated} rutas`,
    };

    console.log(`🎉 [Migration] Migración completada:`, result);
    return result;
  } catch (error: any) {
    console.error("❌ [Migration] Error en migración:", error);
    throw new Error(
      `Error en migración: ${error?.message || "Error desconocido"}`
    );
  }
};

/**
 * Actualiza el estado de un evento independiente
 */
export const updateEventStatus = async (
  eventId: string,
  newStatus: "planificado" | "en_progreso" | "completado"
): Promise<void> => {
  try {
    console.log(
      `🎪 [EventService] Cambiando status de evento ${eventId} a: ${newStatus}`
    );

    const eventRef = doc(getFirestoreClient(), "eventos", eventId);

    const updateData: any = {
      status: newStatus,
      updatedAt: Timestamp.now(),
    };

    // Agregar timestamp específico del estado
    updateData[`${newStatus}At`] = Timestamp.now();

    await updateDoc(eventRef, updateData);
    console.log(
      `✅ [EventService] Status de evento actualizado a: ${newStatus}`
    );
  } catch (error: any) {
    console.error(
      "❌ [EventService] Error actualizando status del evento:",
      error
    );
    throw new Error(
      `No se pudo cambiar el estado del evento: ${
        error?.message || "Error desconocido"
      }`
    );
  }
};

/**
 * Obtiene el texto legible del estado
 */
export const getStatusText = (status: Route["status"]): string => {
  switch (status) {
    case "planificada":
      return "Planificada";
    case "en_progreso":
      return "En Proceso";
    case "completada":
      return "Finalizada";
    default:
      return "Desconocido";
  }
};

/**
 * Obtiene el color CSS del estado
 */
export const getStatusColor = (status: Route["status"]): string => {
  switch (status) {
    case "planificada":
      return "bg-blue-100 text-blue-800";
    case "en_progreso":
      return "bg-yellow-100 text-yellow-800";
    case "completada":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
