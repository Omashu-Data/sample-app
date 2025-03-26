import {
  OWGames,
  OWGamesEvents,
  OWHotkeys,
  OWWindow
} from "@overwolf/overwolf-api-ts";

import { AppWindow } from "../AppWindow";
import { kHotkeys, kWindowNames, kGamesFeatures } from "../consts";

import WindowState = overwolf.windows.WindowStateEx;

// Ventana que se muestra en juego mientras un juego está ejecutándose.
// Escucha todos los eventos de información y eventos del juego listados en consts.ts
// y los escribe en el registro correspondiente.
// También configura Ctrl+F como tecla rápida para minimizar/restaurar.
class InGame extends AppWindow {
  private static _instance: InGame;
  private _gameEventsListener: OWGamesEvents;
  private _windows: Record<string, OWWindow>;
  private _eventsLog: HTMLElement;
  private _infoLog: HTMLElement;
  private _loLFeaturesRegistered: boolean = false;

  private constructor() {
    super(kWindowNames.inGame);

    this._windows = {};
    this._windows[kWindowNames.inGame] = new OWWindow(kWindowNames.inGame);

    // Inicializar elementos de registro - IMPORTANTE: Estos IDs deben existir en el HTML
    this._eventsLog = document.getElementById('eventsLog');
    this._infoLog = document.getElementById('infoLog');

    // Configurar teclas rápidas
    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();

    // Agregar listeners directos (forma utilizada en los ejemplos específicos)
    this.registerEventsDirectly();
  }

  private registerEventsDirectly() {
    // Agregar listeners directos de Overwolf events
    overwolf.games.events.onError.addListener((info) => {
      console.error("Error en eventos del juego:", info);
    });

    // Información estática y actualizaciones
    overwolf.games.events.onInfoUpdates2.addListener((info) => {
      console.log("InfoUpdate recibido directamente:", info);
      this.onInfoUpdates(info);
    });

    // Eventos del juego
    overwolf.games.events.onNewEvents.addListener((info) => {
      console.log("Nuevo evento recibido directamente:", info);
      this.onNewEvents(info);
    });
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new InGame();
    }

