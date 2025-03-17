import {
  OWGames,
  OWGamesEvents,
  OWHotkeys,
  OWWindow
} from "@overwolf/overwolf-api-ts";

import { AppWindow } from "../AppWindow";
import { kHotkeys, kWindowNames, kGamesFeatures } from "../consts";

import WindowState = overwolf.windows.WindowStateEx;
import { HeatmapManager } from './heatmap';
import { initializeAds } from './ads'; // Importar el módulo de anuncios

// Interfaz para los datos del jugador
interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  level: number;
  gold: number;
  gameTime: number; // en segundos
  gameMode: string;
}

// Interfaces para el sistema de mejora
interface PlayerStrength {
  id: string;
  icon: string;
  text: string;
  value: number;
}

interface PlayerWeakness {
  id: string;
  icon: string;
  text: string;
  value: number;
  targetValue: number;
}

interface PlayerGoal {
  id: string;
  title: string;
  description: string;
  tip: string;
  currentValue: number;
  targetValue: number;
  progress: number; // 0-100
}

interface PlayerTip {
  id: string;
  icon: string;
  title: string;
  content: string;
  category: string;
}

// Interfaces para el sistema de gamificación
interface PlayerAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  currentValue: number;
  targetValue: number;
  xpReward: number;
  unlocked: boolean;
}

interface PlayerMilestone {
  id: string;
  name: string;
  icon: string;
  level: string;
  completed: boolean;
  current: boolean;
}

interface PlayerLevel {
  level: number;
  currentXP: number;
  requiredXP: number;
}

// La ventana que se muestra en juego mientras League of Legends está en ejecución.
// Implementa las siguientes funcionalidades:
// 1. Mostrar métricas en tiempo real
// 2. Grabar clips automáticamente al detectar una kill
// 3. Integrar publicidad para monetización
// 4. Conectarse al servidor web
class InGameLOL extends AppWindow {
  private static _instance: InGameLOL;
  private _windows: Record<string, OWWindow>;
  
  // Elementos HTML
  private _killsValue: HTMLElement;
  private _deathsValue: HTMLElement;
  private _assistsValue: HTMLElement;
  private _csValue: HTMLElement;
  private _levelValue: HTMLElement;
  private _goldValue: HTMLElement;
  private _gameTimeValue: HTMLElement;
  private _gameModeValue: HTMLElement;
  private _dpsValue: HTMLElement;
  private _kdaValue: HTMLElement;
  private _cspmValue: HTMLElement;
  private _eventsLog: HTMLElement;
  private _clipNotification: HTMLElement;
  private _adContainer: HTMLElement;
  
  // Elementos para la pestaña de mejora
  private _strengthsList: HTMLElement;
  private _weaknessesList: HTMLElement;
  private _goalsList: HTMLElement;
  private _tipsContainer: HTMLElement;
  
  // Datos del jugador
  private _playerStats: PlayerStats = {
    kills: 0,
    deaths: 0,
    assists: 0,
    cs: 0,
    level: 1,
    gold: 0,
    gameTime: 0,
    gameMode: "CLASSIC"
  };
  
  // Datos para el sistema de mejora
  private _playerStrengths: PlayerStrength[] = [];
  private _playerWeaknesses: PlayerWeakness[] = [];
  private _playerGoals: PlayerGoal[] = [];
  private _playerTips: PlayerTip[] = [];
  
  // Configuración para clips
  private _clipDuration: number = 15; // duración en segundos
  private _clipsFolder: string = ''; // carpeta donde se guardan los clips
  private _clipsList: any[] = []; // lista de clips guardados
  private _isRecording: boolean = false;
  private _lastDamageValues: number[] = [];
  private _gameClassId: number = null;
  
  // Intervalo para consultar la API de Live Client Data
  private _liveClientInterval: number = null;
  
  // Valores de referencia para análisis
  private readonly _referenceValues = {
    csPerMin: {
      bronze: 5.0,
      silver: 6.0,
      gold: 7.0,
      platinum: 8.0,
      diamond: 9.0
    },
    kda: {
      bronze: 2.0,
      silver: 2.5,
      gold: 3.0,
      platinum: 3.5,
      diamond: 4.0
    },
    goldPerMin: {
      bronze: 300,
      silver: 350,
      gold: 400,
      platinum: 450,
      diamond: 500
    }
  };
  
  private interestingFeatures = [
    'counters',
    'match_info',
    'game_info',
    'location',  // Añadido para el mapa de calor
    'kill',      // Añadido para el mapa de calor
    'death',     // Añadido para el mapa de calor
    'assist',    // Añadido para el mapa de calor
    'objective'  // Añadido para el mapa de calor
  ];
  private heatmapManager: HeatmapManager;

  // Elementos para el sistema de gamificación
  private _userLevel: PlayerLevel = {
    level: 7,
    currentXP: 650,
    requiredXP: 1000
  };
  
  private _achievements: PlayerAchievement[] = [];
  private _milestones: PlayerMilestone[] = [];
  private _streakDays: number = 3;
  private _totalAchievements: number = 20;
  private _unlockedAchievements: number = 12;
  
  private _levelBadge: HTMLElement;
  private _xpBar: HTMLElement;
  private _xpText: HTMLElement;
  private _rewardNotification: HTMLElement;

  private constructor() {
    super(kWindowNames.inGame);

    this._windows = {};
    this._windows[kWindowNames.inGame] = new OWWindow(kWindowNames.inGame);

    // Inicializar el mapa de calor
    this.heatmapManager = new HeatmapManager();

    // Configurar las teclas rápidas cuando se carga la ventana
    this.setupHotkeys();
  }

  public static instance(): InGameLOL {
    if (!this._instance) {
      this._instance = new InGameLOL();
    }

    return this._instance;
  }

  public async run() {
    const gameClassId = await this.getCurrentGameClassId();
    if (!gameClassId) {
      return;
    }

    this._gameClassId = gameClassId;

    console.log(`Juego detectado: ${gameClassId}`);
    this.logEvent("Sistema", `Juego detectado: League of Legends`);

    // Inicializar elementos UI
    this.initializeUIElements();

    // Resetear estadísticas
    this.resetStats();

    // Iniciar intervalo para consultar datos de Live Client
    this.startLiveClientPolling();

    // Inicializar la captura de clips
    this.initializeClipCapture();
    
    // Cargar clips guardados
    this.loadSavedClips();

    // Registrar eventos del juego
    this.registerEvents();

    // Configurar botones de la interfaz
    this.setupButtons();

    // Inicializar la interfaz
    await this.init();
  }

