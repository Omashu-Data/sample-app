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

// Aquí irá el resto del código que moveremos después
// (registerEvents, unregisterEvents, setFeatures, etc.) 