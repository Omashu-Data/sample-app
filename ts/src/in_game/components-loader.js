/**
 * Cargador de componentes modulares
 * Este script carga los diferentes componentes de la interfaz desde archivos separados
 */
document.addEventListener('DOMContentLoaded', function() {
  // Cargar los diferentes componentes
  loadBannerHorizontal();
  loadTabsMenu();
  loadBannerVertical();
  
  // Inicializar los listeners de tabs
  initTabsListeners();
  
  // Escuchar específicamente cuando se carga la pestaña de eventos
  document.addEventListener('tabContentLoaded', function(e) {
    if (e.detail && e.detail.tabId === 'events-tab') {
      console.log('Tab de eventos cargado, inicializando observadores...');
      triggerEventsObservers();
    }
  });
});

/**
 * Carga el banner horizontal en su contenedor
 */
function loadBannerHorizontal() {
  const container = document.getElementById('banner-horizontal-container');
  if (container) {
    loadComponent(container, 'banner-horizontal.html', 'banner horizontal');
  }
}

/**
 * Carga el menú de tabs en su contenedor
 */
function loadTabsMenu() {
  const container = document.getElementById('tabs-menu-container');
  if (container) {
    loadComponent(container, 'tabs-menu.html', 'menú de tabs', initTabsListeners);
  }
}

/**
 * Carga el banner vertical en su contenedor
 */
function loadBannerVertical() {
  const container = document.getElementById('banner-vertical-container');
  if (container) {
    loadComponent(container, 'banner-vertical.html', 'banner vertical');
  }
}

/**
 * Función genérica para cargar un componente
 * @param {HTMLElement} container - El contenedor donde se cargará el componente
 * @param {string} file - El archivo HTML a cargar
 * @param {string} name - Nombre descriptivo del componente (para logs)
 * @param {Function} callback - Función a ejecutar después de cargar (opcional)
 */
function loadComponent(container, file, name, callback) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', file, true);
  
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 400) {
      // Éxito - insertar el contenido
      container.innerHTML = xhr.responseText;
      console.log(`Componente ${name} cargado correctamente`);
      
      // Ejecutar callback si existe
      if (typeof callback === 'function') {
        callback();
      }
    } else {
      console.error(`Error al cargar el componente ${name}:`, xhr.statusText);
      // No aplicamos fallback para mantener la simplicidad
    }
  };
  
  xhr.onerror = function() {
    console.error(`Error de red al intentar cargar el componente ${name}`);
  };
  
  xhr.send();
}

/**
 * Inicializa los listeners para las pestañas
 */
function initTabsListeners() {
  const tabButtons = document.querySelectorAll('.tabs__button');
  const tabPanes = document.querySelectorAll('.tabs__pane');
  
  if (!tabButtons.length) {
    console.warn('No se encontraron botones de tabs para inicializar');
    return;
  }
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remover clase activa de todos los botones
      tabButtons.forEach(btn => btn.classList.remove('tabs__button--active'));
      
      // Añadir clase activa al botón actual
      button.classList.add('tabs__button--active');
      
      // Obtener el tab a mostrar
      const tabName = button.getAttribute('data-tab-target');
      
      // Ocultar todos los paneles
      tabPanes.forEach(pane => pane.classList.remove('tabs__pane--active'));
      
      // Mostrar el panel correspondiente
      const activePane = document.getElementById(tabName);
      if (activePane) {
        activePane.classList.add('tabs__pane--active');
        
        // Si el contenido aún no se ha cargado, cargarlo
        if (!activePane.dataset.loaded) {
          loadTabContent(tabName);
          activePane.dataset.loaded = 'true';
        }
      }
    });
  });
  
  console.log('Listeners de tabs inicializados');
  
  // Activar el primer tab por defecto
  const firstTabButton = tabButtons[0];
  if (firstTabButton) {
    const tabName = firstTabButton.getAttribute('data-tab-target');
    const firstTab = document.getElementById(tabName);
    if (firstTab && !firstTab.dataset.loaded) {
      loadTabContent(tabName);
      firstTab.dataset.loaded = 'true';
    }
  }
}

