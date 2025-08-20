// Tipos para las visitas y respuestas de formularios

export interface VisitaBase {
  id: string;
  marcaTemporal: Date;
  direccionCorreo: string;
  rifCliente: string;
  nombreEstablecimiento: string;
  tipoVisita: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)';
  mercaderista: string;
  ubicacion: {
    lat: number;
    lng: number;
    latitude?: number;  // 🗺️ AGREGAR FORMATO ALTERNATIVO
    longitude?: number; // 🗺️ PARA COMPATIBILIDAD
    direccion: string;
    address?: string;   // 🗺️ FORMATO ALTERNATIVO
  };
  sucursal: string;
  observacionesAdicionales?: string;
  createdAt: Date;
  updatedAt: Date;
  sincronizadoN8N: boolean;
  errorSync?: string;
  checkIn写真URL?: string;
  checkInContexto?: string;
}

// Respuestas específicas para Merchandising
export interface RespuestasMerchandising {
  // Señalización
  clientePoseeSeñalizacion: boolean;
  fotoSeñalizacion?: string;
  
  // Planograma Shell
  hicistePlanogramaShell: boolean;
  fotoAntesShell?: string;
  fotoDespuesShell?: string;
  
  // Sticker Punto de Venta Shell
  clienteTieneStickerShell: boolean;
  colocasteStickerShell: boolean;
  fotoStickerShell?: string;
  
  // Materiales Shell
  totalCenefasShell: number;
  totalPapelBobinaShell: number;
  totalStickersShellCambio: number;
  totalAmbientadoresShell: number;
  totalBolsasShell: number;
  
  // Exhibidores Shell
  clienteTieneExhibidoresShell: boolean;
  fotoExhibidoresShell?: string;
  
  // Afiches Shell
  afichesFerrari2023: number;
  afichesHX8: number;
  afichesProductosPremium2024: number;
  afichesShellFamilia2023: number;
  afichesShellHX7: number;
  afichesTablaAplicacionShell: number;
  aficheShellGadus2021: number;
  aficheShellHelix: number;
  aficheShellRimula: number;
  aficheShellAdvance: number;
  aficheShell5W30: number;
  fotosAfichesShell?: string;
  
  // 🆕 Afiches Shell Material Interno
  fotosAfichesShellMaterial?: string;
  
  // Banderines Shell
  colocasteBanderinesShell: boolean;
  totalBanderinesShell: number;
  fotosBanderinesShell?: string;
  
  // Aviso Acrílico Shell
  clienteTieneAvisoAcrilicoShell: boolean;
  fotoAvisoAcrilicoShell?: string;
  
  // Material Qualid
  colocasteQualid: boolean;
  hicistePlanogramaQualid: boolean;
  fotoAntesQualid?: string;
  fotoDespuesQualid?: string;
  totalCenefasQualid: number;
  totalBolsasQualid: number;
  
  // Afiches Qualid
  afiches_FiltrosFluidos2024: number;
  afichesQualidCaucho2023: number;
  afichesQualidCaucho2024: number;
  afichesQualidCuidadoAutomotriz2022: number;
  afichesQualidFF2022: number;
  afichesQualidFiltros2022: number;
  afichesQualidMantenimiento2022: number;
  afichesQualidTablaCrossReference2024: number;
  afichesQualidTablaAplicacion: number;
  afichesQualidTablaFiltroAutomotriz2024: number;
  aficheQualidFiltrosAutomotriz: number;
  aficheQualidFamilyCarCare: number;
  fotosAfichesQualid?: string;
  
  // Exhibidores Qualid
  colocasteExhibidoresCauchosQualid: boolean;
  totalExhibidorCauchoPequeño: number;
  totalExhibidorCauchoGrande: number;
  fotoExhibidoresCauchosQualid?: string;
  
  // 🆕 Fotos de Trade (impulso y eventos)
  fotoImpulsoShell?: string;
  fotoPromotorasShell?: string;
  fotoImpulsoQualid?: string;
  fotoPromotorasQualid?: string;
  
  // Observaciones específicas
  observacionesShell?: string;
  observacionesQualid?: string;
  
  // Observaciones estructuradas para N8N
  observaciones?: string | string[] | ObservacionItem[];
}

// Interface para observaciones estructuradas
export interface ObservacionItem {
  pregunta: string;
  respuesta: string;
}

// Respuestas para Trade (común para Eventos e Impulso)
export interface RespuestasTrade {
      marcaSeleccionada: 'Shell' | 'Qualid';
  recursosUtilizados: string[];
  entregablesShell: string[];
  entregablesQualid: string[];
  fotos: string[];
  observaciones?: string | string[] | ObservacionItem[]; // Permitir string, array de strings o array de objetos
}

