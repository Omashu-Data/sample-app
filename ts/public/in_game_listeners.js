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
  
  // Enviar error a la pestaña de eventos
  sendEventToTabEvents({ type: 'error', info: info });
}

// Manejar actualizaciones de información
function onInfoUpdates(info) {
  addToLog(infoLog, info);
  console.log("Recibida actualización de info:", info);
  
  // Enviar info a la pestaña de eventos
  sendInfoToTabEvents(info);
  
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
      forceUpdateOverviewTab();
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
  sendEventToTabEvents(e);
  
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
let uiUpdateInterval = null;

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
      if (!uiUpdateInterval) {
        uiUpdateInterval = setInterval(function() {
          forceUpdateActiveTab(); // Usamos la función que actualiza la pestaña activa
          // Log de estado (opcional, puede ser muy verboso)
          // console.log("UI Update Tick. Estado actual:", gameDataManager.getData());
        }, 1000); // Actualizar UI cada segundo
      }
    }
  } else {
    // Si LoL no está corriendo y teníamos intervalo, detenerlo
    if (lolDataInterval) {
      console.log("LoL no detectado o cerrado. Deteniendo captura...");
      unregisterEvents();
      
      clearInterval(lolDataInterval);
      lolDataInterval = null;
      
      // Detener también el intervalo de UI
      if (uiUpdateInterval) {
        clearInterval(uiUpdateInterval);
        uiUpdateInterval = null;
      }
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
window.updateTabWithGameData = function(tabId) {
  try {
    console.log(`Intentando actualizar manualmente la pestaña ${tabId} con datos actuales`);
    const tabPane = document.getElementById(tabId);
    
    if (!tabPane) {
      console.error(`No se encontró la pestaña con ID ${tabId}`);
      return false;
    }
    
    const data = gameDataManager.getData();
    
    // Buscar la función updateUI dentro del contenido de la pestaña
    const updateUIFn = tabPane.querySelector('script')?.textContent.includes('function updateUI') 
      ? new Function('return ' + tabPane.querySelector('script')?.textContent)().updateUI 
      : null;
    
    if (updateUIFn) {
      console.log(`Se encontró updateUI en la pestaña ${tabId}, llamándola...`);
      try {
        updateUIFn(data);
        return true;
      } catch (e) {
        console.error(`Error al llamar a updateUI en ${tabId}:`, e);
      }
    } else {
      console.error(`No se encontró la función updateUI en la pestaña ${tabId}`);
      
      // Intento alternativo - buscar elementos directamente
      const playerNameElement = tabPane.querySelector('#player-name');
      const gameTimeElement = tabPane.querySelector('#game-time-value');
      const killsElement = tabPane.querySelector('#kda-kills');
      const deathsElement = tabPane.querySelector('#kda-deaths');
      const assistsElement = tabPane.querySelector('#kda-assists');
      
      let updated = false;
      
      if (playerNameElement && data.summoner && data.summoner.name) {
        playerNameElement.textContent = data.summoner.name;
        updated = true;
      }
      
      if (gameTimeElement && data.match && data.match.gameTime !== undefined) {
        gameTimeElement.textContent = formatGameTime(data.match.gameTime);
        updated = true;
      }
      
      if (killsElement && data.match) {
        killsElement.textContent = data.match.kills || '0';
        updated = true;
      }
      
      if (deathsElement && data.match) {
        deathsElement.textContent = data.match.deaths || '0';
        updated = true;
      }
      
      if (assistsElement && data.match) {
        assistsElement.textContent = data.match.assists || '0';
        updated = true;
      }
      
      return updated;
    }
  } catch (e) {
    console.error(`Error general al actualizar la pestaña ${tabId}:`, e);
    return false;
  }
};

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
function forceUpdateOverviewTab() {
  console.log("Forzando actualización de la pestaña de resumen");
  
  // Verificar si tenemos datos válidos
  if (!gameDataManager.currentData.summoner.name) {
    console.log("No hay datos de jugador todavía, no actualizamos");
    return;
  }
  
  // Buscar la pestaña de resumen
  const overviewTab = document.getElementById('overview-tab');
  if (!overviewTab) {
    console.log("Pestaña de resumen no encontrada");
    return;
  }
  
  // ----- CAMBIO IMPORTANTE ------
  // Usamos el mismo patrón que en components-loader.js para encontrar la función updateUI
  
  // Obtener los datos actuales del juego
  const data = gameDataManager.getData();
  
  // Método 1: Buscar la función updateUI adjunta al elemento de pestaña
  if (overviewTab.updateUIFunction && typeof overviewTab.updateUIFunction === 'function') {
    console.log("Usando función updateUI adjunta al elemento 'overview-tab'");
    overviewTab.updateUIFunction(data);
    return;
  }
  
  // Método 2: Buscar en el objeto tabUpdateFunctions
  if (window.tabUpdateFunctions && window.tabUpdateFunctions['overview-tab'] && 
      typeof window.tabUpdateFunctions['overview-tab'] === 'function') {
    console.log("Usando función updateUI desde tabUpdateFunctions['overview-tab']");
    window.tabUpdateFunctions['overview-tab'](data);
    return;
  }
  
  // Método 3: Buscar en nombres de función específicos por tab
  if (window._overviewUpdateUI && typeof window._overviewUpdateUI === 'function') {
    console.log("Usando función específica window._overviewUpdateUI");
    window._overviewUpdateUI(data);
    return;
  }
  
  // Método 4: Como fallback intentar window.updateUI global
  if (typeof window.updateUI === 'function') {
    console.log("Fallback: Usando window.updateUI global");
    window.updateUI(data);
    return;
  }
  
  // Método 5: Intentar encontrar updateUI dentro del tab
  const updateUIScripts = overviewTab.querySelectorAll('script');
  let tabUpdateUI = null;
  
  for (const script of updateUIScripts) {
    if (script.textContent.includes('function updateUI')) {
      try {
        // Ejecutar el script para acceder a la función
        const scriptFunc = new Function(`
          let updateUI;
          ${script.textContent}
          return updateUI;
        `);
        tabUpdateUI = scriptFunc();
        break;
      } catch (e) {
        console.error("Error extrayendo updateUI del script:", e);
      }
    }
  }
  
  if (typeof tabUpdateUI === 'function') {
    console.log("Usando updateUI encontrada en el tab");
    tabUpdateUI(data);
    return;
  }
  
  // Método 6: Buscar window.frames[0].updateUI
  try {
    if (overviewTab.querySelector('iframe') && 
        typeof overviewTab.querySelector('iframe').contentWindow.updateUI === 'function') {
      console.log("Usando updateUI del iframe");
      overviewTab.querySelector('iframe').contentWindow.updateUI(data);
      return;
    }
  } catch (e) {
    console.log("No se pudo acceder a updateUI del iframe:", e);
  }
  
  // Fallback: Actualización manual si no encontramos updateUI
  console.log("No se encontró ninguna función updateUI, actualizando elementos manualmente");
  
  // Buscar los elementos dentro de la pestaña
  const playerNameElement = overviewTab.querySelector('#player-name');
  const gameTimeElement = overviewTab.querySelector('#game-time-value');
  const killsElement = overviewTab.querySelector('#kda-kills');
  const deathsElement = overviewTab.querySelector('#kda-deaths');
  const assistsElement = overviewTab.querySelector('#kda-assists');
  
  // Actualizar elementos manualmente como ultimo recurso
  try {
    // Actualizar nombre
    if (playerNameElement) {
      playerNameElement.textContent = data.summoner.name || "Desconocido";
      console.log("Nombre actualizado a:", data.summoner.name);
    }
    
    // Actualizar tiempo
    if (gameTimeElement) {
      const formattedTime = formatGameTime(data.match.gameTime);
      gameTimeElement.textContent = formattedTime;
      console.log("Tiempo actualizado a:", formattedTime);
    }
    
    // Actualizar KDA
    if (killsElement) {
      killsElement.textContent = data.match.kills || "0";
    }
    if (deathsElement) {
      deathsElement.textContent = data.match.deaths || "0";
    }
    if (assistsElement) {
      assistsElement.textContent = data.match.assists || "0";
    }
    
    // También actualizamos los elementos de retos como fallback
    const challengeKillsElement = overviewTab.querySelector('#challenge-kills-value');
    const challengeWardsElement = overviewTab.querySelector('#challenge-wards-value');
    const challengeCSElement = overviewTab.querySelector('#challenge-cs-value');
    
    if (challengeKillsElement && data.match) {
      challengeKillsElement.textContent = (data.match.kills || 0) + "/3";
    }
    
    if (challengeWardsElement && data.vision) {
      challengeWardsElement.textContent = (data.vision.wardsPlaced || 0) + "/5";
    }
    
    if (challengeCSElement && data.match && data.match.cs !== undefined && data.match.gameTime !== undefined) {
      const gameTimeInMinutes = Math.max(data.match.gameTime / 60, 1);
      const csPerMinute = (data.match.cs / gameTimeInMinutes).toFixed(1);
      challengeCSElement.textContent = csPerMinute + "/8";
    }
    
    console.log("Actualización manual completada");
  } catch (e) {
    console.error("Error actualizando elementos:", e);
  }
}

// NUEVA FUNCIÓN: Actualiza cualquier pestaña activa (no solo overview)
function forceUpdateActiveTab() {
  try {
    // Obtener la pestaña activa
    const activeTab = document.querySelector('.tabs__pane--active');
    if (!activeTab || !activeTab.id) {
      console.log("No se encontró pestaña activa para actualizar");
      return;
    }
    
    // No hacer nada si ya es la pestaña overview (para evitar duplicación)
    if (activeTab.id === 'overview-tab') {
      // Ya se actualiza con forceUpdateOverviewTab
      return;
    }
    
    console.log(`Forzando actualización de pestaña activa: ${activeTab.id}`);
    
    // Obtener los datos actuales
    const data = gameDataManager.getData();
    console.log(`Datos enviados a ${activeTab.id}:`, {
      summoner: data.summoner ? data.summoner.name : "no disponible",
      gameTime: data.match ? data.match.gameTime : "no disponible",
      kda: data.match ? `${data.match.kills}/${data.match.deaths}/${data.match.assists}` : "no disponible"
    });
    
    let updateSuccess = false;
    
    // Método 1: Buscar la función updateUI adjunta al elemento de pestaña
    if (activeTab.updateUIFunction && typeof activeTab.updateUIFunction === 'function') {
      console.log(`Usando función updateUI adjunta al elemento ${activeTab.id}`);
      try {
        activeTab.updateUIFunction(data);
        updateSuccess = true;
      } catch (e) {
        console.error(`Error al llamar updateUIFunction en ${activeTab.id}:`, e);
      }
    }
    
    // Método 2: Buscar en el objeto tabUpdateFunctions
    if (!updateSuccess && window.tabUpdateFunctions && window.tabUpdateFunctions[activeTab.id] && 
        typeof window.tabUpdateFunctions[activeTab.id] === 'function') {
      console.log(`Usando función updateUI desde tabUpdateFunctions['${activeTab.id}']`);
      try {
        window.tabUpdateFunctions[activeTab.id](data);
        updateSuccess = true;
      } catch (e) {
        console.error(`Error al llamar tabUpdateFunctions['${activeTab.id}']:`, e);
      }
    }
    
    // Método 3: Buscar en nombres de función específicos por tab
    if (!updateSuccess) {
      const tabName = activeTab.id.replace('-tab', '');
      const specificFunctionName = `_${tabName}UpdateUI`;
      if (window[specificFunctionName] && typeof window[specificFunctionName] === 'function') {
        console.log(`Usando función específica window.${specificFunctionName}`);
        try {
          window[specificFunctionName](data);
          updateSuccess = true;
        } catch (e) {
          console.error(`Error al llamar ${specificFunctionName}:`, e);
        }
      }
    }
    
    // Método 4: Como fallback intentar window.updateUI global
    if (!updateSuccess && typeof window.updateUI === 'function') {
      console.log('Fallback: Usando window.updateUI global para actualizar');
      try {
        window.updateUI(data);
        updateSuccess = true;
      } catch (e) {
        console.error(`Error al llamar window.updateUI:`, e);
      }
    }
    
    // Método 5: Extraer la función updateUI del script del tab
    if (!updateSuccess) {
      try {
        console.log('Intentando extraer updateUI del script del tab');
        const scripts = activeTab.querySelectorAll('script');
        let updateUIFn = null;
        
        for (const script of scripts) {
          if (script.textContent.includes('function updateUI')) {
            try {
              // Extraer la función
              const scriptContent = script.textContent;
              const fnMatch = scriptContent.match(/function\s+updateUI\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
              if (fnMatch) {
                updateUIFn = new Function('gameData', fnMatch[1]);
                break;
              }
            } catch (extractError) {
              console.error('Error extrayendo updateUI:', extractError);
            }
          }
        }
        
        if (typeof updateUIFn === 'function') {
          console.log('Usando updateUI extraída del script');
          updateUIFn(data);
          updateSuccess = true;
        }
      } catch (scriptError) {
        console.error('Error procesando scripts:', scriptError);
      }
    }
    
    // Método 6: Buscar elementos directamente como último recurso
    if (!updateSuccess) {
      console.log(`Actualizando manualmente elementos clave de ${activeTab.id}`);
      
      try {
        // Elementos comunes que podrían existir en cualquier pestaña
        const playerNameElements = activeTab.querySelectorAll('[id$="-player-name"], [id$="player-name"], [id="player-name"]');
        const gameTimeElements = activeTab.querySelectorAll('[id$="-game-time"], [id$="game-time"], [id="game-time-value"]');
        const killsElements = activeTab.querySelectorAll('[id$="-kills"], [id="kda-kills"], [id="stats-kills"]');
        const deathsElements = activeTab.querySelectorAll('[id$="-deaths"], [id="kda-deaths"], [id="stats-deaths"]');
        const assistsElements = activeTab.querySelectorAll('[id$="-assists"], [id="kda-assists"], [id="stats-assists"]');
        
        let updated = false;
        
        // Actualizar nombre del jugador
        if (data.summoner && data.summoner.name) {
          playerNameElements.forEach(el => {
            el.textContent = data.summoner.name;
            updated = true;
          });
        }
        
        // Actualizar tiempo de juego
        if (data.match && data.match.gameTime !== undefined) {
          const formattedTime = formatGameTime(data.match.gameTime);
          gameTimeElements.forEach(el => {
            el.textContent = formattedTime;
            updated = true;
          });
        }
        
        // Actualizar KDA
        if (data.match) {
          if (data.match.kills !== undefined) {
            killsElements.forEach(el => {
              el.textContent = data.match.kills;
              updated = true;
            });
          }
          
          if (data.match.deaths !== undefined) {
            deathsElements.forEach(el => {
              el.textContent = data.match.deaths;
              updated = true;
            });
          }
          
          if (data.match.assists !== undefined) {
            assistsElements.forEach(el => {
              el.textContent = data.match.assists;
              updated = true;
            });
          }
        }
        
        // Para pestaña de estadísticas específicamente
        if (activeTab.id === 'stats-tab') {
          console.log('Aplicando actualizaciones específicas para stats-tab');
          
          // Oro
          const goldElement = activeTab.querySelector('#stats-gold');
          if (goldElement && data.match && data.match.gold !== undefined) {
            const formattedGold = new Intl.NumberFormat('es-ES').format(data.match.gold);
            goldElement.textContent = formattedGold;
            updated = true;
          } else if (goldElement && data.info && data.info.game_info && data.info.game_info.gold) {
            const formattedGold = new Intl.NumberFormat('es-ES').format(data.info.game_info.gold);
            goldElement.textContent = formattedGold;
            updated = true;
          }
          
          // CS
          const csElement = activeTab.querySelector('#stats-cs');
          if (csElement && data.match && data.match.cs !== undefined) {
            csElement.textContent = data.match.cs;
            updated = true;
          } else if (csElement && data.info && data.info.game_info && data.info.game_info.minionKills) {
            csElement.textContent = data.info.game_info.minionKills;
            updated = true;
          }
          
          // CS por minuto
          const csPerMinElement = activeTab.querySelector('#stats-cs-per-min');
          if (csPerMinElement) {
            let cs = 0;
            let gameTime = 0;
            
            if (data.match && data.match.cs !== undefined) {
              cs = data.match.cs;
            } else if (data.info && data.info.game_info && data.info.game_info.minionKills) {
              cs = data.info.game_info.minionKills;
            }
            
            if (data.match && data.match.gameTime !== undefined) {
              gameTime = data.match.gameTime;
            } else if (data.gameData && data.gameData.gameTime !== undefined) {
              gameTime = data.gameData.gameTime;
            }
            
            if (cs > 0 && gameTime > 0) {
              const gameTimeInMinutes = Math.max(gameTime / 60, 1);
              const csPerMinute = (cs / gameTimeInMinutes).toFixed(1);
              csPerMinElement.textContent = csPerMinute;
              updated = true;
            }
          }
          
          // Wards
          const wardsElement = activeTab.querySelector('#stats-wards-placed');
          if (wardsElement) {
            let wardsPlaced = 0;
            if (data.vision && data.vision.wardsPlaced !== undefined) {
              wardsPlaced = data.vision.wardsPlaced;
            } else if (data.ward && data.ward.placed !== undefined) {
              wardsPlaced = data.ward.placed;
            } else if (data.objectives && data.objectives.wardPlaced !== undefined) {
              wardsPlaced = data.objectives.wardPlaced;
            }
            
            wardsElement.textContent = wardsPlaced;
            updated = true;
          }
          
          // Daño
          if (data.combat) {
            const damageElements = {
              'stats-total-damage': data.combat.damageDealt,
              'stats-champion-damage': data.combat.damageDealtToChampions || data.combat.totalDamageToChampions,
              'stats-damage-taken': data.combat.damageTaken,
              'stats-total-healing': data.combat.healing || data.combat.healingDone
            };
            
            for (const [id, value] of Object.entries(damageElements)) {
              const element = activeTab.querySelector(`#${id}`);
              if (element && value !== undefined) {
                const formattedValue = new Intl.NumberFormat('es-ES').format(value);
                element.textContent = formattedValue;
                updated = true;
              }
            }
          }
          
          updateSuccess = updated;
        }
      } catch (e) {
        console.error("Error actualizando elementos manualmente:", e);
      }
    }
    
    // PASO ADICIONAL: Si es tab-stats, intentar actualizar la tabla de variables explícitamente
    if (activeTab.id === 'stats-tab') {
      console.log('Intentando actualizar tabla de variables específicamente');
      
      // Método 1: Usar la función actualizarTablaVariables adjunta al elemento del tab
      if (activeTab.actualizarTablaVariables && typeof activeTab.actualizarTablaVariables === 'function') {
        console.log('Usando activeTab.actualizarTablaVariables para actualizar la tabla');
        try {
          activeTab.actualizarTablaVariables(data);
          return true;
        } catch (e) {
          console.error('Error llamando activeTab.actualizarTablaVariables:', e);
        }
      }
      
      // Método 2: Buscar la función actualizarTablaVariables en el script
      try {
        const scripts = activeTab.querySelectorAll('script');
        let actualizarTablaVariablesFn = null;
        
        for (const script of scripts) {
          if (script.textContent.includes('function actualizarTablaVariables')) {
            try {
              // Extraer la función
              const scriptContent = script.textContent;
              const fnMatch = scriptContent.match(/function\s+actualizarTablaVariables\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
              if (fnMatch) {
                actualizarTablaVariablesFn = new Function('gameData', fnMatch[1]);
                break;
              }
            } catch (extractError) {
              console.error('Error extrayendo actualizarTablaVariables:', extractError);
            }
          }
        }
        
        if (actualizarTablaVariablesFn) {
          console.log('Llamando a actualizarTablaVariables extraída del script');
          actualizarTablaVariablesFn(data);
          } else {
          console.log('No se encontró la función actualizarTablaVariables en el script');
          
          // Método 3: Actualizar el contenido del tbody directamente
          const tbody = activeTab.querySelector('#variables-body');
          if (tbody) {
            console.log('Actualizando tabla de variables manualmente');
            
            // Limpiar tabla y añadir mensaje de actualización en proceso
            tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 20px;">Actualizando variables...</td></tr>';
            
            // Timeout corto para dar tiempo a que el mensaje se muestre
            setTimeout(() => {
              try {
                // Intentar generar filas básicas para la tabla
                tbody.innerHTML = '';
                let rowCount = 0;
                
                function generateTableRows(obj, prefix = '') {
                  if (!obj || typeof obj !== 'object') return 0;
                  
                  const keys = Object.keys(obj).sort();
                  for (const key of keys) {
                    if (rowCount >= 100) break; // Limitar a 100 filas
                    
                    const value = obj[key];
                    const fullName = prefix ? `${prefix}.${key}` : key;
                    
                    const row = document.createElement('tr');
                    row.style.borderBottom = '1px solid #333';
                    
                    const nameCell = document.createElement('td');
                    nameCell.style.padding = '6px';
                    nameCell.style.fontWeight = 'bold';
                    nameCell.textContent = fullName;
                    
                    const valueCell = document.createElement('td');
                    valueCell.style.padding = '6px';
                    
                    if (value === null) {
                      valueCell.textContent = 'null';
                      valueCell.style.color = '#888';
                    } else if (value === undefined) {
                      valueCell.textContent = 'undefined';
                      valueCell.style.color = '#888';
                    } else if (typeof value === 'object') {
                      if (Array.isArray(value)) {
                        valueCell.textContent = `Array[${value.length}]`;
                        valueCell.style.color = '#5F9EA0';
                      } else {
                        valueCell.textContent = `Object{${Object.keys(value).length} props}`;
                        valueCell.style.color = '#7B68EE';
                      }
                      // No procesamos recursivamente para simplificar
                    } else {
                      valueCell.textContent = String(value);
                      if (typeof value === 'boolean') {
                        valueCell.style.color = value ? '#4CAF50' : '#F44336';
                      } else if (typeof value === 'number') {
                        valueCell.style.color = '#03A9F4';
                      }
                    }
                    
                    row.appendChild(nameCell);
                    row.appendChild(valueCell);
                    tbody.appendChild(row);
                    rowCount++;
                  }
                  
                  return rowCount;
                }
                
                generateTableRows(data);
                
                if (rowCount === 0) {
                  tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 20px;">No se encontraron variables para mostrar</td></tr>';
                }
            } catch (e) {
                console.error('Error al generar filas de la tabla:', e);
                tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 20px; color: #FF5555;">Error al procesar variables: ${e.message}</td></tr>`;
              }
            }, 50);
          }
        }
      } catch (e) {
        console.error('Error general actualizando tabla de variables:', e);
      }
    }
    
    return updateSuccess;
  } catch (e) {
    console.error("Error general en forceUpdateActiveTab:", e);
    return false;
  }
}

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

// Función para enviar evento a la pestaña de eventos
function sendEventToTabEvents(eventData) {
  try {
    // Forma 1: Buscar elemento de la pestaña directamente
    const eventsTab = document.getElementById('events-tab');
    if (eventsTab && typeof eventsTab.addEventToVisibleLog === 'function') {
      eventsTab.addEventToVisibleLog(eventData);
      return true;
    }
    
    // Forma 2: Buscar la función global en el iframe
    const eventsIframe = document.querySelector('iframe[src*="tab-events.html"]');
    if (eventsIframe && eventsIframe.contentWindow) {
      try {
        // Intentar mediante la función adjunta al elemento iframe
        if (typeof eventsIframe.addEventToVisibleLog === 'function') {
          eventsIframe.addEventToVisibleLog(eventData);
          return true;
        }
        
        // Intentar mediante la función global en el contentWindow
        if (typeof eventsIframe.contentWindow.addEventToVisibleLog === 'function') {
          eventsIframe.contentWindow.addEventToVisibleLog(eventData);
          return true;
        }
      } catch (iframeError) {
        console.warn("Error accediendo a iframe:", iframeError);
      }
    }
    
    // Forma 3: Intentar a través de mensajes
    const tabs = document.querySelectorAll('.tab-content');
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      if (tab.id === 'events-tab' || (tab.querySelector && tab.querySelector('iframe[src*="tab-events.html"]'))) {
        // Intentar crear un evento personalizado
        const updateEvent = new CustomEvent('event-update', { detail: eventData });
        tab.dispatchEvent(updateEvent);
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error al enviar evento a la pestaña:", error);
    return false;
  }
}

// Función para enviar info a la pestaña de eventos
function sendInfoToTabEvents(infoData) {
  try {
    // Forma 1: Buscar elemento de la pestaña directamente
    const eventsTab = document.getElementById('events-tab');
    if (eventsTab && typeof eventsTab.addInfoToVisibleLog === 'function') {
      eventsTab.addInfoToVisibleLog(infoData);
      return true;
    }
    
    // Forma 2: Buscar la función global en el iframe
    const eventsIframe = document.querySelector('iframe[src*="tab-events.html"]');
    if (eventsIframe && eventsIframe.contentWindow) {
      try {
        // Intentar mediante la función adjunta al elemento iframe
        if (typeof eventsIframe.addInfoToVisibleLog === 'function') {
          eventsIframe.addInfoToVisibleLog(infoData);
          return true;
        }
        
        // Intentar mediante la función global en el contentWindow
        if (typeof eventsIframe.contentWindow.addInfoToVisibleLog === 'function') {
          eventsIframe.contentWindow.addInfoToVisibleLog(infoData);
          return true;
        }
      } catch (iframeError) {
        console.warn("Error accediendo a iframe:", iframeError);
      }
    }
    
    // Forma 3: Intentar a través de mensajes
    const tabs = document.querySelectorAll('.tab-content');
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      if (tab.id === 'events-tab' || (tab.querySelector && tab.querySelector('iframe[src*="tab-events.html"]'))) {
        // Intentar crear un evento personalizado
        const updateEvent = new CustomEvent('info-update', { detail: infoData });
        tab.dispatchEvent(updateEvent);
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error al enviar info a la pestaña:", error);
    return false;
  }
} 