/**
 * Archivo principal para la ventana in-game
 * Inicializa la interfaz y maneja la comunicación con Overwolf
 */

// Configuración global
const DEBUG_MODE = true; // Activa el modo de depuración globalmente

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('Inicializando ventana in-game...');
  
  // Inicializar la aplicación
  initializeApp();
});

/**
 * Inicializa la aplicación completa
 */
function initializeApp() {
  console.log('Configurando interfaz de usuario...');
  
  // Registrar listener para cuando el contenido de pestaña se carga
  document.addEventListener('tabContentLoaded', onTabContentLoaded);
  
  // Comprobar si hay información de debug y mostrarla si es necesario
  setupDebugMode();
  
  // Probar a obtener cada tab para ver si se carga correctamente
  setTimeout(checkTabsLoaded, 2000);
  
  // En modo debug, añadir controles para recargar componentes
  if (DEBUG_MODE) {
    setupDebugControls();
  }
}

/**
 * Maneja el evento de carga de contenido de pestaña
 * @param {CustomEvent} event - El evento de carga de pestaña
 */
function onTabContentLoaded(event) {
  const tabId = event.detail.tabId;
  console.log(`Contenido de pestaña ${tabId} cargado correctamente`);
  
  // Actualizar elementos específicos según la pestaña
  if (tabId === 'overview-tab') {
    // Actualizar información de resumen
    updateOverviewTab();
  }
}

/**
 * Configura el modo de depuración si es necesario
 */
function setupDebugMode() {
  // Usar variable global o parámetro de URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlDebug = urlParams.get('debug');
  
  if (DEBUG_MODE || urlDebug === 'true') {
    // Crear un contenedor de información de depuración
    const debugInfo = document.createElement('div');
    debugInfo.className = 'debug-info';
    debugInfo.innerHTML = '<b>MODO DEBUG ACTIVADO</b>';
    document.body.appendChild(debugInfo);
    
    // Registrar listener para mostrar información en el contenedor
    window.debugLog = function(message) {
      const timestamp = new Date().toLocaleTimeString();
      debugInfo.innerHTML += `<br>[${timestamp}] ${message}`;
      console.log(`[DEBUG] ${message}`);
      
      // Mantener el scroll al final
      debugInfo.scrollTop = debugInfo.scrollHeight;
    };
    
    // Añadir contornos de depuración para elementos importantes
    if (urlDebug === 'highlight') {
      document.querySelectorAll('.tabs__pane').forEach(pane => {
        pane.classList.add('debug-highlight');
      });
      
      document.querySelectorAll('.tabs__button').forEach(button => {
        button.classList.add('debug-highlight');
      });
    }
    
    window.debugLog('Sistema de depuración inicializado');
  }
}

/**
 * Configura controles de depuración adicionales
 */
function setupDebugControls() {
  // Crear panel de control de depuración
  const debugControls = document.createElement('div');
  debugControls.className = 'debug-controls';
  debugControls.style.cssText = 'position:fixed;top:5px;left:5px;background:rgba(0,0,0,0.7);padding:5px;border-radius:3px;z-index:9999;color:lime;font-size:12px;';
  
  // Botón para recargar los tabs
  const reloadTabsButton = document.createElement('button');
  reloadTabsButton.textContent = 'Recargar Tabs';
  reloadTabsButton.style.cssText = 'margin-right:5px;padding:3px;background:#333;color:lime;border:1px solid lime;border-radius:3px;cursor:pointer;';
  reloadTabsButton.onclick = function() {
    if (window.tabLoader && typeof window.tabLoader.initTabsListeners === 'function') {
      window.tabLoader.initTabsListeners();
      window.debugLog('Tabs reinicializados manualmente');
    }
  };
  
  // Botón para ver información DOM
  const inspectDOMButton = document.createElement('button');
  inspectDOMButton.textContent = 'Inspeccionar DOM';
  inspectDOMButton.style.cssText = 'padding:3px;background:#333;color:lime;border:1px solid lime;border-radius:3px;cursor:pointer;';
  inspectDOMButton.onclick = function() {
    const tabsCount = document.querySelectorAll('.tabs__pane').length;
    const buttonsCount = document.querySelectorAll('.tabs__button').length;
    const activePane = document.querySelector('.tabs__pane--active');
    const activeButton = document.querySelector('.tabs__button--active');
    
    window.debugLog(`Tabs: ${tabsCount}, Botones: ${buttonsCount}`);
    window.debugLog(`Tab activo: ${activePane ? activePane.id : 'ninguno'}`);
    window.debugLog(`Botón activo: ${activeButton ? activeButton.getAttribute('data-tab-target') : 'ninguno'}`);
  };
  
  // Agregar botones al panel
  debugControls.appendChild(reloadTabsButton);
  debugControls.appendChild(inspectDOMButton);
  document.body.appendChild(debugControls);
}

