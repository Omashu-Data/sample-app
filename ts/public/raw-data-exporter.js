/**
 * raw-data-exporter.js
 * Sistema para exportar todos los datos crudos de League of Legends 
 * obtenidos a través de Game Events Provider (GEP) y Live Client Data
 */

// Configuración del exportador
const RAW_DATA_EXPORTER = {
  // Intervalo de guardado automático en milisegundos (5 minutos)
  AUTOSAVE_INTERVAL: 5 * 60 * 1000,
  
  // Intervalo de recopilación de datos en milisegundos (15 segundos)
  DATA_COLLECTION_INTERVAL: 15 * 1000,
  
  // URL del servidor para enviar datos (reemplazar con la URL real)
  SERVER_ENDPOINT: "https://tu-servidor.com/api/lol-data",
  
  // Carpeta donde se guardarán los archivos
  SAVE_FOLDER: "Overwolf/lol-data",
  
  // Habilitar guardado automático
  ENABLE_AUTO_SAVE: true,
  
  // Habilitar envío automático al servidor
  ENABLE_SERVER_UPLOAD: false
};

// Clase principal del exportador de datos
class RawDataExporter {
  constructor() {
    // Datos acumulados para la sesión actual
    this.sessionData = {
      // Metadatos de la sesión
      sessionInfo: {
        startTime: new Date().toISOString(),
        gameVersion: null,
        playerName: null,
        playerRegion: null,
        matchId: null
      },
      
      // Datos capturados en intervalos regulares
      timeSeriesData: [],
      
      // Eventos importantes (kills, deaths, objectives, etc.)
      events: [],
      
      // Estado final del juego
      finalState: null
    };
    
    // Intervalos activos
    this.dataCollectionInterval = null;
    this.autoSaveInterval = null;
    
    // Referencias a las funciones vinculadas para mantener el contexto 'this'
    this.boundCollectData = this.collectData.bind(this);
    this.boundAutoSave = this.autoSaveToFile.bind(this);
    
    // Variable para trackear si el juego está en curso
    this.gameInProgress = false;
    
    // Flag para controlar si se está procesando el fin de juego
    this.isProcessingGameEnd = false;
  }
  
  /**
   * Inicializa el exportador y configura los listeners
   */
  init() {
    console.log("[RawDataExporter] Inicializando sistema de exportación de datos crudos...");
    
    // Intentar obtener referencia a gameDataManager
    if (window.gameDataManager) {
      // Suscribirse a actualizaciones de datos
      window.gameDataManager.subscribe(this.onGameDataUpdate.bind(this));
      console.log("[RawDataExporter] Suscrito a gameDataManager");
    } else {
      console.error("[RawDataExporter] No se pudo acceder a gameDataManager");
      
      // Intentar acceder desde la ventana principal
      overwolf.windows.getMainWindow(mainWindow => {
        if (mainWindow && mainWindow.gameDataManager) {
          mainWindow.gameDataManager.subscribe(this.onGameDataUpdate.bind(this));
          console.log("[RawDataExporter] Suscrito a gameDataManager desde mainWindow");
        } else {
          console.error("[RawDataExporter] No se pudo acceder a gameDataManager desde mainWindow");
        }
      });
    }
    
    // Configurar evento para detectar cuando termine la partida
    overwolf.games.events.onInfoUpdates2.addListener(this.onInfoUpdate.bind(this));
    
    // Configurar evento para detectar cuando el estado del juego cambia
    overwolf.games.onGameInfoUpdated.addListener(this.onGameInfoUpdated.bind(this));
    
    // Configurar evento para detectar cuando la ventana in_game se va a cerrar
    overwolf.windows.onStateChanged.addListener(this.onWindowStateChanged.bind(this));
    
    // Iniciar recopilación periódica de datos
    this.startDataCollection();
    
    // Iniciar guardado automático
    if (RAW_DATA_EXPORTER.ENABLE_AUTO_SAVE) {
      this.startAutoSave();
    }
    
    return this;
  }
  
