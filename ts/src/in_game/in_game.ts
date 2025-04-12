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
  private _windows: Record<string, OWWindow>;

  private constructor() {
    super(kWindowNames.inGame);

    this._windows = {};
    this._windows[kWindowNames.inGame] = new OWWindow(kWindowNames.inGame);

    // Configurar teclas rápidas
    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();
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
    
    // Inicializar la interfaz
    await this.initInterface();
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
