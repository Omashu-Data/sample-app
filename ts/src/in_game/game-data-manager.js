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
    events: []
  },
  
  listeners: [],
  
  updateData: function(newData) {
    console.log('gameDataManager.updateData llamado con:', 
      JSON.stringify({
        summoner: newData.summoner ? newData.summoner.name : 'no disponible',
        gameTime: newData.match ? newData.match.gameTime : 'no disponible',
        kda: newData.match ? `${newData.match.kills}/${newData.match.deaths}/${newData.match.assists}` : 'no disponible'
      })
    );
    
    if (newData.summoner) {
      Object.assign(this.currentData.summoner, newData.summoner);
    }
    if (newData.match) {
      Object.assign(this.currentData.match, newData.match);
    }
    if (newData.combat) {
      Object.assign(this.currentData.combat, newData.combat);
    }
    if (newData.objectives) {
      Object.assign(this.currentData.objectives, newData.objectives);
    }
    if (newData.events && newData.events.length > 0) {
      this.currentData.events = this.currentData.events.concat(newData.events);
      if (this.currentData.events.length > 100) {
        this.currentData.events = this.currentData.events.slice(-100);
      }
    }
    
    this.notifyListeners();
    
    // NUEVO: Mostrar un marcador visible para depurar
    this.showDataMarker();
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