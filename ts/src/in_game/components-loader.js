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
  
  fetch(htmlFile)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(html => {
      tabPane.innerHTML = html;
      console.log(`Contenido cargado exitosamente para ${tabId}`);
      
      // Disparar evento para notificar que el contenido se ha cargado
      const event = new CustomEvent('tabContentLoaded', { detail: { tabId } });
      document.dispatchEvent(event);
    })
    .catch(error => {
      console.error(`Error al cargar el contenido para ${tabId}:`, error);
      tabPane.innerHTML = `<div class="error-message">Error al cargar el contenido: ${error.message}</div>`;
    });
}

// Exportar funciones para uso externo si es necesario
window.tabLoader = {
  loadTabContent,
  initTabsListeners
}; 