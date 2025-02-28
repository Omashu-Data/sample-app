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

  private constructor() {
    super(kWindowNames.inGame);

    // Inicializar elementos HTML
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
    this._adContainer = document.getElementById('ad-container');

    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();
    
    // Inicializar captura de clips
    this.initializeClipCapture();
    
    // Configurar los anuncios
    this.setupAds();
    
    // Iniciar el temporizador para actualizar métricas regulares
    setInterval(() => this.updatePerformanceMetrics(), 5000);
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new InGameLOL();
    }
    return this._instance;
  }

  public async run() {
    this._gameClassId = await this.getCurrentGameClassId();
    
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
  }

  private onInfoUpdates(info) {
    console.log('Info update recibido:', info);
    
    try {
      // Actualizar información del juego
      if (info.game_info) {
        if (info.game_info.game_mode) {
          this._playerStats.gameMode = info.game_info.game_mode;
          this.updateUI('gameMode', info.game_info.game_mode);
        }
        
        if (info.game_info.time) {
          const timeInSeconds = parseInt(info.game_info.time);
          this._playerStats.gameTime = timeInSeconds;
          this.updateUI('gameTime', this.formatGameTime(timeInSeconds));
        }
      }
      
      // Actualizar contadores
      if (info.counters) {
        if (info.counters.gold) {
          this._playerStats.gold = parseInt(info.counters.gold);
          this.updateUI('gold', info.counters.gold);
        }
        
        if (info.counters.minions_killed) {
          this._playerStats.cs = parseInt(info.counters.minions_killed);
          this.updateUI('cs', info.counters.minions_killed);
        }
      }
      
      // Actualizar nivel
      if (info.level) {
        this._playerStats.level = parseInt(info.level);
        this.updateUI('level', info.level);
      }
    } catch (e) {
      console.error('Error procesando actualizaciones de información:', e);
    }
  }

  private onNewEvents(e) {
    console.log('Nuevos eventos recibidos:', e);
    
    if (!e || !e.events) {
      return;
    }
    
    try {
      e.events.forEach(event => {
        switch (event.name) {
          case 'kill':
            this._playerStats.kills++;
            this.updateUI('kills', this._playerStats.kills.toString());
            this.logEvent("Kill", "¡Has conseguido una kill!");
            this.captureClip();
            this.sendEventToServer('kill');
            break;
            
          case 'death':
            this._playerStats.deaths++;
            this.updateUI('deaths', this._playerStats.deaths.toString());
            this.logEvent("Muerte", "Has muerto");
            break;
            
          case 'assist':
            this._playerStats.assists++;
            this.updateUI('assists', this._playerStats.assists.toString());
            this.logEvent("Asistencia", "Has conseguido una asistencia");
            break;
            
          case 'level':
            if (event.data) {
              this._playerStats.level = parseInt(event.data.level);
              this.updateUI('level', event.data.level);
              this.logEvent("Nivel", `Has subido al nivel ${event.data.level}`);
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
      });
    } catch (e) {
      console.error('Error procesando eventos:', e);
    }
  }

  // Actualiza los elementos de la UI con nuevos valores
  private updateUI(stat: string, value: string) {
    try {
      let element: HTMLElement = null;
      
      switch (stat) {
        case 'kills':
          element = this._killsValue;
          break;
        case 'deaths':
          element = this._deathsValue;
          break;
        case 'assists':
          element = this._assistsValue;
          break;
        case 'cs':
          element = this._csValue;
          break;
        case 'level':
          element = this._levelValue;
          break;
        case 'gold':
          element = this._goldValue;
          break;
        case 'gameTime':
          element = this._gameTimeValue;
          break;
        case 'gameMode':
          element = this._gameModeValue;
          break;
        case 'dps':
          element = this._dpsValue;
          break;
        case 'kda':
          element = this._kdaValue;
          break;
        case 'cspm':
          element = this._cspmValue;
          break;
      }
      
      if (element) {
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
      }
    } catch (e) {
      console.error('Error actualizando la UI:', e);
    }
  }

  // Calcula y actualiza las métricas de rendimiento
  private updatePerformanceMetrics() {
    try {
      // Calcular KDA
      const kda = this._playerStats.deaths > 0 
        ? ((this._playerStats.kills + this._playerStats.assists) / this._playerStats.deaths).toFixed(2)
        : (this._playerStats.kills + this._playerStats.assists).toString();
      this.updateUI('kda', kda);
      
      // Calcular CS por minuto
      const gameTimeMinutes = this._playerStats.gameTime / 60;
      const cspm = gameTimeMinutes > 0 
        ? (this._playerStats.cs / gameTimeMinutes).toFixed(1)
        : '0';
      this.updateUI('cspm', cspm);
      
      // Calcular DPS promedio
      const dps = this._lastDamageValues.length > 0 
        ? (this._lastDamageValues.reduce((a, b) => a + b, 0) / this._lastDamageValues.length).toFixed(0)
        : '0';
      this.updateUI('dps', dps);
    } catch (e) {
      console.error('Error actualizando métricas de rendimiento:', e);
    }
  }

  // Formatea el tiempo de juego a mm:ss
  private formatGameTime(timeInSeconds: number): string {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Registra eventos en el log visual
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

  // Inicializa la captura de clips
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

  // Captura un clip cuando el jugador realiza una kill
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

  // Muestra una notificación cuando se ha guardado un clip
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

  // Configura los anuncios de Overwolf
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

  // Envía un evento al servidor web
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

  // Envía un resumen de la partida al servidor
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

  // Resetea las estadísticas para una nueva partida
  private resetStats() {
    try {
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
      
      // Actualizar UI
      this.updateUI('kills', '0');
      this.updateUI('deaths', '0');
      this.updateUI('assists', '0');
      this.updateUI('cs', '0');
      this.updateUI('level', '1');
      this.updateUI('gold', '0');
      this.updateUI('gameTime', '00:00');
      this.updateUI('dps', '0');
      this.updateUI('kda', '0');
      this.updateUI('cspm', '0');
      
      // Limpiar log de eventos
      this._eventsLog.innerHTML = '';
    } catch (e) {
      console.error('Error al resetear estadísticas:', e);
    }
  }

  // Displays the toggle minimize/restore hotkey in the window header
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

  // Sets toggleInGameWindow as the behavior for the Ctrl+F hotkey
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
}

InGameLOL.instance().run();