  private initializeUIElements() {
    try {
      // Obtener referencias a todos los elementos de la UI
      this._killsValue = document.getElementById('kills-value');
      this._deathsValue = document.getElementById('deaths-value');
      this._assistsValue = document.getElementById('assists-value');
      this._csValue = document.getElementById('cs-value');
      this._levelValue = document.getElementById('level-value');
      this._goldValue = document.getElementById('gold-value');
      this._gameTimeValue = document.getElementById('game-time-value');
      this._gameModeValue = document.getElementById('game-mode-value');
      this._dpsValue = document.getElementById('dps-value');
      this._kdaValue = document.getElementById('kda-value');
      this._cspmValue = document.getElementById('cspm-value');
      this._eventsLog = document.getElementById('events-log');
      this._clipNotification = document.getElementById('clip-notification');
      
      // Elementos para la pestaña de mejora
      this._strengthsList = document.getElementById('strengths-list');
      this._weaknessesList = document.getElementById('weaknesses-list');
      this._goalsList = document.getElementById('goals-list');
      this._tipsContainer = document.getElementById('tips-container');
      
      // Elementos para el sistema de gamificación
      this._levelBadge = document.getElementById('level-badge');
      this._xpBar = document.getElementById('xp-bar');
      this._xpText = document.getElementById('xp-text');
      this._rewardNotification = document.getElementById('reward-notification');
      
      // Verificar que todos los elementos existen
      if (!this._killsValue || !this._deathsValue || !this._assistsValue || 
          !this._csValue || !this._levelValue || !this._goldValue || 
          !this._gameTimeValue || !this._gameModeValue || !this._dpsValue || 
          !this._kdaValue || !this._cspmValue || !this._eventsLog || 
          !this._clipNotification || !this._strengthsList || !this._weaknessesList ||
          !this._goalsList || !this._tipsContainer || !this._levelBadge || !this._xpBar || !this._xpText || !this._rewardNotification) {
        console.error('No se pudieron inicializar todos los elementos UI');
        this.logEvent("Error", "No se pudieron inicializar todos los elementos UI");
      } else {
        console.log('Elementos UI inicializados correctamente');
        this.logEvent("Sistema", "Interfaz de usuario inicializada");
        
        // Inicializar datos de ejemplo para la pestaña de mejora
        this.initializeImprovementData();
        
        // Inicializar datos de gamificación
        this.initializeGamificationData();
      }
    } catch (e) {
      console.error('Error inicializando elementos UI:', e);
    }
  }

  private onInfoUpdates(info) {
    console.log('Info update recibido:', JSON.stringify(info));
    
    try {
      // Función para actualizar elementos directamente
      const updateElementText = (id, value) => {
        this.updateElementText(id, value);
      };

      // Actualizar CS desde múltiples fuentes posibles para mayor robustez
      const updateCS = (cs) => {
        if (cs !== undefined && !isNaN(parseInt(cs))) {
          this._playerStats.cs = parseInt(cs);
          updateElementText('cs-value', cs);
          console.log(`CS actualizado: ${cs}`);
          
          // Actualizar también CSPM
          this.updatePerformanceMetrics();
        }
      };
      
      // Comprobación específica para información de League of Legends
      if (info.live_client_data) {
        // Intentar obtener información del tiempo de juego
        if (info.live_client_data.game_data && info.live_client_data.game_data.gameTime) {
          const gameTime = Math.floor(parseFloat(info.live_client_data.game_data.gameTime));
          this._playerStats.gameTime = gameTime;
          updateElementText('game-time-value', this.formatGameTime(gameTime));
        }
        
        // Intentar obtener información del jugador activo
        if (info.live_client_data.active_player) {
          // Oro
          if (info.live_client_data.active_player.currentGold) {
            const gold = parseInt(info.live_client_data.active_player.currentGold);
            this._playerStats.gold = gold;
            updateElementText('gold-value', gold);
          }
          
          // Puntuación de CS
          if (info.live_client_data.active_player.minionsKilled) {
            updateCS(info.live_client_data.active_player.minionsKilled);
          }
          
          // CS alternativo (scores)
          if (info.live_client_data.active_player.scores && 
              (info.live_client_data.active_player.scores.creepScore !== undefined || 
               info.live_client_data.active_player.scores.minionsKilled !== undefined)) {
            const cs = info.live_client_data.active_player.scores.creepScore || 
                       info.live_client_data.active_player.scores.minionsKilled;
            updateCS(cs);
          }
        }
      }
      
      // Actualizar contadores (formato original)
      if (info.counters) {
        if (info.counters.gold) {
          this._playerStats.gold = parseInt(info.counters.gold);
          updateElementText('gold-value', info.counters.gold);
        }
        
        // Comprobar múltiples nombres posibles para CS
        if (info.counters.minions_killed) {
          updateCS(info.counters.minions_killed);
        }
        
        if (info.counters.cs) {
          updateCS(info.counters.cs);
        }
        
        if (info.counters.creep_score) {
          updateCS(info.counters.creep_score);
        }
        
        if (info.counters.creepScore) {
          updateCS(info.counters.creepScore);
        }
      }
      
      // Actualizar métricas de rendimiento
      this.updatePerformanceMetrics();

      // Si hay información de ubicación, actualizar el mapa de calor
      if (info.location) {
        console.log('Actualización de ubicación recibida:', info.location);
      }
    } catch (e) {
      console.error('Error procesando actualización de información:', e);
    }
  }

  private onNewEvents(e) {
    console.log('Nuevos eventos recibidos:', e);
    
    if (!e || !e.events) {
      return;
    }
    
    try {
      // Función para actualizar elementos directamente
      const updateElementText = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value.toString();
        } else {
          console.error(`No se encontró el elemento con ID: ${id}`);
        }
      };

      e.events.forEach(event => {
        console.log(`Procesando evento: ${event.name}`, event);
        
      switch (event.name) {
        case 'kill':
            this._playerStats.kills++;
            updateElementText('kills-value', this._playerStats.kills);
            this.logEvent("Kill", "¡Has conseguido una kill!");
            this.captureClip();
            this.sendEventToServer('kill');
            
            // Comprobar progreso de logros relacionados con kills
            if (this._playerStats.kills === 5) {
              this.checkAchievementProgress('pentakill', 1);
            }
            break;
            
        case 'death':
            this._playerStats.deaths++;
            updateElementText('deaths-value', this._playerStats.deaths);
            this.logEvent("Muerte", "Has muerto");
            break;
            
        case 'assist':
            this._playerStats.assists++;
            updateElementText('assists-value', this._playerStats.assists);
            this.logEvent("Asistencia", "Has conseguido una asistencia");
            break;
            
        case 'level':
            if (event.data) {
              let level = event.data.level;
              // Manejar correctamente los datos de nivel
              if (typeof level === 'object') {
                if (level.hasOwnProperty('value')) {
                  level = level.value;
                } else {
                  level = 1; // Valor predeterminado
                }
              }
              
              this._playerStats.level = parseInt(level) || 1;
              updateElementText('level-value', this._playerStats.level);
              this.logEvent("Nivel", `Has subido al nivel ${this._playerStats.level}`);
            }
            break;
            
          case 'damage':
            // Registrar daño para el cálculo de DPS
            if (event.data && event.data.damage) {
              const damageValue = parseInt(event.data.damage);
              this._lastDamageValues.push(damageValue);
              // Mantener solo los últimos 10 valores
              if (this._lastDamageValues.length > 10) {
                this._lastDamageValues.shift();
              }
              
              // Actualizar el valor de DPS
              const dps = this._lastDamageValues.length > 0 
                ? (this._lastDamageValues.reduce((a, b) => a + b, 0) / this._lastDamageValues.length)
                : 0;
              updateElementText('dps-value', dps.toFixed(0));
            }
            break;
            
        case 'matchStart':
        case 'match_start':
            this.resetStats();
            this.logEvent("Partida", "La partida ha comenzado");
            break;
            
        case 'matchEnd':
        case 'match_end':
            this.logEvent("Partida", "La partida ha terminado");
            this.sendMatchSummaryToServer();
            break;
            
        case 'gold_earned':
            if (event.data && event.data.amount) {
              const goldAmount = parseInt(event.data.amount);
              this._playerStats.gold += goldAmount;
              updateElementText('gold-value', this._playerStats.gold);
              
              // Comprobar progreso de logro de oro
              this.checkAchievementProgress('gold_hoarder', this._playerStats.gold);
            }
            break;
            
        case 'objective':
            if (event.data && event.data.type === 'dragon') {
              // Incrementar contador de dragones para el logro
              const currentDragons = this._achievements.find(a => a.id === 'jungle_master')?.currentValue || 0;
              this.checkAchievementProgress('jungle_master', currentDragons + 1);
            }
            break;
        }
        
        // Actualizar KDA después de cada evento relevante
        if (['kill', 'death', 'assist'].includes(event.name)) {
          const kda = this._playerStats.deaths > 0 
            ? ((this._playerStats.kills + this._playerStats.assists) / this._playerStats.deaths).toFixed(2)
            : (this._playerStats.kills + this._playerStats.assists).toString();
          updateElementText('kda-value', kda);
        }
      });

