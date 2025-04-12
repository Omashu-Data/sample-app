// Lista de características que necesitamos capturar
const features = [
  'gep_internal',
  'live_client_data',
  'matchState',
  'match_info',
  'death',
  'respawn',
  'abilities',
  'kill',
  'assist',
  'gold',
  'minions',
  'summoner_info',
  'gameMode',
  'teams',
  'level',
  'announcer',
  'counters',
  'damage',
  'heal',
  'items',
  'ward',
  'vision',
  'objective',
  'spell_cast'
];

// Elementos DOM para logs
const eventsLog = document.getElementById('eventsLog');
const infoLog = document.getElementById('infoLog');

// ---- MANEJADORES DE EVENTOS DE OVERWOLF ----

// Manejar errores
function onError(info) {
  console.error("Error:", info);
  addToLog(eventsLog, { type: 'error', info: info }, true);
  
}

// Manejar actualizaciones de información
function onInfoUpdates(info) {
  addToLog(infoLog, info);
  console.log("Recibida actualización de info:", info);
  
  // Enviar info a la pestaña de eventos
  // COMENTADO/ELIMINADO: sendInfoToTabEvents(info);
  
  // NUEVO: Analizar estructura de datos GEP
  analizarEstructuraGEP(info);
  
  try {
    const updates = {
      summoner: {},
      match: {},
      combat: {},
      vision: {},
      objectives: {},
      items: {},
      teamStats: {},
      events: []
    };
    
    // Actualizar datos del invocador
    if (info.summoner_info) {
      if (info.summoner_info.name) {
        updates.summoner.name = info.summoner_info.name;
      }
      if (info.summoner_info.champion) {
        updates.summoner.champion = info.summoner_info.champion;
      }
      if (info.summoner_info.position) {
        updates.summoner.position = info.summoner_info.position;
      }
      if (info.summoner_info.team) {
        updates.summoner.team = info.summoner_info.team;
      }
    }
    
    // Actualizar nivel
    if (info.level) {
      updates.summoner.level = parseInt(info.level) || gameDataManager.currentData.summoner.level;
    }
    
    // Actualizar CS (minions)
    if (info.minions) {
      let cs = gameDataManager.currentData.match.cs;
      if (info.minions.minionKills) {
        cs = parseInt(info.minions.minionKills) || cs;
      }
      if (info.minions.neutralMinionKills) {
        cs += parseInt(info.minions.neutralMinionKills) || 0;
      }
      updates.match.cs = cs;
    }
    
    // Actualizar oro
    if (info.gold) {
      updates.match.gold = parseInt(info.gold) || gameDataManager.currentData.match.gold;
    }
    
    // Actualizar modo de juego
    if (info.gameMode) {
      updates.match.gameMode = info.gameMode;
    }
    
    // Actualizar tiempo de juego
    if (info.counters && info.counters.match_clock) {
      updates.match.gameTime = parseInt(info.counters.match_clock) || gameDataManager.currentData.match.gameTime;
    }
    
    // Actualizar KDA
    if (info.kill && info.kill.kills) {
      updates.match.kills = parseInt(info.kill.kills);
      
      // Registrar evento de kill
      updates.events.push({
        type: 'kill',
        timestamp: Date.now(),
        data: { kills: updates.match.kills }
      });
    }
    
    if (info.death && info.death.deaths) {
      updates.match.deaths = parseInt(info.death.deaths);
      
      // Registrar evento de muerte
      updates.events.push({
        type: 'death',
        timestamp: Date.now(),
        data: { deaths: updates.match.deaths }
      });
    }
    
    if (info.assist && info.assist.assists) {
      updates.match.assists = parseInt(info.assist.assists);
      
      // Registrar evento de asistencia
      updates.events.push({
        type: 'assist',
        timestamp: Date.now(),
        data: { assists: updates.match.assists }
      });
    }
    
    // NUEVO: Procesar estadísticas de equipo
    if (info.teams) {
      try {
        const teams = JSON.parse(info.teams);
        // Encontrar equipo del jugador
        const playerTeam = gameDataManager.currentData.summoner.team;
        if (playerTeam && teams[playerTeam]) {
          updates.teamStats = {
            totalKills: teams[playerTeam].kills || 0,
            totalDeaths: teams[playerTeam].deaths || 0,
            totalObjectives: (teams[playerTeam].objectives || 0)
          };
        }
      } catch (e) {
        console.error("Error al parsear datos de equipos:", e);
      }
    }
    
    // NUEVO: Procesar estadísticas de daño
    if (info.damage) {
      try {
        updates.combat = updates.combat || {};
        updates.combat.damageDealt = parseInt(info.damage.total) || 0;
      } catch (e) {
        console.error("Error al procesar datos de daño:", e);
      }
    }
    
    // NUEVO: Procesar estadísticas de curación
    if (info.heal) {
      try {
        updates.combat = updates.combat || {};
        updates.combat.healing = parseInt(info.heal.total) || 0;
      } catch (e) {
        console.error("Error al procesar datos de curación:", e);
      }
    }
    
    // NUEVO: Procesar wards
    if (info.ward) {
      try {
        updates.vision = updates.vision || {};
        if (info.ward.placed) {
          updates.vision.wardsPlaced = parseInt(info.ward.placed) || 0;
          
          // Registrar evento de ward colocada
          if (updates.vision.wardsPlaced > gameDataManager.currentData.vision.wardsPlaced) {
            updates.events.push({
              type: 'ward_placed',
              timestamp: Date.now(),
              data: { wardsPlaced: updates.vision.wardsPlaced }
            });
          }
        }
        if (info.ward.destroyed) {
          updates.vision.wardsDestroyed = parseInt(info.ward.destroyed) || 0;
        }
      } catch (e) {
        console.error("Error al procesar datos de wards:", e);
      }
    }
    
    // NUEVO: Procesar objetivos
    if (info.objective) {
      try {
        updates.objectives = updates.objectives || {};
        
        // Detectar cambios en objetivos específicos
        const objTypes = {
          'turret': 'turretKills',
          'inhibitor': 'inhibitorKills',
          'dragon': 'dragonKills',
          'baron': 'baronKills',
          'herald': 'heraldKills'
        };
        
        for (const [type, field] of Object.entries(objTypes)) {
          if (info.objective[type]) {
            updates.objectives[field] = parseInt(info.objective[type]) || 0;
            
            // Si ha aumentado, registrar evento
            if (updates.objectives[field] > (gameDataManager.currentData.objectives[field] || 0)) {
              updates.events.push({
                type: `${type}_kill`,
                timestamp: Date.now(),
                data: { [field]: updates.objectives[field] }
              });
            }
          }
        }
      } catch (e) {
        console.error("Error al procesar datos de objetivos:", e);
      }
    }
    
    // Procesar datos de live_client_data
    if (info.live_client_data) {
      // Datos del jugador activo
      if (info.live_client_data.active_player) {
        try {
          const player = JSON.parse(info.live_client_data.active_player);
          
          if (player.summonerName) {
            updates.summoner.name = player.summonerName;
          }
          
          if (player.level) {
            updates.summoner.level = player.level;
          }
          
          if (player.championStats) {
            updates.match.gold = Math.round(player.championStats.currentGold || gameDataManager.currentData.match.gold);
          }
          
          // NUEVO: Procesar datos de inventario
          if (player.items) {
            updates.items = updates.items || {};
            updates.items.inventory = player.items.map(item => ({
              id: item.itemID,
              name: item.displayName,
              slot: item.slot
            }));
          }
        } catch (e) {
          console.log("Error al parsear active_player:", e);
        }
      }
      
      // Datos del juego
      if (info.live_client_data.game_data) {
        try {
          const gameInfo = JSON.parse(info.live_client_data.game_data);
          
          if (gameInfo.gameTime) {
            updates.match.gameTime = Math.floor(parseFloat(gameInfo.gameTime));
          }
          
          if (gameInfo.gameMode) {
            updates.match.gameMode = gameInfo.gameMode;
          }
        } catch (e) {
          console.log("Error al parsear game_data:", e);
        }
      }
      
      // Actualizar eventos del juego
      if (info.live_client_data.events) {
        try {
          const events = JSON.parse(info.live_client_data.events);
          
          if (events && events.Events) {
            events.Events.forEach(event => {
              // Procesar eventos de asesinato
              if (event.EventName === "ChampionKill") {
                const playerName = gameDataManager.currentData.summoner.name;
                
                if (event.KillerName === playerName) {
                  updates.match.kills = (updates.match.kills !== undefined ? 
                                      updates.match.kills : gameDataManager.currentData.match.kills) + 1;
                                      
                  updates.events.push({
                    type: 'kill',
                    timestamp: Date.now(),
                    data: { 
                      killer: event.KillerName,
                      victim: event.VictimName
                    }
                  });
                }
                
                if (event.VictimName === playerName) {
                  updates.match.deaths = (updates.match.deaths !== undefined ? 
                                       updates.match.deaths : gameDataManager.currentData.match.deaths) + 1;
                                       
                  updates.events.push({
                    type: 'death',
                    timestamp: Date.now(),
                    data: { 
                      killer: event.KillerName,
                      victim: event.VictimName
                    }
                  });
                }
                
                if (event.Assisters && event.Assisters.includes(playerName)) {
                  updates.match.assists = (updates.match.assists !== undefined ? 
                                        updates.match.assists : gameDataManager.currentData.match.assists) + 1;
                                        
                  updates.events.push({
                    type: 'assist',
                    timestamp: Date.now(),
                    data: { 
                      killer: event.KillerName,
                      victim: event.VictimName,
                      assister: playerName
                    }
                  });
                }
              }
              
              // NUEVO: Procesar eventos de ward
              else if (event.EventName === "WardPlaced") {
                if (event.WardType && event.PlacerName === gameDataManager.currentData.summoner.name) {
                  updates.vision = updates.vision || {};
                  updates.vision.wardsPlaced = (updates.vision.wardsPlaced || 
                                             gameDataManager.currentData.vision.wardsPlaced || 0) + 1;
                                             
                  if (event.WardType.includes("Control")) {
                    updates.vision.controlWards = (updates.vision.controlWards || 
                                                gameDataManager.currentData.vision.controlWards || 0) + 1;
                  }
                  
                  updates.events.push({
                    type: 'ward_placed',
                    timestamp: Date.now(),
                    data: { 
                      type: event.WardType,
                      placer: event.PlacerName
                    }
                  });
                }
              }
              
              // NUEVO: Procesar eventos de objetivos
              else if (event.EventName === "DragonKill" || 
                     event.EventName === "HeraldKill" || 
                     event.EventName === "BaronKill") {
                const objectiveType = event.EventName.replace('Kill', '').toLowerCase();
                const field = `${objectiveType}Kills`;
                
                // Si el jugador o su equipo participó
                const team = gameDataManager.currentData.summoner.team;
                if (event.KillerName.includes(team)) {
                  updates.objectives = updates.objectives || {};
                  updates.objectives[field] = (updates.objectives[field] || 
                                           gameDataManager.currentData.objectives[field] || 0) + 1;
                                           
                  updates.events.push({
                    type: `${objectiveType}_kill`,
                    timestamp: Date.now(),
                    data: { 
                      team: event.KillerName,
                      type: objectiveType
                    }
                  });
                }
              }
              
              // NUEVO: Procesar eventos de torreta
              else if (event.EventName === "TurretKilled") {
                const playerName = gameDataManager.currentData.summoner.name;
                const field = 'turretKills';
                
                if (event.KillerName === playerName || 
                    (event.Assisters && event.Assisters.includes(playerName))) {
                  updates.objectives = updates.objectives || {};
                  updates.objectives[field] = (updates.objectives[field] || 
                                           gameDataManager.currentData.objectives[field] || 0) + 1;
                                           
                  updates.events.push({
                    type: 'turret_kill',
                    timestamp: Date.now(),
                    data: { 
                      killer: event.KillerName,
                      assisters: event.Assisters
                    }
                  });
                }
              }
              
              // Añadir el evento al registro general
              updates.events.push({
                type: 'game_event',
                name: event.EventName,
                timestamp: Date.now(),
                data: event
              });
            });
          }
        } catch (e) {
          console.log("Error al parsear eventos:", e);
        }
      }
    }
    
    // Actualizar datos centralizados si hay cambios
    if (Object.keys(updates.summoner).length > 0 || 
        Object.keys(updates.match).length > 0 || 
        Object.keys(updates.combat).length > 0 || 
        Object.keys(updates.vision).length > 0 || 
        Object.keys(updates.objectives).length > 0 || 
        Object.keys(updates.items).length > 0 || 
        Object.keys(updates.teamStats).length > 0 || 
        updates.events.length > 0) {
      gameDataManager.updateData(updates);
      
      // Forzar actualización directa de la pestaña
      // COMENTADO/ELIMINADO: forceUpdateOverviewTab();
    }
  } catch (e) {
    console.error("Error procesando datos:", e);
  }
}

