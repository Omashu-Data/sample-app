import {
  OWGames,
  OWGamesEvents,
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { AppWindow } from "../AppWindow";
import { kHotkeys, kWindowNames, kGamesFeatures } from "../consts";

import WindowState = overwolf.windows.WindowStateEx;

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

// La ventana que se muestra en juego mientras League of Legends está en ejecución.
// Implementa las siguientes funcionalidades:
// 1. Mostrar métricas en tiempo real
// 2. Grabar clips automáticamente al detectar una kill
// 3. Integrar publicidad para monetización
// 4. Conectarse al servidor web
class InGameLOL extends AppWindow {
  private static _instance: InGameLOL;
  private _gameEventsListener: OWGamesEvents;
  
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
  
  // Configuración para clips
  private _clipDuration: number = 15; // duración en segundos
  private _isRecording: boolean = false;
  private _lastDamageValues: number[] = [];
  private _gameClassId: number = null;
  
  // Intervalo para consultar la API de Live Client Data
  private _liveClientInterval: number = null;

  private constructor() {
    super(kWindowNames.inGame);

    this._gameEventsListener = null;
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

    // Iniciar y registrar el listener de eventos del juego
    this.registerToGEP();

    // Inicializar elementos UI
    this.initializeUIElements();

    // Resetear estadísticas
    this.resetStats();

    // Iniciar intervalo para consultar datos de Live Client
    this.startLiveClientPolling();
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
      
      // Verificar que todos los elementos existen
      if (!this._killsValue || !this._deathsValue || !this._assistsValue || 
          !this._csValue || !this._levelValue || !this._goldValue || 
          !this._gameTimeValue || !this._gameModeValue || !this._dpsValue || 
          !this._kdaValue || !this._cspmValue || !this._eventsLog || 
          !this._clipNotification) {
        console.error('No se pudieron inicializar todos los elementos UI');
        this.logEvent("Error", "No se pudieron inicializar todos los elementos UI");
      } else {
        console.log('Elementos UI inicializados correctamente');
        this.logEvent("Sistema", "Interfaz de usuario inicializada");
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
                ? (this._lastDamageValues.reduce((a, b) => a + b, 0) / this._lastDamageValues.length).toFixed(0)
                : '0';
              updateElementText('dps-value', dps);
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
        }
        
        // Actualizar KDA después de cada evento relevante
        if (['kill', 'death', 'assist'].includes(event.name)) {
          const kda = this._playerStats.deaths > 0 
            ? ((this._playerStats.kills + this._playerStats.assists) / this._playerStats.deaths).toFixed(2)
            : (this._playerStats.kills + this._playerStats.assists).toString();
          updateElementText('kda-value', kda);
        }
      });
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
        ? (this._lastDamageValues.reduce((a, b) => a + b, 0) / this._lastDamageValues.length).toFixed(0)
        : '0';
      updateElementText('dps-value', dps);
      
      console.log('Métricas de rendimiento actualizadas: KDA=' + kda + ', CSPM=' + cspm + ', DPS=' + dps);
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
      overwolf.media.replays.onCaptureError.addListener(error => {
        console.error('Error en la captura de clip:', error);
      });
      
      overwolf.media.replays.onCaptureStopped.addListener(info => {
        console.log('Captura de clip detenida:', info);
        this._isRecording = false;
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
      // Si ya está grabando, no intentar iniciar otra grabación
      if (this._isRecording) {
        console.log('Ya hay una grabación en curso');
        return;
      }

      // Simplemente mostrar una notificación para esta versión
      // La implementación real requeriría usar la API correcta según la versión de Overwolf
      console.log('Se simula la captura de un clip por una kill');
      this.showClipNotification();
      
      // Simular proceso de grabación
      this._isRecording = true;
      setTimeout(() => {
        this._isRecording = false;
        console.log('Simulación de grabación completada');
      }, 3000);
      
      // Aquí iría el código real para grabar usando la API de Overwolf
      // Esta es solo una simulación para el prototipo
    } catch (e) {
      console.error('Error al capturar clip:', e);
    }
  }

  private showClipNotification() {
    try {
      this._clipNotification.classList.remove('hidden');
      
      setTimeout(() => {
        this._clipNotification.classList.add('hidden');
      }, 3000);
    } catch (e) {
      console.error('Error al mostrar notificación de clip:', e);
    }
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

  private async setToggleHotkeyText() {
    try {
      const gameClassId = await this.getCurrentGameClassId();
      const hotkeyText = await OWHotkeys.getHotkeyText(kHotkeys.toggle, gameClassId);
      const hotkeyElem = document.getElementById('hotkey');
      hotkeyElem.textContent = hotkeyText;
    } catch (e) {
      console.error('Error al configurar texto de hotkey:', e);
    }
  }

  private async setToggleHotkeyBehavior() {
    try {
      const toggleInGameWindow = async (
        hotkeyResult: overwolf.settings.hotkeys.OnPressedEvent
      ): Promise<void> => {
        console.log(`pressed hotkey for ${hotkeyResult.name}`);
        const inGameState = await this.getWindowState();

        if (inGameState.window_state === WindowState.NORMAL ||
          inGameState.window_state === WindowState.MAXIMIZED) {
          this.currWindow.minimize();
        } else if (inGameState.window_state === WindowState.MINIMIZED ||
          inGameState.window_state === WindowState.CLOSED) {
          this.currWindow.restore();
        }
      }

      OWHotkeys.onHotkeyDown(kHotkeys.toggle, toggleInGameWindow);
    } catch (e) {
      console.error('Error al configurar comportamiento de hotkey:', e);
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
  
      // Cargar un anuncio simulado
      this.loadSimulatedAd();
      console.log('Interfaz inicializada correctamente');
      
      return true;
    } catch (error) {
      console.error('Error al inicializar la interfaz:', error);
      return false;
    }
  }

  private loadSimulatedAd() {
    try {
      const adContainer = document.getElementById('ad-container');
      if (adContainer) {
        // Crear un anuncio simulado con estilo omashu.gg
        const adContent = document.createElement('div');
        adContent.className = 'simulated-ad';
        adContent.innerHTML = `
          <div style="background: linear-gradient(135deg, #130b37, #271664); color: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 1px solid rgba(109, 61, 255, 0.3); animation: pulse 2s infinite;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; color: rgb(188, 166, 255);">omashu.gg</h3>
            <p style="margin: 0 0 15px 0; font-size: 14px;">Mejora tu experiencia de juego con herramientas premium</p>
            <div style="display: flex; justify-content: center; gap: 10px;">
              <button style="background: rgba(92, 52, 227, 1); border: none; color: white; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.3s;">Suscribirse</button>
              <button style="background: rgba(19, 11, 55, 0.8); border: 1px solid rgba(109, 61, 255, 0.3); color: white; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.3s;">Más información</button>
            </div>
          </div>
          <style>
            @keyframes pulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.02); }
              100% { transform: scale(1); }
            }
          </style>
        `;
        adContainer.innerHTML = '';
        adContainer.appendChild(adContent);
        
        // Registrar evento
        this.logEvent("Publicidad", "Anuncio de omashu.gg cargado");
        console.log('Anuncio de omashu.gg cargado en el contenedor:', adContainer.id);
      } else {
        console.error('No se encontró el contenedor de anuncios');
      }
    } catch (e) {
      console.error('Error al cargar el anuncio simulado:', e);
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

  // Registra el listener al Game Events Provider de Overwolf
  private registerToGEP() {
    try {
      // Verificar si el juego es League of Legends (ID: 5426)
      if (this._gameClassId !== 5426) {
        console.log('El juego actual no es League of Legends');
        return;
      }

      const gameFeatures = kGamesFeatures.get(this._gameClassId);
  
      if (gameFeatures && gameFeatures.length) {
        this._gameEventsListener = new OWGamesEvents(
          {
            onInfoUpdates: this.onInfoUpdates.bind(this),
            onNewEvents: this.onNewEvents.bind(this)
          },
          gameFeatures
        );
  
        this._gameEventsListener.start();
        
        console.log('Inicializado el escuchador de eventos para League of Legends');
        this.logEvent("Sistema", "Plugin inicializado y conectado correctamente");
      }
    } catch (error) {
      console.error('Error al registrar al GEP:', error);
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
}

InGameLOL.instance().run();