  /**
   * Manejador de actualizaciones de datos del juego
   * @param {Object} gameData - Datos actualizados del juego
   */
  onGameDataUpdate(gameData) {
    // Actualizar los metadatos de la sesión si es necesario
    if (gameData.summoner && gameData.summoner.name && !this.sessionData.sessionInfo.playerName) {
      this.sessionData.sessionInfo.playerName = gameData.summoner.name;
    }
    
    if (gameData.match && gameData.match.gameMode && !this.sessionData.sessionInfo.gameMode) {
      this.sessionData.sessionInfo.gameMode = gameData.match.gameMode;
    }
    
    // Verificar si el juego está en progreso
    if (gameData.match && gameData.match.gameTime > 0) {
      if (!this.gameInProgress) {
        console.log("[RawDataExporter] Juego detectado en progreso");
        this.gameInProgress = true;
        
        // Registrar tiempo de inicio
        this.sessionData.sessionInfo.gameStartTime = new Date().toISOString();
      }
    }
    
    // Detectar eventos importantes y guardarlos con timestamp
    if (gameData.events && gameData.events.length > 0) {
      // Procesar solo nuevos eventos
      const currentEventsCount = this.sessionData.events.length;
      const newEvents = gameData.events.slice(currentEventsCount);
      
      for (const event of newEvents) {
        this.sessionData.events.push({
          ...event,
          capturedAt: new Date().toISOString()
        });
      }
    }
  }
  
  /**
   * Manejador de actualizaciones de información del juego
   * @param {Object} info - Información actualizada
   */
  onInfoUpdate(info) {
    // Detectar fin de juego
    if (info.match_info && (info.match_info.match_end === "true" || info.match_info.game_end === "true")) {
      console.log("[RawDataExporter] Fin de juego detectado por eventos");
      this.onGameEnd();
    }
  }
  
  /**
   * Manejador de eventos de estado del juego
   * @param {Object} gameInfo - Información del juego
   */
  onGameInfoUpdated(gameInfo) {
    if (gameInfo && gameInfo.gameInfo) {
      const isGameRunning = gameInfo.gameInfo.isRunning;
      
      // Si el juego estaba en progreso pero ya no está ejecutándose
      if (this.gameInProgress && !isGameRunning) {
        console.log("[RawDataExporter] Fin de juego detectado por cambio de estado del juego");
        this.onGameEnd();
      }
    }
  }
  
  /**
   * Manejador de cambios de estado de la ventana
   * @param {Object} state - Estado de la ventana
   */
  onWindowStateChanged(state) {
    // Verificar si esta es la ventana in_game y se está cerrando
    if (state && state.window_name === 'in_game') {
      if (state.window_state_ex === 'closed' || state.window_state === 'closed') {
        console.log("[RawDataExporter] Ventana in_game cerrada, realizando exportación final");
        
        // Asegurar que los datos se exportan antes de que la ventana se cierre completamente
        if (this.gameInProgress && !this.isProcessingGameEnd) {
          console.log("[RawDataExporter] Fin de juego detectado por cierre de ventana in_game");
          this.onGameEnd();
        }
      }
    }
  }
  
  /**
   * Recopila datos del juego en intervalos regulares
   */
  startDataCollection() {
    // Detener intervalo existente si lo hay
    if (this.dataCollectionInterval) {
      clearInterval(this.dataCollectionInterval);
    }
    
    // Iniciar nuevo intervalo
    this.dataCollectionInterval = setInterval(
      this.boundCollectData, 
      RAW_DATA_EXPORTER.DATA_COLLECTION_INTERVAL
    );
    
    console.log(`[RawDataExporter] Recopilación de datos iniciada (cada ${RAW_DATA_EXPORTER.DATA_COLLECTION_INTERVAL / 1000}s)`);
  }
  
  /**
   * Inicia el guardado automático de datos
   */
  startAutoSave() {
    // Detener intervalo existente si lo hay
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Iniciar nuevo intervalo
    this.autoSaveInterval = setInterval(
      this.boundAutoSave, 
      RAW_DATA_EXPORTER.AUTOSAVE_INTERVAL
    );
    
    console.log(`[RawDataExporter] Guardado automático iniciado (cada ${RAW_DATA_EXPORTER.AUTOSAVE_INTERVAL / 60000} minutos)`);
  }
  