/**
 * Carga el contenido de una pestaña específica
 * @param {string} tabId - El ID del contenedor de la pestaña
 */
function loadTabContent(tabId) {
  const tabName = tabId.replace('-tab', '');
  const htmlFile = `tab-${tabName}.html`;
  
  console.log(`Cargando contenido para ${tabId} desde ${htmlFile}`);
  
  const tabPane = document.getElementById(tabId);
  if (!tabPane) {
    console.error(`No se encontró el elemento con ID ${tabId}`);
    return;
  }
  
  // Mostrar indicador de carga
  tabPane.innerHTML = `<div class="loading-indicator" style="text-align: center; padding: 20px; margin-top: 30px;">
    <div style="font-size: 16px; margin-bottom: 10px;">Cargando ${tabName}...</div>
    <div style="font-size: 12px; color: #aaa;">Por favor espere mientras se preparan los datos</div>
  </div>`;
  
  fetch(htmlFile)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(html => {
      // Insertar el HTML
      tabPane.innerHTML = html;
      console.log(`Contenido HTML cargado exitosamente para ${tabId}`);
      
      // Si es la pestaña de resumen, aplicar datos inmediatamente
      if (tabId === 'overview-tab') {
        // Asegurarnos de que el elemento está listo antes de actualizarlo
        setTimeout(() => {
          try {
            // Actualizar directamente los elementos principales
            directUpdateTab(tabId);
            
            // Crear un script simple para manejar futuras actualizaciones
            const script = document.createElement('script');
            script.textContent = `
              (function() {
                // Función para recibir actualizaciones centralizadas
                window.receiveGameData = function(data) {
                  console.log('${tabId}: Recibiendo actualización directa');
                  if (typeof updateUI === 'function') {
                    updateUI(data);
                  } else {
                    console.warn('No se encontró función updateUI en ${tabId}');
                  }
                };
                
                // Registrar que el tab está listo para recibir datos
                if (window.parent && window.parent.registerTabReady) {
                  window.parent.registerTabReady('${tabId}');
                }
                
                console.log('${tabId}: Preparado para recibir datos');
              })();
            `;
            tabPane.appendChild(script);
            
            // Establecer un timer para actualizar periódicamente
            if (!window._tabUpdateTimers) window._tabUpdateTimers = {};
            if (window._tabUpdateTimers[tabId]) clearInterval(window._tabUpdateTimers[tabId]);
            
            window._tabUpdateTimers[tabId] = setInterval(() => {
              directUpdateTab(tabId);
            }, 1000);
            
            console.log(`Tab ${tabId} configurado para actualizaciones automáticas`);
          } catch (e) {
            console.error(`Error inicializando tab ${tabId}:`, e);
          }
        }, 200);
      }
      
      // Disparar evento para notificar que el contenido se ha cargado
      const event = new CustomEvent('tabContentLoaded', { detail: { tabId } });
      document.dispatchEvent(event);
    })
    .catch(error => {
      console.error(`Error al cargar el contenido para ${tabId}:`, error);
      tabPane.innerHTML = `<div class="error-message" style="color: red; padding: 20px; text-align: center;">
        Error al cargar ${tabName}: ${error.message}
      </div>`;
    });
}

/**
 * Actualiza directamente los elementos de una pestaña con los datos actuales del juego
 * @param {string} tabId - El ID de la pestaña a actualizar
 */
