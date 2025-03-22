/**
 * Gestor de la pestaña de resumen
 * Este script se encarga de actualizar la pestaña de resumen con datos en tiempo real de Overwolf
 */

// Clase para gestionar la pestaña de resumen
class OverviewManager {
  constructor() {
    // Referencias a elementos del DOM
    this.playerName = document.getElementById('player-name');
    this.playerRole = document.getElementById('player-role');
    this.playerRoleIcon = document.getElementById('player-role-icon');
    this.playerChampionIcon = document.getElementById('player-champion-icon');
    this.matchTime = document.getElementById('match-time');
    this.blueTeamScore = document.getElementById('blue-team-score');
    this.redTeamScore = document.getElementById('red-team-score');
    
    // Elementos para los retos
    this.wardChallengeProgress = document.getElementById('ward-challenge-progress');
    this.wardChallengeText = document.getElementById('ward-challenge-text');
    this.objectiveChallengeProgress = document.getElementById('objective-challenge-progress');
    this.objectiveChallengeText = document.getElementById('objective-challenge-text');
    this.csChallengeProgress = document.getElementById('cs-challenge-progress');
    this.csChallengeText = document.getElementById('cs-challenge-text');
    
    // Elementos del radar
    this.radarCS = document.getElementById('radar-cs');
    this.radarKDA = document.getElementById('radar-kda');
    this.radarDMG = document.getElementById('radar-dmg');
    this.radarVIS = document.getElementById('radar-vis');
    this.radarOBJ = document.getElementById('radar-obj');
    this.performanceScore = document.getElementById('performance-score');
    
    // Estado del juego
    this.gameData = {
      playerName: 'Summoner',
      playerTeam: 'ORDER', // 'ORDER' o 'CHAOS'
      playerRole: 'MIDDLE',
      playerChampion: 'Unknown',
      matchTime: 0,
      blueKills: 0,
      redKills: 0,
      playerStats: {
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        gold: 0,
        wardsPlaced: 0,
        objectivesParticipation: 0
      },
      opponentStats: {
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0
      }
    };
    
    // Mapeo de roles a iconos
    this.roleIcons = {
      'TOP': '⚔️',
      'JUNGLE': '🌳',
      'MIDDLE': '🧙',
      'BOTTOM': '🏹',
      'UTILITY': '🛡️',
      'UNKNOWN': '🎮'
    };
    
    // Mapeo de roles a nombres en español
    this.roleNames = {
      'TOP': 'Superior',
      'JUNGLE': 'Jungla',
      'MIDDLE': 'Medio',
      'BOTTOM': 'Inferior',
      'UTILITY': 'Soporte',
      'UNKNOWN': 'Desconocido'
    };
    
    // Objetivos de los retos
    this.challenges = {
      wards: {
        target: 10,
        current: 0
      },
      objectives: {
        target: 5,
        current: 0
      },
      cs: {
        target: 150,
        current: 0
      }
    };
    
    // Inicialización
    this.init();
  }
  
  /**
   * Inicializa el gestor de resumen
   */
  init() {
    console.log('Inicializando OverviewManager...');
    
    // Registrar para eventos de actualización de la pestaña
    document.addEventListener('tabContentLoaded', event => {
      if (event.detail.tabId === 'overview-tab') {
        console.log('Pestaña de resumen cargada, actualizando datos...');
        this.updateAllElements();
      }
    });
    
    // Escuchar eventos del juego
    this.registerGameEvents();
  }
  
  /**
   * Registra los manejadores de eventos del juego
   */
  registerGameEvents() {
    // Escuchar actualizaciones de información del juego
    overwolf.games.events.onInfoUpdates2.addListener(this.handleInfoUpdates.bind(this));
    
    // Escuchar nuevos eventos del juego
    overwolf.games.events.onNewEvents.addListener(this.handleNewEvents.bind(this));
    
    console.log('Eventos de juego registrados para la pestaña de resumen');
  }
  