  /**
   * Recopila datos actuales del juego y los añade a la serie temporal
   */
  collectData() {
    if (!this.gameInProgress) return;
    
    try {
      // Obtener datos actuales
      let currentData;
      
      if (window.gameDataManager && typeof window.gameDataManager.getData === 'function') {
        currentData = window.gameDataManager.getData();
      } else {
        // Intentar desde la ventana principal
        const mainWindow = overwolf.windows.getMainWindow();
        if (mainWindow && mainWindow.gameDataManager) {
          currentData = mainWindow.gameDataManager.getData();
        } else {
          console.warn("[RawDataExporter] No se pueden obtener datos actuales");
          return;
        }
      }
      
      // Añadir timestamp
      const dataPoint = {
        timestamp: new Date().toISOString(),
        gameTime: currentData.match ? currentData.match.gameTime : 0,
        data: currentData
      };
      
      // Añadir a la serie temporal
      this.sessionData.timeSeriesData.push(dataPoint);
      
      // Limitar la cantidad de puntos de datos (mantener máximo 1000 puntos)
      if (this.sessionData.timeSeriesData.length > 1000) {
        // Mantener solo la mitad más reciente para evitar crecimiento excesivo
        this.sessionData.timeSeriesData = this.sessionData.timeSeriesData.slice(-500);
      }
    } catch (error) {
      console.error("[RawDataExporter] Error al recopilar datos:", error);
    }
  }
  
  /**
   * Guarda automáticamente los datos en un archivo
   */
  autoSaveToFile() {
    if (this.sessionData.timeSeriesData.length === 0) {
      console.log("[RawDataExporter] No hay datos para guardar");
      return;
    }
    
    this.saveToFile();
  }
  
  /**
   * Guarda los datos en un archivo JSON
   * @param {string} [customFilename] - Nombre personalizado para el archivo
   * @returns {Promise<boolean>} - Éxito de la operación
   */
  saveToFile(customFilename) {
    return new Promise(async (resolve) => {
      try {
        // Verificar si hay datos para guardar
        if (this.sessionData.timeSeriesData.length === 0) {
          console.log("[RawDataExporter] No hay datos para guardar");
          resolve(false);
          return;
        }
        
        // Generar nombre del archivo
        const playerName = this.sessionData.sessionInfo.playerName || 'unknown';
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = customFilename || `lol-raw-data-${playerName}-${timestamp}.json`;
        
        // Convertir datos a JSON
        const jsonData = JSON.stringify(this.sessionData, null, 2);
        
        // Guardar archivo en Documents
        const success = await this.saveToDocuments(filename, jsonData);
        
        if (success) {
          console.log(`[RawDataExporter] Datos guardados en ${filename}`);
          resolve(true);
        } else {
          console.error(`[RawDataExporter] Error al guardar datos en ${filename}`);
          resolve(false);
        }
      } catch (error) {
        console.error("[RawDataExporter] Error al guardar datos:", error);
        resolve(false);
      }
    });
  }
  
  /**
   * Guarda datos en la carpeta Documents del usuario
   * @param {string} filename - Nombre del archivo
   * @param {string} jsonData - Datos en formato JSON
   * @returns {Promise<boolean>} - Éxito de la operación
   */
  saveToDocuments(filename, jsonData) {
    return new Promise((resolve) => {
      try {
        // Obtener carpeta Documents
        overwolf.io.getPathByType('documents', documentsPath => {
          if (!documentsPath || !documentsPath.path) {
            console.error("[RawDataExporter] No se pudo obtener la ruta a Documents");
            resolve(false);
            return;
          }
          
          // Crear carpeta si no existe
          const folderPath = `${documentsPath.path}\\${RAW_DATA_EXPORTER.SAVE_FOLDER}`;
          overwolf.io.dir.create(folderPath, createResult => {
            // Guardar archivo
            const filePath = `${folderPath}\\${filename}`;
            overwolf.io.writeFileContents(filePath, jsonData, 'UTF8', true, writeResult => {
              resolve(writeResult.success);
            });
          });
        });
      } catch (error) {
        console.error("[RawDataExporter] Error al guardar en Documents:", error);
        resolve(false);
      }
    });
  }
  