    return this._instance;
  }

  public async run() {
    const gameClassId = await this.getCurrentGameClassId();

    if (!gameClassId) {
      console.error("No se pudo detectar el juego en ejecución");
      return;
    }

    console.log(`Juego detectado: ${gameClassId}`);
    
    // Intentar obtener características específicas del juego
    const gameFeatures = kGamesFeatures.get(gameClassId);

    if (gameFeatures && gameFeatures.length) {
      console.log("Registrando eventos para las características:", gameFeatures);
      
      // Usar tanto el método de la clase OWGamesEvents como el método directo
      this._gameEventsListener = new OWGamesEvents(
        {
          onInfoUpdates: this.onInfoUpdates.bind(this),
          onNewEvents: this.onNewEvents.bind(this)
        },
        gameFeatures
      );

      this._gameEventsListener.start();
      console.log("Listener de eventos iniciado con OWGamesEvents");

      // También usar el método específico de setRequiredFeatures como en el ejemplo de LoL
      if (gameClassId === 5426 && !this._loLFeaturesRegistered) {
        this.setLoLRequiredFeatures();
      }

    // Inicializar la interfaz
      await this.initInterface();
    }
  }

  // Registrar características específicas para League of Legends
  // Esta función replica el comportamiento del ejemplo lol-events-sample-app
  private setLoLRequiredFeatures() {
    const loLFeatures = [
      'summoner_info',
      'gameMode',
      'teams',
      'matchState',
      'kill',
      'death',
      'respawn',
      'assist',
      'minions',
      'level',
      'abilities',
      'announcer',
      'counters',
      'match_info',
      'damage',
      'heal',
      'live_client_data',
      'jungle_camps',
      'team_frames'
    ];

    console.log("Configurando características específicas para LoL:", loLFeatures);

    const trySetFeatures = () => {
      overwolf.games.events.setRequiredFeatures(loLFeatures, (info) => {
        if (!info.success) {
          console.log("No se pudieron establecer las características requeridas: " + info.error);
          console.log("Intentando de nuevo en 2 segundos");
          window.setTimeout(trySetFeatures, 2000);
          return;
        }

        console.log("Características requeridas establecidas correctamente:");
        console.log(JSON.stringify(info));
        this._loLFeaturesRegistered = true;
      });
    };

    trySetFeatures();
  }

  private async initInterface() {
    try {
      console.log("Inicializando la interfaz...");
      
      // Inicializar loader para componentes HTML
      await this.loadComponents();

      // Inicializar botones de control de ventana
      this.initWindowControlButtons();
      
      console.log("Interfaz inicializada correctamente");
    } catch (error) {
      console.error("Error al inicializar la interfaz:", error);
    }
  }

  private async loadComponents() {
    try {
      // Esta función es para mantener compatibilidad con la carga dinámica de componentes
      console.log("Carga de componentes delegada a los scripts externos");
    } catch (e) {
      console.error("Error al cargar componentes:", e);
    }
  }

  private onInfoUpdates(info) {
    console.log("Info update recibido:", info);
    this.logLine(this._infoLog, info, false);
  }

  private onNewEvents(e) {
    console.log("Nuevos eventos recibidos:", e);
    
    // Eventos especiales que se destacarán en el registro
    const shouldHighlight = e.events && e.events.some(event => {
      switch (event.name) {
        case 'kill':
        case 'death':
        case 'assist':
        case 'level':
        case 'matchStart':
        case 'match_start':
        case 'matchEnd':
        case 'match_end':
          return true;
      }
      return false
    });
    
    this.logLine(this._eventsLog, e, shouldHighlight);
  }

  // Muestra la tecla rápida para minimizar/restaurar en el encabezado de la ventana
  private async setToggleHotkeyText() {
    try {
      const gameClassId = await this.getCurrentGameClassId();
      const hotkeyText = await OWHotkeys.getHotkeyText(kHotkeys.toggle, gameClassId);
      const hotkeyElem = document.getElementById('hotkey');
      if (hotkeyElem) {
        hotkeyElem.textContent = hotkeyText;
      }
    } catch (e) {
      console.error("Error al configurar texto de hotkey:", e);
    }
  }

  // Establece toggleInGameWindow como el comportamiento para la tecla rápida Ctrl+F
  private async setToggleHotkeyBehavior() {
    try {
      const toggleInGameWindow = async (
        hotkeyResult: overwolf.settings.hotkeys.OnPressedEvent
      ): Promise<void> => {
        console.log(`Se presionó la tecla rápida ${hotkeyResult.name}`);
        const inGameState = await this._windows[kWindowNames.inGame].getWindowState();

      if (inGameState.window_state === WindowState.NORMAL ||
        inGameState.window_state === WindowState.MAXIMIZED) {
          this._windows[kWindowNames.inGame].minimize();
        } else if (inGameState.window_state === WindowState.MINIMIZED ||
          inGameState.window_state === WindowState.CLOSED) {
          this._windows[kWindowNames.inGame].restore();
        }
      }

      OWHotkeys.onHotkeyDown(kHotkeys.toggle, toggleInGameWindow);
      } catch (e) {
      console.error("Error al configurar comportamiento de hotkey:", e);
    }
  }

  // Añade una nueva línea al registro especificado
  private logLine(log: HTMLElement, data, highlight) {
    if (!log) {
      console.warn("Elemento de log no disponible");
          return;
        }
        
    try {
      const line = document.createElement('pre');
      line.textContent = JSON.stringify(data);

      if (highlight) {
        line.className = 'highlight';
      }

      // Comprobar si el desplazamiento está cerca del fondo
      const shouldAutoScroll =
        log.scrollTop + log.offsetHeight >= log.scrollHeight - 10;

      log.appendChild(line);

      if (shouldAutoScroll) {
        log.scrollTop = log.scrollHeight;
      }
    } catch (e) {
      console.error("Error al agregar línea al log:", e);
    }
  }

  private initWindowControlButtons() {
    try {
      // Botones de control de ventana
      const minimizeButton = document.getElementById('minimizeButton');
      const maximizeButton = document.getElementById('maximizeButton');
      const closeButton = document.getElementById('closeButton');

      // Verificar si se encontraron los botones
      if (minimizeButton) {
      minimizeButton.addEventListener('click', () => {
        overwolf.windows.getCurrentWindow(result => {
          if (result.success) {
            overwolf.windows.minimize(result.window.id);
          }
        });
      });
      }

      if (maximizeButton) {
      maximizeButton.addEventListener('click', () => {
        overwolf.windows.getCurrentWindow(result => {
          if (result.success) {
            const windowId = result.window.id;
            overwolf.windows.getWindowState(windowId, stateResult => {
              if (stateResult.success) {
                if (stateResult.window_state === 'maximized') {
                  overwolf.windows.restore(windowId);
                } else {
                  overwolf.windows.maximize(windowId);
                }
              }
            });
          }
        });
      });
      }

      if (closeButton) {
      closeButton.addEventListener('click', () => {
        overwolf.windows.getCurrentWindow(result => {
          if (result.success) {
            overwolf.windows.close(result.window.id);
          }
        });
      });
      }
    } catch (e) {
      console.error('Error inicializando botones de control de ventana:', e);
    }
  }

  private async getCurrentGameClassId(): Promise<number | null> {
    try {
      const info = await OWGames.getRunningGameInfo();
      return (info && info.isRunning && info.classId) ? info.classId : null;
    } catch (e) {
      console.error("Error al obtener el ID de clase del juego:", e);
      return null;
    }
  }
}

InGame.instance().run();