/**
 * Actualiza la información en la pestaña de resumen
 */
function updateOverviewTab() {
  // Buscar el elemento match-time
  const matchTimeElement = document.getElementById('match-time');
  if (matchTimeElement) {
    // Actualizar con un valor de ejemplo para probar
    matchTimeElement.textContent = '10:45';
    console.log('Tiempo en pestaña de resumen actualizado');
  } else {
    console.error('No se encontró el elemento match-time en la pestaña de resumen');
  }
}

/**
 * Verifica que todas las pestañas se carguen correctamente
 */
function checkTabsLoaded() {
  const tabs = ['overview-tab', 'stats-tab', 'events-tab', 'clips-tab', 'performance-tab', 'improve-tab', 'heatmap-tab'];
  let loadedCount = 0;
  
  tabs.forEach(tabId => {
    const tabPane = document.getElementById(tabId);
    if (tabPane) {
      console.log(`Pestaña ${tabId} encontrada`);
      loadedCount++;
      
      // Verificar si tiene contenido o solo el indicador de carga
      const hasContent = tabPane.innerHTML.includes('loading-indicator') === false || tabPane.getAttribute('data-loaded') === 'true';
      console.log(`Pestaña ${tabId} tiene contenido: ${hasContent}`);
      
      // Si no tiene contenido y no está cargando, intentar cargarlo manualmente
      if (!hasContent && tabPane.querySelectorAll('.loading-indicator').length === 0) {
        console.log(`Intentando cargar contenido para ${tabId} manualmente...`);
        if (window.tabLoader && typeof window.tabLoader.loadTabContent === 'function') {
          window.tabLoader.loadTabContent(tabId);
        }
      }
    } else {
      console.error(`Pestaña ${tabId} NO encontrada`);
    }
  });
  
  console.log(`Se encontraron ${loadedCount} de ${tabs.length} pestañas`);
  
  // Verificar los botones de pestañas
  const tabButtons = document.querySelectorAll('.tabs__button');
  console.log(`Se encontraron ${tabButtons.length} botones de pestañas`);
  
  // Verificar atributos de botones
  tabButtons.forEach((button, index) => {
    const target = button.getAttribute('data-tab-target');
    console.log(`Botón ${index + 1}: data-tab-target="${target}"`);
  });
  
  // Verificar si hay alguna pestaña activa
  const activePane = document.querySelector('.tabs__pane--active');
  if (activePane) {
    console.log(`Pestaña activa: ${activePane.id}`);
  } else {
    console.error('No hay ninguna pestaña activa');
    
    // Activar la primera pestaña si ninguna está activa
    const firstTab = document.querySelector('.tabs__pane');
    if (firstTab) {
      firstTab.classList.add('tabs__pane--active');
      console.log(`Activada primera pestaña (${firstTab.id}) por defecto`);
      
      // También activar el botón correspondiente
      const firstButton = document.querySelector(`.tabs__button[data-tab-target="${firstTab.id}"]`);
      if (firstButton) {
        firstButton.classList.add('tabs__button--active');
      }
    }
  }
  
  if (DEBUG_MODE && window.debugLog) {
    window.debugLog(`Verificación de pestañas completada: ${loadedCount}/${tabs.length} encontradas`);
  }
} 