// Manejar nuevos eventos
function onNewEvents(e) {
  const isHighlight = e.events && e.events.some(event => 
    ['kill', 'death', 'assist', 'level', 'matchStart', 'matchEnd'].includes(event.name)
  );
  
  addToLog(eventsLog, e, isHighlight);
  
  // Enviar evento a la pestaña de eventos
  // COMENTADO/ELIMINADO: sendEventToTabEvents(e);
  
  if (e.events) {
    const updates = {
      summoner: {},
      match: {},
      objectives: {},
      events: []
    };
    
    e.events.forEach(event => {
      updates.events.push({
        name: event.name,
        data: event.data,
        timestamp: new Date().getTime()
      });
      
      switch (event.name) {
        case 'kill':
          updates.match.kills = gameDataManager.currentData.match.kills + 1;
          break;
        case 'death':
          updates.match.deaths = gameDataManager.currentData.match.deaths + 1;
          break;
        case 'assist':
          updates.match.assists = gameDataManager.currentData.match.assists + 1;
          break;
        case 'level':
          if (event.data && event.data.level) {
            updates.summoner.level = parseInt(event.data.level);
          }
          break;
        case 'matchStart':
          updates.match.kills = 0;
          updates.match.deaths = 0;
          updates.match.assists = 0;
          updates.match.cs = 0;
          break;
      }
    });
    
    gameDataManager.updateData(updates);
  }
}

