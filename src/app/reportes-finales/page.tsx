'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { crearVisita, setN8NWebhookURL } from '@/services/visitas';
import { RespuestasTrade } from '@/types/visitas';
import { getCurrentUser, getUserFromStorage } from '@/services/auth';
import { uploadMultipleImages } from '@/services/images';
import { SyncService } from '@/services/sync'; // Importar nuestro SyncService

// 🗜️ FUNCIÓN PARA COMPRIMIR IMÁGENES BASE64
const comprimirImagenBase64 = (base64String: string, calidad: number = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Calcular nuevas dimensiones (máximo 800px de ancho)
      const maxWidth = 800;
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      const newWidth = img.width * ratio;
      const newHeight = img.height * ratio;
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // Dibujar imagen redimensionada
      ctx?.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Convertir a JPEG con calidad reducida
      const comprimida = canvas.toDataURL('image/jpeg', calidad);
      console.log(`📸 Imagen comprimida: ${base64String.length} → ${comprimida.length} chars (${Math.round((1 - comprimida.length/base64String.length) * 100)}% reducción)`);
      resolve(comprimida);
    };
    
    img.src = base64String;
  });
};

export default function ReportesFinalesPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Estados para los 3 reportes
  const [reporteShellFaltante, setReporteShellFaltante] = useState('');
  const [reporteQualidFaltante, setReporteQualidFaltante] = useState('');
  const [reporteComentariosAdicionales, setReporteComentariosAdicionales] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);

  // Configurar URL del webhook N8N al inicializar
  useEffect(() => {
    setN8NWebhookURL('https://n8n.con-visas.com/webhook/Disbattery-Trade-app');
  }, []);

  const handleGuardarYContinuar = async () => {
    //
    // =================================================================
    // INICIO DE LA MODIFICACIÓN PARA FUNCIONALIDAD OFFLINE
    // =================================================================
    //
    if (typeof window !== 'undefined' && !navigator.onLine) {
      try {
        setIsSyncing(true);
        console.log('🔄 Modo Offline: Guardando reporte localmente...');
        
        const datosAcumulados = JSON.parse(localStorage.getItem('datosFormularioCompleto') || '{}');
        if (!datosAcumulados.clienteData) {
          toast({
            variant: 'destructive',
            title: 'Error de Datos',
            description: 'No se encontraron datos del cliente. Reinicie el proceso.',
          });
          return;
        }

        // Agregar los reportes finales a los datos acumulados
        datosAcumulados.reporteShellFaltante = reporteShellFaltante;
        datosAcumulados.reporteQualidFaltante = reporteQualidFaltante;
        datosAcumulados.reporteComentariosAdicionales = reporteComentariosAdicionales;
        
        // Llamar a nuestro SyncService para guardar en IndexedDB
        await SyncService.saveVisitaOffline(datosAcumulados);

        // Limpiar localStorage
        localStorage.removeItem('clienteData');
        localStorage.removeItem('datosFormularioCompleto');

        toast({
          title: '✅ Reporte Guardado Offline',
          description: 'Los datos se han guardado en su dispositivo y se enviarán automáticamente cuando recupere la conexión.',
        });

        // Navegar a la página de éxito
        router.push('/registro-exitoso');

      } catch (error) {
        console.error('Error guardando el reporte offline:', error);
        toast({
          variant: 'destructive',
          title: 'Error al Guardar Offline',
          description: 'Hubo un problema al guardar los datos en el dispositivo. Por favor, intente de nuevo.',
        });
      } finally {
        setIsSyncing(false);
      }
      return; // Detener la ejecución si estamos offline
    }
    //
    // =================================================================
    // FIN DE LA MODIFICACIÓN PARA FUNCIONALIDAD OFFLINE
    // =================================================================
    //

    try {
      setIsSyncing(true);
      
      // Obtener datos acumulados
      const datosAcumulados = JSON.parse(localStorage.getItem('datosFormularioCompleto') || '{}');
      
      if (!datosAcumulados.clienteData) {
        toast({
          variant: 'destructive',
          title: 'Error de Datos',
          description: 'No se encontraron datos del cliente. Reinicie el proceso.',
        });
        return;
      }

      const cliente = datosAcumulados.clienteData;
      
      // Obtener datos del usuario logueado
      let currentUser = await getCurrentUser();
      if (!currentUser) {
        currentUser = getUserFromStorage();
      }
      
      const mercaderista = datosAcumulados.mercaderista || currentUser?.fullName || 'Usuario App';
      const correoMercaderista = datosAcumulados.correoMercaderista || currentUser?.email || '';

      // Preparar datos de ventas para las observaciones
      const ventasData: string[] = [];
      
      // Agregar ventas Shell si hubo
      if (datosAcumulados.huboVentasShell === true && datosAcumulados.ventasShellDetalladas) {
        const ventas = datosAcumulados.ventasShellDetalladas;
        ventasData.push('VENTAS SHELL:');
        ventasData.push(`- ADVANCE: ${ventas.advance || '0'} litros`);
        ventasData.push(`- HELIX HX5: ${ventas.helixHX5 || '0'} litros`);
        ventasData.push(`- HELIX HX7: ${ventas.helixHX7 || '0'} litros`);
        ventasData.push(`- HELIX HX8: ${ventas.helixHX8 || '0'} litros`);
        ventasData.push(`- HELIX ULTRA: ${ventas.helixUltra || '0'} litros`);
        ventasData.push(`- RIMULA: ${ventas.rimula || '0'} litros`);
        ventasData.push(`- SPIRAX: ${ventas.spirax || '0'} litros`);
        ventasData.push(`- GADUS: ${ventas.gadus || '0'} cartuchos`);
        ventasData.push(`- OTROS: ${ventas.otros || '0'} litros`);
      } else if (datosAcumulados.huboVentasShell === false) {
        ventasData.push('No hubo ventas de productos SHELL');
      }
      
      // Agregar ventas Qualid si hubo
      if (datosAcumulados.huboVentasQualid === true && datosAcumulados.ventasQualidDetalladas) {
        const ventas = datosAcumulados.ventasQualidDetalladas;
        ventasData.push('VENTAS QUALID:');
        ventasData.push(`- FLUIDOS: ${ventas.fluidos || '0'} litros`);
        ventasData.push(`- SPRAY: ${ventas.spray || '0'} unidades`);
        ventasData.push(`- FILTRO AUTOMOTRIZ: ${ventas.filtroAutomotriz || '0'} unidades`);
        ventasData.push(`- SERVICIO PESADO: ${ventas.servicioPesado || '0'} unidades`);
        ventasData.push(`- CAUCHOS: ${ventas.cauchos || '0'} unidades`);
      } else if (datosAcumulados.huboVentasQualid === false) {
        ventasData.push('No hubo ventas de productos QUALID');
      }

      // 🔄 MANEJO DE IMÁGENES COMPRIMIDAS (SEPARADAS PARA N8N)
      let fotosComprimidas: Record<string, string> = {};
      
      console.log('📷 Comprimiendo imágenes para N8N...');
      console.log('🔍 DEBUG: Datos acumulados completos:', datosAcumulados);
      console.log('🔍 DEBUG: Tipo de visita:', datosAcumulados.tipoVisita);
      console.log('🔍 DEBUG: Marca seleccionada:', datosAcumulados.marca);
      
      // 🔍 DEBUGGING ESPECÍFICO PARA FOTOS DE TRADE
      console.log('🔍 DEBUG: Verificando fotos de Trade...');
      console.log('  - fotoImpulso:', datosAcumulados.fotoImpulso ? 'EXISTE' : 'NO EXISTE');
      console.log('  - fotoPromotoras:', datosAcumulados.fotoPromotoras ? 'EXISTE' : 'NO EXISTE');
      console.log('  - fotoImpulsoShell:', datosAcumulados.fotoImpulsoShell ? 'EXISTE' : 'NO EXISTE');
      console.log('  - fotoPromotorasShell:', datosAcumulados.fotoPromotorasShell ? 'EXISTE' : 'NO EXISTE');
      console.log('  - fotoImpulsoQualid:', datosAcumulados.fotoImpulsoQualid ? 'EXISTE' : 'NO EXISTE');
      console.log('  - fotoPromotorasQualid:', datosAcumulados.fotoPromotorasQualid ? 'EXISTE' : 'NO EXISTE');
      
      // 🔍 DEBUGGING ESPECÍFICO PARA FOTOS DE MERCHANDISING
      if (datosAcumulados.shellMerchandising) {
        const shell = datosAcumulados.shellMerchandising;
        console.log('🔍 DEBUG: Verificando fotos de Merchandising Shell...');
        console.log('  - fotoAntesShell:', shell.fotoAntesShell ? `EXISTE (${shell.fotoAntesShell.length} chars)` : 'NO EXISTE O VACÍA');
        console.log('  - fotoDespuesShell:', shell.fotoDespuesShell ? `EXISTE (${shell.fotoDespuesShell.length} chars)` : 'NO EXISTE O VACÍA');
        console.log('  - fotoStickerShell:', shell.fotoStickerShell ? `EXISTE (${shell.fotoStickerShell.length} chars)` : 'NO EXISTE O VACÍA');
        
        // Verificar si son cadenas vacías
        if (shell.fotoAntesShell === '') console.log('⚠️ fotoAntesShell es cadena VACÍA');
        if (shell.fotoDespuesShell === '') console.log('⚠️ fotoDespuesShell es cadena VACÍA');
        if (shell.fotoStickerShell === '') console.log('⚠️ fotoStickerShell es cadena VACÍA');
      } else {
        console.log('⚠️ NO HAY DATOS DE shellMerchandising');
      }
      
      // 🗜️ COMPRIMIR TODAS LAS FOTOS DISPONIBLES EN PARALELO
      const compresiones: Promise<void>[] = [];
      
      // 🆕 FOTO DE SEÑALIZACIÓN (VISIT-CAPTURE)
      console.log('🚩🚩🚩 === DEBUGGING FOTO SEÑALIZACIÓN EN REPORTES-FINALES ===');
      console.log('🚩 datosAcumulados.signagePhoto existe:', !!datosAcumulados.signagePhoto);
      console.log('🚩 datosAcumulados.signagePhoto tipo:', typeof datosAcumulados.signagePhoto);
      console.log('🚩 datosAcumulados.signagePhoto longitud:', datosAcumulados.signagePhoto?.length || 0);
      console.log('🚩 datosAcumulados.signagePhoto es base64:', datosAcumulados.signagePhoto?.startsWith('data:image/'));
      console.log('🚩 datosAcumulados.clienteData?.signagePhoto existe:', !!datosAcumulados.clienteData?.signagePhoto);
      console.log('🚩 datosAcumulados.clienteData?.signagePhoto es base64:', datosAcumulados.clienteData?.signagePhoto?.startsWith('data:image/'));
      
      // ✅ INTENTAR MÚLTIPLES FUENTES PARA LA FOTO DE SEÑALIZACIÓN
      const fotoSeñalizacion = datosAcumulados.signagePhoto || datosAcumulados.clienteData?.signagePhoto;
      console.log('🚩 Foto señalización final seleccionada:', fotoSeñalizacion ? 'ENCONTRADA' : 'NO ENCONTRADA');
      
      if (fotoSeñalizacion && fotoSeñalizacion.trim() !== '' && fotoSeñalizacion.startsWith('data:image/')) {
        console.log('✅ PROCESANDO FOTO DE SEÑALIZACIÓN');
        compresiones.push(
          comprimirImagenBase64(fotoSeñalizacion).then(comprimida => {
            fotosComprimidas.foto_senalizacion = comprimida;
            console.log('✅ COMPRIMIDA FOTO DE SEÑALIZACIÓN');
          }).catch(error => {
            console.log('❌ ERROR comprimiendo foto de señalización:', error);
          })
        );
      } else {
        console.log('⚠️ FOTO DE SEÑALIZACIÓN está vacía o inválida');
        console.log('   - Valor:', fotoSeñalizacion);
        console.log('   - Es string:', typeof fotoSeñalizacion === 'string');
        console.log('   - Está vacía:', !fotoSeñalizacion || fotoSeñalizacion.trim() === '');
        console.log('   - Es base64:', fotoSeñalizacion?.startsWith('data:image/'));
      }
      
      // FOTOS DE TRADE-IMPULSO/EVENTOS
      if (datosAcumulados.fotoImpulso && datosAcumulados.fotoImpulso.trim() !== '' && datosAcumulados.fotoImpulso.startsWith('data:image/')) {
        compresiones.push(
          comprimirImagenBase64(datosAcumulados.fotoImpulso).then(comprimida => {
            fotosComprimidas.foto_impulso = comprimida;
            console.log('✅ COMPRIMIDA FOTO DE IMPULSO');
          }).catch(error => {
            console.log('❌ ERROR comprimiendo foto impulso:', error);
          })
        );
      } else {
        console.log('⚠️ FOTO DE IMPULSO está vacía o inválida');
        // Recuperar fotos específicas por marca
        if (datosAcumulados.fotoImpulsoShell && datosAcumulados.fotoImpulsoShell.trim() !== '' && datosAcumulados.fotoImpulsoShell.startsWith('data:image/')) {
          compresiones.push(
            comprimirImagenBase64(datosAcumulados.fotoImpulsoShell).then(comprimida => {
              fotosComprimidas.foto_impulso_shell = comprimida;
              console.log('✅ COMPRIMIDA FOTO DE IMPULSO SHELL');
            }).catch(error => {
              console.log('❌ ERROR comprimiendo foto impulso shell:', error);
            })
          );
        }
        if (datosAcumulados.fotoImpulsoQualid && datosAcumulados.fotoImpulsoQualid.trim() !== '' && datosAcumulados.fotoImpulsoQualid.startsWith('data:image/')) {
          compresiones.push(
            comprimirImagenBase64(datosAcumulados.fotoImpulsoQualid).then(comprimida => {
              fotosComprimidas.foto_impulso_qualid = comprimida;
              console.log('✅ COMPRIMIDA FOTO DE IMPULSO QUALID');
            }).catch(error => {
              console.log('❌ ERROR comprimiendo foto impulso qualid:', error);
            })
          );
        }
      }
      
      if (datosAcumulados.fotoPromotoras && datosAcumulados.fotoPromotoras.trim() !== '' && datosAcumulados.fotoPromotoras.startsWith('data:image/')) {
        compresiones.push(
          comprimirImagenBase64(datosAcumulados.fotoPromotoras).then(comprimida => {
            fotosComprimidas.foto_promotoras = comprimida;
            console.log('✅ COMPRIMIDA FOTO DE PROMOTORAS');
          }).catch(error => {
            console.log('❌ ERROR comprimiendo foto promotoras:', error);
          })
        );
      } else {
        console.log('⚠️ FOTO DE PROMOTORAS está vacía o inválida');
        // Recuperar fotos específicas por marca
        if (datosAcumulados.fotoPromotorasShell && datosAcumulados.fotoPromotorasShell.trim() !== '' && datosAcumulados.fotoPromotorasShell.startsWith('data:image/')) {
          compresiones.push(
            comprimirImagenBase64(datosAcumulados.fotoPromotorasShell).then(comprimida => {
              fotosComprimidas.foto_promotoras_shell = comprimida;
              console.log('✅ COMPRIMIDA FOTO DE PROMOTORAS SHELL');
            }).catch(error => {
              console.log('❌ ERROR comprimiendo foto promotoras shell:', error);
            })
          );
        }
        if (datosAcumulados.fotoPromotorasQualid && datosAcumulados.fotoPromotorasQualid.trim() !== '' && datosAcumulados.fotoPromotorasQualid.startsWith('data:image/')) {
          compresiones.push(
            comprimirImagenBase64(datosAcumulados.fotoPromotorasQualid).then(comprimida => {
              fotosComprimidas.foto_promotoras_qualid = comprimida;
              console.log('✅ COMPRIMIDA FOTO DE PROMOTORAS QUALID');
            }).catch(error => {
              console.log('❌ ERROR comprimiendo foto promotoras qualid:', error);
            })
          );
        }
      }
      
      // FOTOS DE MERCHANDISING SHELL
      if (datosAcumulados.shellMerchandising) {
        const shell = datosAcumulados.shellMerchandising;
        console.log('📸 COMPRIMIENDO FOTOS DE MERCHANDISING SHELL:');
        
        // 🔧 VERIFICAR Y COMPRIMIR FOTO ANTES DEL PLANOGRAMA
        if (shell.fotoAntesShell && shell.fotoAntesShell.trim() !== '' && shell.fotoAntesShell.startsWith('data:image/')) {
          compresiones.push(
            comprimirImagenBase64(shell.fotoAntesShell).then(comprimida => {
              fotosComprimidas.foto_antes_planograma = comprimida;
              console.log('✅ COMPRIMIDA FOTO ANTES DEL PLANOGRAMA');
            }).catch(error => {
              console.log('❌ ERROR comprimiendo foto antes planograma:', error);
            })
          );
        } else {
          console.log('⚠️ FOTO ANTES DEL PLANOGRAMA está vacía o inválida');
        }
        
        // 🔧 VERIFICAR Y COMPRIMIR FOTO DESPUÉS DEL PLANOGRAMA
        if (shell.fotoDespuesShell && shell.fotoDespuesShell.trim() !== '' && shell.fotoDespuesShell.startsWith('data:image/')) {
          compresiones.push(
            comprimirImagenBase64(shell.fotoDespuesShell).then(comprimida => {
              fotosComprimidas.foto_despues_planograma = comprimida;
              console.log('✅ COMPRIMIDA FOTO DESPUÉS DEL PLANOGRAMA');
            }).catch(error => {
              console.log('❌ ERROR comprimiendo foto después planograma:', error);
            })
          );
        } else {
          console.log('⚠️ FOTO DESPUÉS DEL PLANOGRAMA está vacía o inválida');
        }
        
        // 🔧 VERIFICAR Y COMPRIMIR FOTO STICKER SHELL
        if (shell.fotoStickerShell && shell.fotoStickerShell.trim() !== '' && shell.fotoStickerShell.startsWith('data:image/')) {
          compresiones.push(
            comprimirImagenBase64(shell.fotoStickerShell).then(comprimida => {
              fotosComprimidas.foto_sticker_shell = comprimida;
              console.log('✅ COMPRIMIDA FOTO STICKER SHELL');
            }).catch(error => {
              console.log('❌ ERROR comprimiendo foto sticker shell:', error);
            })
          );
        } else {
          console.log('⚠️ FOTO STICKER SHELL está vacía o inválida');
        }
      }
      
      // 🆕 FOTOS DE MATERIAL INTERNO SHELL
      if (datosAcumulados.shellMaterialInterno) {
        const material = datosAcumulados.shellMaterialInterno;
        console.log('📸 COMPRIMIENDO FOTOS DE MATERIAL INTERNO SHELL:');
        
        if (material.fotoExhibidoresShell && material.fotoExhibidoresShell.trim() !== '' && material.fotoExhibidoresShell.startsWith('data:image/')) {
          compresiones.push(comprimirImagenBase64(material.fotoExhibidoresShell).then(c => { fotosComprimidas.foto_exhibidores_shell = c; console.log('✅ COMPRIMIDA FOTO EXHIBIDORES'); }));
        }
        if (material.fotoAfichesColocadosShell && material.fotoAfichesColocadosShell.trim() !== '' && material.fotoAfichesColocadosShell.startsWith('data:image/')) {
          compresiones.push(comprimirImagenBase64(material.fotoAfichesColocadosShell).then(c => { fotosComprimidas.foto_afiches_shell = c; console.log('✅ COMPRIMIDA FOTO AFICHES'); }));
        }
        if (material.fotoBanderinesShell && material.fotoBanderinesShell.trim() !== '' && material.fotoBanderinesShell.startsWith('data:image/')) {
          compresiones.push(comprimirImagenBase64(material.fotoBanderinesShell).then(c => { fotosComprimidas.foto_banderines_shell = c; console.log('✅ COMPRIMIDA FOTO BANDERINES'); }));
        }
        if (material.fotoAvisoAcrilicoShell && material.fotoAvisoAcrilicoShell.trim() !== '' && material.fotoAvisoAcrilicoShell.startsWith('data:image/')) {
          compresiones.push(comprimirImagenBase64(material.fotoAvisoAcrilicoShell).then(c => { fotosComprimidas.foto_aviso_acrilico_shell = c; console.log('✅ COMPRIMIDA FOTO AVISO ACRÍLICO'); }));
        }
      }
      
      // 🆕 FOTOS DE MERCHANDISING QUALID
      if (datosAcumulados.qualidMerchandising) {
        const qualid = datosAcumulados.qualidMerchandising;
        console.log('📸 COMPRIMIENDO FOTOS DE MERCHANDISING QUALID:');
        
        // Fotos de planograma Qualid
        if (qualid.fotoAntesPlanogramaQualid && qualid.fotoAntesPlanogramaQualid.trim() !== '' && qualid.fotoAntesPlanogramaQualid.startsWith('data:image/')) {
          compresiones.push(comprimirImagenBase64(qualid.fotoAntesPlanogramaQualid).then(c => { fotosComprimidas.foto_antes_planograma_qualid = c; console.log('✅ COMPRIMIDA FOTO ANTES PLANOGRAMA QUALID'); }));
        }
        if (qualid.fotoDespuesPlanogramaQualid && qualid.fotoDespuesPlanogramaQualid.trim() !== '' && qualid.fotoDespuesPlanogramaQualid.startsWith('data:image/')) {
          compresiones.push(comprimirImagenBase64(qualid.fotoDespuesPlanogramaQualid).then(c => { fotosComprimidas.foto_despues_planograma_qualid = c; console.log('✅ COMPRIMIDA FOTO DESPUÉS PLANOGRAMA QUALID'); }));
        }
        
        // Fotos de afiches y exhibidores Qualid
        if (qualid.fotoAfichesQualid && qualid.fotoAfichesQualid.trim() !== '' && qualid.fotoAfichesQualid.startsWith('data:image/')) {
          compresiones.push(comprimirImagenBase64(qualid.fotoAfichesQualid).then(c => { fotosComprimidas.foto_afiches_qualid = c; console.log('✅ COMPRIMIDA FOTO AFICHES QUALID'); }));
        }
        if (qualid.fotoExhibidoresCauchoQualid && qualid.fotoExhibidoresCauchoQualid.trim() !== '' && qualid.fotoExhibidoresCauchoQualid.startsWith('data:image/')) {
          compresiones.push(comprimirImagenBase64(qualid.fotoExhibidoresCauchoQualid).then(c => { fotosComprimidas.foto_exhibidores_caucho_qualid = c; console.log('✅ COMPRIMIDA FOTO EXHIBIDORES CAUCHO QUALID'); }));
        }
      }
      
      // 📎 ESPERAR A QUE TODAS LAS COMPRESIONES TERMINEN
      await Promise.all(compresiones);
      
      console.log(`📊 TOTAL DE FOTOS COMPRIMIDAS: ${Object.keys(fotosComprimidas).length} imágenes`);
      console.log('🎯 FOTOS COMPRIMIDAS PARA N8N:', Object.keys(fotosComprimidas));

      // 🧹 CLONAR Y LIMPIAR DATOS PARA FIREBASE (ELIMINAR IMÁGENES BASE64 GRANDES)
      const datosLimpiosParaFirebase = JSON.parse(JSON.stringify(datosAcumulados));
      if (datosLimpiosParaFirebase.signagePhoto) delete datosLimpiosParaFirebase.signagePhoto;
      if (datosLimpiosParaFirebase.shellMerchandising) {
        delete datosLimpiosParaFirebase.shellMerchandising.fotoAntesShell;
        delete datosLimpiosParaFirebase.shellMerchandising.fotoDespuesShell;
        delete datosLimpiosParaFirebase.shellMerchandising.fotoStickerShell;
      }
      if (datosLimpiosParaFirebase.shellMaterialInterno) {
        delete datosLimpiosParaFirebase.shellMaterialInterno.fotoExhibidoresShell;
        delete datosLimpiosParaFirebase.shellMaterialInterno.fotoAfichesColocadosShell;
        delete datosLimpiosParaFirebase.shellMaterialInterno.fotoBanderinesShell;
        delete datosLimpiosParaFirebase.shellMaterialInterno.fotoAvisoAcrilicoShell;
      }
      if (datosLimpiosParaFirebase.qualidMerchandising) {
        delete datosLimpiosParaFirebase.qualidMerchandising.fotoAntesPlanogramaQualid;
        delete datosLimpiosParaFirebase.qualidMerchandising.fotoDespuesPlanogramaQualid;
        delete datosLimpiosParaFirebase.qualidMerchandising.fotoAfichesQualid;
        delete datosLimpiosParaFirebase.qualidMerchandising.fotoExhibidoresCauchoQualid;
      }
      console.log('🧼 Datos limpios de imágenes para Firebase:', datosLimpiosParaFirebase);

      // 🆕 INICIALIZAR datosSheet CON HEADERS EXACTOS DEL GOOGLE SHEET
      let datosSheet: Record<string, any> = {
        'Marca temporal': new Date().toLocaleString('es-ES'),
        'Dirección de correo electrónico': correoMercaderista,
        'Rif del cliente:': cliente.rif,
        'Nombre del establecimiento:': cliente.nombre,
        'Desde que sucursal se realiza el registro': cliente.sede || 'No especificada'
      };

      // 🗂️ ESTRUCTURA ORGANIZADA CON PREGUNTAS Y RESPUESTAS
      const observacionesOrganizadas = [];

      // INFORMACIÓN BÁSICA
      observacionesOrganizadas.push(`TIPO DE VISITA: ${datosAcumulados.tipoVisita || 'No especificado'}`);
      observacionesOrganizadas.push(`MARCA SELECCIONADA: ${datosAcumulados.marca || 'No especificada'}`);
      observacionesOrganizadas.push(`MERCADERISTA: ${mercaderista}`);
      observacionesOrganizadas.push(`ESTABLECIMIENTO: ${cliente.nombre} (${cliente.rif})`);
      observacionesOrganizadas.push(`SUCURSAL: ${cliente.sede || 'No especificada'}`);

      // 🆕 AÑADIR DATO DE SEÑALIZACIÓN
      if (datosAcumulados.hasSignage) {
        observacionesOrganizadas.push(`¿EL CLIENTE TIENE SEÑALIZACIÓN?: ${datosAcumulados.hasSignage === 'Yes' ? 'Sí' : 'No'}`);
      }
      
      // RECURSOS UTILIZADOS
      if ((datosAcumulados.recursosUsados || []).length > 0) {
        observacionesOrganizadas.push(`RECURSOS UTILIZADOS:`);
        datosAcumulados.recursosUsados.forEach((r: any) => {
          observacionesOrganizadas.push(`  - ${r.tipo}: ${r.cantidad} unidades`);
        });
      } else {
        observacionesOrganizadas.push(`RECURSOS UTILIZADOS: Ninguno reportado`);
      }

      // ENTREGABLES SHELL
      if ((datosAcumulados.entregablesShell || []).length > 0) {
        observacionesOrganizadas.push(`ENTREGABLES SHELL DISTRIBUIDOS:`);
        datosAcumulados.entregablesShell.forEach((e: any) => {
          observacionesOrganizadas.push(`  - ${e.tipo}: ${e.cantidad} unidades`);
        });
      } else {
        observacionesOrganizadas.push(`ENTREGABLES SHELL DISTRIBUIDOS: Ninguno reportado`);
      }

      // ENTREGABLES QUALID
      if ((datosAcumulados.entregablesQualid || []).length > 0) {
        observacionesOrganizadas.push(`ENTREGABLES QUALID DISTRIBUIDOS:`);
        datosAcumulados.entregablesQualid.forEach((e: any) => {
          observacionesOrganizadas.push(`  - ${e.tipo}: ${e.cantidad} unidades`);
        });
      } else {
        observacionesOrganizadas.push(`ENTREGABLES QUALID DISTRIBUIDOS: Ninguno reportado`);
      }

      // ACTIVIDADES DE MERCHANDISING SHELL (si es merchandising)
      if (datosAcumulados.shellMerchandising) {
        const shell = datosAcumulados.shellMerchandising;
        observacionesOrganizadas.push(`ACTIVIDADES DE MERCHANDISING (EXTERNO):`);
        observacionesOrganizadas.push(`  ¿Trabajaste en el planograma?: ${shell.hicistePlanogramaShell ? 'Sí' : 'No'}`);
        observacionesOrganizadas.push(`  ¿Cuántos stickers autorizados tiene el cliente?: ${shell.cantidadStickersAutorizados || 0}`);
        observacionesOrganizadas.push(`  Cantidad de Stickers Nuevos Colocados: ${shell.cantidadStickersNuevos || 0}`);
        observacionesOrganizadas.push(`  Total de Cenefas Shell colocadas: ${shell.totalCenefasShell || 0}`);
        observacionesOrganizadas.push(`  Total de Papel Bobina Shell colocado (metros): ${shell.totalPapelBobinaShell || 0}`);
        observacionesOrganizadas.push(`  Stickers Shell Cambio de Lubricante entregados: ${shell.totalStickersShellCambio || 0}`);
        observacionesOrganizadas.push(`  Ambientadores Shell para vehículo: ${shell.totalAmbientadoresShell || 0}`);
        observacionesOrganizadas.push(`  Bolsas Shell para carro: ${shell.totalBolsasShell || 0}`);
      }

      // 🆕 ACTIVIDADES DE MATERIAL INTERNO SHELL
      if (datosAcumulados.shellMaterialInterno) {
        const material = datosAcumulados.shellMaterialInterno;
        observacionesOrganizadas.push(`ACTIVIDADES DE MERCHANDISING (INTERNO):`);
        observacionesOrganizadas.push(`  ¿El cliente tiene exhibidores Shell?: ${material.tieneExhibidoresShell ? `Sí, ${material.cantidadExhibidoresShell || 0} unidades` : 'No'}`);
        observacionesOrganizadas.push(`  ¿Colocó banderines?: ${material.colocoBanderinesShell ? `Sí, ${material.cantidadTirasBanderinesShell || 0} tiras` : 'No'}`);
        observacionesOrganizadas.push(`  ¿Colocaste aviso acrílico para exteriores Shell?: ${material.colocoAvisoAcrilicoShell ? 'Sí' : 'No'}`);
        if (material.afichesColocadosShell && material.afichesColocadosShell.length > 0) {
          observacionesOrganizadas.push(`  Afiches Shell Colocados:`);
          material.afichesColocadosShell.forEach((afiche: any) => {
            observacionesOrganizadas.push(`    - ${afiche.tipo}: ${afiche.cantidad} unidades`);
          });
        } else {
          observacionesOrganizadas.push(`  Afiches Shell Colocados: Ninguno`);
        }
      }

      // 🆕 ACTIVIDADES DE MERCHANDISING QUALID
      if (datosAcumulados.qualidMerchandising) {
        const qualid = datosAcumulados.qualidMerchandising;
        observacionesOrganizadas.push(`ACTIVIDADES DE MERCHANDISING (QUALID):`);
        observacionesOrganizadas.push(`  Total de Cenefas Qualid colocadas: ${qualid.totalCenefasQualid || 0}`);
        observacionesOrganizadas.push(`  Total de Bolsas Qualid para carro entregadas: ${qualid.totalBolsasQualid || 0}`);
        
        if (qualid.afichesColocadosQualid && qualid.afichesColocadosQualid.length > 0) {
          observacionesOrganizadas.push(`  Afiches Qualid Colocados:`);
          qualid.afichesColocadosQualid.forEach((afiche: any) => {
            observacionesOrganizadas.push(`    - ${afiche.tipo}: ${afiche.cantidad} unidades`);
          });
        } else {
          observacionesOrganizadas.push(`  Afiches Qualid Colocados: Ninguno`);
        }

        if (qualid.exhibidoresCauchoQualid && qualid.exhibidoresCauchoQualid.length > 0) {
          observacionesOrganizadas.push(`  Exhibidores de Caucho Qualid Colocados:`);
          qualid.exhibidoresCauchoQualid.forEach((exhibidor: any) => {
            observacionesOrganizadas.push(`    - ${exhibidor.tipo}: ${exhibidor.cantidad} unidades`);
          });
        } else {
          observacionesOrganizadas.push(`  Exhibidores de Caucho Qualid Colocados: Ninguno`);
        }
      }

      // ✅ VERIFICAR TIPO DE VISITA PARA USAR FORMATO CORRECTO
      const tipoVisita = datosAcumulados.tipoVisita || '';
      const esTradeImpulsoOEventos = tipoVisita.includes('Trade (Impulso)') || tipoVisita.includes('Trade (Eventos)');
      
      console.log('🔍 TIPO DE VISITA DETECTADO:', tipoVisita);
      console.log('🔍 ¿Es Trade Impulso/Eventos?:', esTradeImpulsoOEventos);

      if (esTradeImpulsoOEventos) {
        // 🎯 FORMATO ESPECÍFICO PARA TRADE IMPULSO/EVENTOS (Headers del CSV)
        console.log('🎯 USANDO FORMATO TRADE IMPULSO/EVENTOS');

        // ✅ HEADERS BÁSICOS DEL CSV TRADE
        datosSheet["Registro de material para Impulso o Evento:"] = tipoVisita.includes('Impulso') ? 'Impulso' : 'Evento';
        datosSheet["Indica el nombre del evento:"] = datosAcumulados.nombreEvento || cliente.nombre || 'No especificado';
        datosSheet["Indica la ciudad en la que se realizó el evento:"] = cliente.ciudad || 'No especificada';
        datosSheet["¿Qué marca fue promocionada en el impulso o evento?"] = datosAcumulados.marca || 'No especificada';

        // ✅ MATERIAL DE APOYO SHELL
        const recursosShell = (datosAcumulados.recursosUsados || []).filter((r: any) => r.tipo?.toLowerCase().includes('shell'));
        datosSheet["¿Qué material de apoyo Shell se utilizó? [UNIFORMES DE PROMOTORAS SHELL]"] = recursosShell.find((r: any) => r.tipo?.toLowerCase().includes('uniform'))?.cantidad || 0;
        datosSheet["¿Qué material de apoyo Shell se utilizó? [BANDEROLAS SHELL]"] = recursosShell.find((r: any) => r.tipo?.toLowerCase().includes('banderola'))?.cantidad || 0;
        datosSheet["¿Qué material de apoyo Shell se utilizó? [IGLOO SHELL]"] = recursosShell.find((r: any) => r.tipo?.toLowerCase().includes('igloo'))?.cantidad || 0;
        datosSheet["¿Qué material de apoyo Shell se utilizó? [TOLDO SHELL]"] = recursosShell.find((r: any) => r.tipo?.toLowerCase().includes('toldo'))?.cantidad || 0;
        datosSheet["¿Qué material de apoyo Shell se utilizó? [EXHIBIDORES SHELL]"] = recursosShell.find((r: any) => r.tipo?.toLowerCase().includes('exhibidor'))?.cantidad || 0;

        // ✅ FOTOS DE TRADE SHELL
        datosSheet["Fotos del impulso o evento SHELL:"] = 'Pendiente de mapeo'; // Se actualizará después con URL de Firebase
        datosSheet["Fotos de las promotoras con los clientes en el impulso o evento SHELL:"] = 'Pendiente de mapeo'; // Se actualizará después

        // ✅ MATERIAL DE APOYO QUALID
        const recursosQualid = (datosAcumulados.recursosUsados || []).filter((r: any) => r.tipo?.toLowerCase().includes('qualid'));
        datosSheet["¿Qué material de apoyo Qualid se utilizó? [UNIFORMES DE PROMOTORAS QUALID]"] = recursosQualid.find((r: any) => r.tipo?.toLowerCase().includes('uniform'))?.cantidad || 0;
        datosSheet["¿Qué material de apoyo Qualid se utilizó? [BANDEROLAS QUALID]"] = recursosQualid.find((r: any) => r.tipo?.toLowerCase().includes('banderola'))?.cantidad || 0;
        datosSheet["¿Qué material de apoyo Qualid se utilizó? [IGLOO QUALID]"] = recursosQualid.find((r: any) => r.tipo?.toLowerCase().includes('igloo'))?.cantidad || 0;
        datosSheet["¿Qué material de apoyo Qualid se utilizó? [TOLDO QUALID]"] = recursosQualid.find((r: any) => r.tipo?.toLowerCase().includes('toldo'))?.cantidad || 0;

        // ✅ FOTOS DE TRADE QUALID
        datosSheet["Fotos del impulso o evento QUALID:"] = 'Pendiente de mapeo'; // Se actualizará después
        datosSheet["Fotos de las promotoras con los clientes en el impulso o evento QUALID:"] = 'Pendiente de mapeo'; // Se actualizará después

        // ✅ ENTREGABLES SHELL
        const entregablesShell = datosAcumulados.entregablesShell || [];
        datosSheet["Total de AMBIENTADORES SHELL PARA VEHÍCULO entregados:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('ambientador'))?.cantidad || 0;
        datosSheet["Total de BOLSAS SHELL PARA CARRO entregadas:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('bolsa') && e.tipo?.toLowerCase().includes('carro'))?.cantidad || 0;
        datosSheet["Total de LLAVEROS DE TELA SHELL entregados:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('llavero') && e.tipo?.toLowerCase().includes('tela'))?.cantidad || 0;
        datosSheet["Total de GORRA SHELL entregadas:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('gorra'))?.cantidad || 0;
        datosSheet["Total de BOLSAS TIPO BOUTIQUE NEGRO entregadas:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('boutique') && e.tipo?.toLowerCase().includes('negro'))?.cantidad || 0;
        datosSheet["Total de BOLSAS TIPO BOUTIQUE BLANCO entregados:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('boutique') && e.tipo?.toLowerCase().includes('blanco'))?.cantidad || 0;
        datosSheet["Total de TAPASOL SHELL/QUALID entregados:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('tapasol'))?.cantidad || 0;
        datosSheet["Total de GLOBOS SHELL entregados:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('globo'))?.cantidad || 0;
        datosSheet["Total de VASOS SHELL entregados:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('vaso'))?.cantidad || 0;
        datosSheet["Total de AGENDAS entregadas:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('agenda'))?.cantidad || 0;
        datosSheet["Total de REVISTAS entregadas:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('revista'))?.cantidad || 0;
        datosSheet["Total de BOLSAS TIPO BOUTIQUE VERTICAL  entregadas:"] = entregablesShell.find((e: any) => e.tipo?.toLowerCase().includes('boutique') && e.tipo?.toLowerCase().includes('vertical'))?.cantidad || 0;

        // ✅ ENTREGABLES QUALID
        const entregablesQualid = datosAcumulados.entregablesQualid || [];
        datosSheet["Total de BOLSAS QUALID PARA CARRO entregadas:"] = entregablesQualid.find((e: any) => e.tipo?.toLowerCase().includes('bolsa') && e.tipo?.toLowerCase().includes('carro'))?.cantidad || 0;
        datosSheet["Total de ESPONJAS QUALID entregadas:"] = entregablesQualid.find((e: any) => e.tipo?.toLowerCase().includes('esponja'))?.cantidad || 0;
        datosSheet["Total de GLOBOS QUALID entregadas:"] = entregablesQualid.find((e: any) => e.tipo?.toLowerCase().includes('globo'))?.cantidad || 0;
        datosSheet["Total de GORRA QUALID entregadas:"] = entregablesQualid.find((e: any) => e.tipo?.toLowerCase().includes('gorra'))?.cantidad || 0;
        datosSheet["Total de LLAVERO CAUCHO QUALID entregadas:"] = entregablesQualid.find((e: any) => e.tipo?.toLowerCase().includes('llavero') && e.tipo?.toLowerCase().includes('caucho'))?.cantidad || 0;
        datosSheet["Total de LLAVEROS DE TELA QUALID entregadas:"] = entregablesQualid.find((e: any) => e.tipo?.toLowerCase().includes('llavero') && e.tipo?.toLowerCase().includes('tela'))?.cantidad || 0;
        datosSheet["Total de PAÑOS QUALID entregadas:"] = entregablesQualid.find((e: any) => e.tipo?.toLowerCase().includes('paño'))?.cantidad || 0;
        datosSheet["Total de VASOS QUALID (total ambos colores) entregadas:"] = entregablesQualid.find((e: any) => e.tipo?.toLowerCase().includes('vaso'))?.cantidad || 0;

        // ✅ VENTAS SHELL
        const ventasShell = datosAcumulados.ventasShellDetalladas || {};
        datosSheet["¿Se reportó venta de productos SHELL?"] = datosAcumulados.huboVentasShell ? 'Sí' : 'No';
        datosSheet["Total en litros de SHELL ADVANCE vendidos:"] = ventasShell.advance || 0;
        datosSheet["Total en litros de SHELL HELIX HX5 vendidos:"] = ventasShell.helixHX5 || 0;
        datosSheet["Total en litros de SHELL HELIX HX7 vendidos:"] = ventasShell.helixHX7 || 0;
        datosSheet["Total en litros de SHELL HELIX HX8 vendidos:"] = ventasShell.helixHX8 || 0;
        datosSheet["Total en litros de SHELL HELIX ULTRA vendidos:"] = ventasShell.helixUltra || 0;
        datosSheet["Total en litros de SHELL RIMULA vendidos:"] = ventasShell.rimula || 0;
        datosSheet["Total en litros de SHELL SPIRAX vendidos:"] = ventasShell.spirax || 0;
        datosSheet["Total en cartuchos de SHELL GADUS vendidos:"] = ventasShell.gadus || 0;
        datosSheet["Total en litros de OTROS vendidos:"] = ventasShell.otros || 0;

        // ✅ VENTAS QUALID
        const ventasQualid = datosAcumulados.ventasQualidDetalladas || {};
        datosSheet["¿Se reportó venta de productos QUALID?"] = datosAcumulados.huboVentasQualid ? 'Sí' : 'No';
        datosSheet["Total en litros de QUALID FLUIDOS vendidos:"] = ventasQualid.fluidos || 0;
        datosSheet["Total en unidades de QUALID SPRAY vendido:"] = ventasQualid.spray || 0;
        datosSheet["Total en unidades de QUALID FILTRO AUTOMOTRIZ vendidos:"] = ventasQualid.filtroAutomotriz || 0;
        datosSheet["Total en unidades de productos QUALID SERVICIO PESADO vendidos:"] = ventasQualid.servicioPesado || 0;
        datosSheet["Total en unidades de CAUCHOS QUALID vendidos:"] = ventasQualid.cauchos || 0;

        // ✅ OBSERVACIONES FINALES
        datosSheet["Añade aquí todos los detalles de producto faltante por familia de productos SHELL "] = reporteShellFaltante || 'No reportado';
        datosSheet["Añade aquí todos los detalles de producto faltante por familia de productos QUALID "] = reporteQualidFaltante || 'No reportado';
        datosSheet["Añade aquí todos tus comentarios y observaciones adicionales "] = reporteComentariosAdicionales || 'No reportado';

      } else {
        // 🔄 FORMATO ORIGINAL PARA MERCHANDISING
        console.log('🔄 USANDO FORMATO MERCHANDISING ORIGINAL');

        // ✅ SEÑALIZACIÓN (aceptar 'Yes'|'No' y booleanos) con fallback desde clienteData
        console.log('🚩 DEBUGGING SEÑALIZACIÓN EN REPORTES-FINALES:');
        console.log('🚩 datosAcumulados.hasSignage:', datosAcumulados.hasSignage);
        console.log('🚩 datosAcumulados.clienteData?.hasSignage:', datosAcumulados.clienteData?.hasSignage);
        console.log('🚩 datosAcumulados.cliente?.hasSignage:', datosAcumulados.cliente?.hasSignage);
        
        // ✅ LÓGICA MEJORADA: Priorizar datosAcumulados.hasSignage, luego clienteData.hasSignage
        const hs = (datosAcumulados.hasSignage !== undefined && datosAcumulados.hasSignage !== null && datosAcumulados.hasSignage !== '')
          ? datosAcumulados.hasSignage
          : (datosAcumulados.clienteData?.hasSignage !== undefined && datosAcumulados.clienteData?.hasSignage !== null && datosAcumulados.clienteData?.hasSignage !== '')
            ? datosAcumulados.clienteData.hasSignage
            : (datosAcumulados.cliente?.hasSignage ?? undefined);
        
        console.log('🚩 Valor final de hasSignage (hs):', hs);
        
        let hasSignageStr = 'No respondido';
        if (hs === 'Yes' || hs === true) hasSignageStr = 'Sí';
        else if (hs === 'No' || hs === false) hasSignageStr = 'No';
        
        console.log('🚩 hasSignageStr final:', hasSignageStr);
        datosSheet["¿El cliente posee señalización?"] = hasSignageStr;
      
      // ✅ MAPEAR FOTOS DE FIREBASE STORAGE A CAMPOS ESPECÍFICOS
      // (Las variables se declararán DESPUÉS de que fotosUrls esté poblado)

      datosSheet["Foto de la señalización"] = 'Pendiente de mapeo'; // Se actualizará después

      // ✅ MERCHANDISING SHELL - PLANOGRAMA
      if (datosAcumulados.shellMerchandising) {
        const shell = datosAcumulados.shellMerchandising;
        datosSheet["¿Hiciste Planograma SHELL?"] = shell.hicistePlanogramaShell ? 'Sí' : 'No';
        datosSheet["Foto \"Antes\" del Planograma Shell"] = 'Pendiente de mapeo'; // Se actualizará después
        datosSheet["Foto \"Después\" del Planograma Shell"] = 'Pendiente de mapeo'; // Se actualizará después
        
        // STICKERS PUNTO DE VENTA
        datosSheet["¿El cliente tiene STICKER PUNTO DE VENTA AUTORIZADO SHELL?"] = shell.cantidadStickersAutorizados > 0 ? 'Sí' : 'No';
        datosSheet["¿Colocaste STICKER PUNTO DE VENTA AUTORIZADO SHELL?"] = shell.cantidadStickersNuevos > 0 ? 'Sí' : 'No';
        datosSheet["Foto del STICKER PUNTO DE VENTA AUTORIZADO SHELL:"] = 'Pendiente de mapeo'; // Se actualizará después
        
        // MATERIALES SHELL
        datosSheet["Total de CENEFAS SHELL colocadas:"] = shell.totalCenefasShell || 0;
        datosSheet["Total de PAPEL BOBINA SHELL colocado en metros:"] = shell.totalPapelBobinaShell || 0;
        datosSheet["Total de STICKERS SHELL CAMBIO DE LUBRICANTE entregados:"] = shell.totalStickersShellCambio || 0;
        datosSheet["Total de AMBIENTADORES SHELL PARA VEHÍCULO entregados:"] = shell.totalAmbientadoresShell || 0;
        datosSheet["Total de BOLSAS SHELL PARA CARRO entregadas:"] = shell.totalBolsasShell || 0;
      } else {
        // Valores predeterminados si no hay datos de merchandising Shell
        datosSheet["¿Hiciste Planograma SHELL?"] = 'No respondido';
        datosSheet["Foto \"Antes\" del Planograma Shell"] = 'No capturada';
        datosSheet["Foto \"Después\" del Planograma Shell"] = 'No capturada';
        datosSheet["¿El cliente tiene STICKER PUNTO DE VENTA AUTORIZADO SHELL?"] = 'No respondido';
        datosSheet["¿Colocaste STICKER PUNTO DE VENTA AUTORIZADO SHELL?"] = 'No respondido';
        datosSheet["Foto del STICKER PUNTO DE VENTA AUTORIZADO SHELL:"] = 'No capturada';
        datosSheet["Total de CENEFAS SHELL colocadas:"] = 0;
        datosSheet["Total de PAPEL BOBINA SHELL colocado en metros:"] = 0;
        datosSheet["Total de STICKERS SHELL CAMBIO DE LUBRICANTE entregados:"] = 0;
        datosSheet["Total de AMBIENTADORES SHELL PARA VEHÍCULO entregados:"] = 0;
        datosSheet["Total de BOLSAS SHELL PARA CARRO entregadas:"] = 0;
      }

      // ✅ MATERIAL INTERNO SHELL - EXHIBIDORES
      if (datosAcumulados.shellMaterialInterno) {
        const material = datosAcumulados.shellMaterialInterno;
        datosSheet["¿El cliente tiene EXHIBIDORES SHELL?"] = material.tieneExhibidoresShell ? 'Sí' : 'No';
        datosSheet["De tener EXHIBIDORES SHELL, adjunta aquí la foto:"] = 'Pendiente de mapeo'; // Se actualizará después
        
        // AFICHES SHELL ESPECÍFICOS (mapear a headers exactos)
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA FERRARI 2023]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA HX8]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA PRODUCTOS PREMIUM 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA SHELL FAMILIA 2023]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA SHELL HX7 10W-40]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA TABLA DE APLICACION SHELL]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE CAMPAÑA SHELL GADUS 2021]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL HELIX]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL RIMULA]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL ADVANCE]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL 5W-30]"] = 0;
        
        // Mapear afiches que tengamos guardados a las categorías específicas
        if (material.afichesColocadosShell && material.afichesColocadosShell.length > 0) {
          material.afichesColocadosShell.forEach((afiche: any) => {
            const tipo = afiche.tipo?.toLowerCase() || '';
            const cantidad = afiche.cantidad || 0;
            
            // Mapeo inteligente basado en el tipo de afiche
            if (tipo.includes('ferrari')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA FERRARI 2023]"] = cantidad;
            } else if (tipo.includes('hx8')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA HX8]"] = cantidad;
            } else if (tipo.includes('premium')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA PRODUCTOS PREMIUM 2024]"] = cantidad;
            } else if (tipo.includes('familia')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA SHELL FAMILIA 2023]"] = cantidad;
            } else if (tipo.includes('hx7')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA SHELL HX7 10W-40]"] = cantidad;
            } else if (tipo.includes('tabla') || tipo.includes('aplicacion')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA TABLA DE APLICACION SHELL]"] = cantidad;
            } else if (tipo.includes('gadus')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE CAMPAÑA SHELL GADUS 2021]"] = cantidad;
            } else if (tipo.includes('helix')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL HELIX]"] = cantidad;
            } else if (tipo.includes('rimula')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL RIMULA]"] = cantidad;
            } else if (tipo.includes('advance')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL ADVANCE]"] = cantidad;
            } else if (tipo.includes('5w-30')) {
              datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL 5W-30]"] = cantidad;
            }
          });
        }
        
        datosSheet["Fotos de los AFICHES SHELL colocados:"] = 'Pendiente de mapeo'; // Se actualizará después
        
        // BANDERINES SHELL
        datosSheet["¿Colocaste TIRA DE BANDERINES SHELL?"] = material.colocoBanderinesShell ? 'Sí' : 'No';
        datosSheet["Total de TIRA DE BANDERINES SHELL colocadas:"] = material.cantidadTirasBanderinesShell || 0;
        datosSheet["Fotos de los BANDERINES SHELL colocados:"] = 'Pendiente de mapeo'; // Se actualizará después
        
        // AVISO ACRÍLICO SHELL
        datosSheet["¿El cliente tiene AVISO ACRÍLICO PARA EXTERIORES SHELL?"] = material.colocoAvisoAcrilicoShell ? 'Sí' : 'No';
        datosSheet["Foto del AVISO ACRÍLICO PARA EXTERIORES SHELL colocado:"] = 'Pendiente de mapeo'; // Se actualizará después
        } else {
        // Valores predeterminados para material interno Shell
        datosSheet["¿El cliente tiene EXHIBIDORES SHELL?"] = 'No respondido';
        datosSheet["De tener EXHIBIDORES SHELL, adjunta aquí la foto:"] = 'No capturada';
        
        // Todos los afiches Shell con valor 0
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA FERRARI 2023]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA HX8]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA PRODUCTOS PREMIUM 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA SHELL FAMILIA 2023]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA SHELL HX7 10W-40]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHES CAMPAÑA TABLA DE APLICACION SHELL]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE CAMPAÑA SHELL GADUS 2021]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL HELIX]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL RIMULA]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL ADVANCE]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES SHELL? [AFICHE SHELL 5W-30]"] = 0;
        datosSheet["Fotos de los AFICHES SHELL colocados:"] = 'No capturada';
        
        datosSheet["¿Colocaste TIRA DE BANDERINES SHELL?"] = 'No respondido';
        datosSheet["Total de TIRA DE BANDERINES SHELL colocadas:"] = 0;
        datosSheet["Fotos de los BANDERINES SHELL colocados:"] = 'No capturada';
        
        datosSheet["¿El cliente tiene AVISO ACRÍLICO PARA EXTERIORES SHELL?"] = 'No respondido';
        datosSheet["Foto del AVISO ACRÍLICO PARA EXTERIORES SHELL colocado:"] = 'No capturada';
      }

      // ✅ MERCHANDISING QUALID
      if (datosAcumulados.qualidMerchandising) {
        const qualid = datosAcumulados.qualidMerchandising;
        datosSheet["¿Colocaste Material Qualid?"] = 'Sí'; // Si hay datos de Qualid, es porque sí colocó material
        datosSheet["¿Hiciste Planograma Qualid?"] = 'No especificado'; // No tenemos este dato específico
        datosSheet["Foto del antes del Planograma Qualid"] = 'Pendiente de mapeo'; // Se actualizará después
        datosSheet["Foto del después del Planograma Qualid"] = 'Pendiente de mapeo'; // Se actualizará después
        
        // MATERIALES QUALID
        datosSheet["Total de CENEFAS QUALID colocadas:"] = qualid.totalCenefasQualid || 0;
        datosSheet["Total de BOLSAS QUALID PARA CARRO ENTREGADAS:"] = qualid.totalBolsasQualid || 0;
        
        // AFICHES QUALID ESPECÍFICOS (mapear a headers exactos)
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA FILTROS Y FLUIDOS 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CAUCHO 2023]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CAUCHO 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CUIDADO AUTOMOTRIZ 2022]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID FF 2022]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID FILTROS 2022]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID MANTENIMIENTO 2022]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA CROSS REFERENCE SERVICIO PESADO 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA DE APLICACIÓN]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA DE FILTRO AUTOMOTRIZ 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHE QUALID FILTROS AUTOMOTRIZ]"] = 0;
        
        // Mapear afiches que tengamos guardados a las categorías específicas
        if (qualid.afichesColocadosQualid && qualid.afichesColocadosQualid.length > 0) {
          qualid.afichesColocadosQualid.forEach((afiche: any) => {
            const tipo = afiche.tipo?.toLowerCase() || '';
            const cantidad = afiche.cantidad || 0;
            
            // Mapeo inteligente basado en el tipo de afiche Qualid
            if (tipo.includes('filtros') && tipo.includes('fluidos') && tipo.includes('2024')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA FILTROS Y FLUIDOS 2024]"] = cantidad;
            } else if (tipo.includes('caucho') && tipo.includes('2023')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CAUCHO 2023]"] = cantidad;
            } else if (tipo.includes('caucho') && tipo.includes('2024')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CAUCHO 2024]"] = cantidad;
            } else if (tipo.includes('cuidado') && tipo.includes('automotriz')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CUIDADO AUTOMOTRIZ 2022]"] = cantidad;
            } else if (tipo.includes('ff') && tipo.includes('2022')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID FF 2022]"] = cantidad;
            } else if (tipo.includes('filtros') && tipo.includes('2022')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID FILTROS 2022]"] = cantidad;
            } else if (tipo.includes('mantenimiento')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID MANTENIMIENTO 2022]"] = cantidad;
            } else if (tipo.includes('cross') || tipo.includes('servicio pesado')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA CROSS REFERENCE SERVICIO PESADO 2024]"] = cantidad;
            } else if (tipo.includes('tabla') && tipo.includes('aplicación')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA DE APLICACIÓN]"] = cantidad;
            } else if (tipo.includes('tabla') && tipo.includes('filtro') && tipo.includes('automotriz')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA DE FILTRO AUTOMOTRIZ 2024]"] = cantidad;
            } else if (tipo.includes('filtros automotriz')) {
              datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHE QUALID FILTROS AUTOMOTRIZ]"] = cantidad;
            }
          });
        }
        
        datosSheet["Fotos de los AFICHES QUALID colocados:"] = 'Pendiente de mapeo'; // Se actualizará después
        
        // EXHIBIDORES DE CAUCHO QUALID
        const tieneExhibidores = qualid.exhibidoresCauchoQualid && qualid.exhibidoresCauchoQualid.length > 0;
        datosSheet["¿Colocaste EXHIBIDORES DE CAUCHOS QUALID?"] = tieneExhibidores ? 'Sí' : 'No';
        
        let totalPequeño = 0;
        let totalGrande = 0;
        
        if (tieneExhibidores) {
          qualid.exhibidoresCauchoQualid.forEach((exhibidor: any) => {
            const tipo = exhibidor.tipo?.toLowerCase() || '';
            const cantidad = exhibidor.cantidad || 0;
            
            if (tipo.includes('pequeño')) {
              totalPequeño += cantidad;
            } else if (tipo.includes('grande')) {
              totalGrande += cantidad;
        } else {
              // Si no especifica, asumimos pequeño por defecto
              totalPequeño += cantidad;
            }
          });
        }
        
        datosSheet["Total de EXHIBIDOR DE CAUCHO PEQUEÑO colocado:"] = totalPequeño;
        datosSheet["Total de EXHIBIDORES DE CAUCHO GRANDE colocado:"] = totalGrande;
        datosSheet["Foto de EXHIBIDORES DE CAUCHOS QUALID colocados:"] = 'Pendiente de mapeo'; // Se actualizará después
      } else {
        // Valores predeterminados para Qualid
        datosSheet["¿Colocaste Material Qualid?"] = 'No';
        datosSheet["¿Hiciste Planograma Qualid?"] = 'No';
        datosSheet["Foto del antes del Planograma Qualid"] = 'No capturada';
        datosSheet["Foto del después del Planograma Qualid"] = 'No capturada';
        datosSheet["Total de CENEFAS QUALID colocadas:"] = 0;
        datosSheet["Total de BOLSAS QUALID PARA CARRO ENTREGADAS:"] = 0;
        
        // Todos los afiches Qualid con valor 0
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA FILTROS Y FLUIDOS 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CAUCHO 2023]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CAUCHO 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID CUIDADO AUTOMOTRIZ 2022]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID FF 2022]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID FILTROS 2022]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID MANTENIMIENTO 2022]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA CROSS REFERENCE SERVICIO PESADO 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA DE APLICACIÓN]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHES CAMPAÑA QUALID TABLA DE FILTRO AUTOMOTRIZ 2024]"] = 0;
        datosSheet["¿Cuáles y cuantos AFICHES QUALID? [AFICHE QUALID FILTROS AUTOMOTRIZ]"] = 0;
        datosSheet["Fotos de los AFICHES QUALID colocados:"] = 'No capturada';
        
        datosSheet["¿Colocaste EXHIBIDORES DE CAUCHOS QUALID?"] = 'No';
        datosSheet["Total de EXHIBIDOR DE CAUCHO PEQUEÑO colocado:"] = 0;
        datosSheet["Total de EXHIBIDORES DE CAUCHO GRANDE colocado:"] = 0;
        datosSheet["Foto de EXHIBIDORES DE CAUCHOS QUALID colocados:"] = 'No capturada';
      }

      // ✅ REPORTES FINALES (headers exactos del Google Sheet)
      datosSheet["Coloca aquí tus observaciones de producto faltante y cualquier comentario adicional para la cartera de productos SHELL:"] = reporteShellFaltante.trim() || 'Sin observaciones';
              datosSheet["Coloca aquí tus observaciones de producto faltante y cualquier comentario adicional para la cartera de productos QUALID:"] = reporteQualidFaltante.trim() || 'Sin observaciones';
        datosSheet["Añade aquí todos tus comentarios y observaciones adicionales"] = reporteComentariosAdicionales.trim() || 'Sin comentarios adicionales';
      } // Cierre del bloque else (merchandising)
      
      console.log('📊 ESTRUCTURA FINAL datosSheet con headers exactos:');
      console.log('🎯 Total de campos mapeados:', Object.keys(datosSheet).length);
      console.log('✅ Todos los datos mapeados a headers del Google Sheet');

      // ✅ CORRECCIÓN: ESTRATEGIA DE ENVÍO UNIFICADA
      console.log('=== INICIANDO ENVÍO UNIFICADO CORRECTO ===');
      
      // 📤 PASO 1: Subir imágenes a Firebase Storage (obtener URLs)
      let fotosUrls: string[] = [];
      
      if (Object.keys(fotosComprimidas).length > 0) {
        console.log('📤 Subiendo imágenes a Firebase Storage...');
        
        try {
          // Preparar imágenes para subir
          const imagesToUpload = Object.entries(fotosComprimidas).map(([key, base64], index) => ({
            base64: base64,
            path: `visitas/${cliente.rif}/${Date.now()}`,
            prefix: `${key}_${index}`
          }));
          
          // Subir todas las imágenes y obtener URLs
          fotosUrls = await uploadMultipleImages(imagesToUpload);
          console.log(`✅ ${fotosUrls.length} imágenes subidas a Firebase Storage`);
          
          // ✅ AHORA MAPEAR FOTOS A datosSheet DIRECTAMENTE (después de que fotosUrls esté lleno)
          console.log('🎯 Mapeando URLs de Firebase Storage a campos específicos...');
          console.log('📊 Claves disponibles en fotosComprimidas:', Object.keys(fotosComprimidas));
          console.log('📊 Total fotosUrls recibidas:', fotosUrls.length);
          console.log('📊 URLs de Firebase:', fotosUrls);
          
          // ✅ FUNCIÓN HELPER PARA MAPEO SEGURO (toma el primer match disponible)
          const mapearFoto = (claveComprimida: string, nombreCampo: string) => {
            const claves = Object.keys(fotosComprimidas);
            let indice = claves.indexOf(claveComprimida);
            
            // ✅ BÚSQUEDA ROBUSTA PARA SEÑALIZACIÓN
            if (indice === -1 && (claveComprimida === 'foto_signage' || claveComprimida === 'foto_senalizacion')) {
              // Buscar ambas variantes
              indice = claves.indexOf('foto_senalizacion');
              if (indice === -1) {
                indice = claves.indexOf('foto_signage');
              }
            }
            
            const url = fotosUrls[indice];
            console.log(`🔍 Mapeando "${nombreCampo}": clave="${claveComprimida}" índice=${indice} url=${url ? 'ENCONTRADA' : 'NO ENCONTRADA'}`);
            if (indice === -1) {
              console.log(`   - Claves disponibles:`, Object.keys(fotosComprimidas));
            }
            return url || 'No capturada';
          };
          
          // ✅ ACTUALIZAR CAMPOS CON URLs REALES usando función helper
          if (esTradeImpulsoOEventos) {
            // 🎯 MAPEO ESPECÍFICO PARA TRADE IMPULSO/EVENTOS
            console.log('🎯 MAPEANDO FOTOS PARA TRADE IMPULSO/EVENTOS');
            console.log('🚀 CÓDIGO ACTUALIZADO - VERSIÓN CORREGIDA EJECUTÁNDOSE');
            
            // 🔧 CORRECCIÓN: Mapear fotos según la marca seleccionada
            const marcaSeleccionada = datosAcumulados.marca;
            console.log('🔧 Marca seleccionada para mapeo:', marcaSeleccionada);
            console.log('🔧 Claves disponibles en fotosComprimidas:', Object.keys(fotosComprimidas));
            
            if (marcaSeleccionada === 'Shell') {
              console.log('✅ EJECUTANDO MAPEO PARA SHELL');
              // Para Shell, usar las fotos generales en los campos de Shell
              datosSheet["Fotos del impulso o evento SHELL:"] = mapearFoto('foto_impulso', 'Impulso Shell');
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento SHELL:"] = mapearFoto('foto_promotoras', 'Promotoras Shell');
              datosSheet["Fotos del impulso o evento QUALID:"] = 'No capturada';
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento QUALID:"] = 'No capturada';
            } else if (marcaSeleccionada === 'Qualid') {
              console.log('✅ EJECUTANDO MAPEO PARA QUALID');
              // Para Qualid, usar las fotos generales en los campos de Qualid
              datosSheet["Fotos del impulso o evento SHELL:"] = 'No capturada';
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento SHELL:"] = 'No capturada';
              datosSheet["Fotos del impulso o evento QUALID:"] = mapearFoto('foto_impulso', 'Impulso Qualid');
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento QUALID:"] = mapearFoto('foto_promotoras', 'Promotoras Qualid');
            } else {
              // Fallback: intentar mapear todas las posibilidades
              console.log('⚠️ Marca no reconocida, usando fallback');
              datosSheet["Fotos del impulso o evento SHELL:"] = mapearFoto('foto_impulso_shell', 'Impulso Shell') || mapearFoto('foto_impulso', 'Impulso General');
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento SHELL:"] = mapearFoto('foto_promotoras_shell', 'Promotoras Shell') || mapearFoto('foto_promotoras', 'Promotoras General');
              datosSheet["Fotos del impulso o evento QUALID:"] = mapearFoto('foto_impulso_qualid', 'Impulso Qualid');
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento QUALID:"] = mapearFoto('foto_promotoras_qualid', 'Promotoras Qualid');
            }
            
            console.log('🎯 MAPEO COMPLETADO - VERIFICANDO RESULTADOS:');
            console.log('  - Fotos Shell:', datosSheet["Fotos del impulso o evento SHELL:"]);
            console.log('  - Promotoras Shell:', datosSheet["Fotos de las promotoras con los clientes en el impulso o evento SHELL:"]);
          } else {
            // 🔄 MAPEO ORIGINAL PARA MERCHANDISING (incluye señalización)
            console.log('🔄 MAPEANDO FOTOS PARA MERCHANDISING');
            datosSheet["Foto de la señalización"] = mapearFoto('foto_senalizacion', 'Señalización');
            datosSheet["Foto \"Antes\" del Planograma Shell"] = mapearFoto('foto_antes_planograma', 'Planograma Antes');
            datosSheet["Foto \"Después\" del Planograma Shell"] = mapearFoto('foto_despues_planograma', 'Planograma Después');
            datosSheet["Foto del STICKER PUNTO DE VENTA AUTORIZADO SHELL:"] = mapearFoto('foto_sticker_shell', 'Sticker Shell');
            datosSheet["De tener EXHIBIDORES SHELL, adjunta aquí la foto:"] = mapearFoto('foto_exhibidores_shell', 'Exhibidores Shell');
            datosSheet["Fotos de los AFICHES SHELL colocados:"] = mapearFoto('foto_afiches_shell', 'Afiches Shell');
            datosSheet["Fotos de los BANDERINES SHELL colocados:"] = mapearFoto('foto_banderines_shell', 'Banderines Shell');
            datosSheet["Foto del AVISO ACRÍLICO PARA EXTERIORES SHELL colocado:"] = mapearFoto('foto_aviso_acrilico_shell', 'Aviso Acrílico Shell');
            datosSheet["Foto del antes del Planograma Qualid"] = mapearFoto('foto_antes_planograma_qualid', 'Planograma Antes Qualid');
            datosSheet["Foto del después del Planograma Qualid"] = mapearFoto('foto_despues_planograma_qualid', 'Planograma Después Qualid');
            datosSheet["Fotos de los AFICHES QUALID colocados:"] = mapearFoto('foto_afiches_qualid', 'Afiches Qualid');
            datosSheet["Foto de EXHIBIDORES DE CAUCHOS QUALID colocados:"] = mapearFoto('foto_exhibidores_caucho_qualid', 'Exhibidores Qualid');
          }
          
        } catch (error) {
          console.error('❌ Error subiendo imágenes a Firebase Storage:', error);
          
          // 🚨 SOLUCIÓN TEMPORAL: Continuar sin imágenes pero guardar datos
          console.log('🔄 Continuando sin imágenes debido a error CORS/Firebase Storage');
          
          // ✅ Marcar campos específicos como "Error de subida" para consistencia
          if (esTradeImpulsoOEventos) {
            // 🎯 CAMPOS DE ERROR PARA TRADE IMPULSO/EVENTOS
            // 🔧 CORRECCIÓN: Aplicar error según la marca seleccionada
            const marcaSeleccionada = datosAcumulados.marca;
            
            if (marcaSeleccionada === 'Shell') {
              datosSheet["Fotos del impulso o evento SHELL:"] = 'Error de subida';
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento SHELL:"] = 'Error de subida';
              datosSheet["Fotos del impulso o evento QUALID:"] = 'No capturada';
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento QUALID:"] = 'No capturada';
            } else if (marcaSeleccionada === 'Qualid') {
              datosSheet["Fotos del impulso o evento SHELL:"] = 'No capturada';
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento SHELL:"] = 'No capturada';
              datosSheet["Fotos del impulso o evento QUALID:"] = 'Error de subida';
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento QUALID:"] = 'Error de subida';
            } else {
              // Fallback: marcar todos como error
              datosSheet["Fotos del impulso o evento SHELL:"] = 'Error de subida';
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento SHELL:"] = 'Error de subida';
              datosSheet["Fotos del impulso o evento QUALID:"] = 'Error de subida';
              datosSheet["Fotos de las promotoras con los clientes en el impulso o evento QUALID:"] = 'Error de subida';
            }
          } else {
            // 🔄 CAMPOS DE ERROR PARA MERCHANDISING
            datosSheet["Foto de la señalización"] = 'Error de subida';
            datosSheet["Foto \"Antes\" del Planograma Shell"] = 'Error de subida';
            datosSheet["Foto \"Después\" del Planograma Shell"] = 'Error de subida';
            datosSheet["Foto del STICKER PUNTO DE VENTA AUTORIZADO SHELL:"] = 'Error de subida';
            datosSheet["De tener EXHIBIDORES SHELL, adjunta aquí la foto:"] = 'Error de subida';
            datosSheet["Fotos de los AFICHES SHELL colocados:"] = 'Error de subida';
            datosSheet["Fotos de los BANDERINES SHELL colocados:"] = 'Error de subida';
            datosSheet["Foto del AVISO ACRÍLICO PARA EXTERIORES SHELL colocado:"] = 'Error de subida';
            datosSheet["Foto del antes del Planograma Qualid"] = 'Error de subida';
            datosSheet["Foto del después del Planograma Qualid"] = 'Error de subida';
            datosSheet["Fotos de los AFICHES QUALID colocados:"] = 'Error de subida';
            datosSheet["Foto de EXHIBIDORES DE CAUCHOS QUALID colocados:"] = 'Error de subida';
          }
          
          toast({
            variant: 'destructive',
            title: 'Error subiendo imágenes',
            description: 'Se guardará la visita sin imágenes debido a problema técnico. Los datos están seguros.',
          });
        }
      }

      // 📝 PASO 2: UN SOLO ENVÍO con datos + URLs de imágenes
      const respuestasCompletas: any = {
        observacionesAdicionales: `Formulario completo - ${Object.keys(datosSheet).length} campos + ${fotosUrls.length} imágenes`,
        datosSheet: datosSheet, // Ya incluye URLs de imágenes
        fotos: fotosUrls, // URLs de Firebase Storage (no base64)
        totalImagenes: fotosUrls.length
      };

      console.log('📝 ENVÍO ÚNICO - Enviando datos completos con imágenes...');
      console.log('🎯 Total de campos en datosSheet:', Object.keys(datosSheet).length);
      console.log('📸 Total de imágenes (URLs):', fotosUrls.length);

      // 🚀 ENVIAR UN SOLO REGISTRO COMPLETO
      // ✅ UBICACIÓN: usar cliente.position válido, si no, clienteData.position
      console.log('🗺️ DEBUGGING GPS EN REPORTES-FINALES:');
      console.log('🗺️ cliente.position:', cliente.position);
      console.log('🗺️ datosAcumulados.clienteData?.position:', datosAcumulados.clienteData?.position);
      console.log('🗺️ cliente.position es válido?:', cliente.position && !(cliente.position.lat === 0 && cliente.position.lng === 0));
      
      const posPreferida = (cliente.position && !(cliente.position.lat === 0 && cliente.position.lng === 0))
        ? cliente.position
        : (datosAcumulados.clienteData?.position || cliente.position || { lat: 0, lng: 0 });
      
      console.log('🗺️ POSICIÓN PREFERIDA FINAL:', posPreferida);

      const visitaId = await crearVisita({
        rifCliente: cliente.rif,
        nombreEstablecimiento: cliente.nombre,
        tipoVisita: datosAcumulados.tipoVisita,
        mercaderista: mercaderista,
        correoMercaderista: correoMercaderista,
        ubicacion: posPreferida,
        sucursal: cliente.sede,
        respuestas: respuestasCompletas,
        observacionesAdicionales: `Formulario ${datosAcumulados.tipoVisita} completado con ${fotosUrls.length} imágenes`,
        datosN8N: {
          datosSheet: datosSheet,
          fotos: fotosUrls, // URLs de Firebase, no base64
          tipoVisita: datosAcumulados.tipoVisita,
          mercaderista: mercaderista,
          clienteInfo: {
            rif: cliente.rif,
            nombre: cliente.nombre,
            sucursal: cliente.sede
          }
        }
      });

      console.log('✅ ENVÍO ÚNICO COMPLETADO - Visita guardada correctamente');
      console.log('🆔 ID de visita única:', visitaId);
      console.log('📊 Registro completo con datos + URLs de imágenes');

      // Limpiar localStorage
      localStorage.removeItem('clienteData');
      localStorage.removeItem('datosFormularioCompleto');

      toast({
        title: '✅ Trade Guardado Exitosamente',
        description: `📊 Datos e imágenes enviados en 1 solicitud única. ID: ${visitaId}`,
      });

      // Navegar a la página de éxito
      router.push('/registro-exitoso');
      
    } catch (error) {
      console.error('Error guardando trade completo:', error);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar Trade',
        description: 'Hubo un problema enviando los datos. Intente nuevamente.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

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
                backgroundImage: 'linear-gradient(to right, #fbce04, #e30a18)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Reportes Finales
            </span>
          </CardTitle>
          <CardDescription>
            Complete los reportes finales antes de finalizar la visita.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Sección 13: Reporte de producto faltante SHELL */}
          <div className="space-y-2">
            <div className="bg-yellow-50 p-2 rounded-md border-l-4 border-yellow-400">
              <Label className="text-sm font-semibold text-yellow-800">Sección 13 de 15</Label>
            </div>
            <Label htmlFor="reporte-shell-faltante" className="text-sm font-medium">
              Reporte de producto faltante de las familias SHELL
            </Label>
            <p className="text-xs text-muted-foreground">Descripción (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Añade aquí todos los detalles de producto faltante por familia de productos SHELL
            </p>
            <Textarea
              id="reporte-shell-faltante"
              value={reporteShellFaltante}
              onChange={(e) => setReporteShellFaltante(e.target.value)}
              placeholder="Escriba su reporte de productos SHELL faltantes..."
              disabled={isSyncing}
              className="mt-1 min-h-[80px]"
              rows={4}
            />
          </div>

          {/* Sección 14: Reporte de producto faltante QUALID */}
          <div className="space-y-2">
            <div className="bg-yellow-50 p-2 rounded-md border-l-4 border-yellow-400">
              <Label className="text-sm font-semibold text-yellow-800">Sección 14 de 15</Label>
            </div>
            <Label htmlFor="reporte-qualid-faltante" className="text-sm font-medium">
              Reporte de producto faltante de las familias QUALID
            </Label>
            <p className="text-xs text-muted-foreground">Descripción (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Añade aquí todos los detalles de producto faltante por familia de productos QUALID
            </p>
            <Textarea
              id="reporte-qualid-faltante"
              value={reporteQualidFaltante}
              onChange={(e) => setReporteQualidFaltante(e.target.value)}
              placeholder="Escriba su reporte de productos QUALID faltantes..."
              disabled={isSyncing}
              className="mt-1 min-h-[80px]"
              rows={4}
            />
          </div>

          {/* Sección 15: Reporte de comentarios adicionales */}
          <div className="space-y-2">
            <div className="bg-yellow-50 p-2 rounded-md border-l-4 border-yellow-400">
              <Label className="text-sm font-semibold text-yellow-800">Sección 15 de 15</Label>
            </div>
            <Label htmlFor="reporte-comentarios-adicionales" className="text-sm font-medium">
              Reporte de comentarios adicionales
            </Label>
            <p className="text-xs text-muted-foreground">
              Aquí puedes dejar tus comentarios y observaciones sobre temas importantes como actividades de la competencia, presencia de nuevas marcas, etc.
            </p>
            <Textarea
              id="reporte-comentarios-adicionales"
              value={reporteComentariosAdicionales}
              onChange={(e) => setReporteComentariosAdicionales(e.target.value)}
              placeholder="Añade aquí todos tus comentarios y observaciones adicionales..."
              disabled={isSyncing}
              className="mt-1 min-h-[80px]"
              rows={4}
            />
          </div>
        </CardContent>
        
        <CardFooter>
          <Button
            onClick={handleGuardarYContinuar}
            disabled={isSyncing}
            className="w-full"
            style={{
              background: 'linear-gradient(to right, #fcce05, #ff0000)',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            {isSyncing ? 'Guardando...' : 'Guardar Reportes y Finalizar Visita'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
