// ---- GESTOR CENTRALIZADO DE DATOS DEL JUEGO ----
const gameDataManager = {
  currentData: {
    summoner: {
      name: '',
      champion: '',
      level: 0,
      team: '',
      position: '',
      role: ''
    },
    match: {
      gameMode: '',
      gameTime: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
      gold: 0,
      totalDamageDealt: 0,
      totalDamageToChampions: 0,
      visionScore: 0
    },
    combat: {
      damageDealt: 0,
      damageTaken: 0,
      magicDamageDealt: 0,
      physicalDamageDealt: 0,
      trueDamageDealt: 0,
      largestCriticalStrike: 0,
      healingDone: 0
    },
    objectives: {
      turretKills: 0,
      baronKills: 0,
      dragonKills: 0,
      wardPlaced: 0,
      wardKilled: 0
    },
    championStats: {
      abilityPower: 0,
      attackDamage: 0,
      attackSpeed: 0,
      armor: 0,
      magicResist: 0,
      critChance: 0,
      critDamage: 0,
      currentHealth: 0,
      maxHealth: 0,
      moveSpeed: 0,
      tenacity: 0,
      lifeSteal: 0,
      omnivamp: 0,
      physicalVamp: 0,
      spellVamp: 0,
      armorPenetrationFlat: 0,
      armorPenetrationPercent: 0,
      bonusArmorPenetrationPercent: 0,
      magicPenetrationFlat: 0,
      magicPenetrationPercent: 0,
      bonusMagicPenetrationPercent: 0,
      physicalLethality: 0,
      attackRange: 0,
      abilityHaste: 0,
      healShieldPower: 0,
      healthRegenRate: 0,
      resourceMax: 0,
      resourceRegenRate: 0,
      resourceType: '',
      resourceValue: 0,
    },
    events: []
  },
  
  listeners: [],
  
  updateData: function(newData) {
    let dataChanged = false;
    // Helper function to compare and assign, converting to number if possible
    const assignIfChanged = (target, source, targetKey, sourceKey = targetKey) => {
      if (source && source[sourceKey] !== undefined) {
        let value = source[sourceKey];
        // Attempt to parse numerical values, handle potential errors
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            value = parsed;
          }
        }
        if (target[targetKey] !== value) {
          target[targetKey] = value;
          dataChanged = true;
          console.log(`[GDM] Changed ${targetKey} to ${value} from source.${sourceKey}`);
        }
      }
    };
    
    console.log('[GDM] updateData raw input:', JSON.stringify(newData).substring(0, 500)); // Log raw input (truncated)
    
    // --- Determine data sources --- 
    const info = newData.info; // Data might be nested under 'info'
    const gameInfo = info?.game_info ?? newData.game_info;
    const damageInfo = info?.damage ?? newData.damage;
    const healInfo = info?.heal ?? newData.heal;
    const visionInfo = info?.vision ?? newData.vision; // Assuming vision might also be nested
    const objectivesInfo = info?.objectives ?? newData.objectives;
    const summonerInfo = info?.summoner_info ?? newData.summoner;
    const matchInfo = info?.match_info ?? newData.match;
    const combatInfo = info?.combat ?? newData.combat;
    const championStatsInfo = info?.championStats ?? newData.championStats;
    const liveClientData = info?.live_client_data ?? newData.live_client_data;
    const events = info?.events ?? newData.events; // Events might also be under info

    // --- Update Summoner --- 
    this.currentData.summoner = this.currentData.summoner || {};
    if (summonerInfo) {
      assignIfChanged(this.currentData.summoner, summonerInfo, 'name');
      assignIfChanged(this.currentData.summoner, summonerInfo, 'champion');
      assignIfChanged(this.currentData.summoner, summonerInfo, 'level');
      assignIfChanged(this.currentData.summoner, summonerInfo, 'team');
      assignIfChanged(this.currentData.summoner, summonerInfo, 'position');
      assignIfChanged(this.currentData.summoner, summonerInfo, 'role');
    }
    // Extra level source
    if (newData.level !== undefined) { // Check top level 'level'
       assignIfChanged(this.currentData.summoner, newData, 'level');
    }

    // --- Update Match --- 
    this.currentData.match = this.currentData.match || {};
    if (matchInfo) {
      assignIfChanged(this.currentData.match, matchInfo, 'gameMode');
      assignIfChanged(this.currentData.match, matchInfo, 'gameTime');
      assignIfChanged(this.currentData.match, matchInfo, 'kills');
      assignIfChanged(this.currentData.match, matchInfo, 'deaths');
      assignIfChanged(this.currentData.match, matchInfo, 'assists');
      assignIfChanged(this.currentData.match, matchInfo, 'cs');
      assignIfChanged(this.currentData.match, matchInfo, 'gold');
    }
    // Extra sources from game_info
    if (gameInfo) {
      assignIfChanged(this.currentData.match, gameInfo, 'gold');
      assignIfChanged(this.currentData.match, gameInfo, 'kills');
      assignIfChanged(this.currentData.match, gameInfo, 'deaths');
      assignIfChanged(this.currentData.match, gameInfo, 'assists');
      assignIfChanged(this.currentData.match, gameInfo, 'doubleKills');
      // Calculate CS from minionKills + neutralMinionKills
      if (gameInfo.minionKills !== undefined) {
          const totalCS = (parseInt(gameInfo.minionKills) || 0) + (parseInt(gameInfo.neutralMinionKills) || 0);
          if (this.currentData.match.cs !== totalCS) {
              this.currentData.match.cs = totalCS;
              dataChanged = true;
              console.log(`[GDM] Calculated CS to ${totalCS}`);
          }
      }
    }
     // Extra sources from top level 
     if (newData.gold !== undefined) assignIfChanged(this.currentData.match, newData, 'gold');
     if (newData.minions) {
       const totalCS = (parseInt(newData.minions.minionKills) || 0) + (parseInt(newData.minions.neutralMinionKills) || 0);
       if (this.currentData.match.cs !== totalCS) {
         this.currentData.match.cs = totalCS;
         dataChanged = true;
         console.log(`[GDM] Calculated CS from top-level minions to ${totalCS}`);
       }
     }
     if (newData.gameMode !== undefined) assignIfChanged(this.currentData.match, newData, 'gameMode');
     if (newData.counters?.match_clock !== undefined) {
         assignIfChanged(this.currentData.match, newData.counters, 'gameTime', 'match_clock');
     }
     // KDA from top level kill/death/assist objects
     if (newData.kill?.kills !== undefined) assignIfChanged(this.currentData.match, newData.kill, 'kills');
     if (newData.death?.deaths !== undefined) assignIfChanged(this.currentData.match, newData.death, 'deaths');
     if (newData.assist?.assists !== undefined) assignIfChanged(this.currentData.match, newData.assist, 'assists');

    // --- Update Combat --- 
    this.currentData.combat = this.currentData.combat || {};
    if (combatInfo) { // Prioritize data already structured as 'combat'
        assignIfChanged(this.currentData.combat, combatInfo, 'damageDealt');
        assignIfChanged(this.currentData.combat, combatInfo, 'damageTaken');
        assignIfChanged(this.currentData.combat, combatInfo, 'damageDealtToChampions');
        assignIfChanged(this.currentData.combat, combatInfo, 'healingDone');
    }
    if (damageInfo) { // Map from damageInfo object
      assignIfChanged(this.currentData.combat, damageInfo, 'damageDealt', 'total_damage_dealt');
      assignIfChanged(this.currentData.combat, damageInfo, 'damageDealtToChampions', 'total_damage_dealt_to_champions');
      assignIfChanged(this.currentData.combat, damageInfo, 'damageTaken', 'total_damage_taken');
      assignIfChanged(this.currentData.combat, damageInfo, 'damageSelfMitigated', 'total_damage_self_mitigated');
      assignIfChanged(this.currentData.combat, damageInfo, 'damageToObjectives', 'total_damage_dealt_to_objectives');
      // Choose one source for building damage
      const buildingDmg = damageInfo.total_damage_dealt_to_buildings ?? damageInfo.total_damage_dealt_to_turrets;
      if (buildingDmg !== undefined && this.currentData.combat.damageToBuildings !== buildingDmg) {
          this.currentData.combat.damageToBuildings = buildingDmg;
          dataChanged = true;
           console.log(`[GDM] Changed damageToBuildings to ${buildingDmg}`);
      }
    }
    if (healInfo) { // Map from healInfo object
      assignIfChanged(this.currentData.combat, healInfo, 'healingDone', 'total_heal');
    }

    // --- Update Objectives --- 
    this.currentData.objectives = this.currentData.objectives || {};
    if (objectivesInfo) {
      assignIfChanged(this.currentData.objectives, objectivesInfo, 'turretKills');
      assignIfChanged(this.currentData.objectives, objectivesInfo, 'baronKills');
      assignIfChanged(this.currentData.objectives, objectivesInfo, 'dragonKills');
      assignIfChanged(this.currentData.objectives, objectivesInfo, 'wardPlaced'); // Note: might conflict with visionInfo
      assignIfChanged(this.currentData.objectives, objectivesInfo, 'wardKilled'); // Note: might conflict with visionInfo
    }

    // --- Update Vision --- 
    this.currentData.vision = this.currentData.vision || {};
    if (visionInfo) {
       assignIfChanged(this.currentData.vision, visionInfo, 'wardsPlaced');
       assignIfChanged(this.currentData.vision, visionInfo, 'wardsDestroyed');
    }
    // Get vision from objectivesInfo if not in visionInfo
    if (objectivesInfo && this.currentData.vision.wardsPlaced === undefined) {
        assignIfChanged(this.currentData.vision, objectivesInfo, 'wardsPlaced', 'wardPlaced');
    }
     if (objectivesInfo && this.currentData.vision.wardsDestroyed === undefined) {
        assignIfChanged(this.currentData.vision, objectivesInfo, 'wardsDestroyed', 'wardKilled');
    }
    // Also check top level ward object
    if (newData.ward) {
        if (this.currentData.vision.wardsPlaced === undefined) assignIfChanged(this.currentData.vision, newData.ward, 'wardsPlaced', 'placed');
        if (this.currentData.vision.wardsDestroyed === undefined) assignIfChanged(this.currentData.vision, newData.ward, 'wardsDestroyed', 'destroyed');
    }

    // --- Update Champion Stats --- 
    this.currentData.championStats = this.currentData.championStats || {};
    if (championStatsInfo) {
        Object.keys(this.currentData.championStats).forEach(key => {
            // Usar assignIfChanged para actualizar solo si el valor existe en la fuente
            assignIfChanged(this.currentData.championStats, championStatsInfo, key);
        });
    }

    // --- Process Events --- 
    if (events && Array.isArray(events) && events.length > 0) {
      const initialLength = this.currentData.events.length;
      const currentEventStrings = new Set(this.currentData.events.map(e => JSON.stringify(e)));
      const newEventsToAdd = events.filter(e => !currentEventStrings.has(JSON.stringify(e)));
      
      if (newEventsToAdd.length > 0) {
        // Add timestamp if missing
        const now = Date.now();
        const eventsWithTimestamp = newEventsToAdd.map(e => ({ timestamp: now, ...e }));
        this.currentData.events = this.currentData.events.concat(eventsWithTimestamp);
        // Limitar tamaño del log de eventos
        if (this.currentData.events.length > 100) {
          this.currentData.events = this.currentData.events.slice(-100);
        }
        dataChanged = true;
        console.log(`[GDM] Added ${newEventsToAdd.length} new events.`);
      }
    }
    
    // Notificar solo si hubo cambios reales
    if (dataChanged) {
      console.log('[GDM] Notificando listeners porque hubo cambios');
      this.notifyListeners();
      this.showDataMarker(); // Mostrar marcador visual
    } else {
       console.log('[GDM] No hubo cambios detectados, no se notificará');
    }
  },
  
  subscribe: function(callback) {
    console.log('gameDataManager.subscribe llamado');
    if (typeof callback === 'function' && !this.listeners.includes(callback)) {
      this.listeners.push(callback);
      console.log(`Nuevo listener añadido. Total: ${this.listeners.length}`);
      callback(this.currentData);
    }
    return this;
  },
  
  unsubscribe: function(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
    return this;
  },
  
  notifyListeners: function() {
    console.log(`Notificando a ${this.listeners.length} listeners con datos:`, 
      JSON.stringify({
        summoner: this.currentData.summoner.name,
        gameTime: this.currentData.match.gameTime,
        kda: `${this.currentData.match.kills}/${this.currentData.match.deaths}/${this.currentData.match.assists}`
      })
    );
    
    this.listeners.forEach(callback => {
      try {
        callback(this.currentData);
      } catch (e) {
        console.error('Error en listener de datos:', e);
      }
    });
  },
  
  getData: function() {
    return JSON.parse(JSON.stringify(this.currentData));
  },
  
  // NUEVO: Método para mostrar un marcador visual de actualización de datos
  showDataMarker: function() {
    // Crear o actualizar un marcador visual para debugging
    let marker = document.getElementById('data-update-marker');
    if (!marker) {
      marker = document.createElement('div');
      marker.id = 'data-update-marker';
      marker.style.position = 'fixed';
      marker.style.bottom = '10px';
      marker.style.right = '10px';
      marker.style.background = 'rgba(0, 128, 0, 0.7)';
      marker.style.color = 'white';
      marker.style.padding = '5px 10px';
      marker.style.borderRadius = '5px';
      marker.style.fontSize = '12px';
      marker.style.zIndex = '9999';
      document.body.appendChild(marker);
    }
    
    marker.textContent = `Datos actualizados: ${new Date().toLocaleTimeString()} - ${this.currentData.summoner.name} (${this.currentData.match.kills}/${this.currentData.match.deaths}/${this.currentData.match.assists})`;
    
    // Efecto de parpadeo
    marker.style.animation = 'none';
    marker.offsetHeight; // Forzar reflow
    marker.style.animation = 'blink 0.5s';
  }
}; 