// ---- FUNCIONES DE REGISTRO Y CONFIGURACIÓN DE EVENTOS ----

// Registrar manejadores de eventos
function registerEvents() {
  unregisterEvents();
  
  overwolf.games.events.onError.addListener(onError);
  overwolf.games.events.onInfoUpdates2.addListener(onInfoUpdates);
  overwolf.games.events.onNewEvents.addListener(onNewEvents);
  
  console.log("Eventos registrados directamente en in_game.html (ahora en listeners.js)");
}

// Eliminar manejadores de eventos
function unregisterEvents() {
  try {
    overwolf.games.events.onError.removeListener(onError);
    overwolf.games.events.onInfoUpdates2.removeListener(onInfoUpdates);
    overwolf.games.events.onNewEvents.removeListener(onNewEvents);
  } catch (e) {
    console.log("Error al eliminar listeners:", e);
  }
}

// Configurar características requeridas
function setFeatures() {
  console.log("Intentando establecer características:", features);
  
  overwolf.games.events.setRequiredFeatures(features, function(info) {
    if (!info.success) {
      console.log("No se pudieron establecer las características:", info.error);
      setTimeout(setFeatures, 2000);
      return;
    }
    
    console.log("Características establecidas correctamente");
  });
}

// ---- LÓGICA DE ESTADO DEL JUEGO Y LIVE CLIENT API ----

let lolDataInterval = null;
// ELIMINADO: let uiUpdateInterval = null;

