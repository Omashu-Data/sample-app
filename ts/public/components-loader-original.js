/**
 * Cargador de componentes modulares
 * Este script carga los diferentes componentes de la interfaz desde archivos separados
 */
document.addEventListener('DOMContentLoaded', function() {
  // Cargar los diferentes componentes
  loadBannerHorizontal();
  loadTabsMenu();
  loadBannerVertical();
  
  // Esperar a que las tabs estÃ©n cargadas antes de inicializar los listeners
  // Utilizamos MutationObserver para detectar cuando las tabs se hayan cargado
  observeForTabs();
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
 * Carga el menÃº de tabs en su contenedor
 */
function loadTabsMenu() {
  const container = document.getElementById('tabs-menu-container');
  if (container) {
    loadComponent(container, 'tabs-menu.html', 'menÃº de tabs', initTabsListeners);
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
 * FunciÃ³n genÃ©rica para cargar un componente
 * @param {HTMLElement} container - El contenedor donde se cargarÃ¡ el componente
 * @param {string} file - El archivo HTML a cargar
 * @param {string} name - Nombre descriptivo del componente (para logs)
 * @param {Function} callback - FunciÃ³n a ejecutar despuÃ©s de cargar (opcional)
 */
function loadComponent(container, file, name, callback) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', file, true);
  
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 400) {
      // Ã‰xito - insertar el contenido
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
 * Observa el DOM para detectar cuando se cargan las tabs
 */
function observeForTabs() {
  const observer = new MutationObserver((mutations, obs) => {
    const tabsNavigation = document.querySelector('.tabs__navigation');
    if (tabsNavigation) {
      console.log('Tabs detectadas en el DOM, inicializando listeners...');
      initTabsListeners();
      obs.disconnect(); // Desconectar el observer una vez que encontramos las tabs
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Inicializa los listeners para las pestaÃ±as
 */
function initTabsListeners() {
  console.log('Inicializando listeners de tabs...');
  
  // Esperar un breve momento para asegurar que el DOM estÃ¡ completamente cargado
  setTimeout(() => {
    const tabButtons = document.querySelectorAll('.tabs__button');
    const tabPanes = document.querySelectorAll('.tabs__pane');
    
    console.log(`Encontrados ${tabButtons.length} botones de tabs y ${tabPanes.length} paneles`);
    
    if (!tabButtons.length) {
      console.warn('No se encontraron botones de tabs para inicializar');
      return;
    }
    
    // Eliminar listeners previos para evitar duplicados
    tabButtons.forEach(button => {
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
    });
    
    // Volver a seleccionar los botones despuÃ©s de clonarlos
    const refreshedButtons = document.querySelectorAll('.tabs__button');
    
    refreshedButtons.forEach(button => {
      button.addEventListener('click', function() {
        console.log(`Click en tab: ${this.getAttribute('data-tab-target')}`);
        
        // Remover clase activa de todos los botones
        refreshedButtons.forEach(btn => btn.classList.remove('tabs__button--active'));
        
        // AÃ±adir clase activa al botÃ³n actual
        this.classList.add('tabs__button--active');
        
        // Obtener el tab a mostrar
        const tabName = this.getAttribute('data-tab-target');
        
        // Ocultar todos los paneles
        tabPanes.forEach(pane => pane.classList.remove('tabs__pane--active'));
        
        // Mostrar el panel correspondiente
        const activePane = document.getElementById(tabName);
        if (activePane) {
          console.log(`Activando panel: ${tabName}`);
          activePane.classList.add('tabs__pane--active');
          
          // Si el contenido aÃºn no se ha cargado, cargarlo
          if (!activePane.dataset.loaded) {
            loadTabContent(tabName);
            activePane.dataset.loaded = 'true';
          }
        } else {
          console.error(`No se encontrÃ³ el panel con ID: ${tabName}`);
        }
      });
    });
    
    console.log('Listeners de tabs inicializados correctamente');
    
    // Si no hay ninguna pestaÃ±a activa, activar la de rendimiento por defecto
    const hasActiveButton = Array.from(refreshedButtons).some(btn => btn.classList.contains('tabs__button--active'));
    if (!hasActiveButton && refreshedButtons.length > 0) {
      // Buscar el botÃ³n de rendimiento
      const performanceButton = Array.from(refreshedButtons).find(btn => 
        btn.getAttribute('data-tab-target') === 'performance-tab');
      
      if (performanceButton) {
        console.log('Activando pestaÃ±a de rendimiento por defecto');
        performanceButton.click();
      } else {
        console.log('Activando primera pestaÃ±a por defecto');
        refreshedButtons[0].click();
      }
    }
  }, 200); // PequeÃ±o retraso para asegurar que todo estÃ¡ listo
}

/**
 * Carga el contenido de una pestaÃ±a especÃ­fica
 * @param {string} tabId - El ID del contenedor de la pestaÃ±a
 */
function loadTabContent(tabId) {
  const tabName = tabId.replace('-tab', '');
  const htmlFile = `tab-${tabName}.html`;
  
  console.log(`Cargando contenido para ${tabId} desde ${htmlFile}`);
  
  const tabPane = document.getElementById(tabId);
  if (!tabPane) {
    console.error(`No se encontrÃ³ el elemento con ID ${tabId}`);
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
      console.log(`Contenido para ${tabId} cargado correctamente`);
      
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

// Configurar la navegaciÃ³n entre pestaÃ±as
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tabs__button');
  const tabPanes = document.querySelectorAll('.tabs__pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Desactivar todas las pestaÃ±as
      tabButtons.forEach(btn => btn.classList.remove('tabs__button--active'));
      tabPanes.forEach(pane => pane.classList.remove('tabs__pane--active'));
      
      // Activar la pestaÃ±a seleccionada
      button.classList.add('tabs__button--active');
      const targetId = button.getAttribute('data-tab-target');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('tabs__pane--active');
      }
    });
  });
}

// Ejecutar cuando el DOM estÃ© completamente cargado
document.addEventListener('DOMContentLoaded', () => {
  initComponentsLoader();
});

// Exportar funciones para uso externo si es necesario
window.tabLoader = {
  loadTabContent,
  setupTabNavigation
}; 

