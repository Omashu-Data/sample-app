/**
 * Cargador de componentes header.html
 * Este script carga el header desde un archivo separado
 */
document.addEventListener('DOMContentLoaded', function() {
  // Elemento donde se colocará el header
  const headerContainer = document.getElementById('header-container');
  
  if (headerContainer) {
    // Intentar cargar el header desde archivo
    loadHeaderContent(headerContainer);
  } else {
    console.error('No se encontró el contenedor del header (#header-container)');
  }
  
  // Configurar las hotkeys inmediatamente, independientemente del header
  setupHotkeys();
});

/**
 * Carga el contenido del header en el contenedor
 * @param {HTMLElement} container - El contenedor donde se cargará el header
 */
function loadHeaderContent(container) {
  // Para Overwolf, usamos XMLHttpRequest que es más compatible que fetch
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'header.html', true);
  
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 400) {
      // Éxito - insertar el contenido del header
      container.innerHTML = xhr.responseText;
      
      // Asegurarnos de que el header se ajusta correctamente al contenedor
      const header = container.querySelector('#header');
      if (header) {
        // Eliminar cualquier posicionamiento absoluto o fijo que pueda heredar
        header.style.position = 'relative';
        header.style.top = 'auto';
        header.style.left = 'auto';
        header.style.transform = 'none';
        
        // Inicializar funcionalidades del header
        initializeHeader();
      }
    } else {
      // Error - cargar versión de respaldo
      console.error('Error al cargar el header:', xhr.statusText);
      loadFallbackHeader(container);
    }
  };
  
  xhr.onerror = function() {
    // Error de red - cargar versión de respaldo
    console.error('Error de red al intentar cargar el header');
    loadFallbackHeader(container);
  };
  
  xhr.send();
}

/**
 * Carga una versión de respaldo del header en caso de error
 * @param {HTMLElement} container - El contenedor donde se cargará el header
 */
function loadFallbackHeader(container) {
  // Versión integrada del header como respaldo
  const fallbackHeader = `<!-- Header de respaldo -->
  <header id="header" class="header header--draggable">
    <div class="header__logo-container">
      <img src="../../img/icons/omashu-logo.svg" class="header__logo" alt="omashu.gg logo" />
      <h1>omashu.gg</h1>
    </div>
    <div class="user-progress user-progress--compact">
      <div class="user-progress__level">
        <span class="user-progress__badge pulse-effect">
          <span>🏆</span> Nivel 7
        </span>
        <div class="user-progress__xp">
          <div class="user-progress__xp-bar" style="width: 65%"></div>
          <span class="user-progress__xp-text">650/1000 XP</span>
        </div>
      </div>
      <div class="user-progress__rewards">
        <div class="user-progress__reward user-progress__reward--unlocked" title="Análisis Avanzado Desbloqueado">🏆</div>
        <div class="user-progress__reward user-progress__reward--unlocked" title="Grabación Automática Desbloqueada">📹</div>
        <div class="user-progress__reward" title="Desbloquea en Nivel 10">🔒</div>
      </div>
    </div>
    <span class="header__hotkey">
      Mostrar/Ocultar:
      <kbd id="hotkey">Shift+F</kbd>
    </span>
    <div class="header__controls">
      <button id="minimizeButton" class="header__control header__control--minimize" aria-label="Minimizar"></button>
      <button id="maximizeButton" class="header__control header__control--maximize" aria-label="Maximizar"></button>
      <button id="closeButton" class="header__control header__control--close" aria-label="Cerrar"></button>
    </div>
  </header>`;
  
  container.innerHTML = fallbackHeader;
  initializeHeader();
}

/**
 * Inicializa las funcionalidades del header
 */