  /**
   * Maneja las actualizaciones de información del juego
   * @param {Object} info - Información actualizada del juego
   */
  handleInfoUpdates(info) {
    if (!info || !info.info) return;
    
    // Procesar información del juego
    if (info.info.game_info) {
      if (info.info.game_info.time) {
        this.gameData.matchTime = parseInt(info.info.game_info.time);
        this.updateMatchTime();
      }
    }
    
    // Información del jugador
    if (info.info.summoner_info) {
      if (info.info.summoner_info.name) {
        this.gameData.playerName = info.info.summoner_info.name;
        this.updatePlayerName();
      }
      
      if (info.info.summoner_info.position) {
        this.gameData.playerRole = info.info.summoner_info.position;
        this.updatePlayerRole();
      }
      
      if (info.info.summoner_info.champion) {
        this.gameData.playerChampion = info.info.summoner_info.champion;
        this.updatePlayerChampion();
      }
      
      if (info.info.summoner_info.team) {
        this.gameData.playerTeam = info.info.summoner_info.team;
      }
    }
    
    // Información de kill/muerte/asistencia
    if (info.info.live_client_data) {
      if (info.info.live_client_data.active_player) {
        const activePlayer = info.info.live_client_data.active_player;
        
        if (activePlayer.scores) {
          this.gameData.playerStats.kills = parseInt(activePlayer.scores.kills || 0);
          this.gameData.playerStats.deaths = parseInt(activePlayer.scores.deaths || 0);
          this.gameData.playerStats.assists = parseInt(activePlayer.scores.assists || 0);
          this.gameData.playerStats.cs = parseInt(activePlayer.scores.creepScore || 0);
          this.gameData.playerStats.wardsPlaced = parseInt(activePlayer.scores.wardScore || 0);
          
          // Actualizar retos
          this.updateChallenges();
          
          // Actualizar radar
          this.updateRadarStats();
        }
      }
      
      // Actualizar puntuación del equipo
      if (info.info.live_client_data.teams) {
        const teams = info.info.live_client_data.teams;
        
        if (teams.order) {
          this.gameData.blueKills = parseInt(teams.order.objectives.champion.kills || 0);
        }
        
        if (teams.chaos) {
          this.gameData.redKills = parseInt(teams.chaos.objectives.champion.kills || 0);
        }
        
        this.updateTeamScores();
      }
    }
  }
  
  /**
   * Maneja nuevos eventos del juego
   * @param {Object} e - Nuevos eventos del juego
   */
  handleNewEvents(e) {
    if (!e || !e.events) return;
    
    for (const event of e.events) {
      switch (event.name) {
        case 'ward_placed':
          this.gameData.playerStats.wardsPlaced++;
          this.updateChallenges();
          break;
          
        case 'dragon_kill':
        case 'herald_kill':
        case 'baron_kill':
          if (event.data && event.data.participating) {
            this.gameData.playerStats.objectivesParticipation++;
            this.updateChallenges();
          }
          break;
          
        case 'match_start':
          this.resetChallenges();
          break;
          
        case 'match_end':
          console.log('Partida finalizada');
          break;
      }
    }
  }
  
  /**
   * Actualiza el nombre del jugador en la interfaz
   */
  updatePlayerName() {
    if (this.playerName) {
      this.playerName.textContent = this.gameData.playerName;
    }
  }
  
  /**
   * Actualiza el rol del jugador en la interfaz
   */
  updatePlayerRole() {
    if (this.playerRole) {
      const role = this.gameData.playerRole || 'UNKNOWN';
      this.playerRole.textContent = this.roleNames[role] || 'Desconocido';
    }
    
    if (this.playerRoleIcon) {
      const role = this.gameData.playerRole || 'UNKNOWN';
      this.playerRoleIcon.textContent = this.roleIcons[role] || '🎮';
    }
  }
  
  /**
   * Actualiza el campeón del jugador en la interfaz
   */
  updatePlayerChampion() {
    if (this.playerChampionIcon) {
      // Aquí podríamos cargar el icono real del campeón
      // Por ahora, usamos emojis según el rol
      const role = this.gameData.playerRole || 'UNKNOWN';
      this.playerChampionIcon.textContent = this.roleIcons[role] || '👤';
    }
  }
  
  /**
   * Actualiza el tiempo de partida en la interfaz
   */
  updateMatchTime() {
    if (this.matchTime) {
      this.matchTime.textContent = this.formatTime(this.gameData.matchTime);
    }
  }
  
  /**
   * Actualiza las puntuaciones de los equipos en la interfaz
   */
  updateTeamScores() {
    if (this.blueTeamScore) {
      this.blueTeamScore.textContent = this.gameData.blueKills;
    }
    
    if (this.redTeamScore) {
      this.redTeamScore.textContent = this.gameData.redKills;
    }
  }
  
