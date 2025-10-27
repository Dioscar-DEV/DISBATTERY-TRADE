import emailjs from "@emailjs/browser";

// Configuración de EmailJS desde variables de entorno
const EMAILJS_CONFIG = {
  serviceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "service_gxvt5sr",
  publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "NldiItSGzS1TMPAz0",
  templates: {
    nuevaRuta: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_NUEVA_RUTA || "template_swkb7yd",
    rutaCompletada: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_RUTA_COMPLETADA || "template_3hl2pte",
    nuevoUsuario: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_NUEVO_USUARIO || "template_2lwmrgc", // Template para aprobación de usuarios
  },
};

// Inicializar EmailJS
emailjs.init(EMAILJS_CONFIG.publicKey);

export interface EmailNotificationData {
  // Para Nueva Ruta
  mercaderista_nombre?: string;
  mercaderista_email?: string;
  admin_nombre?: string;
  admin_email?: string;
  fecha_ruta?: string;
  puntos_cantidad?: number;
  sede?: string;

  // Para Ruta Completada
  hora_finalizacion?: string;

  // Para Aprobación de Usuario
  usuario_nombre?: string;
  usuario_email?: string;
  usuario_rol?: string;
  usuario_telefono?: string;
  usuario_ciudad?: string;
  admin_creador?: string;
  fecha_solicitud?: string;
  user_id?: string;
}

/**
 * Envía notificación por email cuando se crea una nueva ruta
 */
export const sendNuevaRutaEmail = async (
  data: EmailNotificationData
): Promise<boolean> => {
  try {
    console.log("📧 Enviando email de nueva ruta a:", data.mercaderista_email);
    console.log("📧 Datos del email:", data);

    const templateParams = {
      mercaderista_nombre: data.mercaderista_nombre,
      mercaderista_email: data.mercaderista_email,
      admin_nombre: data.admin_nombre,
      admin_email: data.admin_email,
      fecha_ruta: data.fecha_ruta,
      puntos_cantidad: data.puntos_cantidad,
      sede: data.sede,
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.nuevaRuta,
      templateParams
    );

    console.log("✅ Email de nueva ruta enviado exitosamente:", response);
    return true;
  } catch (error) {
    console.error("❌ Error enviando email de nueva ruta:", error);
    return false;
  }
};

/**
 * Envía notificación por email cuando se completa una ruta
 */
export const sendRutaCompletadaEmail = async (
  data: EmailNotificationData
): Promise<boolean> => {
  try {
    console.log("📧 Enviando email de ruta completada a:", data.admin_email);
    console.log("📧 Datos del email:", data);

    const templateParams = {
      admin_nombre: data.admin_nombre,
      admin_email: data.admin_email,
      mercaderista_nombre: data.mercaderista_nombre,
      mercaderista_email: data.mercaderista_email,
      fecha_ruta: data.fecha_ruta,
      hora_finalizacion: data.hora_finalizacion,
      sede: data.sede,
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.rutaCompletada,
      templateParams
    );

    console.log("✅ Email de ruta completada enviado exitosamente:", response);
    return true;
  } catch (error) {
    console.error("❌ Error enviando email de ruta completada:", error);
    return false;
  }
};

/**
 * Envía notificación por email cuando se crea un nuevo usuario pendiente de aprobación
 */
export const sendNuevoUsuarioAprobacionEmail = async (
  data: EmailNotificationData
): Promise<boolean> => {
  try {
    console.log(
      "📧 Enviando email de aprobación de usuario para:",
      data.usuario_nombre
    );
    console.log("📧 Datos del email:", data);

    const templateParams = {
      usuario_nombre: data.usuario_nombre,
      usuario_email: data.usuario_email,
      usuario_rol: data.usuario_rol,
      usuario_telefono: data.usuario_telefono,
      usuario_ciudad: data.usuario_ciudad,
      admin_creador: data.admin_creador,
      fecha_solicitud: data.fecha_solicitud,
      sede: data.sede,
      user_id: data.user_id,
      // URL para aprobar/rechazar (puedes personalizar esto)
      approval_url: `https://disbattery-trade.web.app/admin/users/approve/${data.user_id}`,
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.nuevoUsuario,
      templateParams
    );

    console.log(
      "✅ Email de aprobación de usuario enviado exitosamente:",
      response
    );
    return true;
  } catch (error) {
    console.error("❌ Error enviando email de aprobación de usuario:", error);
    return false;
  }
};

/**
 * Función de prueba para verificar que EmailJS funciona
 */
export const testEmailService = async (): Promise<boolean> => {
  try {
    console.log("🧪 Probando servicio EmailJS...");

    const testData: EmailNotificationData = {
      mercaderista_nombre: "Usuario Prueba",
      mercaderista_email: "dsalcedo@smartautomatai.com", // Tu email para pruebas
      admin_nombre: "Admin Prueba",
      admin_email: "dsalcedo@smartautomatai.com",
      fecha_ruta: new Date().toLocaleDateString("es-VE"),
      puntos_cantidad: 1,
      sede: "GRUPO DISBATTERY",
    };

    const result = await sendNuevaRutaEmail(testData);

    if (result) {
      console.log("✅ Servicio EmailJS funcionando correctamente");
      alert("✅ Email de prueba enviado! Revisa tu bandeja de entrada.");
    } else {
      console.log("❌ Error en el servicio EmailJS");
      alert("❌ Error enviando email de prueba. Revisa la consola.");
    }

    return result;
  } catch (error) {
    console.error("❌ Error probando EmailJS:", error);
    alert("❌ Error: " + (error as Error).message);
    return false;
  }
};