// Función para obtener datos de la API Live Client de LoL
function fetchLiveClientData() {
  console.log("Obteniendo datos de Live Client Data API...");
  
  fetch('https://127.0.0.1:2999/liveclientdata/allgamedata')
    .then(response => {
      if (!response.ok) {
        // No lanzar error si es 404 (juego no iniciado o API no lista)
        if (response.status === 404) {
          console.log("Live Client API no disponible (404).");
          return null; // Devolver null para indicar que no hay datos
        } 
        throw new Error(`Error HTTP: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Si no hay datos (ej. por 404), salir
      if (data === null) return;
      
      console.log("Datos obtenidos de API:", data);
      
      // Analizar estructura de Live Client Data
      analizarEstructuraLiveClientData(data);
      
      const updates = {
        summoner: {},
        match: {}
        // Asegurarse de inicializar otros campos si se usan abajo
      };
      
      if (data && data.activePlayer) {
        if (data.activePlayer.summonerName) {
          updates.summoner.name = data.activePlayer.summonerName;
        }
        
        if (data.activePlayer.level) {
          updates.summoner.level = data.activePlayer.level;
        }
        
        // Buscar datos del jugador activo en allPlayers para más detalles
        if (data.allPlayers) {
          const activePlayerData = data.allPlayers.find(p => 
            p.summonerName === data.activePlayer.summonerName
          );
          
          if (activePlayerData) {
            updates.summoner.champion = activePlayerData.championName || '';
            
            if (activePlayerData.scores) {
              updates.match.kills = activePlayerData.scores.kills || 0;
              updates.match.deaths = activePlayerData.scores.deaths || 0;
              updates.match.assists = activePlayerData.scores.assists || 0;
              updates.match.cs = 
                (activePlayerData.scores.creepScore || 0) + 
                (activePlayerData.scores.neutralMinionsKilled || 0);
              updates.match.gold = Math.round(activePlayerData.scores.currentGold || 0);
            }
          }
        }
      }
        
      if (data.gameData && data.gameData.gameTime) {
        updates.match.gameTime = Math.floor(data.gameData.gameTime);
      }
      
      if (data.gameData && data.gameData.gameMode) {
        updates.match.gameMode = data.gameData.gameMode;
      }
      
      // Solo actualizar si hemos obtenido algún dato útil
      if (Object.keys(updates.summoner).length > 0 || Object.keys(updates.match).length > 0) {
         gameDataManager.updateData(updates);
      }
    })
    .catch(error => {
      // No mostrar errores de conexión como errores críticos si son comunes
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          console.log("Error conectando a Live Client API (puede ser normal si el juego no está activo):");
      } else {
          console.error("Error procesando Live Client API:", error);
      }
    });
}

// Manejar cambios en el estado del juego
function handleGameStateChange(gameInfo) {
  // Comprobar si el juego es LoL (ID 5426) y está corriendo
  const isLolRunning = gameInfo && gameInfo.isRunning && Math.floor(gameInfo.id/10) === 5426;
  
  if (isLolRunning) {
    // Si LoL está corriendo y no teníamos intervalo, iniciarlo
    if (!lolDataInterval) {
      console.log("LoL detectado. Iniciando captura de eventos y Live Client API...");
      
      registerEvents();
      setTimeout(setFeatures, 1000); // Dar tiempo a registrar antes de configurar
      
      fetchLiveClientData(); // Primera llamada inmediata
      lolDataInterval = setInterval(fetchLiveClientData, 2000); // Actualizar cada 2 segundos
      
      // Iniciar intervalo de actualización de UI si no existe
      // COMENTADO/ELIMINADO:
      // if (!uiUpdateInterval) {
      //   uiUpdateInterval = setInterval(function() {
      //     forceUpdateActiveTab(); // Usamos la función que actualiza la pestaña activa
      //     // Log de estado (opcional, puede ser muy verboso)
      //     // console.log("UI Update Tick. Estado actual:", gameDataManager.getData());
      //   }, 1000); // Actualizar UI cada segundo
      // }
    }
  } else {
    // Si LoL no está corriendo y teníamos intervalo, detenerlo
    if (lolDataInterval) {
      console.log("LoL no detectado o cerrado. Deteniendo captura...");
      unregisterEvents();
      
      clearInterval(lolDataInterval);
      lolDataInterval = null;
      
      // Detener también el intervalo de UI
      // COMENTADO/ELIMINADO:
      // if (uiUpdateInterval) {
      //   clearInterval(uiUpdateInterval);
      //   uiUpdateInterval = null;
      // }
    }
  }
}

// ---- INICIALIZACIÓN DE LISTENERS DE ESTADO DEL JUEGO ----
console.log("Inicializando listeners de estado del juego...");

// Verificar estado inicial
overwolf.games.getRunningGameInfo(function(gameInfo) {
  if (gameInfo) {
    handleGameStateChange(gameInfo);
  }
});

// Escuchar cambios
overwolf.games.onGameInfoUpdated.addListener(function(res) {
  if (res && res.gameInfo) {
    handleGameStateChange(res.gameInfo);
  }
});

// Aquí irá el resto del código que moveremos después
// (Exposición de funciones en window, intervalos de actualización forzada, etc.) 

// ---- FUNCIONES Y LÓGICA RESTANTE ----

// Exponer métodos para las pestañas
window.gameDataManager = gameDataManager;

window.getGameData = function() {
  return gameDataManager.getData();
};

window.subscribeToGameData = function(callback) {
  console.log('window.subscribeToGameData: Nuevo intento de suscripción');
  return window.gameDataManager.subscribe(callback);
};

// NUEVO: Función auxiliar para actualizar una pestaña específica
// COMENTADO/ELIMINADO: window.updateTabWithGameData = function(tabId) { ... }

// Listener para recibir mensajes de actualización de datos
window.addEventListener('message', function(event) {
  console.log('in_game: Mensaje recibido:', event.data);
  
  // Comprobar si es un mensaje de actualización de datos
  if (event.data && event.data.type === 'game_data_update') {
    const dataChanged = window.gameDataManager.updateData(event.data.data);
    console.log('in_game: Datos actualizados:', dataChanged);
  }
});

// Método para propagar datos globalmente (para debugging)
window.debugGameData = function() {
  console.log('gameDataManager estado actual:', window.gameDataManager);
  return {
    subscribers: window.gameDataManager.listeners.length,
    data: {
      summoner: { ...window.gameDataManager.summoner },
      match: { ...window.gameDataManager.match }
    }
  };
};

// NUEVO: Función para actualizar forzadamente la pestaña de resumen
// COMENTADO/ELIMINADO: function forceUpdateOverviewTab() { ... }

// NUEVA FUNCIÓN: Actualiza cualquier pestaña activa (no solo overview)
// COMENTADO/ELIMINADO: function forceUpdateActiveTab() { ... }

console.log('Sistema integrado de captura de eventos y gestión de datos inicializado. Versión: 2.0');

// NUEVO: Sistema de análisis de estructuras de datos

// Objeto para almacenar todas las claves únicas detectadas
const keyRegistry = {
  gep: new Set(),
  liveClient: new Set(),
  timestamps: {
    firstDetected: {},
    lastDetected: {}
  },
  
  // Método para registrar claves nuevas de GEP
  registerGEPKeys: function(info) {
    if (!info) return;
    
    try {
      this._registerKeys(info, 'gep');
      this._updatePanel();
    } catch (e) {
      console.error("Error registrando claves GEP:", e);
    }
  },
  
  // Método para registrar claves nuevas de Live Client
  registerLiveClientKeys: function(data) {
    if (!data) return;
    
    try {
      this._registerKeys(data, 'liveClient');
      this._updatePanel();
    } catch (e) {
      console.error("Error registrando claves Live Client:", e);
    }
  },
  
  // Método interno para registrar claves recursivamente
  _registerKeys: function(data, source, prefix = '') {
    if (typeof data !== 'object' || data === null) return;
    
    // Evitar desbordamiento de pila con objetos circulares
    if (prefix.split('.').length > 10) return;
    
    Object.keys(data).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      // Guardar la clave
      this[source].add(fullKey);
      
      // Registrar timestamps
      const now = new Date();
      if (!this.timestamps.firstDetected[`${source}.${fullKey}`]) {
        this.timestamps.firstDetected[`${source}.${fullKey}`] = now;
      }
      this.timestamps.lastDetected[`${source}.${fullKey}`] = now;
      
      // Si el valor es un objeto, continuar recursivamente
      if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
        this._registerKeys(data[key], source, fullKey);
      }
      
      // Si es un array de objetos, analizar el primer elemento
      if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object') {
        this._registerKeys(data[key][0], source, `${fullKey}[0]`);
      }
    });
  },
  
  // Método para actualizar el panel visual
  _updatePanel: function() {
    // NUEVO: Desactivar completamente la creación y actualización del panel
    return; 
    
    // El código original del panel se mantiene abajo pero no se ejecutará
    let panel = document.getElementById('keys-registry-panel');
    
    if (!panel) {
      // Crear panel si no existe
      panel = document.createElement('div');
      panel.id = 'keys-registry-panel';
      panel.style.position = 'fixed';
      panel.style.right = '10px';
      panel.style.top = '10px';
      panel.style.width = '400px';
      panel.style.maxHeight = '80%';
      panel.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
      panel.style.color = '#4CAF50';
      panel.style.padding = '15px';
      panel.style.borderRadius = '5px';
      panel.style.fontSize = '14px';
      panel.style.overflow = 'auto';
      panel.style.zIndex = '99999';
      panel.style.border = '2px solid #4CAF50';
      panel.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
      document.body.appendChild(panel);
      
      // Crear encabezado
      const header = document.createElement('div');
      header.innerHTML = `
        <h2 style="margin-top: 0; text-align: center; color: #4CAF50;">Registro de Claves</h2>
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between;">
          <span>GEP: <strong id="gep-count">0</strong> claves</span>
          <span>Live Client: <strong id="live-count">0</strong> claves</span>
        </div>
      `;
      panel.appendChild(header);
      
      // Crear contenedor para las claves
      const keysContainer = document.createElement('div');
      keysContainer.id = 'keys-container';
      keysContainer.style.maxHeight = '300px';
      keysContainer.style.overflow = 'auto';
      keysContainer.style.marginBottom = '10px';
      keysContainer.style.padding = '10px';
      keysContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      keysContainer.style.borderRadius = '3px';
      panel.appendChild(keysContainer);
      
      // Crear contenedor para botones
      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.display = 'flex';
      buttonsContainer.style.justifyContent = 'space-between';
      
      // Botón para exportar datos
      const exportButton = document.createElement('button');
      exportButton.textContent = 'Exportar Datos';
      exportButton.style.backgroundColor = '#4CAF50';
      exportButton.style.color = 'white';
      exportButton.style.border = 'none';
      exportButton.style.padding = '8px 15px';
      exportButton.style.borderRadius = '3px';
      exportButton.style.cursor = 'pointer';
      exportButton.onclick = this.exportData.bind(this);
      
      // Botón para mostrar datos en consola
      const logButton = document.createElement('button');
      logButton.textContent = 'Mostrar en Consola';
      logButton.style.backgroundColor = '#2196F3';
      logButton.style.color = 'white';
      logButton.style.border = 'none';
      logButton.style.padding = '8px 15px';
      logButton.style.borderRadius = '3px';
      logButton.style.cursor = 'pointer';
      logButton.onclick = this.logDataToConsole.bind(this);
      
      // Botón para limpiar datos
      const clearButton = document.createElement('button');
      clearButton.textContent = 'Limpiar Registro';
      clearButton.style.backgroundColor = '#f44336';
      clearButton.style.color = 'white';
      clearButton.style.border = 'none';
      clearButton.style.padding = '8px 15px';
      clearButton.style.borderRadius = '3px';
      clearButton.style.cursor = 'pointer';
      clearButton.onclick = this.clearData.bind(this);
      
      buttonsContainer.appendChild(exportButton);
      buttonsContainer.appendChild(logButton);
      buttonsContainer.appendChild(clearButton);
      panel.appendChild(buttonsContainer);
      
      // Texto informativo
      const infoText = document.createElement('div');
      infoText.innerHTML = `
        <p style="margin-top: 10px; font-size: 12px; color: #aaa;">
          Este panel registra todas las claves únicas detectadas en eventos y datos del juego.
          Úsalo para entender qué información está disponible para tu app.
        </p>
      `;
      panel.appendChild(infoText);
    }
    
    // Actualizar contadores
    document.getElementById('gep-count').textContent = this.gep.size.toString();
    document.getElementById('live-count').textContent = this.liveClient.size.toString();
    
    // Actualizar lista de claves
    const keysContainer = document.getElementById('keys-container');
    
    // Preparar datos para mostrar
    const allKeys = [
      ...Array.from(this.gep).map(key => ({ key, source: 'GEP' })),
      ...Array.from(this.liveClient).map(key => ({ key, source: 'Live Client' }))
    ];
    
    // Ordenar alfabéticamente
    allKeys.sort((a, b) => a.key.localeCompare(b.key));
    
    // Generar HTML
    keysContainer.innerHTML = allKeys.map(item => `
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between;">
        <span style="color: ${item.source === 'GEP' ? '#FFD700' : '#00BFFF'};">
          [${item.source}]
        </span>
        <span style="margin-left: 10px; flex-grow: 1; word-break: break-all;">
          ${item.key}
        </span>
      </div>
    `).join('');
    
    // Si no hay claves, mostrar mensaje
    if (allKeys.length === 0) {
      keysContainer.innerHTML = '<div style="text-align: center; color: #aaa;">No se han detectado claves todavía. Inicia una partida para comenzar a capturar datos.</div>';
    }
  },
  
  // Método para exportar datos a un archivo
  exportData: function() {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        gepKeys: Array.from(this.gep),
        liveClientKeys: Array.from(this.liveClient),
        detectionTimestamps: this.timestamps,
        gameDataManager: gameDataManager.currentData
      };
      
      const jsonStr = JSON.stringify(data, null, 2);
      
      // Usar la API de Overwolf para guardar el archivo
      const fileName = `LOL-DataKeys-${new Date().toISOString().replace(/:/g, '-')}.json`;
      const overwolfFileName = `${overwolf.io.paths.documents}\\Overwolf\\${fileName}`;
      
      // Método específico de Overwolf para escribir archivos
      overwolf.io.writeFileContents(
        overwolfFileName, 
        jsonStr, 
        "UTF8", 
        true, 
        (result) => {
          if (result.success) {
            // Mostrar notificación de éxito
            overwolf.notifications.showToast({
              header: "Archivo guardado",
              message: `Claves exportadas a: ${overwolfFileName}`,
              duration: 5
            });
            
            console.log(`Archivo guardado con éxito en: ${overwolfFileName}`);
          } else {
            console.error("Error al guardar archivo:", result.error);
            alert(`Error al guardar archivo: ${result.error}`);
          }
        }
      );
      
      // También hacer backup del método del navegador como alternativa
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error exportando datos:", e);
      alert("Error al exportar datos: " + e.message);
    }
  },
  
  // Método para mostrar datos en la consola
  logDataToConsole: function() {
    console.log("===== REGISTRO COMPLETO DE CLAVES =====");
    console.log("Claves GEP:", Array.from(this.gep));
    console.log("Claves Live Client:", Array.from(this.liveClient));
    console.log("Timestamps de detección:", this.timestamps);
    console.log("Estado actual de gameDataManager:", gameDataManager.currentData);
  },
  
  // Método para limpiar todos los datos
  clearData: function() {
    if (confirm("¿Estás seguro de que quieres limpiar todos los datos registrados?")) {
      this.gep.clear();
      this.liveClient.clear();
      this.timestamps = { firstDetected: {}, lastDetected: {} };
      this._updatePanel();
    }
  }
};

// Reemplazar las funciones de análisis para usar el nuevo registro de claves
function analizarEstructuraGEP(info) {
  keyRegistry.registerGEPKeys(info);
}

function analizarEstructuraLiveClientData(data) {
  keyRegistry.registerLiveClientKeys(data);
}

// Exponer el registro globalmente
window.keyRegistry = keyRegistry;

// Exponer APIs de análisis globalmente
// window.estructuraDatos = estructuraDatos; // Parece que estructuraDatos no está definido
window.analizarEstructuraGEP = analizarEstructuraGEP;
window.analizarEstructuraLiveClientData = analizarEstructuraLiveClientData;
// window.mostrarDatosCompletos = mostrarDatosCompletos; // Parece que mostrarDatosCompletos no está definido

// REGISTRADOR DE CLAVES ÚNICAS - Panel visible
const keysRegistrar = {
  gepKeys: new Set(),
  liveClientKeys: new Set(),
  
  // Registrar claves GEP
  registerGEPKeys: function(data, prefix = '') {
    if (!data || typeof data !== 'object') return;
    
    Object.keys(data).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      this.gepKeys.add(fullKey);
      
      // Procesamiento recursivo para objetos anidados (limitar profundidad)
      if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key]) 
          && fullKey.split('.').length < 5) {
        this.registerGEPKeys(data[key], fullKey);
      }
    });
    
    this.updatePanel();
  },
  
  // Registrar claves de Live Client API
  registerLiveClientKeys: function(data, prefix = '') {
    if (!data || typeof data !== 'object') return;
    
    Object.keys(data).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      this.liveClientKeys.add(fullKey);
      
      // Procesamiento recursivo para objetos anidados (limitar profundidad)
      if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])
          && fullKey.split('.').length < 5) {
        this.registerLiveClientKeys(data[key], fullKey);
      }
    });
    
    this.updatePanel();
  },
  
  // Crear y actualizar panel visual
  updatePanel: function() {
    // --- DESACTIVACIÓN DEL PANEL VISUAL ---
    // Para reactivar el panel, elimina la siguiente línea ("return;")
    return;
    // ---------------------------------------

    let panel = document.getElementById('keys-panel');
    
    if (!panel) {
      // Crear panel si no existe
      panel = document.createElement('div');
      panel.id = 'keys-panel';
      panel.style.position = 'fixed';
      panel.style.top = '100px';
      panel.style.left = '10px';  // Cambio a lado izquierdo
      panel.style.width = '350px';
      panel.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
      panel.style.color = '#00FF00';  // Verde más brillante
      panel.style.padding = '15px';
      panel.style.borderRadius = '8px';
      panel.style.zIndex = '99999';
      panel.style.border = '3px solid #00FF00';  // Borde más grueso
      panel.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.7)';  // Brillo más intenso
      panel.style.maxHeight = '500px';  // Panel más grande
      panel.style.overflow = 'auto';
      panel.style.fontFamily = 'Arial, sans-serif';  // Tipografía más legible
      document.body.appendChild(panel);
      
      // Crear elementos del panel
      const header = document.createElement('div');
      header.innerHTML = `
        <h3 style="text-align: center; margin-top: 0; font-size: 18px; text-shadow: 0 0 5px #00FF00;">REGISTRADOR DE CLAVES</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px;">
          <div>GEP: <span id="gep-count" style="font-weight: bold;">0</span></div>
          <div>Live Client: <span id="client-count" style="font-weight: bold;">0</span></div>
        </div>
      `;
      panel.appendChild(header);
      
      // Contenedor para las claves
      const keysContainer = document.createElement('div');
      keysContainer.id = 'keys-list';
      keysContainer.style.maxHeight = '300px';  // Más espacio para mostrar claves
      keysContainer.style.overflow = 'auto';
      keysContainer.style.marginBottom = '15px';
      keysContainer.style.backgroundColor = 'rgba(0, 20, 0, 0.7)';  // Fondo más oscuro
      keysContainer.style.padding = '10px';
      keysContainer.style.borderRadius = '5px';
      keysContainer.style.border = '1px solid #00AA00';  // Borde para el contenedor
      panel.appendChild(keysContainer);
      
      // Botones de acción
      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.display = 'flex';
      buttonsContainer.style.justifyContent = 'space-between';
      
      // Botón para exportar
      const exportButton = document.createElement('button');
      exportButton.innerText = 'Exportar JSON';
      exportButton.style.backgroundColor = '#008800';
      exportButton.style.color = 'white';
      exportButton.style.border = 'none';
      exportButton.style.padding = '8px 15px';
      exportButton.style.borderRadius = '5px';
      exportButton.style.cursor = 'pointer';
      exportButton.style.fontWeight = 'bold';
      exportButton.style.boxShadow = '0 0 5px rgba(0, 255, 0, 0.5)';
      exportButton.onmouseover = function() { this.style.backgroundColor = '#00AA00'; };
      exportButton.onmouseout = function() { this.style.backgroundColor = '#008800'; };
      exportButton.onclick = this.exportKeys.bind(this);
      
      // Botón para mostrar en consola
      const logButton = document.createElement('button');
      logButton.innerText = 'Ver en Consola';
      logButton.style.backgroundColor = '#0055AA';
      logButton.style.color = 'white';
      logButton.style.border = 'none';
      logButton.style.padding = '8px 15px';
      logButton.style.borderRadius = '5px';
      logButton.style.cursor = 'pointer';
      logButton.style.fontWeight = 'bold';
      logButton.style.boxShadow = '0 0 5px rgba(0, 150, 255, 0.5)';
      logButton.onmouseover = function() { this.style.backgroundColor = '#0077CC'; };
      logButton.onmouseout = function() { this.style.backgroundColor = '#0055AA'; };
      logButton.onclick = this.logToConsole.bind(this);
      
      // Botón para ocultar el panel
      const hideButton = document.createElement('button');
      hideButton.innerText = 'Ocultar Panel';
      hideButton.style.backgroundColor = '#AA0000';
      hideButton.style.color = 'white';
      hideButton.style.border = 'none';
      hideButton.style.padding = '8px 15px';
      hideButton.style.borderRadius = '5px';
      hideButton.style.cursor = 'pointer';
      hideButton.style.fontWeight = 'bold';
      hideButton.style.boxShadow = '0 0 5px rgba(255, 0, 0, 0.5)';
      hideButton.onmouseover = function() { this.style.backgroundColor = '#CC0000'; };
      hideButton.onmouseout = function() { this.style.backgroundColor = '#AA0000'; };
      hideButton.onclick = function() { 
        panel.style.display = 'none'; 
        // Crear botón flotante para mostrar de nuevo
        const showButton = document.createElement('button');
        showButton.innerText = 'Mostrar Registrador';
        showButton.style.position = 'fixed';
        showButton.style.top = '10px';
        showButton.style.left = '10px';
        showButton.style.backgroundColor = '#008800';
        showButton.style.color = 'white';
        showButton.style.border = 'none';
        showButton.style.padding = '5px 10px';
        showButton.style.borderRadius = '5px';
        showButton.style.zIndex = '99999';
        showButton.style.cursor = 'pointer';
        showButton.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.7)';
        showButton.id = 'show-keys-panel';
        showButton.onclick = function() {
          panel.style.display = 'block';
          document.body.removeChild(showButton);
        };
        document.body.appendChild(showButton);
      };
      
      buttonsContainer.appendChild(exportButton);
      buttonsContainer.appendChild(logButton);
      buttonsContainer.appendChild(hideButton);
      panel.appendChild(buttonsContainer);
      
      // Texto informativo
      const infoText = document.createElement('div');
      infoText.innerHTML = `
        <p style="margin-top: 10px; font-size: 12px; color: #aaa; text-align: center;">
          Todas las claves detectadas serán guardadas automáticamente.
          <br>Haz clic en "Exportar JSON" para guardar archivo en Documentos/Overwolf.
        </p>
      `;
      panel.appendChild(infoText);
    }
    
    // Actualizar contadores
    document.getElementById('gep-count').textContent = this.gepKeys.size;
    document.getElementById('client-count').textContent = this.liveClientKeys.size;
    
    // Actualizar lista de claves
    const keysListElement = document.getElementById('keys-list');
    if (keysListElement) {
      // Combinar y ordenar todas las claves
      const allKeys = [
        ...Array.from(this.gepKeys).map(key => ({ key, source: 'GEP' })),
        ...Array.from(this.liveClientKeys).map(key => ({ key, source: 'Live' }))
      ];
      
      // Ordenar alfabéticamente
      allKeys.sort((a, b) => a.key.localeCompare(b.key));
      
      // Limitar a las últimas 50 claves para mejorar rendimiento
      const keysToShow = allKeys.slice(0, 50);
      
      // Generar HTML
      keysListElement.innerHTML = keysToShow.map(item => `
        <div style="margin-bottom: 3px; font-size: 12px;">
          <span style="color: ${item.source === 'GEP' ? 'yellow' : 'aqua'};">[${item.source}]</span>
          <span>${item.key}</span>
        </div>
      `).join('') + (allKeys.length > 50 ? 
        `<div style="text-align: center; color: #aaa;">...y ${allKeys.length - 50} más</div>` : '');
    }
  },
  
  // Exportar todas las claves a un archivo JSON
  exportKeys: function() {
    const data = {
      timestamp: new Date().toISOString(),
      gepKeys: Array.from(this.gepKeys),
      liveClientKeys: Array.from(this.liveClientKeys)
    };
    
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Usar la API de Overwolf para guardar el archivo
    const fileName = `lol-keys-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const overwolfFileName = `${overwolf.io.paths.documents}\\Overwolf\\${fileName}`;
    
    // Método específico de Overwolf para escribir archivos
    overwolf.io.writeFileContents(
      overwolfFileName, 
      jsonStr, 
      "UTF8", 
      true, 
      (result) => {
        if (result.success) {
          // Mostrar notificación de éxito
          overwolf.notifications.showToast({
            header: "Archivo guardado",
            message: `Claves exportadas a: ${overwolfFileName}`,
            duration: 5
          });
          
          console.log(`Archivo guardado con éxito en: ${overwolfFileName}`);
        } else {
          console.error("Error al guardar archivo:", result.error);
          alert(`Error al guardar archivo: ${result.error}`);
        }
      }
    );
    
    // También hacer backup del método del navegador como alternativa
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  
  // Mostrar todas las claves en la consola
  logToConsole: function() {
    console.log('===== CLAVES ÚNICAS DETECTADAS =====');
    console.log('GEP Keys:', Array.from(this.gepKeys));
    console.log('Live Client Keys:', Array.from(this.liveClientKeys));
    console.log('Total Keys:', this.gepKeys.size + this.liveClientKeys.size);
  }
};

// Modificar las funciones de análisis para usar el registrador de claves
const originalGEPAnalyzer = analizarEstructuraGEP;
analizarEstructuraGEP = function(info) {
  originalGEPAnalyzer(info);
  keysRegistrar.registerGEPKeys(info);
};

const originalLiveClientAnalyzer = analizarEstructuraLiveClientData;
analizarEstructuraLiveClientData = function(data) {
  originalLiveClientAnalyzer(data);
  keysRegistrar.registerLiveClientKeys(data);
};

// Exponer el registrador globalmente
window.keysRegistrar = keysRegistrar;