      // Registrar eventos relevantes para el mapa de calor
      const relevantEvents = ['kill', 'death', 'assist', 'objective'];
      if (e && e.events) {
        e.events.forEach(event => {
          if (relevantEvents.includes(event.name)) {
            console.log(`Evento ${event.name} registrado para el mapa de calor:`, event);
          }
        });
      }
    } catch (e) {
      console.error('Error procesando eventos:', e);
    }
  }

  private updateUI(stat: string, value: string) {
    try {
      console.log(`Intentando actualizar UI para ${stat} con valor ${value}`);
      
      let elementId = '';
      
      // Mapear el nombre de la estadística al ID del elemento
      switch (stat) {
        case 'kills':
          elementId = 'kills-value';
          break;
        case 'deaths':
          elementId = 'deaths-value';
          break;
        case 'assists':
          elementId = 'assists-value';
          break;
        case 'cs':
          elementId = 'cs-value';
          break;
        case 'level':
          elementId = 'level-value';
          break;
        case 'gold':
          elementId = 'gold-value';
          break;
        case 'gameTime':
          elementId = 'game-time-value';
          break;
        case 'gameMode':
          elementId = 'game-mode-value';
          break;
        case 'dps':
          elementId = 'dps-value';
          break;
        case 'kda':
          elementId = 'kda-value';
          break;
        case 'cspm':
          elementId = 'cspm-value';
          break;
      }
      
      // Intentar obtener el elemento por su ID
      const element = document.getElementById(elementId);
      
      if (element) {
        console.log(`Elemento encontrado: ${elementId}, valor actual: ${element.textContent}, nuevo valor: ${value}`);
        
        // Guardar el valor anterior para detectar cambios
        const oldValue = element.textContent;
        element.textContent = value;
        
        // Resaltar el cambio si el valor es diferente
        if (oldValue !== value) {
          element.classList.add('highlight');
          setTimeout(() => {
            element.classList.remove('highlight');
          }, 1000);
        }
      } else {
        console.error(`No se encontró el elemento con ID: ${elementId}`);
        
        // Intentar encontrar el elemento usando un enfoque alternativo
        console.log(`Intentando búsqueda alternativa para ${stat}`);
        const possibleElements = document.querySelectorAll(`[id*="${stat}"], [id*="${stat.toLowerCase()}"], [class*="${stat}"], [class*="${stat.toLowerCase()}"]`);
        console.log(`Elementos alternativos encontrados: ${possibleElements.length}`);
        possibleElements.forEach(el => {
          console.log(`  - Elemento: ${el.tagName}, ID: ${el.id}, Clase: ${el.className}`);
        });
      }
    } catch (e) {
      console.error('Error actualizando la UI:', e);
    }
  }

  private updatePerformanceMetrics() {
    try {
      // Función para actualizar elementos directamente
      const updateElementText = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value.toString();
        } else {
          console.error(`No se encontró el elemento con ID: ${id}`);
        }
      };
      
      // Calcular KDA
      const kda = this._playerStats.deaths > 0 
        ? ((this._playerStats.kills + this._playerStats.assists) / this._playerStats.deaths).toFixed(2)
        : (this._playerStats.kills + this._playerStats.assists).toString();
      updateElementText('kda-value', kda);
      
      // Calcular CS por minuto
      const gameTimeMinutes = this._playerStats.gameTime / 60;
      const cspm = gameTimeMinutes > 0 
        ? (this._playerStats.cs / gameTimeMinutes).toFixed(1)
        : '0';
      updateElementText('cspm-value', cspm);
      
      // Calcular DPS promedio
      const dps = this._lastDamageValues.length > 0 
        ? (this._lastDamageValues.reduce((a, b) => a + b, 0) / this._lastDamageValues.length)
        : 0;
      updateElementText('dps-value', dps.toFixed(0));
      
      console.log('Métricas de rendimiento actualizadas: KDA=' + kda + ', CSPM=' + cspm + ', DPS=' + dps.toFixed(0));
      
      // Actualizar análisis de mejora después de actualizar métricas
      this.analyzePlayerPerformance();
    } catch (e) {
      console.error('Error actualizando métricas de rendimiento:', e);
    }
  }

  private formatGameTime(timeInSeconds: number): string {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private logEvent(category: string, message: string) {
    try {
      const eventItem = document.createElement('div');
      eventItem.className = 'event-item';
      
      // Añadir clase específica según categoría
      if (category.toLowerCase() === 'kill') {
        eventItem.classList.add('kill');
      } else if (category.toLowerCase() === 'muerte') {
        eventItem.classList.add('death');
      } else if (category.toLowerCase() === 'asistencia') {
        eventItem.classList.add('assist');
      }
      
      const timestamp = new Date().toLocaleTimeString();
      eventItem.textContent = `[${timestamp}] ${category}: ${message}`;
      
      this._eventsLog.appendChild(eventItem);
      this._eventsLog.scrollTop = this._eventsLog.scrollHeight;
      
      // Limitar a 20 eventos en la lista
      if (this._eventsLog.children.length > 20) {
        this._eventsLog.removeChild(this._eventsLog.children[0]);
      }
    } catch (e) {
      console.error('Error al registrar evento:', e);
    }
  }

  private initializeClipCapture() {
    try {
      // Registrar listeners para eventos de captura
      overwolf.media.replays.onCaptureError.addListener(error => {
        console.error('Error en la captura de clip:', error);
      });
      
      overwolf.media.replays.onCaptureStopped.addListener(info => {
        console.log('Captura de clip detenida:', info);
        // Cuando se completa un clip, actualizar la lista
        this.loadSavedClips();
      });
      
      overwolf.media.replays.onCaptureWarning.addListener(warning => {
        console.warn('Advertencia en la captura de clip:', warning);
      });
      
      overwolf.media.replays.onReplayServicesStarted.addListener(() => {
        console.log('Servicios de replay iniciados');
      });
      
      // Comprobar si los servicios de replay están disponibles
      overwolf.media.replays.getState(result => {
        if (result.success) {
          console.log('Estado de los servicios de replay:', result);
          
          // Obtener la carpeta de clips
          // La API getVideosFolder no existe, usamos una ruta predeterminada
          this._clipsFolder = 'C:\\Users\\Public\\Videos\\Overwolf';
          console.log('Carpeta de clips (predeterminada):', this._clipsFolder);
        } else {
          console.error('Error al obtener el estado de los servicios de replay:', result.error);
        }
      });
    } catch (e) {
      console.error('Error al inicializar la captura de clips:', e);
    }
  }

  private captureClip() {
    try {
      // En un entorno real, aquí se llamaría a la API de Overwolf para capturar un clip
      // overwolf.media.replays.capture(this._clipDuration, this.handleClipCaptured.bind(this));
      
      // Para fines de demostración, simulamos la captura
      console.log('Se simula la captura de un clip por una kill');
      this.showClipNotification();
      
      // Simular un nuevo clip para la demostración
      const newClip = {
        id: Date.now().toString(),
        title: `Kill - ${new Date().toLocaleTimeString()}`,
        date: new Date(),
        path: '',
        thumbnail: '../../img/clip-placeholder.svg'
      };
      
      this._clipsList.unshift(newClip);
      this.updateClipsUI();
    } catch (e) {
      console.error('Error al capturar clip:', e);
    }
  }

  private showClipNotification() {
    if (!this._clipNotification) return;
    
    this._clipNotification.classList.remove('app__clip-notification--hidden');
    this._clipNotification.classList.add('show');
    
    setTimeout(() => {
      this._clipNotification.classList.remove('show');
      setTimeout(() => {
        this._clipNotification.classList.add('app__clip-notification--hidden');
      }, 300);
    }, 3000);
  }

  private setupAds() {
    try {
      // Implementación básica de anuncios
      const containerId = this._adContainer.id;
      
      // Mostrar mensaje en el contenedor de anuncios
      this._adContainer.innerHTML = '<div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: #ddd;">Espacio reservado para anuncios</div>';
      
      console.log('Espacio de anuncios configurado. ID del contenedor:', containerId);
      
      // Nota: Para implementar anuncios reales, es necesario registrar la aplicación
      // en la plataforma de Overwolf y obtener las claves de API adecuadas.
    } catch (e) {
      console.error('Error al configurar los anuncios:', e);
    }
  }

  private sendEventToServer(eventType: string) {
    try {
      fetch("https://tu-servidor.com/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          event: eventType,
          timestamp: Date.now(),
          gameId: this._gameClassId,
          playerStats: this._playerStats
        })
      })
      .then(response => response.json())
      .then(data => console.log("Evento enviado:", data))
      .catch(error => console.error("Error en la API:", error));
    } catch (e) {
      console.error('Error al enviar evento al servidor:', e);
    }
  }

  private sendMatchSummaryToServer() {
    try {
      fetch("https://tu-servidor.com/api/match/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          gameId: this._gameClassId,
          duration: this._playerStats.gameTime,
          gameMode: this._playerStats.gameMode,
          playerStats: this._playerStats,
          timestamp: Date.now()
        })
      })
      .then(response => response.json())
      .then(data => console.log("Resumen de partida enviado:", data))
      .catch(error => console.error("Error en la API:", error));
    } catch (e) {
      console.error('Error al enviar resumen de partida al servidor:', e);
    }
  }

  private resetStats() {
    try {
      // Función para actualizar elementos directamente
      const updateElementText = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value.toString();
        } else {
          console.error(`No se encontró el elemento con ID: ${id}`);
        }
      };
      
      this._playerStats = {
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        level: 1,
        gold: 0,
        gameTime: 0,
        gameMode: "CLASSIC"
      };
      
      this._lastDamageValues = [];
      
      // Actualizar UI directamente
      updateElementText('kills-value', '0');
      updateElementText('deaths-value', '0');
      updateElementText('assists-value', '0');
      updateElementText('cs-value', '0');
      updateElementText('level-value', '1');
      updateElementText('gold-value', '0');
      updateElementText('game-time-value', '00:00');
      updateElementText('dps-value', '0');
      updateElementText('kda-value', '0');
      updateElementText('cspm-value', '0');
      updateElementText('game-mode-value', 'CLASSIC');
      
      // Limpiar log de eventos
      this._eventsLog.innerHTML = '';
      
      console.log('Estadísticas reseteadas correctamente');
      this.logEvent("Sistema", "Estadísticas reseteadas para nueva partida");
    } catch (e) {
      console.error('Error al resetear estadísticas:', e);
    }
  }

  private async setupHotkeys() {
    try {
      const toggleInGameWindow = async (hotkeyResult: overwolf.settings.hotkeys.OnPressedEvent): Promise<void> => {
        console.log(`Se presionó la tecla rápida ${hotkeyResult.name}`);
        const inGameState = await this._windows[kWindowNames.inGame].getWindowState();

      if (inGameState.window_state === WindowState.NORMAL ||
        inGameState.window_state === WindowState.MAXIMIZED) {
          console.log('Minimizando ventana en juego');
          this._windows[kWindowNames.inGame].minimize();
        } else {
          console.log('Restaurando ventana en juego');
          this._windows[kWindowNames.inGame].restore();
        }
      }

      try {
        console.log('Configurando comportamiento de hotkey...');

        const gameClassId = await this.getCurrentGameClassId();
        console.log(`Registrando hotkey ${kHotkeys.toggle} para el juego ${gameClassId}`);

        overwolf.settings.hotkeys.onPressed.addListener(async (result) => {
          if (!result || result.name !== kHotkeys.toggle) {
            return;
          }
          
          await toggleInGameWindow(result);
        });

        console.log('Hotkey registrada con éxito');
      } catch (e) {
        console.error('Error al configurar comportamiento de hotkey:', e);
      }

      await this.setToggleHotkeyText();
    } catch (e) {
      console.error('Error al configurar hotkeys:', e);
    }
  }
  
  private async setToggleHotkeyText() {
    try {
      console.log('Configurando texto de hotkey...');
      const gameClassId = await this.getCurrentGameClassId();
      console.log(`Obteniendo texto de hotkey para ${kHotkeys.toggle} del juego ${gameClassId}`);
      
      overwolf.settings.hotkeys.get(result => {
        if (!result || !result.success) {
          console.error('Error al obtener hotkeys');
          return;
        }
        
        let hotkeyText = 'TECLA NO ASIGNADA';
        let hotkey: overwolf.settings.hotkeys.IHotkey;
        
        if (gameClassId !== undefined && result.games && result.games[gameClassId]) {
          hotkey = result.games[gameClassId].find(h => h.name === kHotkeys.toggle);
        }
        
        if (!hotkey) {
          hotkey = result.globals.find(h => h.name === kHotkeys.toggle);
        }
        
        if (hotkey) {
          hotkeyText = hotkey.binding;
        }
        
        console.log(`Texto de hotkey obtenido: ${hotkeyText}`);
        
        const hotkeyElem = document.getElementById('hotkey');
        if (hotkeyElem) {
          hotkeyElem.textContent = hotkeyText;
          console.log('Texto de hotkey actualizado en el elemento HTML');
        } else {
          console.error('No se encontró el elemento HTML con ID "hotkey"');
        }
      });
    } catch (e) {
      console.error('Error al configurar texto de hotkey:', e);
    }
  }

  private async getCurrentGameClassId(): Promise<number | null> {
    try {
    const info = await OWGames.getRunningGameInfo();
    return (info && info.isRunning && info.classId) ? info.classId : null;
    } catch (e) {
      console.error('Error al obtener el ID de clase del juego:', e);
      return null;
    }
  }

  private async init() {
    try {
      console.log('Inicializando la interfaz...');
      
      // Establecer datos iniciales
      this._playerStats = {
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        gold: 0,
        gameTime: 0,
        level: 1,
        gameMode: 'Classic'
      };
  
      // Inicializar la UI con datos por defecto - usar directamente los IDs
      document.getElementById('kills-value').textContent = '0';
      document.getElementById('deaths-value').textContent = '0';
      document.getElementById('assists-value').textContent = '0';
      document.getElementById('kda-value').textContent = '0.0';
      document.getElementById('cs-value').textContent = '0';
      document.getElementById('gold-value').textContent = '0';
      document.getElementById('game-time-value').textContent = '00:00';
      document.getElementById('level-value').textContent = '1';
      document.getElementById('game-mode-value').textContent = 'Classic';
  
      // Registrar el evento de inicialización
      this.logEvent("Sistema", "Aplicación inicializada");
  
      // Inicializar los anuncios reales de Overwolf
      initializeAds();
      console.log('Interfaz inicializada correctamente');
      
      // Inicializar sistema de gamificación
      this.initializeGamificationData();
      
      // Simular una racha de días para la demostración
      this.simulateDailyStreak();
      
      return true;
    } catch (error) {
      console.error('Error al inicializar la interfaz:', error);
      return false;
    }
  }

  private registerEvents() {
    // Registrar manejadores de eventos de juego
    overwolf.games.events.onInfoUpdates2.addListener(this.onInfoUpdates.bind(this));
    overwolf.games.events.onNewEvents.addListener(this.onNewEvents.bind(this));
    
    this.logEvent("Sistema", "Eventos del juego registrados");
  }

  private setupButtons() {
    // Botón para cerrar la ventana
    const closeButton = document.getElementById('closeButton');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        overwolf.windows.getCurrentWindow(result => {
          if (result.success) {
            overwolf.windows.close(result.window.id);
          }
        });
      });
    }

    // Botón para minimizar la ventana
    const minimizeButton = document.getElementById('minimizeButton');
    if (minimizeButton) {
      minimizeButton.addEventListener('click', () => {
        overwolf.windows.getCurrentWindow(result => {
          if (result.success) {
            overwolf.windows.minimize(result.window.id);
          }
        });
      });
    }

    this.logEvent("Sistema", "Botones configurados");
  }

  private startLiveClientPolling() {
    // Realizar polling cada 5 segundos
    setInterval(async () => {
      try {
        await this.fetchLiveClientData();
      } catch (error) {
        console.error('Error en el polling de datos de League of Legends:', error);
      }
    }, 5000);
    
    console.log('Polling a la API Live Client iniciado');
    this.logEvent("Sistema", "Conexión a API de League of Legends iniciada");
  }
  
  private async fetchLiveClientData() {
    try {
      // Función para actualizar elementos directamente
      const updateElementText = (id, value) => {
        this.updateElementText(id, value);
      };
      
      // Intentar obtener datos de la API Live Client
      const response = await fetch('https://127.0.0.1:2999/liveclientdata/allgamedata');
      if (!response.ok) {
        throw new Error(`Error de conexión: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Datos obtenidos de API Live Client:', data);
      
      if (data.activePlayer) {
        // Obtener datos relevantes
        const activePlayer = data.activePlayer;
        const playerStats = activePlayer.championStats;
        const currentGold = activePlayer.currentGold;
        
        // Actualizar oro
        this._playerStats.gold = currentGold;
        updateElementText('gold-value', currentGold);
        
        // Actualizar CS - verificamos múltiples posibles ubicaciones
        if (activePlayer.scores && 
           (activePlayer.scores.creepScore !== undefined || 
            activePlayer.scores.minionsKilled !== undefined)) {
          const cs = activePlayer.scores.creepScore || activePlayer.scores.minionsKilled;
          this._playerStats.cs = cs;
          updateElementText('cs-value', cs);
          console.log(`CS actualizado desde API Live Client: ${cs}`);
        }
        
        // Intentar obtener CS desde otras ubicaciones posibles
        if (activePlayer.minionsKilled !== undefined) {
          this._playerStats.cs = activePlayer.minionsKilled;
          updateElementText('cs-value', activePlayer.minionsKilled);
          console.log(`CS actualizado desde minionsKilled: ${activePlayer.minionsKilled}`);
        }
        
        // Actualizar nivel
        if (activePlayer.level !== undefined) {
          this._playerStats.level = activePlayer.level;
          updateElementText('level-value', activePlayer.level);
        }
        
        // Actualizar KDA
        if (activePlayer.scores) {
          const { kills, deaths, assists } = activePlayer.scores;
          if (kills !== undefined) this._playerStats.kills = kills;
          if (deaths !== undefined) this._playerStats.deaths = deaths;
          if (assists !== undefined) this._playerStats.assists = assists;
          
          updateElementText('kills-value', this._playerStats.kills);
          updateElementText('deaths-value', this._playerStats.deaths);
          updateElementText('assists-value', this._playerStats.assists);
        }
      }
      
      // Buscar el jugador en la lista de jugadores si no tenemos todos los datos
      if (data.allPlayers && this._playerStats.cs === 0) {
        // Intentar encontrar nuestro jugador por nombre
        const summonerName = data.activePlayer?.summonerName;
        if (summonerName) {
          const player = data.allPlayers.find(p => p.summonerName === summonerName);
          if (player && player.scores) {
            if (player.scores.creepScore !== undefined) {
              this._playerStats.cs = player.scores.creepScore;
              updateElementText('cs-value', player.scores.creepScore);
              console.log(`CS actualizado desde allPlayers: ${player.scores.creepScore}`);
            }
          }
        }
      }
      
      // Actualizar tiempo de partida
      if (data.gameData && data.gameData.gameTime !== undefined) {
        const gameTime = Math.floor(data.gameData.gameTime);
        this._playerStats.gameTime = gameTime;
        updateElementText('game-time-value', this.formatGameTime(gameTime));
      }
      
      // Actualizar métricas de rendimiento
      this.updatePerformanceMetrics();
      
      this.logEvent("API", "Datos actualizados desde la API de League");
    } catch (error) {
      console.error('Error al obtener datos de la API Live Client:', error);
    }
  }

  // Función auxiliar para actualizar el texto de un elemento
  private updateElementText(id: string, value: any) {
    try {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value.toString();
        // Añadir efecto de highlight
        element.classList.add('highlight');
        setTimeout(() => {
          element.classList.remove('highlight');
        }, 1000);
      } else {
        console.error(`No se encontró el elemento con ID: ${id}`);
      }
    } catch (e) {
      console.error(`Error al actualizar elemento ${id}:`, e);
    }
  }

  /**
   * Carga los clips guardados desde la carpeta de clips
   */
  private loadSavedClips() {
    try {
      // En un entorno real, aquí se cargarían los clips desde la carpeta
      // overwolf.media.replays.getReplaysByFolder(this._clipsFolder, (result) => {
      //   if (result.success) {
      //     this._clipsList = result.replays;
      //     this.updateClipsUI();
      //   }
      // });
      
      // Para fines de demostración, usamos datos de ejemplo
      console.log('Cargando clips guardados (simulación)');
      
      // Si ya tenemos clips simulados, no añadimos más
      if (this._clipsList.length === 0) {
        // Crear algunos clips de ejemplo
        const exampleClips = [
          {
            id: '1',
            title: 'Triple Kill - Bot Lane',
            date: new Date(Date.now() - 3600000), // 1 hora atrás
            path: '',
            thumbnail: '../../img/clip-placeholder.svg'
          },
          {
            id: '2',
            title: 'Dragon Steal',
            date: new Date(Date.now() - 7200000), // 2 horas atrás
            path: '',
            thumbnail: '../../img/clip-placeholder.svg'
          }
        ];
        
        this._clipsList = exampleClips;
      }
      
      this.updateClipsUI();
    } catch (e) {
      console.error('Error al cargar clips guardados:', e);
    }
  }

  /**
   * Actualiza la interfaz de usuario con los clips guardados
   */
  private updateClipsUI() {
    try {
      const clipsContainer = document.querySelector('.clips-grid');
      if (!clipsContainer) return;
      
      // Limpiar el contenedor
      clipsContainer.innerHTML = '';
      
      if (this._clipsList.length === 0) {
        // Mostrar mensaje de que no hay clips
        const noClipsMessage = document.createElement('div');
        noClipsMessage.className = 'no-clips-message';
        noClipsMessage.innerHTML = `
          <p>No hay clips guardados todavía.</p>
          <p>Cuando consigas una kill, se grabará automáticamente un clip.</p>
        `;
        clipsContainer.appendChild(noClipsMessage);
        return;
      }
      
      // Crear elementos para cada clip
      this._clipsList.forEach(clip => {
        const clipElement = document.createElement('div');
        clipElement.className = 'clip-item';
        clipElement.dataset.id = clip.id;
        
        const formattedDate = clip.date.toLocaleString();
        
        clipElement.innerHTML = `
          <div class="clip-thumbnail">
            <img src="${clip.thumbnail}" alt="${clip.title}">
          </div>
          <div class="clip-info">
            <div class="clip-title">${clip.title}</div>
            <div class="clip-date">${formattedDate}</div>
          </div>
          <div class="clip-actions">
            <button class="clip-button play-clip">Reproducir</button>
            <button class="clip-button open-folder">Abrir carpeta</button>
          </div>
        `;
        
        // Añadir evento para reproducir el clip
        const playButton = clipElement.querySelector('.play-clip');
        if (playButton) {
          playButton.addEventListener('click', () => this.playClip(clip));
        }
        
        // Añadir evento para abrir la carpeta
        const folderButton = clipElement.querySelector('.open-folder');
        if (folderButton) {
          folderButton.addEventListener('click', () => this.openClipsFolder());
        }
        
        clipsContainer.appendChild(clipElement);
      });
    } catch (e) {
      console.error('Error al actualizar UI de clips:', e);
    }
  }

  /**
   * Reproduce un clip
   */
  private playClip(clip: any) {
    try {
      console.log('Reproduciendo clip:', clip.title);
      
      // En un entorno real, aquí se abriría el clip para reproducirlo
      // overwolf.utils.openWindowsExplorer(clip.path, (result) => {
      //   if (!result.success) {
      //     console.error('Error al abrir el clip:', result.error);
      //   }
      // });
      
      // Para fines de demostración, mostramos un mensaje
      alert(`Reproduciendo clip: ${clip.title}`);
    } catch (e) {
      console.error('Error al reproducir clip:', e);
    }
  }

  /**
   * Abre la carpeta donde se guardan los clips
   */
  private openClipsFolder() {
    try {
      console.log('Abriendo carpeta de clips');
      
      // En un entorno real, aquí se abriría la carpeta de clips
      // overwolf.utils.openWindowsExplorer(this._clipsFolder, (result) => {
      //   if (!result.success) {
      //     console.error('Error al abrir la carpeta de clips:', result.error);
      //   }
      // });
      
      // Para fines de demostración, mostramos un mensaje
      alert(`Abriendo carpeta de clips: ${this._clipsFolder || 'Carpeta no disponible'}`);
    } catch (e) {
      console.error('Error al abrir carpeta de clips:', e);
    }
  }

  /**
   * Inicializa datos de ejemplo para la pestaña de mejora
   */
  private initializeImprovementData() {
    try {
      // Inicializar con algunos datos de ejemplo
      this._playerStrengths = [
        {
          id: 'kda',
          icon: '💪',
          text: 'Buen KDA: Mantienes un ratio de 5.0',
          value: 5.0
        }
      ];
      
      this._playerWeaknesses = [
        {
          id: 'cspm',
          icon: '📈',
          text: 'Farming: Tu CS/min está por debajo del promedio',
          value: 4.5,
          targetValue: 7.0
        }
      ];
      
      this._playerGoals = [
        {
          id: 'improve_cspm',
          title: 'Mejorar CS a 7.0 por minuto',
          description: 'Actual: 4.5 CS/min | Objetivo: 7.0 CS/min',
          tip: 'Concéntrate en últimos golpes a minions entre rotaciones',
          currentValue: 4.5,
          targetValue: 7.0,
          progress: 35
        }
      ];
      
      this._playerTips = [
        {
          id: 'farm_tip',
          icon: '💡',
          title: 'Mejora tu Farm',
          content: 'Practica conseguir al menos 70 CS a los 10 minutos. Esto te dará una ventaja económica significativa sobre tu oponente.',
          category: 'farming'
        }
      ];
      
      // Actualizar la UI con estos datos
      this.updateImprovementUI();
    } catch (e) {
      console.error('Error inicializando datos de mejora:', e);
    }
  }
  
  /**
   * Analiza el rendimiento del jugador para identificar fortalezas y debilidades
   */
  private analyzePlayerPerformance() {
    try {
      // Solo analizar si tenemos suficientes datos
      if (this._playerStats.gameTime < 60) { // Al menos 1 minuto de juego
        return;
      }
      
      // Calcular métricas clave
      const gameTimeMinutes = this._playerStats.gameTime / 60;
      const cspm = gameTimeMinutes > 0 ? this._playerStats.cs / gameTimeMinutes : 0;
      const kda = this._playerStats.deaths > 0 
        ? (this._playerStats.kills + this._playerStats.assists) / this._playerStats.deaths 
        : this._playerStats.kills + this._playerStats.assists;
      const goldPerMin = gameTimeMinutes > 0 ? this._playerStats.gold / gameTimeMinutes : 0;
      
      // Limpiar arrays existentes
      this._playerStrengths = [];
      this._playerWeaknesses = [];
      this._playerGoals = [];
      this._playerTips = [];
      
      // Analizar CS por minuto
      if (cspm >= this._referenceValues.csPerMin.gold) {
        // Es una fortaleza
        this._playerStrengths.push({
          id: 'cspm',
          icon: '🌟',
          text: `Excelente farming: ${cspm.toFixed(1)} CS/min`,
          value: cspm
        });
      } else if (cspm < this._referenceValues.csPerMin.silver) {
        // Es una debilidad
        this._playerWeaknesses.push({
          id: 'cspm',
          icon: '📈',
          text: `Farming: ${cspm.toFixed(1)} CS/min está por debajo del promedio`,
          value: cspm,
          targetValue: this._referenceValues.csPerMin.gold
        });
        
        // Crear un objetivo
        const targetCspm = this._referenceValues.csPerMin.silver;
        const progress = Math.min(100, Math.round((cspm / targetCspm) * 100));
        
        this._playerGoals.push({
          id: 'improve_cspm',
          title: `Mejorar CS a ${targetCspm.toFixed(1)} por minuto`,
          description: `Actual: ${cspm.toFixed(1)} CS/min | Objetivo: ${targetCspm.toFixed(1)} CS/min`,
          tip: 'Concéntrate en últimos golpes a minions entre rotaciones',
          currentValue: cspm,
          targetValue: targetCspm,
          progress: progress
        });
        
        // Añadir un consejo
        this._playerTips.push({
          id: 'farm_tip',
          icon: '💡',
          title: 'Mejora tu Farm',
          content: `Practica conseguir al menos ${Math.round(targetCspm * 10)} CS a los 10 minutos. Esto te dará una ventaja económica significativa sobre tu oponente.`,
          category: 'farming'
        });
      }
      
      // Analizar KDA
      if (kda >= this._referenceValues.kda.gold) {
        // Es una fortaleza
        this._playerStrengths.push({
          id: 'kda',
          icon: '💪',
          text: `Buen KDA: ${kda.toFixed(1)}`,
          value: kda
        });
      } else if (kda < this._referenceValues.kda.silver) {
        // Es una debilidad
        this._playerWeaknesses.push({
          id: 'kda',
          icon: '🛡️',
          text: `KDA: ${kda.toFixed(1)} podría mejorar`,
          value: kda,
          targetValue: this._referenceValues.kda.gold
        });
        
        // Crear un objetivo
        const targetKda = this._referenceValues.kda.silver;
        const progress = Math.min(100, Math.round((kda / targetKda) * 100));
        
        this._playerGoals.push({
          id: 'improve_kda',
          title: `Mejorar KDA a ${targetKda.toFixed(1)}`,
          description: `Actual: ${kda.toFixed(1)} | Objetivo: ${targetKda.toFixed(1)}`,
          tip: 'Juega más seguro y evita muertes innecesarias',
          currentValue: kda,
          targetValue: targetKda,
          progress: progress
        });
        
        // Añadir un consejo
        this._playerTips.push({
          id: 'kda_tip',
          icon: '🛡️',
          title: 'Reduce tus muertes',
          content: 'Cada muerte da ventaja al enemigo. Juega más seguro, mantén buena visión y no te arriesgues sin necesidad.',
          category: 'survival'
        });
      }
      
      // Analizar oro por minuto
      if (goldPerMin >= this._referenceValues.goldPerMin.gold) {
        // Es una fortaleza
        this._playerStrengths.push({
          id: 'goldpm',
          icon: '💰',
          text: `Buena economía: ${goldPerMin.toFixed(0)} oro/min`,
          value: goldPerMin
        });
      } else if (goldPerMin < this._referenceValues.goldPerMin.silver) {
        // Es una debilidad
        this._playerWeaknesses.push({
          id: 'goldpm',
          icon: '💰',
          text: `Economía: ${goldPerMin.toFixed(0)} oro/min podría mejorar`,
          value: goldPerMin,
          targetValue: this._referenceValues.goldPerMin.gold
        });
        
        // Crear un objetivo
        const targetGoldpm = this._referenceValues.goldPerMin.silver;
        const progress = Math.min(100, Math.round((goldPerMin / targetGoldpm) * 100));
        
        this._playerGoals.push({
          id: 'improve_goldpm',
          title: `Mejorar economía a ${targetGoldpm} oro/min`,
          description: `Actual: ${goldPerMin.toFixed(0)} oro/min | Objetivo: ${targetGoldpm} oro/min`,
          tip: 'Mejora tu farm y participa en objetivos',
          currentValue: goldPerMin,
          targetValue: targetGoldpm,
          progress: progress
        });
      }
      
      // Actualizar la UI con los nuevos datos
      this.updateImprovementUI();
    } catch (e) {
      console.error('Error analizando rendimiento del jugador:', e);
    }
  }
  
  /**
   * Actualiza la UI de la pestaña de mejora
   */
  private updateImprovementUI() {
    try {
      // Actualizar fortalezas
      if (this._strengthsList) {
        this._strengthsList.innerHTML = '';
        
        if (this._playerStrengths.length === 0) {
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'empty-message';
          emptyMessage.textContent = 'Sigue jugando para identificar tus fortalezas';
          this._strengthsList.appendChild(emptyMessage);
        } else {
          this._playerStrengths.forEach(strength => {
            const strengthItem = document.createElement('div');
            strengthItem.className = 'strength-item';
            strengthItem.innerHTML = `
              <div class="strength-icon">${strength.icon}</div>
              <div class="strength-text">${strength.text}</div>
            `;
            this._strengthsList.appendChild(strengthItem);
          });
        }
      }
      
      // Actualizar debilidades
      if (this._weaknessesList) {
        this._weaknessesList.innerHTML = '';
        
        if (this._playerWeaknesses.length === 0) {
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'empty-message';
          emptyMessage.textContent = 'Sigue jugando para identificar áreas de mejora';
          this._weaknessesList.appendChild(emptyMessage);
        } else {
          this._playerWeaknesses.forEach(weakness => {
            const weaknessItem = document.createElement('div');
            weaknessItem.className = 'weakness-item';
            weaknessItem.innerHTML = `
              <div class="weakness-icon">${weakness.icon}</div>
              <div class="weakness-text">${weakness.text}</div>
            `;
            this._weaknessesList.appendChild(weaknessItem);
          });
        }
      }
      
      // Actualizar objetivos
      if (this._goalsList) {
        this._goalsList.innerHTML = '';
        
        if (this._playerGoals.length === 0) {
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'empty-message';
          emptyMessage.textContent = 'No hay objetivos activos actualmente';
          this._goalsList.appendChild(emptyMessage);
        } else {
          this._playerGoals.forEach(goal => {
            const goalItem = document.createElement('div');
            goalItem.className = 'goal-item';
            goalItem.innerHTML = `
              <div class="goal-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${goal.progress}%;"></div>
                </div>
                <div class="progress-text">${goal.progress}%</div>
              </div>
              <div class="goal-details">
                <div class="goal-title">${goal.title}</div>
                <div class="goal-description">${goal.description}</div>
                <div class="goal-tips">Tip: ${goal.tip}</div>
              </div>
            `;
            this._goalsList.appendChild(goalItem);
          });
        }
      }
      
      // Actualizar consejos
      if (this._tipsContainer) {
        this._tipsContainer.innerHTML = '';
        
        if (this._playerTips.length === 0) {
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'empty-message';
          emptyMessage.textContent = 'No hay consejos personalizados disponibles';
          this._tipsContainer.appendChild(emptyMessage);
        } else {
          this._playerTips.forEach(tip => {
            const tipCard = document.createElement('div');
            tipCard.className = 'tip-card';
            tipCard.innerHTML = `
              <div class="tip-header">
                <div class="tip-icon">${tip.icon}</div>
                <div class="tip-title">${tip.title}</div>
              </div>
              <div class="tip-content">
                ${tip.content}
              </div>
            `;
            this._tipsContainer.appendChild(tipCard);
          });
        }
      }
    } catch (e) {
      console.error('Error actualizando UI de mejora:', e);
    }
  }

  private initializeGamificationData() {
    try {
      // Inicializar logros
      this._achievements = [
        {
          id: 'precision',
          name: 'Precisión Letal',
          description: 'Consigue un 70% de precisión en habilidades',
          icon: '🎯',
          currentValue: 70,
          targetValue: 70,
          xpReward: 100,
          unlocked: true
        },
        {
          id: 'gold_hoarder',
          name: 'Cosechador de Oro',
          description: 'Acumula 10,000 de oro en una partida',
          icon: '💰',
          currentValue: 7500,
          targetValue: 10000,
          xpReward: 150,
          unlocked: false
        },
        {
          id: 'jungle_master',
          name: 'Maestro de la Jungla',
          description: 'Elimina 5 dragones en una sola partida',
          icon: '👑',
          currentValue: 1,
          targetValue: 5,
          xpReward: 200,
          unlocked: false
        },
        {
          id: 'pentakill',
          name: 'Pentakill',
          description: 'Consigue tu primera pentakill',
          icon: '⚔️',
          currentValue: 0,
          targetValue: 1,
          xpReward: 500,
          unlocked: false
        }
      ];
      
      // Inicializar hitos
      this._milestones = [
        {
          id: 'bronze',
          name: 'Bronce',
          icon: '🥉',
          level: 'Bronce',
          completed: true,
          current: false
        },
        {
          id: 'silver',
          name: 'Plata',
          icon: '🥈',
          level: 'Plata',
          completed: true,
          current: false
        },
        {
          id: 'gold',
          name: 'Oro',
          icon: '🥇',
          level: 'Oro',
          completed: false,
          current: true
        },
        {
          id: 'platinum',
          name: 'Platino',
          icon: '💎',
          level: 'Platino',
          completed: false,
          current: false
        },
        {
          id: 'diamond',
          name: 'Diamante',
          icon: '👑',
          level: 'Diamante',
          completed: false,
          current: false
        }
      ];
      
      // Actualizar UI con los datos de gamificación
      this.updateGamificationUI();
      
      console.log('Datos de gamificación inicializados correctamente');
    } catch (e) {
      console.error('Error inicializando datos de gamificación:', e);
    }
  }
  
  private updateGamificationUI() {
    try {
      // Actualizar nivel y XP
      if (this._levelBadge) {
        this._levelBadge.textContent = `Nivel ${this._userLevel.level}`;
      }
      
      if (this._xpBar) {
        const xpPercentage = (this._userLevel.currentXP / this._userLevel.requiredXP) * 100;
        this._xpBar.style.width = `${xpPercentage}%`;
      }
      
      if (this._xpText) {
        this._xpText.textContent = `${this._userLevel.currentXP}/${this._userLevel.requiredXP} XP`;
      }
      
      // Actualizar estadísticas de logros
      const achievementStatsValue = document.querySelector('.achievements__stat:nth-child(1) .achievements__stat-value');
      if (achievementStatsValue) {
        achievementStatsValue.textContent = this._unlockedAchievements.toString();
      }
      
      const achievementStatsPercentage = document.querySelector('.achievements__stat:nth-child(2) .achievements__stat-value');
      if (achievementStatsPercentage) {
        const percentage = Math.round((this._unlockedAchievements / this._totalAchievements) * 100);
        achievementStatsPercentage.textContent = `${percentage}%`;
      }
      
      const achievementStatsStreak = document.querySelector('.achievements__stat:nth-child(3) .achievements__stat-value');
      if (achievementStatsStreak) {
        achievementStatsStreak.textContent = this._streakDays.toString();
      }
      
      // Actualizar progreso de racha
      const streakProgressBar = document.querySelector('.achievements__streak-reward .achievements__progress-fill');
      if (streakProgressBar) {
        const streakPercentage = (this._streakDays / 7) * 100;
        streakProgressBar.setAttribute('style', `width: ${streakPercentage}%`);
      }
      
      console.log('UI de gamificación actualizada correctamente');
    } catch (e) {
      console.error('Error al actualizar UI de gamificación:', e);
    }
  }
  
  private awardXP(amount: number) {
    try {
      this._userLevel.currentXP += amount;
      
      // Comprobar si se ha subido de nivel
      if (this._userLevel.currentXP >= this._userLevel.requiredXP) {
        this._userLevel.level += 1;
        this._userLevel.currentXP -= this._userLevel.requiredXP;
        this._userLevel.requiredXP = Math.round(this._userLevel.requiredXP * 1.5); // Aumentar XP requerida para el siguiente nivel
        
        // Mostrar notificación de subida de nivel
        this.showLevelUpNotification();
      }
      
      // Actualizar UI
      this.updateGamificationUI();
      
      console.log(`Se han otorgado ${amount} puntos de XP. Nivel actual: ${this._userLevel.level}, XP: ${this._userLevel.currentXP}/${this._userLevel.requiredXP}`);
    } catch (e) {
      console.error('Error al otorgar XP:', e);
    }
  }
  
  private showLevelUpNotification() {
    try {
      // Crear notificación de subida de nivel
      const notification = document.createElement('div');
      notification.className = 'app__level-up-notification';
      notification.innerHTML = `
        <div class="app__level-up-content">
          <div class="app__level-up-icon">🏆</div>
          <div class="app__level-up-text">
            <h3 class="app__level-up-title">¡Nivel Subido!</h3>
            <p class="app__level-up-description">Has alcanzado el nivel ${this._userLevel.level}</p>
          </div>
        </div>
      `;
      
      // Añadir al DOM
      document.body.appendChild(notification);
      
      // Mostrar y luego ocultar después de 5 segundos
      setTimeout(() => {
        notification.classList.add('show');
        
        setTimeout(() => {
          notification.classList.remove('show');
          
          // Eliminar del DOM después de la animación
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 500);
        }, 5000);
      }, 100);
      
      console.log(`Notificación de subida de nivel mostrada. Nuevo nivel: ${this._userLevel.level}`);
    } catch (e) {
      console.error('Error al mostrar notificación de subida de nivel:', e);
    }
  }
  
  private checkAchievementProgress(achievementId: string, currentValue: number) {
    try {
      // Buscar el logro
      const achievement = this._achievements.find(a => a.id === achievementId);
      
      if (!achievement) {
        console.error(`No se encontró el logro con ID: ${achievementId}`);
        return;
      }
      
      // Actualizar valor actual
      achievement.currentValue = currentValue;
      
      // Comprobar si se ha desbloqueado
      if (!achievement.unlocked && achievement.currentValue >= achievement.targetValue) {
        achievement.unlocked = true;
        this._unlockedAchievements += 1;
        
        // Otorgar XP
        this.awardXP(achievement.xpReward);
        
        // Mostrar notificación
        this.showAchievementNotification(achievement);
        
        console.log(`¡Logro desbloqueado! ${achievement.name}`);
      }
      
      // Actualizar UI
      this.updateAchievementUI(achievement);
    } catch (e) {
      console.error('Error al comprobar progreso de logro:', e);
    }
  }
  
  private updateAchievementUI(achievement: PlayerAchievement) {
    try {
      // Buscar el elemento del logro
      const achievementCard = document.querySelector(`.achievements__card[data-id="${achievement.id}"]`);
      
      if (!achievementCard) {
        console.error(`No se encontró el elemento UI para el logro: ${achievement.id}`);
        return;
      }
      
      // Actualizar clases
      if (achievement.unlocked) {
        achievementCard.classList.add('achievements__card--unlocked');
        achievementCard.classList.remove('achievements__card--in-progress', 'achievements__card--locked');
      } else if (achievement.currentValue > 0) {
        achievementCard.classList.add('achievements__card--in-progress');
        achievementCard.classList.remove('achievements__card--unlocked', 'achievements__card--locked');
      } else {
        achievementCard.classList.add('achievements__card--locked');
        achievementCard.classList.remove('achievements__card--unlocked', 'achievements__card--in-progress');
      }
      
      // Actualizar barra de progreso
      const progressBar = achievementCard.querySelector('.achievements__progress-fill');
      if (progressBar) {
        const percentage = Math.min(100, Math.round((achievement.currentValue / achievement.targetValue) * 100));
        progressBar.setAttribute('style', `width: ${percentage}%`);
      }
      
      // Actualizar texto de progreso
      const progressText = achievementCard.querySelector('.achievements__progress-text');
      if (progressText) {
        if (achievement.unlocked) {
          progressText.textContent = '¡Completado!';
        } else {
          progressText.textContent = `${achievement.currentValue}/${achievement.targetValue}`;
        }
      }
      
      console.log(`UI del logro ${achievement.id} actualizada correctamente`);
    } catch (e) {
      console.error('Error al actualizar UI del logro:', e);
    }
  }
  
  private showAchievementNotification(achievement: PlayerAchievement) {
    try {
      if (!this._rewardNotification) {
        console.error('Elemento de notificación de recompensa no encontrado');
        return;
      }
      
      // Actualizar contenido de la notificación
      const iconElement = this._rewardNotification.querySelector('.app__reward-icon');
      if (iconElement) {
        iconElement.textContent = achievement.icon;
      }
      
      const titleElement = this._rewardNotification.querySelector('.app__reward-title');
      if (titleElement) {
        titleElement.textContent = '¡Logro Desbloqueado!';
      }
      
      const descriptionElement = this._rewardNotification.querySelector('.app__reward-description');
      if (descriptionElement) {
        descriptionElement.textContent = achievement.name;
      }
      
      const xpElement = this._rewardNotification.querySelector('.app__reward-xp');
      if (xpElement) {
        xpElement.textContent = `+${achievement.xpReward} XP`;
      }
      
      // Mostrar la notificación
      this._rewardNotification.classList.remove('app__reward-notification--hidden');
      this._rewardNotification.classList.add('show');
      
      // Ocultar después de 5 segundos
      setTimeout(() => {
        this._rewardNotification.classList.remove('show');
        
        setTimeout(() => {
          this._rewardNotification.classList.add('app__reward-notification--hidden');
        }, 300);
      }, 5000);
      
      console.log(`Notificación mostrada para logro ${achievement.id}`);
    } catch (e) {
      console.error('Error al mostrar notificación de logro:', e);
    }
  }
  
  private simulateDailyStreak() {
    // Actualizar elementos UI de días de racha
    const dayElements = document.querySelectorAll('.achievements__day');
    
    if (dayElements.length === 0) {
      console.error('No se encontraron elementos de días de racha');
      return;
    }
    
    // Actualizar para una racha de 3 días completados (día actual es el 4to)
    for (let i = 0; i < dayElements.length; i++) {
      if (i < this._streakDays) {
        dayElements[i].classList.add('achievements__day--completed');
      }
      
      if (i === this._streakDays) {
        dayElements[i].classList.add('achievements__day--today');
      }
    }
    
    console.log('UI de racha diaria actualizada correctamente');
  }
}

InGameLOL.instance().run();