function initializeHeader() {
  console.log('Inicializando header...');
  
  // Configurar los botones de control de ventana
  const minimizeButton = document.getElementById('minimizeButton');
  const maximizeButton = document.getElementById('maximizeButton');
  const closeButton = document.getElementById('closeButton');
  const hotkeyElem = document.getElementById('hotkey');

  console.log('Elementos encontrados:', {
    minimizeButton: !!minimizeButton,
    maximizeButton: !!maximizeButton,
    closeButton: !!closeButton,
    hotkeyElem: !!hotkeyElem
  });

  if (minimizeButton) {
    minimizeButton.addEventListener('click', () => {
      if (window.overwolf) {
        overwolf.windows.getCurrentWindow(result => {
          if (result.success) {
            overwolf.windows.minimize(result.window.id);
          }
        });
      } else {
        console.log('Acción de minimizar (simulada)');
      }
    });
  }

  if (maximizeButton) {
    maximizeButton.addEventListener('click', () => {
      if (window.overwolf) {
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
      } else {
        console.log('Acción de maximizar/restaurar (simulada)');
      }
    });
  }

  if (closeButton) {
    closeButton.addEventListener('click', () => {
      if (window.overwolf) {
        overwolf.windows.getCurrentWindow(result => {
          if (result.success) {
            overwolf.windows.close(result.window.id);
          }
        });
      } else {
        console.log('Acción de cerrar (simulada)');
      }
    });
  }

  // Actualizar la información de la tecla de acceso rápido
  updateHotkeyText();
}

/**
 * Configura los atajos de teclado para la aplicación
 */
function setupHotkeys() {
  if (!window.overwolf) {
    console.log('API de Overwolf no disponible');
    return;
  }
  
  console.log('Configurando hotkeys...');
  
  // Nombre de la hotkey definida en consts.ts
  const TOGGLE_HOTKEY_NAME = 'lol_metrics_showhide';
  
  // Función para minimizar/restaurar la ventana
  const toggleWindow = async () => {
    console.log('Toggle hotkey presionada');
    overwolf.windows.getCurrentWindow(result => {
      if (result.success) {
        const windowId = result.window.id;
        overwolf.windows.getWindowState(windowId, stateResult => {
          if (stateResult.success) {
            if (stateResult.window_state === 'normal' || 
                stateResult.window_state === 'maximized') {
              console.log('Minimizando ventana...');
              overwolf.windows.minimize(windowId);
            } else {
              console.log('Restaurando ventana...');
              overwolf.windows.restore(windowId);
            }
          }
        });
      }
    });
  };
  
  // Registrar el listener para la hotkey
  overwolf.settings.hotkeys.onPressed.addListener(result => {
    console.log('Hotkey presionada:', result?.name);
    if (result && result.name === TOGGLE_HOTKEY_NAME) {
      toggleWindow();
    }
  });
  
  console.log('Hotkey registrada exitosamente');
  
  // Actualizar el texto de la hotkey
  updateHotkeyText();
}

/**
 * Actualiza el texto mostrado para la hotkey en la interfaz
 */
function updateHotkeyText() {
  if (!window.overwolf) {
    return;
  }
  
  const hotkeyElem = document.getElementById('hotkey');
  if (!hotkeyElem) {
    console.error('No se encontró el elemento hotkey');
    return;
  }
  
  // Nombre de la hotkey definida en consts.ts
  const TOGGLE_HOTKEY_NAME = 'lol_metrics_showhide';
  
  overwolf.settings.hotkeys.get(result => {
    if (!result || !result.success) {
      console.error('Error al obtener hotkeys');
      hotkeyElem.textContent = 'Shift+F';
      return;
    }
    
    console.log('Hotkeys obtenidas:', result);
    
    // Buscar primero en hotkeys de juego
    let hotkeyText = 'Shift+F'; // Valor por defecto
    let hotkey;
    
    // Buscar en todos los juegos
    if (result.games) {
      for (const gameId in result.games) {
        if (Object.prototype.hasOwnProperty.call(result.games, gameId)) {
          const gameHotkeys = result.games[gameId];
          const foundHotkey = gameHotkeys.find(h => h.name === TOGGLE_HOTKEY_NAME);
          if (foundHotkey) {
            hotkey = foundHotkey;
            break;
          }
        }
      }
    }
    
    // Si no se encuentra en juegos, buscar en globales
    if (!hotkey && result.globals) {
      hotkey = result.globals.find(h => h.name === TOGGLE_HOTKEY_NAME);
    }
    
    if (hotkey && hotkey.binding) {
      hotkeyText = hotkey.binding;
    }
    
    console.log(`Texto de hotkey actualizado: ${hotkeyText}`);
    hotkeyElem.textContent = hotkeyText;
  });
} 