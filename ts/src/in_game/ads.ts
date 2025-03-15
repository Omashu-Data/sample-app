/**
 * Módulo para gestionar los anuncios de Overwolf
 */

// Definir la interfaz para la API de anuncios de Overwolf
declare namespace overwolf {
  namespace extensions {
    namespace ads {
      function createBanner(
        elementId: string, 
        options: { size: { width: number, height: number }, position: string },
        callback: (result: { success: boolean, error?: string }) => void
      ): void;
    }
  }
}

// Configuración de anuncios
const ADS_CONFIG = {
  // Banner superior 728x90
  standardBanner: {
    size: {
      width: 728,
      height: 90
    },
    containerId: 'overwolf-ads-container',
    placeholderId: 'standard-banner-placeholder'
  }
};

/**
 * Inicializa los anuncios de Overwolf
 */
export function initializeAds(): void {
  console.log('Inicializando anuncios de Overwolf...');
  
  // Mostrar placeholders por defecto mientras se verifica la API
  showPlaceholders();
  
  // Comprobar si la API de anuncios de Overwolf está disponible
  if (overwolf && overwolf.extensions && overwolf.extensions.ads) {
    console.log('API de anuncios de Overwolf detectada, intentando inicializar anuncios reales...');
    // Inicializar el banner estándar
    initializeStandardBanner();
  } else {
    console.error('La API de anuncios de Overwolf no está disponible');
    // Los placeholders ya se están mostrando
  }
}

/**
 * Inicializa el banner estándar
 */
function initializeStandardBanner(): void {
  const { containerId, size, placeholderId } = ADS_CONFIG.standardBanner;
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`No se encontró el contenedor de anuncios con ID: ${containerId}`);
    showPlaceholders();
    return;
  }
  
  // Crear el anuncio
  overwolf.extensions.ads.createBanner(containerId, {
    size: size,
    position: 'top-center'
  }, (result) => {
    if (result.success) {
      console.log('Banner de anuncios creado correctamente');
      hidePlaceholder(placeholderId);
    } else {
      console.error('Error al crear el banner de anuncios:', result.error);
      showPlaceholder(placeholderId);
    }
  });
}

/**
 * Muestra los placeholders de anuncios
 */
function showPlaceholders(): void {
  showPlaceholder(ADS_CONFIG.standardBanner.placeholderId);
}

/**
 * Muestra un placeholder específico
 */
function showPlaceholder(id: string): void {
  const placeholder = document.getElementById(id);
  if (placeholder) {
    // No mostrar el placeholder, mantenerlo oculto
    placeholder.style.display = 'none';
    placeholder.innerHTML = '';
  }
}

/**
 * Oculta un placeholder específico
 */
function hidePlaceholder(id: string): void {
  const placeholder = document.getElementById(id);
  if (placeholder) {
    placeholder.style.display = 'none';
  }
}

// Inicializar anuncios cuando se cargue la ventana
window.addEventListener('load', () => {
  initializeAds();
}); 