/**
 * Función de prueba para email de ruta completada
 */
export const testRutaCompletadaEmail = async (): Promise<boolean> => {
  try {
    console.log("🧪 Probando email de ruta completada...");

    const testData: EmailNotificationData = {
      admin_nombre: "Admin Prueba",
      admin_email: "dsalcedo@smartautomatai.com",
      mercaderista_nombre: "Mercaderista Prueba",
      mercaderista_email: "dsalcedo@smartautomatai.com",
      fecha_ruta: new Date().toLocaleDateString("es-VE"),
      hora_finalizacion: new Date().toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      sede: "GRUPO DISBATTERY",
    };

    const result = await sendRutaCompletadaEmail(testData);

    if (result) {
      console.log("✅ Email de ruta completada enviado correctamente");
      alert(
        "✅ Email de ruta completada enviado! Revisa tu bandeja de entrada."
      );
    } else {
      console.log("❌ Error enviando email de ruta completada");
      alert("❌ Error enviando email de ruta completada. Revisa la consola.");
    }

    return result;
  } catch (error) {
    console.error("❌ Error probando email de ruta completada:", error);
    alert("❌ Error: " + (error as Error).message);
    return false;
  }
};

/**
 * Función de debug para probar el flujo completo de ruta completada
 */
export const debugRutaCompletada = async (): Promise<void> => {
  try {
    console.log("🕵️ === DEBUG RUTA COMPLETADA ===");

    // Importar dependencias necesarias
    const { collection, query, where, getDocs } = await import(
      "firebase/firestore"
    );
    const { getFirestoreClient } = await import("@/firebase/clientApp");
    const db = getFirestoreClient();

    // 1. Verificar que hay administradores en la base de datos
    console.log("1️⃣ Buscando administradores en la base de datos...");
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("role", "in", ["Administrador", "AdminMaster", "Supervisor"])
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(
        "❌ ERROR: No se encontraron administradores en la base de datos"
      );
      console.error(
        '💡 SOLUCIÓN: Asegúrate de que hay usuarios con role "Administrador", "AdminMaster" o "Supervisor"'
      );
      return;
    }

    console.log(
      `✅ Encontrados ${querySnapshot.docs.length} administradores en total`
    );

    // 2. Mostrar información de cada administrador
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      console.log(
        `👤 Admin: ${userData.fullName || "Sin nombre"} | Email: ${
          userData.email || "Sin email"
        } | Sede: ${userData.sede || "Sin sede"} | Role: ${userData.role}`
      );
    });

    // 3. Filtrar por sede específica (GRUPO DISBATTERY como ejemplo)
    const sedeTest = "GRUPO DISBATTERY";
    console.log(`2️⃣ Filtrando administradores para sede: ${sedeTest}`);

    const adminsParaSede: { fullName: string; email: string; sede: string }[] = [];
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      const userSede = userData.sede || "GRUPO DISBATTERY";

      if (userData.role === "AdminMaster" || userSede === sedeTest) {
        if (userData.email && userData.fullName) {
          adminsParaSede.push({
            fullName: userData.fullName,
            email: userData.email,
            sede: userSede,
          });
        }
      }
    });

    console.log(
      `✅ Administradores válidos para ${sedeTest}: ${adminsParaSede.length}`
    );
    adminsParaSede.forEach((admin) => {
      console.log(`   📧 ${admin.fullName} (${admin.email})`);
    });

    // 4. Probar envío de email
    if (adminsParaSede.length > 0) {
      console.log("3️⃣ Probando envío de email...");
      const testAdmin = adminsParaSede[0];

      const emailData = {
        admin_nombre: testAdmin.fullName,
        admin_email: testAdmin.email,
        mercaderista_nombre: "Test Mercaderista",
        mercaderista_email: "test@example.com",
        fecha_ruta: new Date().toLocaleDateString("es-VE"),
        hora_finalizacion: new Date().toLocaleTimeString("es-VE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        sede: sedeTest,
      };

      const result = await sendRutaCompletadaEmail(emailData);

      if (result) {
        console.log("✅ Email de prueba enviado correctamente");
        alert(`✅ Email de debug enviado a: ${testAdmin.email}`);
      } else {
        console.error("❌ Error enviando email de prueba");
        alert("❌ Error enviando email de prueba");
      }
    } else {
      console.error("❌ No hay administradores válidos para enviar email");
      alert("❌ No se encontraron administradores válidos");
    }
  } catch (error) {
    console.error("❌ Error en debug:", error);
    alert("❌ Error en debug: " + (error as Error).message);
  }
};

// Exponer funciones para pruebas en el navegador
if (typeof window !== "undefined") {
  (window as any).testEmailService = testEmailService;
  (window as any).testRutaCompletadaEmail = testRutaCompletadaEmail;
  (window as any).debugRutaCompletada = debugRutaCompletada;
}
