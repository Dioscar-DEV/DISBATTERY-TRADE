'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { crearVisita, setN8NWebhookURL } from '@/services/visitas';
import { RespuestasMerchandising } from '@/types/visitas';
import { getCurrentUser, getUserFromStorage } from '@/services/auth';
import { uploadMultipleImages } from '@/services/images';
import { useVisitDraft } from '@/hooks/useVisitDraft';
import { offlineQueue } from '@/services/offlineQueue';
import { offlineManager } from '@/services/offlineManager';

export default function ObservacionesPage() {
  // Borrador offline por punto de ruta (valores seguros iniciales)
  const draft = useVisitDraft({
    routePointId: 'sin-point',
    clienteId: 'sin-cliente',
    brand: 'shell',
  });
  const router = useRouter();
  const { toast } = useToast();

  // Configurar URL del webhook N8N al inicializar
  useEffect(() => {
    setN8NWebhookURL('https://n8n.con-visas.com/webhook/Disbattery-Trade-app');
  }, []);

  const [observacionShellFaltante, setObservacionShellFaltante] = useState<string>('');
  const [observacionQualidFaltante, setObservacionQualidFaltante] = useState<string>('');
  const [observacionesAdicionales, setObservacionesAdicionales] = useState<string>('');
  const [observacionesCompetencia, setObservacionesCompetencia] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSubmit = async () => {
    console.log('🎯 ========== BOTÓN FINAL PRESIONADO - GUARDANDO FORMULARIO COMPLETO ==========');

    try {
      setIsSyncing(true);

      console.log('🔍 INICIANDO DEPURACIÓN DE DATOS...');

      // ✅ VERIFICACIÓN CRÍTICA DEL POINTID ANTES DE PROCESAR
      const clienteDataRaw = localStorage.getItem('clienteData');
      console.log('🆔 [CRÍTICO ANÁLISIS] ClienteData RAW desde localStorage:', clienteDataRaw);

      if (clienteDataRaw) {
        try {
          const clienteDataFromStorage = JSON.parse(clienteDataRaw);
          console.log('🆔 [CRÍTICO ANÁLISIS] ClienteData PARSED:', clienteDataFromStorage);
          console.log('🆔 [CRÍTICO ANÁLISIS] PointId encontrado:', clienteDataFromStorage.pointId);
          console.log('🆔 [CRÍTICO ANÁLISIS] Tipo de pointId:', typeof clienteDataFromStorage.pointId);
          console.log('🆔 [CRÍTICO ANÁLISIS] PointId vacío?:', !clienteDataFromStorage.pointId);
          console.log('🆔 [CRÍTICO ANÁLISIS] RIF del cliente:', clienteDataFromStorage.rif);
          console.log('🆔 [CRÍTICO ANÁLISIS] Nombre del cliente:', clienteDataFromStorage.nombre);

          if (!clienteDataFromStorage.pointId) {
            console.error('❌ [PROBLEMA CONFIRMADO] PointId está vacío al momento de enviar el formulario');
            console.error('❌ [CAUSA RAÍZ] Esto explica por qué se usa solo RIF como fallback');
          } else {
            console.log('✅ [ÉXITO] PointId correcto encontrado al momento del envío');
          }
        } catch (error) {
          console.error('❌ [ERROR] No se pudo parsear clienteData:', error);
        }
      } else {
        console.error('❌ [PROBLEMA CRÍTICO] No hay clienteData en localStorage');
      }

      // Verificar todo el localStorage
      console.log('📦 TODO el localStorage:', Object.keys(localStorage));

      // Recolectar todos los datos acumulados del formulario
      const datosFormularioCompleto = localStorage.getItem('datosFormularioCompleto');
      console.log('📄 datosFormularioCompleto RAW:', datosFormularioCompleto);

      const datosAcumulados = JSON.parse(datosFormularioCompleto || '{}');
      console.log('📊 datosAcumulados PARSED:', datosAcumulados);

      // Verificar clienteData (redundante pero necesario para logs completos)
      const clienteDataFromStorage = JSON.parse(clienteDataRaw || '{}');
      console.log('👤 clienteData PARSED:', clienteDataFromStorage);
      console.log('🔍 RIF en clienteDataFromStorage:', clienteDataFromStorage.rif);
      console.log('🔍 Nombre en clienteDataFromStorage:', clienteDataFromStorage.nombre);

      // ✅ CORRECCIÓN CRÍTICA: Siempre usar clienteDataFromStorage para GPS actualizados
      // y combinar con datosAcumulados.cliente para otros datos
      let cliente = datosAcumulados.cliente;
      console.log('🎯 Cliente desde datosAcumulados:', cliente);
      console.log('🔍 RIF en datosAcumulados.cliente:', cliente?.rif);
      console.log('🔍 Nombre en datosAcumulados.cliente:', cliente?.nombre);

      // ✅ SIEMPRE combinar con clienteDataFromStorage para GPS actualizados
      if (clienteDataFromStorage) {
        console.log('🗺️ COMBINANDO CON DATOS GPS DE clienteDataFromStorage');
        console.log('🗺️ GPS desde clienteData:', clienteDataFromStorage.position);

        if (!cliente) {
          // Si no hay cliente en datosAcumulados, usar clienteData completo
          cliente = clienteDataFromStorage;
          console.log('✅ Cliente obtenido completamente desde clienteData:', cliente);
        } else {
          // Si hay cliente en datosAcumulados, actualizar solo las coordenadas GPS
          cliente = {
            ...cliente,
            position: clienteDataFromStorage.position || cliente.position,
            // También preservar otros campos importantes de clienteData
            pointId: clienteDataFromStorage.pointId || cliente.pointId,
            // ✅ CORRECCIÓN SEÑALIZACIÓN: Priorizar clienteDataFromStorage que tiene los datos más recientes
            hasSignage: clienteDataFromStorage.hasSignage !== undefined ? clienteDataFromStorage.hasSignage : cliente.hasSignage,
            signagePhoto: clienteDataFromStorage.signagePhoto !== undefined ? clienteDataFromStorage.signagePhoto : cliente.signagePhoto
          };
          console.log('✅ Cliente combinado con GPS de clienteData:', cliente);
        }
      } else if (!cliente) {
        console.log('❌ No se encontró cliente en ninguna fuente');
      }

      console.log('🔍 CLIENTE FINAL:', cliente);
      console.log('🔍 TIENE RIF:', cliente?.rif);
      console.log('🔍 TIENE NOMBRE:', cliente?.nombre);
      console.log('🔍 TODOS LOS CAMPOS DEL CLIENTE:', Object.keys(cliente || {}));

      // Refuerza la obtención de rif y nombre del cliente
      let rifCliente = cliente?.rif || cliente?.rifCliente || cliente?.clientRif || '';
      let nombreEstablecimiento = cliente?.nombre || cliente?.nombreEstablecimiento || cliente?.clientName || '';

      console.log('🎯 RIF FINAL PARA GUARDAR:', rifCliente);
      console.log('🎯 NOMBRE FINAL PARA GUARDAR:', nombreEstablecimiento);
      console.log('🎯 ¿RIF es string vacío?:', rifCliente === '');
      console.log('🎯 ¿RIF es undefined?:', rifCliente === undefined);
      console.log('🎯 ¿RIF es null?:', rifCliente === null);
      console.log('🗺️ UBICACIÓN/COORDENADAS DEL CLIENTE:', cliente?.position || cliente?.ubicacion);
      console.log('🗺️ LATITUD:', cliente?.position?.lat || cliente?.position?.latitude);
      console.log('🗺️ LONGITUD:', cliente?.position?.lng || cliente?.position?.longitude);

      // Preparar ubicación con logs detallados
      const ubicacionParaVisita = {
        lat: cliente.position?.lat || 0,
        lng: cliente.position?.lng || 0,
        latitude: cliente.position?.lat || 0,  // 🗺️ AGREGAR AMBOS FORMATOS
        longitude: cliente.position?.lng || 0, // 🗺️ PARA COMPATIBILIDAD
        address: cliente.direccion || '',
        direccion: cliente.direccion || ''
      };

      console.log('🗺️ UBICACIÓN PREPARADA PARA CREARVISITA:', ubicacionParaVisita);

      if (!rifCliente || !nombreEstablecimiento) {
        console.log('❌ ERROR: Datos del cliente incompletos');
        console.log('- rifCliente:', rifCliente);
        console.log('- nombreEstablecimiento:', nombreEstablecimiento);
        toast({
          variant: 'destructive',
          title: 'Datos incompletos',
          description: 'No se encontró el RIF o el nombre del establecimiento del cliente. Reinicie el proceso o seleccione correctamente el cliente.'
        });
        setIsSyncing(false);
        return;
      }

      console.log('✅ Datos del cliente válidos, procediendo a guardar visita...');

      if (!datosAcumulados.shellMerchandising) {
        toast({
          variant: 'destructive',
          title: 'Error de Datos',
          description: 'No se encontraron datos de Shell Merchandising. Complete el formulario.',
        });
        return;
      }

      // Ya tenemos cliente definido arriba
      const shellData = datosAcumulados.shellMerchandising;
      const ventasData = datosAcumulados.ventas;
      const reportesFinalesData = datosAcumulados.reportesFinales;

      // Recolectar datos de señalización si existen
      // ✅ CORRECCIÓN CRÍTICA: Los datos de señalización están en 'clienteData', no en 'signageData'
      const signageData = {
        hasSignage: cliente.hasSignage, // ✅ NO usar fallback vacío, preservar undefined/null
        signagePhoto: cliente.signagePhoto || null
      };
      console.log('🚩 === DEBUGGING SEÑALIZACIÓN EN OBSERVACIONES ===');
      console.log('🚩 clienteDataFromStorage.hasSignage:', clienteDataFromStorage?.hasSignage);
      console.log('🚩 clienteDataFromStorage.signagePhoto:', clienteDataFromStorage?.signagePhoto ? 'SÍ CAPTURADA' : 'NO CAPTURADA');
      console.log('🚩 cliente.hasSignage (final):', cliente.hasSignage);
      console.log('🚩 cliente.signagePhoto (final):', cliente.signagePhoto ? 'SÍ CAPTURADA' : 'NO CAPTURADA');
      console.log('🔧 CORRECCIÓN: Datos de signage desde clienteData:', signageData);
      console.log('🔧 hasSignage:', cliente.hasSignage);
      console.log('🔧 signagePhoto:', cliente.signagePhoto ? 'SÍ CAPTURADA' : 'NO CAPTURADA');

      // 🔧 CORRECCIÓN CRÍTICA: Agregar datos de señalización a datosAcumulados para reportes-finales
      datosAcumulados.hasSignage = signageData.hasSignage;
      datosAcumulados.signagePhoto = signageData.signagePhoto;
      console.log('🔧 DATOS DE SEÑALIZACIÓN AGREGADOS A datosAcumulados:', {
        hasSignage: datosAcumulados.hasSignage,
        signagePhoto: datosAcumulados.signagePhoto ? 'SÍ CAPTURADA' : 'NO CAPTURADA'
      });

      // ✅ CORRECCIÓN GPS: Actualizar clienteData con GPS combinado en datosAcumulados
      datosAcumulados.clienteData = cliente;
      console.log('🗺️ CLIENTE CON GPS ACTUALIZADO EN datosAcumulados.clienteData:', cliente.position);

      // 🔧 GUARDAR datosAcumulados ACTUALIZADOS con señalización Y GPS
      localStorage.setItem('datosFormularioCompleto', JSON.stringify(datosAcumulados));
      console.log('💾 DATOS ACUMULADOS GUARDADOS CON SEÑALIZACIÓN');

      console.log('Datos de ventas encontrados:', ventasData);
      console.log('Datos de reportes finales encontrados:', reportesFinalesData);

      // 🔄 CORRECCIÓN: Subir imágenes a Firebase Storage y obtener URLs
      console.log('🔄 Procesando imágenes...');

      // Preparar imágenes para subir a Firebase Storage
      const imagesToUpload = [];

      // 🔍 DEBUGGING ESPECÍFICO PARA FOTO DE SEÑALIZACIÓN
      console.log('🔍 VERIFICANDO FOTO DE SEÑALIZACIÓN ANTES DE SUBIR:');
      console.log('  - signageData.signagePhoto existe:', !!signageData.signagePhoto);
      console.log('  - Longitud de la imagen:', signageData.signagePhoto ? signageData.signagePhoto.length : 0);
      console.log('  - Es base64 válido:', signageData.signagePhoto ? signageData.signagePhoto.startsWith('data:image/') : false);

      if (signageData.signagePhoto && signageData.signagePhoto.startsWith('data:image/')) {
        console.log('✅ AGREGANDO FOTO DE SEÑALIZACIÓN A LISTA DE SUBIDA');
        imagesToUpload.push({
          base64: signageData.signagePhoto,
          path: `merchandising/senalizacion/${cliente.rif}`,
          prefix: 'senalizacion'
        });
      } else {
        console.log('❌ FOTO DE SEÑALIZACIÓN NO VÁLIDA O VACÍA');
      }

      if (shellData.fotoAntesShell) {
        imagesToUpload.push({
          base64: shellData.fotoAntesShell,
          path: `merchandising/shell/${cliente.rif}`,
          prefix: 'planograma_antes'
        });
      }

      if (shellData.fotoDespuesShell) {
        imagesToUpload.push({
          base64: shellData.fotoDespuesShell,
          path: `merchandising/shell/${cliente.rif}`,
          prefix: 'planograma_despues'
        });
      }

      if (shellData.fotoStickerShell) {
        imagesToUpload.push({
          base64: shellData.fotoStickerShell,
          path: `merchandising/shell/${cliente.rif}`,
          prefix: 'stickers'
        });
      }

      // ✅ NUEVA FUNCIONALIDAD: Incluir todas las fotos individuales de afiches Shell
      if (shellData.afichesColocadosShell && Array.isArray(shellData.afichesColocadosShell)) {
        shellData.afichesColocadosShell.forEach((afiche: any, index: number) => {
          if (afiche.foto && afiche.foto.startsWith('data:image/')) {
            imagesToUpload.push({
              base64: afiche.foto,
              path: `merchandising/shell/${cliente.rif}/afiches`,
              prefix: `afiche_shell_${index}_${afiche.tipo?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 20) || 'desconocido'}`
            });
          }
        });
      }

      // ✅ CORRECCIÓN CRÍTICA: Incluir fotos de Shell Material Interno que se estaban perdiendo
      if (datosAcumulados.shellMaterialInterno) {
        const materialData = datosAcumulados.shellMaterialInterno;
        console.log('🔍 VERIFICANDO FOTOS DE SHELL MATERIAL INTERNO:');
        console.log('  - fotoExhibidoresShell:', !!materialData.fotoExhibidoresShell);
        console.log('  - fotoBanderinesShell:', !!materialData.fotoBanderinesShell);
        console.log('  - fotoAvisoAcrilicoShell:', !!materialData.fotoAvisoAcrilicoShell);
        console.log('  - afichesColocadosShell:', materialData.afichesColocadosShell?.length || 0);

        if (materialData.fotoExhibidoresShell && materialData.fotoExhibidoresShell.startsWith('data:image/')) {
          console.log('✅ AGREGANDO foto de exhibidores Shell');
          imagesToUpload.push({
            base64: materialData.fotoExhibidoresShell,
            path: `merchandising/shell/${cliente.rif}`,
            prefix: 'exhibidores_shell'
          });
        }

        if (materialData.fotoBanderinesShell && materialData.fotoBanderinesShell.startsWith('data:image/')) {
          console.log('✅ AGREGANDO foto de banderines Shell');
          imagesToUpload.push({
            base64: materialData.fotoBanderinesShell,
            path: `merchandising/shell/${cliente.rif}`,
            prefix: 'banderines_shell'
          });
        }

        if (materialData.fotoAvisoAcrilicoShell && materialData.fotoAvisoAcrilicoShell.startsWith('data:image/')) {
          console.log('✅ AGREGANDO foto de aviso acrílico Shell');
          imagesToUpload.push({
            base64: materialData.fotoAvisoAcrilicoShell,
            path: `merchandising/shell/${cliente.rif}`,
            prefix: 'aviso_acrilico_shell'
          });
        }

        // ✅ CORRECCIÓN CRÍTICA: Incluir fotos individuales de afiches de Shell Material Interno
        if (materialData.afichesColocadosShell && Array.isArray(materialData.afichesColocadosShell)) {
          console.log('✅ PROCESANDO afiches individuales de Shell Material Interno');
          materialData.afichesColocadosShell.forEach((afiche: any, index: number) => {
            if (afiche.foto && afiche.foto.startsWith('data:image/')) {
              console.log(`✅ AGREGANDO afiche Shell Material ${index + 1}: ${afiche.tipo}`);
              imagesToUpload.push({
                base64: afiche.foto,
                path: `merchandising/shell/${cliente.rif}/afiches_material`,
                prefix: `afiche_material_shell_${index}_${afiche.tipo?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 20) || 'desconocido'}`
              });
            }
          });
        }
      } else {
        console.log('⚠️ NO HAY DATOS DE shellMaterialInterno');
      }

      // ✅ Incluir fotos de Qualid si existen
      if (datosAcumulados.qualidMerchandising) {
        const qualidData = datosAcumulados.qualidMerchandising;

        if (qualidData.fotoAntesPlanogramaQualid) {
          imagesToUpload.push({
            base64: qualidData.fotoAntesPlanogramaQualid,
            path: `merchandising/qualid/${cliente.rif}`,
            prefix: 'planograma_antes_qualid'
          });
        }

        if (qualidData.fotoDespuesPlanogramaQualid) {
          imagesToUpload.push({
            base64: qualidData.fotoDespuesPlanogramaQualid,
            path: `merchandising/qualid/${cliente.rif}`,
            prefix: 'planograma_despues_qualid'
          });
        }

        // ✅ Incluir todas las fotos individuales de afiches Qualid
        if (qualidData.afichesColocadosQualid && Array.isArray(qualidData.afichesColocadosQualid)) {
          qualidData.afichesColocadosQualid.forEach((afiche: any, index: number) => {
            if (afiche.foto && afiche.foto.startsWith('data:image/')) {
              imagesToUpload.push({
                base64: afiche.foto,
                path: `merchandising/qualid/${cliente.rif}/afiches`,
                prefix: `afiche_qualid_${index}_${afiche.tipo?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 20) || 'desconocido'}`
              });
            }
          });
        }

        if (qualidData.fotoExhibidoresCauchoQualid) {
          imagesToUpload.push({
            base64: qualidData.fotoExhibidoresCauchoQualid,
            path: `merchandising/qualid/${cliente.rif}`,
            prefix: 'exhibidores_caucho_qualid'
          });
        }
      }

      // 🆕 CORRECCIÓN CRÍTICA: Incluir fotos de TRADE (impulso y eventos) que se estaban perdiendo
      console.log('🔍 VERIFICANDO FOTOS DE TRADE (IMPULSO Y EVENTOS):');
      console.log('  - fotoImpulsoShell:', !!datosAcumulados.fotoImpulsoShell);
      console.log('  - fotoPromotorasShell:', !!datosAcumulados.fotoPromotorasShell);
      console.log('  - fotoImpulsoQualid:', !!datosAcumulados.fotoImpulsoQualid);
      console.log('  - fotoPromotorasQualid:', !!datosAcumulados.fotoPromotorasQualid);

      if (datosAcumulados.fotoImpulsoShell && datosAcumulados.fotoImpulsoShell.startsWith('data:image/')) {
        console.log('✅ AGREGANDO foto de impulso Shell');
        imagesToUpload.push({
          base64: datosAcumulados.fotoImpulsoShell,
          path: `trade/impulso/${cliente.rif}`,
          prefix: 'impulso_shell'
        });
      }

      if (datosAcumulados.fotoPromotorasShell && datosAcumulados.fotoPromotorasShell.startsWith('data:image/')) {
        console.log('✅ AGREGANDO foto de promotoras Shell');
        imagesToUpload.push({
          base64: datosAcumulados.fotoPromotorasShell,
          path: `trade/impulso/${cliente.rif}`,
          prefix: 'promotoras_shell'
        });
      }

      if (datosAcumulados.fotoImpulsoQualid && datosAcumulados.fotoImpulsoQualid.startsWith('data:image/')) {
        console.log('✅ AGREGANDO foto de impulso Qualid');
        imagesToUpload.push({
          base64: datosAcumulados.fotoImpulsoQualid,
          path: `trade/impulso/${cliente.rif}`,
          prefix: 'impulso_qualid'
        });
      }

      if (datosAcumulados.fotoPromotorasQualid && datosAcumulados.fotoPromotorasQualid.startsWith('data:image/')) {
        console.log('✅ AGREGANDO foto de promotoras Qualid');
        imagesToUpload.push({
          base64: datosAcumulados.fotoPromotorasQualid,
          path: `trade/impulso/${cliente.rif}`,
          prefix: 'promotoras_qualid'
        });
      }

      console.log(`📊 Total de imágenes preparadas para subir: ${imagesToUpload.length}`);
      imagesToUpload.forEach((img, index) => {
        console.log(`📷 Imagen ${index + 1}: ${img.prefix} (${img.base64 ? 'Válida' : 'Inválida'})`);
      });

      // Subir imágenes a Firebase Storage y obtener URLs
      let fotosUrls: string[] = [];

      if (imagesToUpload.length > 0) {
        try {
          console.log(`📤 Subiendo ${imagesToUpload.length} imágenes a Firebase Storage...`);
          fotosUrls = await uploadMultipleImages(imagesToUpload);
          console.log(`✅ ${fotosUrls.length} imágenes subidas exitosamente`);
        } catch (error) {
          console.error('❌ Error subiendo imágenes:', error);

          // 🚨 SOLUCIÓN TEMPORAL: Continuar sin imágenes pero guardar datos
          console.log('🔄 Continuando sin imágenes debido a error CORS/Firebase Storage');

          toast({
            variant: 'destructive',
            title: 'Error subiendo imágenes',
            description: 'Se guardará la visita sin imágenes debido a problema técnico. Los datos están seguros.',
          });
        }
      }

      // Mapear URLs a los campos correspondientes (en lugar de base64)
      let fotoSeñalizacionUrl = '';
      let fotoAntesShellUrl = '';
      let fotoDespuesShellUrl = '';
      let fotoStickerShellUrl = '';
      let fotosAfichesShellUrls: string[] = [];
      let fotoExhibidoresShellUrl = '';
      let fotoBanderinesShellUrl = '';
      let fotoAvisoAcrilicoShellUrl = '';
      let fotosAfichesShellMaterialUrls: string[] = [];
      let fotoAntesPlanogramaQualidUrl = '';
      let fotoDespuesPlanogramaQualidUrl = '';
      let fotosAfichesQualidUrls: string[] = [];
      let fotoExhibidoresCauchoQualidUrl = '';

      // 🆕 URLs para fotos de Trade (impulso y eventos)
      let fotoImpulsoShellUrl = '';
      let fotoPromotorasShellUrl = '';
      let fotoImpulsoQualidUrl = '';
      let fotoPromotorasQualidUrl = '';

      // Mapear URLs en el orden correcto basado en cómo se agregaron a imagesToUpload
      let urlIndex = 0;

      console.log('🔍 MAPEANDO URLs DE FIREBASE:');
      console.log('  - Total URLs recibidas de Firebase:', fotosUrls.length);
      console.log('  - URLs completas:', fotosUrls);

      if (signageData.signagePhoto && signageData.signagePhoto.startsWith('data:image/')) {
        fotoSeñalizacionUrl = fotosUrls[urlIndex] || '';
        console.log(`🚩 FOTO SEÑALIZACIÓN - URL mapeada [${urlIndex}]:`, fotoSeñalizacionUrl);
        console.log(`🚩 FOTO SEÑALIZACIÓN - hasSignage:`, signageData.hasSignage);
        console.log(`🚩 FOTO SEÑALIZACIÓN - ¿Debería tener foto?:`, signageData.hasSignage === 'Yes');
        urlIndex++;
      } else {
        console.log('🚩 FOTO SEÑALIZACIÓN - SALTANDO mapeo (no existe foto válida)');
        console.log(`🚩 FOTO SEÑALIZACIÓN - signageData.signagePhoto:`, signageData.signagePhoto ? 'EXISTE PERO NO ES BASE64' : 'NO EXISTE');
        console.log(`🚩 FOTO SEÑALIZACIÓN - hasSignage:`, signageData.hasSignage);
      }

      if (shellData.fotoAntesShell) {
        fotoAntesShellUrl = fotosUrls[urlIndex] || '';
        urlIndex++;
      }

      if (shellData.fotoDespuesShell) {
        fotoDespuesShellUrl = fotosUrls[urlIndex] || '';
        urlIndex++;
      }

      if (shellData.fotoStickerShell) {
        fotoStickerShellUrl = fotosUrls[urlIndex] || '';
        urlIndex++;
      }

      // Mapear URLs de afiches individuales de Shell
      if (shellData.afichesColocadosShell && Array.isArray(shellData.afichesColocadosShell)) {
        const afichesConFoto = shellData.afichesColocadosShell.filter((afiche: any) =>
          afiche.foto && afiche.foto.startsWith('data:image/')
        );

        for (let i = 0; i < afichesConFoto.length; i++) {
          if (fotosUrls[urlIndex]) {
            fotosAfichesShellUrls.push(fotosUrls[urlIndex]);
          }
          urlIndex++;
        }
      }

      // ✅ CORRECCIÓN: Mapear URLs de Shell Material Interno
      if (datosAcumulados.shellMaterialInterno) {
        const materialData = datosAcumulados.shellMaterialInterno;

        if (materialData.fotoExhibidoresShell && materialData.fotoExhibidoresShell.startsWith('data:image/')) {
          fotoExhibidoresShellUrl = fotosUrls[urlIndex] || '';
          console.log(`  - URL de exhibidores Shell mapeada [${urlIndex}]:`, fotoExhibidoresShellUrl);
          urlIndex++;
        }

        if (materialData.fotoBanderinesShell && materialData.fotoBanderinesShell.startsWith('data:image/')) {
          fotoBanderinesShellUrl = fotosUrls[urlIndex] || '';
          console.log(`  - URL de banderines Shell mapeada [${urlIndex}]:`, fotoBanderinesShellUrl);
          urlIndex++;
        }

        if (materialData.fotoAvisoAcrilicoShell && materialData.fotoAvisoAcrilicoShell.startsWith('data:image/')) {
          fotoAvisoAcrilicoShellUrl = fotosUrls[urlIndex] || '';
          console.log(`  - URL de aviso acrílico Shell mapeada [${urlIndex}]:`, fotoAvisoAcrilicoShellUrl);
          urlIndex++;
        }

        // ✅ Mapear URLs de afiches individuales de Shell Material Interno
        if (materialData.afichesColocadosShell && Array.isArray(materialData.afichesColocadosShell)) {
          const afichesConFoto = materialData.afichesColocadosShell.filter((afiche: any) =>
            afiche.foto && afiche.foto.startsWith('data:image/')
          );

          for (let i = 0; i < afichesConFoto.length; i++) {
            if (fotosUrls[urlIndex]) {
              fotosAfichesShellMaterialUrls.push(fotosUrls[urlIndex]);
              console.log(`  - URL de afiche Shell Material ${i + 1} mapeada [${urlIndex}]:`, fotosUrls[urlIndex]);
            }
            urlIndex++;
          }
        }
      }

      // Mapear URLs de Qualid si existen
      if (datosAcumulados.qualidMerchandising) {
        const qualidData = datosAcumulados.qualidMerchandising;

        if (qualidData.fotoAntesPlanogramaQualid) {
          fotoAntesPlanogramaQualidUrl = fotosUrls[urlIndex] || '';
          urlIndex++;
        }

        if (qualidData.fotoDespuesPlanogramaQualid) {
          fotoDespuesPlanogramaQualidUrl = fotosUrls[urlIndex] || '';
          urlIndex++;
        }

        // Mapear URLs de afiches individuales de Qualid
        if (qualidData.afichesColocadosQualid && Array.isArray(qualidData.afichesColocadosQualid)) {
          const afichesConFoto = qualidData.afichesColocadosQualid.filter((afiche: any) =>
            afiche.foto && afiche.foto.startsWith('data:image/')
          );

          for (let i = 0; i < afichesConFoto.length; i++) {
            if (fotosUrls[urlIndex]) {
              fotosAfichesQualidUrls.push(fotosUrls[urlIndex]);
            }
            urlIndex++;
          }
        }

        if (qualidData.fotoExhibidoresCauchoQualid) {
          fotoExhibidoresCauchoQualidUrl = fotosUrls[urlIndex] || '';
          urlIndex++;
        }
      }

      // 🆕 Mapear URLs de fotos de Trade (impulso y eventos)
      if (datosAcumulados.fotoImpulsoShell && datosAcumulados.fotoImpulsoShell.startsWith('data:image/')) {
        fotoImpulsoShellUrl = fotosUrls[urlIndex] || '';
        console.log(`  - URL de impulso Shell mapeada [${urlIndex}]:`, fotoImpulsoShellUrl);
        urlIndex++;
      }

      if (datosAcumulados.fotoPromotorasShell && datosAcumulados.fotoPromotorasShell.startsWith('data:image/')) {
        fotoPromotorasShellUrl = fotosUrls[urlIndex] || '';
        console.log(`  - URL de promotoras Shell mapeada [${urlIndex}]:`, fotoPromotorasShellUrl);
        urlIndex++;
      }

      if (datosAcumulados.fotoImpulsoQualid && datosAcumulados.fotoImpulsoQualid.startsWith('data:image/')) {
        fotoImpulsoQualidUrl = fotosUrls[urlIndex] || '';
        console.log(`  - URL de impulso Qualid mapeada [${urlIndex}]:`, fotoImpulsoQualidUrl);
        urlIndex++;
      }

      if (datosAcumulados.fotoPromotorasQualid && datosAcumulados.fotoPromotorasQualid.startsWith('data:image/')) {
        fotoPromotorasQualidUrl = fotosUrls[urlIndex] || '';
        console.log(`  - URL de promotoras Qualid mapeada [${urlIndex}]:`, fotoPromotorasQualidUrl);
        urlIndex++;
      }

      console.log(`✅ URLs mapeadas correctamente. Total URLs utilizadas: ${urlIndex} de ${fotosUrls.length}`);
      console.log(`📷 Fotos de afiches Shell Merchandising: ${fotosAfichesShellUrls.length} URLs`);
      console.log(`📷 Fotos de afiches Shell Material Interno: ${fotosAfichesShellMaterialUrls.length} URLs`);
      console.log(`📷 Fotos de afiches Qualid: ${fotosAfichesQualidUrls.length} URLs`);
      console.log(`📷 Fotos de Shell Material: exhibidores=${!!fotoExhibidoresShellUrl}, banderines=${!!fotoBanderinesShellUrl}, acrilico=${!!fotoAvisoAcrilicoShellUrl}`);
      console.log(`📷 Fotos de Trade: impulsoShell=${!!fotoImpulsoShellUrl}, promotorasShell=${!!fotoPromotorasShellUrl}, impulsoQualid=${!!fotoImpulsoQualidUrl}, promotorasQualid=${!!fotoPromotorasQualidUrl}`);

      // Construir respuestas completas para el Google Sheet con URLs de descarga
      const respuestas: RespuestasMerchandising = {
        // Señalización (de signage-capture si existe)
        clientePoseeSeñalizacion: signageData.hasSignage === 'Yes',
        fotoSeñalizacion: fotoSeñalizacionUrl || (signageData.hasSignage === 'Yes' ? 'No capturada' : ''),

        // Planograma Shell (de shell-merchandising)
        hicistePlanogramaShell: shellData.hicistePlanogramaShell || false,
        fotoAntesShell: fotoAntesShellUrl,
        fotoDespuesShell: fotoDespuesShellUrl,

        // Sticker Punto de Venta Shell
        clienteTieneStickerShell: shellData.clienteTieneStickerShell || false,
        colocasteStickerShell: shellData.colocasteStickerShell || false,
        fotoStickerShell: fotoStickerShellUrl,

        // Materiales Shell
        totalCenefasShell: shellData.totalCenefasShell || 0,
        totalPapelBobinaShell: shellData.totalPapelBobinaShell || 0,
        totalStickersShellCambio: shellData.totalStickersShellCambio || 0,
        totalAmbientadoresShell: shellData.totalAmbientadoresShell || 0,
        totalBolsasShell: shellData.totalBolsasShell || 0,

        // ✅ CORRECCIÓN: Exhibidores Shell - datos de shell-material-interno con URL de Firebase
        clienteTieneExhibidoresShell: datosAcumulados.shellMaterialInterno?.tieneExhibidoresShell || false,
        fotoExhibidoresShell: fotoExhibidoresShellUrl,

        // ✅ Afiches Shell Merchandising - datos con cantidades individuales (del flujo principal)
        afichesFerrari2023: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('FERRARI 2023'))?.cantidad || 0,
        afichesHX8: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('HX8'))?.cantidad || 0,
        afichesProductosPremium2024: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('PRODUCTOS PREMIUM 2024'))?.cantidad || 0,
        afichesShellFamilia2023: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('SHELL FAMILIA 2023'))?.cantidad || 0,
        afichesShellHX7: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('SHELL HX7'))?.cantidad || 0,
        afichesTablaAplicacionShell: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('TABLA DE APLICACION SHELL'))?.cantidad || 0,
        aficheShellGadus2021: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('SHELL GADUS 2021'))?.cantidad || 0,
        aficheShellHelix: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('SHELL HELIX'))?.cantidad || 0,
        aficheShellRimula: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('SHELL RIMULA'))?.cantidad || 0,
        aficheShellAdvance: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('SHELL ADVANCE'))?.cantidad || 0,
        aficheShell5W30: shellData.afichesColocadosShell?.find((a: any) => a.tipo?.includes('SHELL 5W-30'))?.cantidad || 0,
        // ✅ URLs de afiches Shell Merchandising (del flujo principal)
        fotosAfichesShell: fotosAfichesShellUrls.join(' | ') || '',

        // ✅ NUEVO: Afiches Shell Material Interno - datos adicionales con fotos individuales
        fotosAfichesShellMaterial: fotosAfichesShellMaterialUrls.join(' | ') || '',

        // ✅ CORRECCIÓN: Banderines Shell - datos de shell-material-interno con URL de Firebase
        colocasteBanderinesShell: datosAcumulados.shellMaterialInterno?.colocoBanderinesShell || false,
        totalBanderinesShell: datosAcumulados.shellMaterialInterno?.cantidadTirasBanderinesShell || 0,
        fotosBanderinesShell: fotoBanderinesShellUrl,

        // ✅ CORRECCIÓN: Aviso Acrílico Shell - datos de shell-material-interno con URL de Firebase
        clienteTieneAvisoAcrilicoShell: datosAcumulados.shellMaterialInterno?.colocoAvisoAcrilicoShell || false,
        fotoAvisoAcrilicoShell: fotoAvisoAcrilicoShellUrl,

        // Material Qualid - datos reales de qualid-merchandising si existen con URLs de Firebase
        colocasteQualid: !!datosAcumulados.qualidMerchandising,
        hicistePlanogramaQualid: datosAcumulados.qualidMerchandising?.hicistePlanogramaQualid || false,
        fotoAntesQualid: fotoAntesPlanogramaQualidUrl,
        fotoDespuesQualid: fotoDespuesPlanogramaQualidUrl,
        totalCenefasQualid: datosAcumulados.qualidMerchandising?.totalCenefasQualid || 0,
        totalBolsasQualid: datosAcumulados.qualidMerchandising?.bolsasQualidCarro || 0,

        // Afiches Qualid - datos con cantidades individuales
        afiches_FiltrosFluidos2024: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('FILTROS Y FLUIDOS 2024'))?.cantidad || 0,
        afichesQualidCaucho2023: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('QUALID CAUCHO 2023'))?.cantidad || 0,
        afichesQualidCaucho2024: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('QUALID CAUCHO 2024'))?.cantidad || 0,
        afichesQualidCuidadoAutomotriz2022: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('CUIDADO AUTOMOTRIZ 2022'))?.cantidad || 0,
        afichesQualidFF2022: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('QUALID FF 2022'))?.cantidad || 0,
        afichesQualidFiltros2022: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('QUALID FILTROS 2022'))?.cantidad || 0,
        afichesQualidMantenimiento2022: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('QUALID MANTENIMIENTO 2022'))?.cantidad || 0,
        afichesQualidTablaCrossReference2024: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('CROSS REFERENCE'))?.cantidad || 0,
        afichesQualidTablaAplicacion: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('TABLA DE APLICACIÓN'))?.cantidad || 0,
        afichesQualidTablaFiltroAutomotriz2024: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('FILTRO AUTOMOTRIZ 2024'))?.cantidad || 0,
        aficheQualidFiltrosAutomotriz: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('FILTROS AUTOMOTRIZ'))?.cantidad || 0,
        aficheQualidFamilyCarCare: datosAcumulados.qualidMerchandising?.afichesColocadosQualid?.find((a: any) => a.tipo?.includes('FAMILY CAR CARE'))?.cantidad || 0,
        // ✅ ACTUALIZADO: Usar URLs de Firebase Storage para afiches individuales de Qualid
        fotosAfichesQualid: fotosAfichesQualidUrls.join(' | ') || '',

        // Exhibidores Qualid - con URL de Firebase
        colocasteExhibidoresCauchosQualid: datosAcumulados.qualidMerchandising?.exhibidoresCauchoQualid?.length > 0 || false,
        totalExhibidorCauchoPequeño: datosAcumulados.qualidMerchandising?.exhibidoresCauchoQualid?.find((e: any) => e.tipo?.includes('Pequeño'))?.cantidad || 0,
        totalExhibidorCauchoGrande: datosAcumulados.qualidMerchandising?.exhibidoresCauchoQualid?.find((e: any) => e.tipo?.includes('Grande'))?.cantidad || 0,
        fotoExhibidoresCauchosQualid: fotoExhibidoresCauchoQualidUrl,

        // 🆕 FOTOS DE TRADE (impulso y eventos) que se estaban perdiendo
        fotoImpulsoShell: fotoImpulsoShellUrl,
        fotoPromotorasShell: fotoPromotorasShellUrl,
        fotoImpulsoQualid: fotoImpulsoQualidUrl,
        fotoPromotorasQualid: fotoPromotorasQualidUrl,

        // Observaciones específicas (de esta página y de reportes finales)
        observacionesShell: reportesFinalesData?.reporteShellFaltante || observacionShellFaltante,
        observacionesQualid: reportesFinalesData?.reporteQualidFaltante || observacionQualidFaltante,

        // Observaciones como array para N8N
        observaciones: [
          "Merchandising",
          signageData.hasSignage === 'Yes' ? "Sí" : signageData.hasSignage === 'No' ? "No" : "No respondido",
          shellData.hicistePlanogramaShell === true ? "Sí" : shellData.hicistePlanogramaShell === false ? "No" : "No respondido",
          shellData.clienteTieneStickerShell === true ? "Sí" : shellData.clienteTieneStickerShell === false ? "No" : "No respondido",
          shellData.colocasteStickerShell === true ? "Sí" : shellData.colocasteStickerShell === false ? "No" : "No respondido",
          `${shellData.totalCenefasShell || 0}`,
          `${shellData.totalPapelBobinaShell || 0}`,
          `${shellData.totalStickersShellCambio || 0}`,
          `${shellData.totalAmbientadoresShell || 0}`,
          `${shellData.totalBolsasShell || 0}`,
          ventasData?.shell?.huboVentas === true ? "Sí" : ventasData?.shell?.huboVentas === false ? "No" : "No respondido",
          ventasData?.qualid?.huboVentas === true ? "Sí" : ventasData?.qualid?.huboVentas === false ? "No" : "No respondido",
          `${fotosUrls.length}`,
          observacionShellFaltante.trim() || "Sin observaciones",
          observacionQualidFaltante.trim() || "Sin observaciones",
          observacionesAdicionales.trim() || "Sin comentarios",
          observacionesCompetencia.trim() || "Sin observaciones"
        ],
      };

      // Construir observaciones adicionales combinadas
      const observacionesCombinadasArray = [];

      // Agregar observaciones de esta página
      if (observacionesAdicionales.trim()) {
        observacionesCombinadasArray.push(`Comentarios adicionales: ${observacionesAdicionales.trim()}`);
      }
      if (observacionesCompetencia.trim()) {
        observacionesCombinadasArray.push(`Observaciones competencia: ${observacionesCompetencia.trim()}`);
      }

      // Agregar comentarios adicionales de reportes finales si existen
      if (reportesFinalesData?.reporteComentariosAdicionales?.trim()) {
        observacionesCombinadasArray.push(`Reporte final: ${reportesFinalesData.reporteComentariosAdicionales.trim()}`);
      }

      // Agregar resumen de ventas simplificado si existen
      if (ventasData) {
        const resumenVentas = [];
        if (ventasData.shell?.huboVentas !== undefined) {
          resumenVentas.push(`Ventas SHELL: ${ventasData.shell.huboVentas ? 'Sí' : 'No'}`);
        }
        if (ventasData.qualid?.huboVentas !== undefined) {
          resumenVentas.push(`Ventas QUALID: ${ventasData.qualid.huboVentas ? 'Sí' : 'No'}`);
        }
        if (resumenVentas.length > 0) {
          observacionesCombinadasArray.push(`Resumen ventas: ${resumenVentas.join(' | ')}`);
        }
      }

      const observacionesCombinadas = observacionesCombinadasArray.join(' | ');

      // Obtener datos del usuario logueado
      let currentUser = await getCurrentUser();
      if (!currentUser) {
        // Fallback: intentar desde localStorage
        currentUser = getUserFromStorage();
      }

      const mercaderista = currentUser?.fullName || 'Usuario App';
      const correoMercaderista = currentUser?.email || '';

      // 📊 ESTRUCTURA DETALLADA PARA N8N - MERCHANDISING
      const datosDetalladosN8N = {
        // Información básica
        tipoVisita: 'Merchandising',
        mercaderista: mercaderista,
        correoMercaderista: correoMercaderista,

        // Cliente
        cliente: {
          rif: cliente.rif,
          nombre: cliente.nombre || cliente.clientName, // Fallback para datos de signage
          sucursal: cliente.sede || 'GRUPO DISBATTERY', // Fallback
          ubicacion: cliente.position || { lat: 0, lng: 0 } // Fallback
        },

        // Señalización como objeto
        senalizacion: {
          poseeSeñalizacion: signageData.hasSignage === 'Yes',
          fotoUrl: fotoSeñalizacionUrl || null
        },

        // Shell Merchandising estructurado
        shellMerchandising: {
          planograma: {
            trabajado: shellData.hicistePlanogramaShell || false,
            fotoAntes: fotoAntesShellUrl || null,
            fotoDespues: fotoDespuesShellUrl || null
          },
          stickers: {
            clienteTieneStickers: shellData.clienteTieneStickerShell || false,
            colocasteStickers: shellData.colocasteStickerShell || false,
            fotoStickers: fotoStickerShellUrl || null
          },
          materiales: {
            cenefas: shellData.totalCenefasShell || 0,
            papelBobina: shellData.totalPapelBobinaShell || 0,
            stickersShellCambio: shellData.totalStickersShellCambio || 0,
            ambientadores: shellData.totalAmbientadoresShell || 0,
            bolsas: shellData.totalBolsasShell || 0
          }
        },

        // Ventas estructuradas si existen
        ventas: ventasData ? {
          shell: ventasData.shell || null,
          qualid: ventasData.qualid || null
        } : null,

        // Reportes finales estructurados
        reportesFinales: reportesFinalesData ? {
          reporteShellFaltante: reportesFinalesData.reporteShellFaltante || null,
          reporteQualidFaltante: reportesFinalesData.reporteQualidFaltante || null,
          comentariosAdicionales: reportesFinalesData.reporteComentariosAdicionales || null
        } : null,

        // Observaciones de esta página
        observacionesFinales: {
          observacionesShell: observacionShellFaltante.trim() || null,
          observacionesQualid: observacionQualidFaltante.trim() || null,
          comentariosAdicionales: observacionesAdicionales.trim() || null,
          observacionesCompetencia: observacionesCompetencia.trim() || null
        },

        // Fotos como array de URLs de Firebase Storage
        fotos: fotosUrls,

        // Observaciones como array de strings para N8N
        observaciones: [
          "Merchandising",
          signageData.hasSignage === 'Yes' ? "Sí" : signageData.hasSignage === 'No' ? "No" : "No respondido",
          shellData.hicistePlanogramaShell === true ? "Sí" : shellData.hicistePlanogramaShell === false ? "No" : "No respondido",
          shellData.clienteTieneStickerShell === true ? "Sí" : shellData.clienteTieneStickerShell === false ? "No" : "No respondido",
          shellData.colocasteStickerShell === true ? "Sí" : shellData.colocasteStickerShell === false ? "No" : "No respondido",
          `${shellData.totalCenefasShell || 0}`,
          `${shellData.totalPapelBobinaShell || 0}`,
          `${shellData.totalStickersShellCambio || 0}`,
          `${shellData.totalAmbientadoresShell || 0}`,
          `${shellData.totalBolsasShell || 0}`,
          ventasData?.shell?.huboVentas === true ? "Sí" : ventasData?.shell?.huboVentas === false ? "No" : "No respondido",
          ventasData?.qualid?.huboVentas === true ? "Sí" : ventasData?.qualid?.huboVentas === false ? "No" : "No respondido",
          `${fotosUrls.length}`,
          observacionShellFaltante.trim() || "Sin observaciones",
          observacionQualidFaltante.trim() || "Sin observaciones",
          observacionesAdicionales.trim() || "Sin comentarios",
          observacionesCompetencia.trim() || "Sin observaciones"
        ],

        // Metadata
        metadata: {
          timestamp: new Date().toISOString(),
          procesadoCorrectamente: true,
          tieneImagenes: fotosUrls.length > 0,
          totalMateriales: (shellData.totalCenefasShell || 0) + (shellData.totalPapelBobinaShell || 0) + (shellData.totalStickersShellCambio || 0)
        }
      };

      console.log('📊 ESTRUCTURA DETALLADA PARA N8N - MERCHANDISING:', datosDetalladosN8N);

      console.log('=== ENVIANDO VISITA COMPLETA A FIREBASE Y N8N ===');
      console.log('Cliente:', cliente);
      console.log('Usuario logueado:', currentUser);
      console.log('Mercaderista:', mercaderista);
      console.log('Correo:', correoMercaderista);
      console.log('Respuestas completas:', respuestas);
      console.log('Observaciones combinadas:', observacionesCombinadas);

      // Si no hay conexión, encolar offline y salir
      if (!navigator.onLine) {
        const coll = 'visitas';
        const payload = {
          marcaTemporal: new Date(),
          direccionCorreo: (correoMercaderista || '').toLowerCase(),
          rifCliente: rifCliente,
          nombreEstablecimiento: nombreEstablecimiento,
          tipoVisita: 'Merchandising',
          mercaderista: mercaderista,
          ubicacion: ubicacionParaVisita,
          sucursal: cliente.sede || 'GRUPO DISBATTERY',
          respuestas,
          observacionesAdicionales: Array.isArray(respuestas.observaciones) ? respuestas.observaciones.join(' | ') : (respuestas.observaciones || 'Sin observaciones'),
          createdAt: new Date(),
          updatedAt: new Date(),
          sincronizadoN8N: false,
        };

        // Encolar imágenes base64 primero (si existen en datosN8N)
        const fotosBase64: string[] = Array.isArray(datosDetalladosN8N?.fotos)
          ? (datosDetalladosN8N.fotos as string[])
          : [];
        for (let i = 0; i < fotosBase64.length; i++) {
          const base64 = fotosBase64[i];
          if (base64 && base64.startsWith('data:image/')) {
            await offlineQueue.queueUploadImage({
              draftId: draft.draftId || 'draft-temp',
              fieldKey: `foto_${i + 1}`,
              base64,
              storagePath: `visitas/offline/${rifCliente}`,
            });
          }
        }

        // Encolar creación de visita
        await offlineQueue.queueCreateVisita({
          draftId: draft.draftId || 'draft-temp',
          collection: coll,
          data: payload,
        });

        toast({ title: 'Guardado local', description: 'La visita se guardó localmente y se sincronizará al volver la conexión.' });
        await draft.markCompleted();
        return;
      }

      // Crear la visita completa online usando el servicio
      const visitaId = await crearVisita({
        rifCliente: rifCliente,
        nombreEstablecimiento: nombreEstablecimiento,
        tipoVisita: 'Merchandising',
        mercaderista: mercaderista,
        correoMercaderista: correoMercaderista,
        ubicacion: ubicacionParaVisita,
        sucursal: cliente.sede || 'GRUPO DISBATTERY',
        respuestas: respuestas,
        observacionesAdicionales: Array.isArray(respuestas.observaciones) ? respuestas.observaciones.join(' | ') : (respuestas.observaciones || 'Sin observaciones'),
        // ✅ CRÍTICO: Pasar los datos estructurados para N8N con todas las URLs de Firebase Storage
        datosN8N: {
          datosSheet: respuestas,
          datosDetalladosN8N: datosDetalladosN8N
        }
      });

      console.log('=== VISITA GUARDADA EXITOSAMENTE ===');
      console.log('ID de visita:', visitaId);

      // Limpiar localStorage y draft después del guardado exitoso
      localStorage.removeItem('datosFormularioCompleto');
      localStorage.removeItem('clienteData');
      await draft.clear();

      localStorage.removeItem('shellData'); // Por si queda algo del sistema anterior
      localStorage.removeItem('observacionesData'); // Por si queda algo del sistema anterior

      toast({
        title: 'Visita Guardada Exitosamente',
        description: `Todos los datos fueron enviados a Firebase y Google Sheets. ID: ${visitaId}`,
      });

      // ✅ DELAY ANTES DE REDIRECCIÓN PARA CAPTURAR LOGS
      console.log('🎉 ========== GUARDADO EXITOSO - ESPERANDO 3 SEGUNDOS PARA LOGS ==========');
      console.log('🎉 [ÉXITO] Visita guardada con ID:', visitaId);
      console.log('🎉 [ÉXITO] Revisa los logs anteriores para confirmar que pointId se procesó correctamente');
      console.log('🎉 [REDIRECCIÓN] Navegando a página de éxito en 3 segundos...');

      setTimeout(() => {
        console.log('🔄 [REDIRECCIÓN] Ejecutando router.push a /registro-exitoso');
        router.push('/registro-exitoso');
      }, 3000); // 3 segundos de delay

    } catch (error) {
      console.log('=== ERROR GUARDANDO VISITA COMPLETA ===');
      console.error('Error completo:', error);

      // Fallback: guardar observaciones localmente si falla todo
      const dataFallback = {
        observacionShellFaltante,
        observacionQualidFaltante,
        observacionesAdicionales,
        observacionesCompetencia,
        timestamp: new Date().toISOString(),
        error: 'Falló el guardado principal'
      };

      const observacionesData = JSON.parse(localStorage.getItem('observacionesData') || '[]');
      observacionesData.push(dataFallback);
      localStorage.setItem('observacionesData', JSON.stringify(observacionesData));

      toast({
        variant: 'destructive',
        title: 'Error al Guardar Visita',
        description: 'Se guardaron las observaciones localmente. Los datos se enviarán cuando haya conexión.',
      });

      // ✅ DELAY ANTES DE REDIRECCIÓN PARA CAPTURAR LOGS DE ERROR
      console.log('❌ ========== ERROR EN GUARDADO - ESPERANDO 3 SEGUNDOS PARA LOGS ==========');
      console.log('❌ [ERROR] Error completo capturado:', error);
      console.log('❌ [ERROR] Revisa los logs anteriores para identificar el problema con pointId');
      console.log('❌ [REDIRECCIÓN] Navegando a página de éxito en 3 segundos a pesar del error...');

      setTimeout(() => {
        console.log('🔄 [REDIRECCIÓN ERROR] Ejecutando router.push a /registro-exitoso');
        router.push('/registro-exitoso');
      }, 3000); // 3 segundos de delay

    } finally {
      setIsSyncing(false);
    }
  };

  // Función para obtener datos para mostrar en la UI
  const obtenerDatosParaMostrar = () => {
    if (typeof window === 'undefined') return null;
    const datosAcumulados = JSON.parse(localStorage.getItem('datosFormularioCompleto') || '{}');
    return {
      ventas: datosAcumulados.ventas,
      reportesFinales: datosAcumulados.reportesFinales
    };
  };

  const datosParaMostrar = obtenerDatosParaMostrar();

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4"
      style={{
        backgroundImage: 'url("https://storage.googleapis.com/iandai/imagenes/Dise%C3%B1o%20sin%20t%C3%ADtulo%20(51).png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            <span
              style={{
                backgroundImage: 'linear-gradient(to right, #fcce05, #ff0000)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Observaciones Finales
            </span>
          </CardTitle>
          <CardDescription>Complete sus observaciones para finalizar la visita.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Mostrar resumen de datos registrados */}
          {datosParaMostrar && (
            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <Label className="text-sm font-semibold text-blue-800">📊 Resumen de Datos Registrados:</Label>
              <div className="mt-2 space-y-1">
                {datosParaMostrar.ventas && (
                  <>
                    <div className="text-sm">
                      <span className="font-medium">Ventas SHELL:</span> {datosParaMostrar.ventas.shell?.huboVentas ? 'Sí' : 'No'}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Ventas QUALID:</span> {datosParaMostrar.ventas.qualid?.huboVentas ? 'Sí' : 'No'}
                    </div>
                  </>
                )}
                {datosParaMostrar.reportesFinales && (
                  <div className="text-xs text-gray-600 mt-2 pt-2 border-t">
                    <div>✓ Reporte SHELL: {datosParaMostrar.reportesFinales.reporteShellFaltante ? 'Completado' : 'Vacío'}</div>
                    <div>✓ Reporte QUALID: {datosParaMostrar.reportesFinales.reporteQualidFaltante ? 'Completado' : 'Vacío'}</div>
                    <div>✓ Comentarios: {datosParaMostrar.reportesFinales.reporteComentariosAdicionales ? 'Completado' : 'Vacío'}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="obs-shell-faltante" className="text-sm">
              Coloca aquí tus observaciones de producto faltante y cualquier comentario adicional para la cartera de productos SHELL:
            </Label>
            <Textarea
              id="obs-shell-faltante"
              value={observacionShellFaltante}
              onChange={(e) => setObservacionShellFaltante(e.target.value)}
              placeholder="Escriba sus observaciones sobre productos Shell..."
              disabled={isSyncing}
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="obs-qualid-faltante" className="text-sm">
              Coloca aquí tus observaciones de producto faltante y cualquier comentario adicional para la cartera de productos QUALID:
            </Label>
            <Textarea
              id="obs-qualid-faltante"
              value={observacionQualidFaltante}
              onChange={(e) => setObservacionQualidFaltante(e.target.value)}
              placeholder="Escriba sus observaciones sobre productos Qualid..."
              disabled={isSyncing}
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="obs-adicionales" className="text-sm">
              Añade aquí todos tus comentarios y observaciones adicionales
            </Label>
            <Textarea
              id="obs-adicionales"
              value={observacionesAdicionales}
              onChange={(e) => setObservacionesAdicionales(e.target.value)}
              placeholder="Comentarios adicionales generales..."
              disabled={isSyncing}
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="obs-competencia" className="text-sm">
              Aquí puedes dejar tus comentarios y observaciones sobre temas importantes como actividades de la competencia, presencia de nuevas marcas, etc.
            </Label>
            <Textarea
              id="obs-competencia"
              value={observacionesCompetencia}
              onChange={(e) => setObservacionesCompetencia(e.target.value)}
              placeholder="Observaciones sobre la competencia..."
              disabled={isSyncing}
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSubmit}
            disabled={isSyncing}
            className="w-full"
            style={{
              background: 'linear-gradient(to right, #fcce05, #ff0000)',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            {isSyncing ? 'Guardando Visita Completa...' : 'Finalizar y Guardar Visita Completa'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