// Visita completa
export interface VisitaMerchandising extends VisitaBase {
  tipoVisita: 'Merchandising';
  respuestas: RespuestasMerchandising;
}

export interface VisitaTrade extends VisitaBase {
  tipoVisita: 'Trade (Eventos)' | 'Trade (Impulso)';
  respuestas: RespuestasTrade;
}

export type Visita = VisitaMerchandising | VisitaTrade;

// Datos para crear visita
export interface CreateVisitaData {
  rifCliente: string;
  nombreEstablecimiento: string;
  tipoVisita: 'Merchandising' | 'Trade (Eventos)' | 'Trade (Impulso)';
  mercaderista: string;
  correoMercaderista?: string;
  ubicacion: {
    lat: number;
    lng: number;
    latitude?: number;  // 🗺️ AGREGAR FORMATO ALTERNATIVO
    longitude?: number; // 🗺️ PARA COMPATIBILIDAD
    direccion: string;
    address?: string;   // 🗺️ FORMATO ALTERNATIVO
  };
  sucursal: string;
  respuestas: RespuestasMerchandising | RespuestasTrade;
  observacionesAdicionales?: string;
  // 🆕 DATOS COMPLETOS PARA N8N (CON IMÁGENES BASE64)
  datosN8N?: {
    datosSheet: Record<string, any>;
    fotos?: string[] | Record<string, string>;
    [key: string]: any; // Permitir propiedades adicionales flexibles
  };
}