  /**
   * Envía los datos al servidor configurado
   * @returns {Promise<boolean>} - Éxito de la operación
   */
  sendToServer() {
    return new Promise((resolve) => {
      try {
        // Verificar si está habilitado el envío al servidor
        if (!RAW_DATA_EXPORTER.ENABLE_SERVER_UPLOAD) {
          console.log("[RawDataExporter] Envío al servidor deshabilitado en la configuración");
          resolve(false);
          return;
        }
        
        // Verificar si hay datos para enviar
        if (this.sessionData.timeSeriesData.length === 0) {
          console.log("[RawDataExporter] No hay datos para enviar al servidor");
          resolve(false);
          return;
        }
        
        console.log("[RawDataExporter] Enviando datos al servidor...");
        
        // Enviar datos al servidor
        fetch(RAW_DATA_EXPORTER.SERVER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.sessionData)
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("[RawDataExporter] Datos enviados con éxito al servidor:", data);
          resolve(true);
        })
        .catch(error => {
          console.error("[RawDataExporter] Error al enviar datos al servidor:", error);
          resolve(false);
        });
      } catch (error) {
        console.error("[RawDataExporter] Error al preparar datos para envío:", error);
        resolve(false);
      }
    });
  }
  
  /**
   * Acciones a realizar cuando termina el juego
   */
  onGameEnd() {
    // Evitar procesamiento múltiple
    if (this.isProcessingGameEnd) {
      console.log("[RawDataExporter] Ya se está procesando el fin de juego");
      return;
    }
    
    console.log("[RawDataExporter] Procesando fin de juego...");
    this.isProcessingGameEnd = true;
    
    // Marcar juego como terminado
    this.gameInProgress = false;
    
    // Registrar tiempo de finalización
    this.sessionData.sessionInfo.gameEndTime = new Date().toISOString();
    
    // Guardar estado final
    if (window.gameDataManager) {
      this.sessionData.finalState = window.gameDataManager.getData();
    }
    
    // Obtener datos finales antes de que la ventana se cierre
    this.collectData();
    
    // Guardar datos finales de forma sincrónica para asegurar que se complete
    // antes de que la ventana se cierre
    const exportPromise = this.saveToFile(`lol-raw-data-${this.sessionData.sessionInfo.playerName || 'unknown'}-FINAL-${new Date().toISOString().replace(/:/g, '-')}.json`);
    
    // Enviar al servidor de forma sincrónica
    exportPromise.then(() => {
      return this.sendToServer();
    })
    .then(success => {
      if (success) {
        console.log("[RawDataExporter] Datos finales enviados al servidor");
      } else {
        console.warn("[RawDataExporter] No se pudieron enviar los datos finales al servidor");
      }
      
      // Reiniciar datos para nueva sesión
      this.resetSessionData();
      this.isProcessingGameEnd = false;
    })
    .catch(error => {
      console.error("[RawDataExporter] Error durante la exportación final:", error);
      this.isProcessingGameEnd = false;
    });
  }
  
  /**
   * Reinicia los datos de la sesión
   */
  resetSessionData() {
    this.sessionData = {
      sessionInfo: {
        startTime: new Date().toISOString(),
        gameVersion: null,
        playerName: null,
        playerRegion: null,
        matchId: null
      },
      timeSeriesData: [],
      events: [],
      finalState: null
    };
    
    console.log("[RawDataExporter] Datos de sesión reiniciados");
  }
  
  /**
   * Detiene la recopilación y guardado de datos
   */
  stop() {
    // Detener intervalos
    if (this.dataCollectionInterval) {
      clearInterval(this.dataCollectionInterval);
      this.dataCollectionInterval = null;
    }
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    console.log("[RawDataExporter] Sistema de exportación detenido");
  }
}

// Crear instancia y exportarla
const rawDataExporter = new RawDataExporter();

// Inicializar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Pequeño retraso para asegurar que gameDataManager esté disponible
  setTimeout(() => {
    rawDataExporter.init();
  }, 2000);
  
  // Garantizar que los datos se envíen antes de que se cierre la ventana
  window.addEventListener('beforeunload', function(event) {
    // Si el juego estaba en progreso y no se ha procesado el fin del juego
    if (rawDataExporter.gameInProgress && !rawDataExporter.isProcessingGameEnd) {
      console.log("[RawDataExporter] Detectada salida de la ventana, realizando exportación final");
      rawDataExporter.onGameEnd();
      
      // Dar tiempo para que se completen las operaciones
      const start = Date.now();
      while (Date.now() - start < 2000 && rawDataExporter.isProcessingGameEnd) {
        // Esperar hasta 2 segundos o hasta que termine el procesamiento
      }
    }
  });
});

// Exportar para uso global
window.rawDataExporter = rawDataExporter; 