function directUpdateTab(tabId) {
  if (!window.gameDataManager) {
    console.warn(`No se puede actualizar ${tabId}: gameDataManager no disponible`);
    return;
  }
  
  try {
    const tabPane = document.getElementById(tabId);
    if (!tabPane) {
      console.warn(`Pestaña ${tabId} no encontrada`);
      return;
    }
    
    const data = window.gameDataManager.getData();
    console.log(`Actualizando ${tabId} con datos:`, {
      summoner: data.summoner.name,
      gameTime: data.match.gameTime,
      kda: `${data.match.kills}/${data.match.deaths}/${data.match.assists}`
    });
    
    // Actualización específica para overview-tab
    if (tabId === 'overview-tab') {
      const playerNameElement = tabPane.querySelector('#player-name');
      const gameTimeElement = tabPane.querySelector('#game-time-value');
      const killsElement = tabPane.querySelector('#kda-kills');
      const deathsElement = tabPane.querySelector('#kda-deaths');
      const assistsElement = tabPane.querySelector('#kda-assists');
      
      if (playerNameElement && data.summoner && data.summoner.name) {
        playerNameElement.textContent = data.summoner.name;
      }
      
      if (gameTimeElement && data.match && data.match.gameTime !== undefined) {
        const minutes = Math.floor(data.match.gameTime / 60);
        const seconds = data.match.gameTime % 60;
        gameTimeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      
      if (killsElement && data.match) {
        killsElement.textContent = data.match.kills || '0';
      }
      
      if (deathsElement && data.match) {
        deathsElement.textContent = data.match.deaths || '0';
      }
      
      if (assistsElement && data.match) {
        assistsElement.textContent = data.match.assists || '0';
      }
      
      // Actualizar también el panel de rendimiento para mostrar la hora de actualización
      const ratingPanel = tabPane.querySelector('.overview-rating');
      if (ratingPanel) {
        ratingPanel.innerHTML = `
          <div style="text-align: center; font-size: 12px; margin-bottom: 5px;">
            Actualizado: ${new Date().toLocaleTimeString()}
          </div>
          <div style="font-size: 18px; font-weight: bold;">B+</div>
        `;
      }
    }
  } catch (e) {
    console.error(`Error actualizando ${tabId}:`, e);
  }
}

/**
 * Función para asegurarse de que los observers de eventos se inicialicen
 * correctamente cuando se carga la pestaña de eventos
 */
function triggerEventsObservers() {
  try {
    console.log('Intentando forzar la inicialización de los observers de eventos...');
    
    // Verificar si los divs ocultos existen y tienen contenido
    const eventsLog = document.getElementById('eventsLog');
    const infoLog = document.getElementById('infoLog');
    
    console.log('Estado de los logs originales:', {
      eventsLog: eventsLog ? `encontrado (${eventsLog.childNodes.length} nodos)` : 'no encontrado',
      infoLog: infoLog ? `encontrado (${infoLog.childNodes.length} nodos)` : 'no encontrado'
    });
    
    // Asegurarse de que los divs visibles existan
    const eventsTab = document.getElementById('events-tab');
    if (eventsTab && eventsTab.querySelector) {
      const visibleEventsLog = eventsTab.querySelector('#visible-events-log');
      const visibleInfoLog = eventsTab.querySelector('#visible-info-log');
      
      console.log('Estado de los logs visibles:', {
        visibleEventsLog: visibleEventsLog ? 'encontrado' : 'no encontrado',
        visibleInfoLog: visibleInfoLog ? 'encontrado' : 'no encontrado'
      });
      
      // Copiar manualmente cualquier contenido existente
      if (eventsLog && visibleEventsLog) {
        console.log('Copiando eventos existentes a la visualización...');
        Array.from(eventsLog.children).forEach(node => {
          const clone = node.cloneNode(true);
          visibleEventsLog.appendChild(clone);
        });
      }
      
      if (infoLog && visibleInfoLog) {
        console.log('Copiando info existente a la visualización...');
        Array.from(infoLog.children).forEach(node => {
          const clone = node.cloneNode(true);
          visibleInfoLog.appendChild(clone);
        });
      }
    }
  } catch (error) {
    console.error('Error al inicializar observers:', error);
  }
}

// Exportar funciones para uso externo si es necesario
window.tabLoader = {
  loadTabContent,
  initTabsListeners,
  triggerEventsObservers
}; 