// Función helper para mapear a formato de Sheet
export const mapearParaSheet = (visita: Visita): Record<string, any> => {
  const base = {
    'Marca temporal': visita.marcaTemporal.toISOString(),
    'Dirección de correo electrónico': visita.direccionCorreo || '',
    'Rif del cliente:': visita.rifCliente,
    'Nombre del establecimiento:': visita.nombreEstablecimiento,
    'Desde que sucursal se realiza el registro': visita.sucursal,
    'Añade aquí todos tus comentarios y observaciones adicionales': visita.observacionesAdicionales || '',
  };

  if (visita.tipoVisita === 'Merchandising') {
    const resp = visita.respuestas as RespuestasMerchandising;
    return {
      ...base,
      '¿El cliente posee señalización?': resp.clientePoseeSeñalizacion ? 'Sí' : 'No',
      'Foto de la señalización': resp.fotoSeñalizacion || '',
      '¿Hiciste Planograma SHELL?': resp.hicistePlanogramaShell ? 'Sí' : 'No',
      'Foto "Antes" del Planograma Shell': resp.fotoAntesShell || '',
      'Foto "Después" del Planograma Shell': resp.fotoDespuesShell || '',
      '¿El cliente tiene STICKER PUNTO DE VENTA AUTORIZADO SHELL?': resp.clienteTieneStickerShell ? 'Sí' : 'No',
      '¿Colocaste STICKER PUNTO DE VENTA AUTORIZADO SHELL?': resp.colocasteStickerShell ? 'Sí' : 'No',
      'Foto del STICKER PUNTO DE VENTA AUTORIZADO SHELL:': resp.fotoStickerShell || '',
      'Total de CENEFAS SHELL colocadas:': resp.totalCenefasShell,
      'Total de PAPEL BOBINA SHELL colocado en metros:': resp.totalPapelBobinaShell,
      'Total de STICKERS SHELL CAMBIO DE LUBRICANTE entregados:': resp.totalStickersShellCambio,
      'Total de AMBIENTADORES SHELL PARA VEHÍCULO entregados:': resp.totalAmbientadoresShell,
      'Total de BOLSAS SHELL PARA CARRO entregadas:': resp.totalBolsasShell,
      '¿El cliente tiene EXHIBIDORES SHELL?': resp.clienteTieneExhibidoresShell ? 'Sí' : 'No',
      'De tener EXHIBIDORES SHELL, adjunta aquí la foto:': resp.fotoExhibidoresShell || '',
      
      // Afiches Shell
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA FERRARI 2023]': resp.afichesFerrari2023,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA HX8]': resp.afichesHX8,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA PRODUCTOS PREMIUM 2024]': resp.afichesProductosPremium2024,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA SHELL FAMILIA 2023]': resp.afichesShellFamilia2023,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA SHELL HX7 10W-40]': resp.afichesShellHX7,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA TABLA DE APLICACION SHELL]': resp.afichesTablaAplicacionShell,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHE CAMPAÑA SHELL GADUS 2021]': resp.aficheShellGadus2021,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL HELIX]': resp.aficheShellHelix,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL RIMULA]': resp.aficheShellRimula,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL ADVANCE]': resp.aficheShellAdvance,
      '¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL 5W-30]': resp.aficheShell5W30,
      'Fotos de los AFICHES SHELL colocados:': resp.fotosAfichesShell || '',
      
      // Banderines
      '¿Colocaste TIRA DE BANDERINES SHELL?': resp.colocasteBanderinesShell ? 'Sí' : 'No',
      'Total de TIRA DE BANDERINES SHELL colocadas:': resp.totalBanderinesShell,
      'Fotos de los BANDERINES SHELL colocados:': resp.fotosBanderinesShell || '',
      
      // Aviso Acrílico
      '¿El cliente tiene AVISO ACRÍLICO PARA EXTERIORES SHELL?': resp.clienteTieneAvisoAcrilicoShell ? 'Sí' : 'No',
      'Foto del AVISO ACRÍLICO PARA EXTERIORES SHELL colocado:': resp.fotoAvisoAcrilicoShell || '',
      
      // Qualid
      '¿Colocaste Material Qualid?': resp.colocasteQualid ? 'Sí' : 'No',
      '¿Hiciste Planograma Qualid?': resp.hicistePlanogramaQualid ? 'Sí' : 'No',
      'Foto del antes del Planograma Qualid': resp.fotoAntesQualid || '',
      'Foto del después del Planograma Qualid': resp.fotoDespuesQualid || '',
      'Total de CENEFAS QUALID colocadas:': resp.totalCenefasQualid,
      'Total de BOLSAS QUALID PARA CARRO ENTREGADAS:': resp.totalBolsasQualid,
      
      // Afiches Qualid
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA FILTROS Y FLUIDOS 2024]': resp.afiches_FiltrosFluidos2024,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CAUCHO 2023]': resp.afichesQualidCaucho2023,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CAUCHO 2024]': resp.afichesQualidCaucho2024,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CUIDADO AUTOMOTRIZ 2022]': resp.afichesQualidCuidadoAutomotriz2022,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID FF 2022]': resp.afichesQualidFF2022,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID FILTROS 2022]': resp.afichesQualidFiltros2022,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID MANTENIMIENTO 2022]': resp.afichesQualidMantenimiento2022,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA CROSS REFERENCE SERVICIO PESADO 2024]': resp.afichesQualidTablaCrossReference2024,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA DE APLICACIÓN]': resp.afichesQualidTablaAplicacion,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA DE FILTRO AUTOMOTRIZ 2024]': resp.afichesQualidTablaFiltroAutomotriz2024,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHE QUALID FILTROS AUTOMOTRIZ]': resp.aficheQualidFiltrosAutomotriz,
      '¿Cuáles y cuantos AFICHES QUALID? [AFICHE QUALID FAMILY CAR CARE]': resp.aficheQualidFamilyCarCare,
      'Fotos de los AFICHES QUALID colocados:': resp.fotosAfichesQualid || '',
      
      // Exhibidores Qualid
      '¿Colocaste EXHIBIDORES DE CAUCHOS QUALID?': resp.colocasteExhibidoresCauchosQualid ? 'Sí' : 'No',
      'Total de EXHIBIDOR DE CAUCHO PEQUEÑO colocado:': resp.totalExhibidorCauchoPequeño,
      'Total de EXHIBIDORES DE CAUCHO GRANDE colocado:': resp.totalExhibidorCauchoGrande,
      'Foto de EXHIBIDORES DE CAUCHOS QUALID colocados:': resp.fotoExhibidoresCauchosQualid || '',
      
      // Observaciones finales
      'Coloca aquí tus observaciones de producto faltante y cualquier comentario adicional para la cartera de productos SHELL:': resp.observacionesShell || '',
      'Coloca aquí tus observaciones de producto faltante y cualquier comentario adicional para la cartera de productos QUALID:': resp.observacionesQualid || '',
    };
  }

  // Para Trade (Eventos/Impulso) usaremos un formato simplificado
  const resp = visita.respuestas as RespuestasTrade;
  return {
    ...base,
    'Tipo de visita': visita.tipoVisita,
    'Marca seleccionada': resp.marcaSeleccionada,
    'Recursos utilizados': resp.recursosUtilizados.join(', '),
    'Entregables Shell': resp.entregablesShell.join(', '),
    'Entregables Qualid': resp.entregablesQualid.join(', '),
    'Fotos': resp.fotos.join(', '),
    'Observaciones': resp.observaciones || '',
  };
}; 