  /**
   * Actualiza los retos del jugador
   */
  updateChallenges() {
    // Actualizar el reto de wards
    this.challenges.wards.current = this.gameData.playerStats.wardsPlaced;
    const wardProgress = Math.min(100, (this.challenges.wards.current / this.challenges.wards.target) * 100);
    
    if (this.wardChallengeProgress) {
      this.wardChallengeProgress.style.width = `${wardProgress}%`;
    }
    
    if (this.wardChallengeText) {
      this.wardChallengeText.textContent = `${this.challenges.wards.current}/${this.challenges.wards.target}`;
    }
    
    // Actualizar el reto de objetivos
    this.challenges.objectives.current = this.gameData.playerStats.objectivesParticipation;
    const objectiveProgress = Math.min(100, (this.challenges.objectives.current / this.challenges.objectives.target) * 100);
    
    if (this.objectiveChallengeProgress) {
      this.objectiveChallengeProgress.style.width = `${objectiveProgress}%`;
    }
    
    if (this.objectiveChallengeText) {
      this.objectiveChallengeText.textContent = `${this.challenges.objectives.current}/${this.challenges.objectives.target}`;
    }
    
    // Actualizar el reto de CS
    this.challenges.cs.current = this.gameData.playerStats.cs;
    const csProgress = Math.min(100, (this.challenges.cs.current / this.challenges.cs.target) * 100);
    
    if (this.csChallengeProgress) {
      this.csChallengeProgress.style.width = `${csProgress}%`;
    }
    
    if (this.csChallengeText) {
      this.csChallengeText.textContent = `${this.challenges.cs.current}/${this.challenges.cs.target}`;
    }
  }
  
  /**
   * Actualiza las estadísticas del radar
   */
  updateRadarStats() {
    // Aquí simularemos una comparación con el oponente
    // En un caso real, estas métricas vendrían de la API o se calcularían con datos reales
    
    // CS: Comparamos nuestro CS con un valor "esperado" basado en el tiempo de juego
    const expectedCS = Math.min(200, this.gameData.matchTime / 60 * 7); // Aprox 7 CS por minuto
    const csRatio = this.gameData.playerStats.cs / (expectedCS || 1);
    const csValue = Math.min(100, Math.max(0, csRatio * 80)); // Escalar a un porcentaje (máx 100%)
    
    // KDA: (Kills + Assists) / (Deaths || 1)
    const kda = (this.gameData.playerStats.kills + this.gameData.playerStats.assists) / 
               (this.gameData.playerStats.deaths || 1);
    const kdaValue = Math.min(100, Math.max(0, kda * 25)); // Escalar (un KDA de 4 sería 100%)
    
    // Para los otros valores, usamos datos simulados
    const dmgValue = 50 + Math.random() * 30; // Entre 50-80%
    const visValue = 40 + Math.random() * 25; // Entre 40-65%
    const objValue = 45 + Math.random() * 35; // Entre 45-80%
    
    // Actualizar el radar
    if (this.radarCS) {
      this.radarCS.style.setProperty('--stat-value', `${csValue}%`);
    }
    
    if (this.radarKDA) {
      this.radarKDA.style.setProperty('--stat-value', `${kdaValue}%`);
    }
    
    if (this.radarDMG) {
      this.radarDMG.style.setProperty('--stat-value', `${dmgValue}%`);
    }
    
    if (this.radarVIS) {
      this.radarVIS.style.setProperty('--stat-value', `${visValue}%`);
    }
    
    if (this.radarOBJ) {
      this.radarOBJ.style.setProperty('--stat-value', `${objValue}%`);
    }
    
    // Actualizar puntuación general
    const totalScore = (csValue + kdaValue + dmgValue + visValue + objValue) / 5;
    let scoreGrade = 'C';
    
    if (totalScore >= 90) scoreGrade = 'S';
    else if (totalScore >= 80) scoreGrade = 'A+';
    else if (totalScore >= 70) scoreGrade = 'A';
    else if (totalScore >= 60) scoreGrade = 'B+';
    else if (totalScore >= 50) scoreGrade = 'B';
    else if (totalScore >= 40) scoreGrade = 'C+';
    
    if (this.performanceScore) {
      this.performanceScore.textContent = scoreGrade;
    }
  }
  
  /**
   * Reinicia los retos para una nueva partida
   */
  resetChallenges() {
    this.challenges = {
      wards: {
        target: 10,
        current: 0
      },
      objectives: {
        target: 5,
        current: 0
      },
      cs: {
        target: 150,
        current: 0
      }
    };
    
    this.updateChallenges();
  }
  
  /**
   * Actualiza todos los elementos de la interfaz con los datos actuales
   */
  updateAllElements() {
    this.updatePlayerName();
    this.updatePlayerRole();
    this.updatePlayerChampion();
    this.updateMatchTime();
    this.updateTeamScores();
    this.updateChallenges();
    this.updateRadarStats();
  }
  
  /**
   * Formatea un tiempo en segundos a formato MM:SS
   * @param {number} seconds - Tiempo en segundos
   * @returns {string} Tiempo formateado
   */
  formatTime(seconds) {
    if (!seconds) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Iniciar el gestor cuando se cargue la pestaña
document.addEventListener('DOMContentLoaded', () => {
  console.log('Inicializando gestor de resumen...');
  window.overviewManager = new OverviewManager();
}); 