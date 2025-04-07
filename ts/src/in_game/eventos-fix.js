/**
 * eventos-fix.js
 * Script para capturar datos directamente desde in_game.html y enviarlos a la pestaña eventos
 * ¡Sin dependencia de la ventana "eventos de lol"!
 */

(function() {
  console.log("[EVENTOS-FIX] Iniciando sistema de captura directa IN_GAME → PESTAÑA");
  
  // Intervalo de sincronización en ms
  const SYNC_INTERVAL = 100; // Más rápido para mayor reactividad
  
  // Control de eventos procesados
  let processedEventTexts = new Set();
  let processedInfoTexts = new Set();
  
  // Contadores
  let totalEventsSynced = 0;
  let totalInfoSynced = 0;
  
  // Referencia directa a los datos de juego
  let cachedGameData = null;
  let cachedEvents = [];
  
  // Para buscar eventos de GEP
  let gepEvents = [];
  
  // Función principal de sincronización
  function syncData() {
    try {
      // 1. CAPTURAR DATOS DIRECTAMENTE DE IN_GAME
      captureDataFromInGame();
      
      // 2. ACTUALIZAR ESTADO DEBUG
      updateDebugStatus();
    } catch (error) {
      console.error("[EVENTOS-FIX] Error en sincronización:", error);
    }
  }
  
  // CAPTURAR DATOS DIRECTAMENTE DE IN_GAME (igual que lo hace "eventos de lol")
  function captureDataFromInGame() {
    try {
      // CAPTURAR EVENTOS DE GEP
      captureGepEvents();
      
      // CAPTURAR DATOS DE LIVE CLIENT
      captureLiveClientData();
    } catch (e) {
      console.warn("[EVENTOS-FIX] Error capturando datos directamente:", e);
    }
  }
  
  // Capturar eventos de GEP (Game Events Provider)
  function captureGepEvents() {
    try {
      // MÉTODO 1: Acceder directamente a los listeners de eventos GEP
      if (window.overwolf && window.overwolf.games && window.overwolf.games.events) {
        // Este es el método principal que usa Overwolf para eventos
        const eventData = {
          events: []
        };
        
        // Usar el API de Overwolf para obtener eventos actuales si está disponible
        if (typeof overwolf.games.events.getInfo === 'function') {
          overwolf.games.events.getInfo(function(info) {
            if (info && info.success && info.res) {
              processNewEvent({
                events: [{
                  name: "overwolf_info",
                  data: info.res
                }]
              });
            }
          });
        }
        
        processNewEvent(eventData);
      }
      
      // MÉTODO 2: Buscar en la estructura de gameEventsListener
      if (window.gameEventsListener) {
        // Este es el objeto que normalmente contiene los eventos en la aplicación de muestra
        if (window.gameEventsListener.events && Array.isArray(window.gameEventsListener.events)) {
          const events = window.gameEventsListener.events;
          
          // Buscar eventos nuevos
          for (const evt of events) {
            if (!gepEvents.some(e => JSON.stringify(e) === JSON.stringify(evt))) {
              gepEvents.push(evt);
              processNewEvent({
                events: [evt]
              });
            }
          }
        }
        
        // También buscar el evento más reciente
        if (window.gameEventsListener.lastEvent) {
          processNewEvent({
            events: [window.gameEventsListener.lastEvent]
          });
        }
      }
      
      // MÉTODO 3: Buscar variables globales conocidas con eventos
      const possibleEventSources = [
        window.eventLog,
        window.events,
        window.overwolfEvents,
        window.gameEvents,
        window.lastEvent,
        window.allEvents
      ];
      
      // Procesar eventos de todas las fuentes posibles
      for (const source of possibleEventSources) {
        if (source) {
          if (Array.isArray(source)) {
            // Si es un array de eventos
            for (const event of source) {
              if (typeof event === 'object') {
                processNewEvent({
                  events: [event]
                });
              }
            }
          } else if (typeof source === 'object') {
            // Si es un solo evento u otro objeto
            processNewEvent({
              events: [source]
            });
          }
        }
      }
      
      // MÉTODO 4: Buscar directamente en el DOM
      const eventsElements = document.querySelectorAll('[id*="event"], [class*="event"]');
      for (const element of eventsElements) {
        if (element.textContent) {
          try {
            const eventData = JSON.parse(element.textContent);
            processNewEvent(eventData);
          } catch (e) {
            // Ignorar errores de parseo
          }
        }
      }
      
      // MÉTODO 5: Escuchar eventos Overwolf
      if (window.overwolf && !window._eventListenersRegistered) {
        window._eventListenersRegistered = true;
        
        // Registrar listeners para eventos de Overwolf
        if (window.overwolf.games && window.overwolf.games.events) {
          console.log("[EVENTOS-FIX] Registrando listener para eventos de Overwolf");
          
          window.overwolf.games.events.onNewEvents.addListener(function(info) {
            if (info && info.events) {
              processNewEvent({
                events: info.events
              });
            }
          });
          
          window.overwolf.games.events.onInfoUpdates.addListener(function(info) {
            if (info && info.info) {
              processNewInfo({
                info: info.info,
                feature: "gep"
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[EVENTOS-FIX] Error capturando eventos GEP:", e);
    }
  }
  
  // Capturar datos del Live Client API
  function captureLiveClientData() {
    try {
      // MÉTODO 1: Acceso directo a gameDataManager
      if (window.gameDataManager) {
        // Capturar toda la información del juego
        const gameData = JSON.parse(JSON.stringify(window.gameDataManager));
        
        // Generar info para enviar
        const infoData = {
          feature: "live_client_data",
          info: {
            live_client_data: gameData
          }
        };
        
        // Procesar y enviar la info
        processNewInfo(infoData);
      }
      
      // MÉTODO 2: Buscar en variables globales que podrían tener datos
      const possibleDataSources = [
        window.liveClientData,
        window.gameData,
        window.lolData,
        window.summonerData
      ];
      
      for (const source of possibleDataSources) {
        if (source && typeof source === 'object') {
          processNewInfo({
            feature: "live_client_data",
            info: {
              additional_data: source
            }
          });
        }
      }
    } catch (e) {
      console.warn("[EVENTOS-FIX] Error capturando datos Live Client:", e);
    }
  }
  
  // Procesar nuevo evento
  function processNewEvent(eventData) {
    if (!eventData) return;
    
    // Convertir a texto para comparación
    const eventText = JSON.stringify(eventData);
    
    // Verificar si ya procesamos este evento
    if (!processedEventTexts.has(eventText)) {
      processedEventTexts.add(eventText);
      
      // Mostrar en consola para depuración
      console.log("[EVENTOS-FIX] Nuevo evento capturado:", eventData);
      
      // Intentar enviar el evento a la pestaña
      const success = sendEventToEventsTab(eventData);
      
      // Si falla, intentar inserción directa
      if (!success) {
        insertDirectlyIntoEventsLog(eventData);
      }
      
      totalEventsSynced++;
    }
  }
  
  // Procesar nueva información
  function processNewInfo(infoData) {
    if (!infoData) return;
    
    // Convertir a texto para comparación
    const infoText = JSON.stringify(infoData);
    
    // Verificar si ya procesamos esta info
    if (!processedInfoTexts.has(infoText)) {
      processedInfoTexts.add(infoText);
      
      // Intentar enviar la info a la pestaña
      const success = sendInfoToEventsTab(infoData);
      
      // Si falla, intentar inserción directa
      if (!success) {
        insertDirectlyIntoInfoLog(infoData);
      }
      
      totalInfoSynced++;
    }
  }
  
  // Función para enviar evento a la pestaña eventos
  function sendEventToEventsTab(eventData) {
    // Intentar todos los métodos posibles para enviar el evento
    
    // 1. Buscar elemento directo
    try {
      // Obtener todos los elementos que podrían ser la pestaña
      const allPossibleTabs = [
        document.getElementById('tab-events'),
        document.getElementById('events-tab'),
        document.querySelector('.tab-eventos'),
        document.querySelector('[data-tab="eventos"]'),
        document.querySelector('iframe[src*="tab-events.html"]'),
      ];
      
      for (const tab of allPossibleTabs) {
        if (tab) {
          // Intentar todas las posibles formas de llamar a la función
          if (typeof tab.addEventToVisibleLog === 'function') {
            tab.addEventToVisibleLog(eventData);
            return true;
          }
          
          if (tab.contentWindow && typeof tab.contentWindow.addEventToVisibleLog === 'function') {
            tab.contentWindow.addEventToVisibleLog(eventData);
            return true;
          }
          
          // Intentar con querySelector en el iframe
          if (tab.contentDocument) {
            const visibleEventsLog = tab.contentDocument.getElementById('visible-events-log');
            if (visibleEventsLog) {
              appendToLog(visibleEventsLog, eventData);
              return true;
            }
          }
        }
      }
      
      // 2. Buscar en todos los iframes
      const allIframes = document.querySelectorAll('iframe');
      for (const iframe of allIframes) {
        try {
          if (iframe.contentWindow && typeof iframe.contentWindow.addEventToVisibleLog === 'function') {
            iframe.contentWindow.addEventToVisibleLog(eventData);
            return true;
          }
          
          if (iframe.contentDocument) {
            const visibleEventsLog = iframe.contentDocument.getElementById('visible-events-log');
            if (visibleEventsLog) {
              appendToLog(visibleEventsLog, eventData);
              return true;
            }
          }
        } catch (iframeError) {
          // Ignorar errores de acceso entre dominios
        }
      }
      
      // 3. Intentar con window global
      if (typeof window.addEventToVisibleLog === 'function') {
        window.addEventToVisibleLog(eventData);
        return true;
      }
      
      // 4. Emitir evento personalizado
      const eventDetail = { detail: { eventData: eventData } };
      document.dispatchEvent(new CustomEvent('sync-event-to-tab', eventDetail));
      
      // 5. Intentar en el iframe usando postMessage
      const eventIframe = document.querySelector('iframe[src*="tab-events.html"]');
      if (eventIframe && eventIframe.contentWindow) {
        eventIframe.contentWindow.postMessage({ eventData: eventData }, '*');
        
        // También emitir evento en el iframe
        try {
          if (eventIframe.contentDocument) {
            eventIframe.contentDocument.dispatchEvent(new CustomEvent('sync-event-to-tab', eventDetail));
          }
        } catch (e) {
          // Ignorar errores de acceso entre dominios
        }
      }
      
    } catch (error) {
      console.warn("[EVENTOS-FIX] Error enviando evento:", error);
    }
    
    return false;
  }
  
  // Función para enviar info a la pestaña eventos
  function sendInfoToEventsTab(infoData) {
    // Intentar todos los métodos posibles para enviar la info
    
    // 1. Buscar elemento directo
    try {
      // Obtener todos los elementos que podrían ser la pestaña
      const allPossibleTabs = [
        document.getElementById('tab-events'),
        document.getElementById('events-tab'),
        document.querySelector('.tab-eventos'),
        document.querySelector('[data-tab="eventos"]'),
        document.querySelector('iframe[src*="tab-events.html"]'),
      ];
      
      for (const tab of allPossibleTabs) {
        if (tab) {
          // Intentar todas las posibles formas de llamar a la función
          if (typeof tab.addInfoToVisibleLog === 'function') {
            tab.addInfoToVisibleLog(infoData);
            return true;
          }
          
          if (tab.contentWindow && typeof tab.contentWindow.addInfoToVisibleLog === 'function') {
            tab.contentWindow.addInfoToVisibleLog(infoData);
            return true;
          }
          
          // Intentar con querySelector en el iframe
          if (tab.contentDocument) {
            const visibleInfoLog = tab.contentDocument.getElementById('visible-info-log');
            if (visibleInfoLog) {
              appendToLog(visibleInfoLog, infoData);
              return true;
            }
          }
        }
      }
      
      // 2. Buscar en todos los iframes
      const allIframes = document.querySelectorAll('iframe');
      for (const iframe of allIframes) {
        try {
          if (iframe.contentWindow && typeof iframe.contentWindow.addInfoToVisibleLog === 'function') {
            iframe.contentWindow.addInfoToVisibleLog(infoData);
            return true;
          }
          
          if (iframe.contentDocument) {
            const visibleInfoLog = iframe.contentDocument.getElementById('visible-info-log');
            if (visibleInfoLog) {
              appendToLog(visibleInfoLog, infoData);
              return true;
            }
          }
        } catch (iframeError) {
          // Ignorar errores de acceso entre dominios
        }
      }
      
      // 3. Intentar con window global
      if (typeof window.addInfoToVisibleLog === 'function') {
        window.addInfoToVisibleLog(infoData);
        return true;
      }
      
      // 4. Emitir evento personalizado
      const eventDetail = { detail: { infoData: infoData } };
      document.dispatchEvent(new CustomEvent('sync-info-to-tab', eventDetail));
      
      // 5. Intentar en el iframe usando postMessage
      const eventIframe = document.querySelector('iframe[src*="tab-events.html"]');
      if (eventIframe && eventIframe.contentWindow) {
        eventIframe.contentWindow.postMessage({ infoData: infoData }, '*');
        
        // También emitir evento en el iframe
        try {
          if (eventIframe.contentDocument) {
            eventIframe.contentDocument.dispatchEvent(new CustomEvent('sync-info-to-tab', eventDetail));
          }
        } catch (e) {
          // Ignorar errores de acceso entre dominios
        }
      }
      
    } catch (error) {
      console.warn("[EVENTOS-FIX] Error enviando info:", error);
    }
    
    return false;
  }
  
  // Función para añadir a un log directamente
  function appendToLog(logElement, data) {
    try {
      const line = document.createElement('pre');
      line.textContent = JSON.stringify(data, null, 2);
      
      // Verificar si es un evento importante
      const isHighlight = data.events && data.events.some(evt => 
        ['kill', 'death', 'assist', 'level', 'matchStart', 'matchEnd'].includes(evt.name)
      );
      
      if (isHighlight) {
        line.className = 'highlight';
      }
      
      logElement.appendChild(line);
      
      // Limitar tamaño
      while (logElement.childNodes.length > 100) {
        logElement.removeChild(logElement.firstChild);
      }
      
      // Autoscroll
      logElement.scrollTop = logElement.scrollHeight;
      
      return true;
    } catch (error) {
      console.warn("[EVENTOS-FIX] Error añadiendo a log:", error);
      return false;
    }
  }
  
  // Método para inserción directa en el log de eventos
  function insertDirectlyIntoEventsLog(data) {
    try {
      // Intentar localizar el contenedor de logs de eventos
      const container = findEventsLogContainer();
      
      if (container) {
        console.log("[EVENTOS-FIX] Encontrado contenedor de eventos:", container.id || 'sin id');
        
        // Crear elemento
        const line = document.createElement('pre');
        line.style.margin = '5px 0';
        line.style.whiteSpace = 'pre-wrap'; 
        line.style.wordBreak = 'break-all';
        
        // Formatear el JSON con indentación para que sea legible
        line.textContent = typeof data === 'string' 
          ? data 
          : JSON.stringify(data, null, 2);
        
        // Verificar si es un evento destacado
        const isHighlight = data.events && data.events.some(evt => 
          ['kill', 'death', 'assist', 'level', 'matchStart', 'matchEnd'].includes(evt.name)
        );
        
        if (isHighlight) {
          line.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
          line.style.borderLeft = '3px solid #FFD700';
        }
        
        // Insertar en contenedor
        container.appendChild(line);
        
        // Limitar tamaño
        while (container.childNodes.length > 100) {
          container.removeChild(container.firstChild);
        }
        
        // Auto-scroll
        container.scrollTop = container.scrollHeight;
        
        // Para depuración, añadir marcador visible
        const debugMark = document.createElement('span');
        debugMark.style.color = '#00ff00';
        debugMark.style.fontWeight = 'bold';
        debugMark.textContent = ' [INSERTADO DIRECTAMENTE]';
        line.appendChild(debugMark);
        
        return true;
      }
      
      console.warn("[EVENTOS-FIX] No se encontró contenedor para eventos");
      return false;
    } catch (error) {
      console.warn("[EVENTOS-FIX] Error en inserción directa de eventos:", error);
      return false;
    }
  }
  
  // Método para inserción directa en el log de info
  function insertDirectlyIntoInfoLog(data) {
    try {
      // Intentar localizar el contenedor de logs de info
      const container = findInfoLogContainer();
      
      if (container) {
        console.log("[EVENTOS-FIX] Encontrado contenedor de info:", container.id || 'sin id');
        
        // Crear elemento
        const line = document.createElement('pre');
        line.style.margin = '5px 0';
        line.style.whiteSpace = 'pre-wrap'; 
        line.style.wordBreak = 'break-all';
        
        // Formatear el JSON con indentación para que sea legible
        line.textContent = typeof data === 'string' 
          ? data 
          : JSON.stringify(data, null, 2);
        
        // Insertar en contenedor
        container.appendChild(line);
        
        // Limitar tamaño
        while (container.childNodes.length > 100) {
          container.removeChild(container.firstChild);
        }
        
        // Auto-scroll
        container.scrollTop = container.scrollHeight;
        
        // Para depuración, añadir marcador visible
        const debugMark = document.createElement('span');
        debugMark.style.color = '#00ff00';
        debugMark.style.fontWeight = 'bold';
        debugMark.textContent = ' [INSERTADO DIRECTAMENTE]';
        line.appendChild(debugMark);
        
        return true;
      }
      
      console.warn("[EVENTOS-FIX] No se encontró contenedor para info");
      return false;
    } catch (error) {
      console.warn("[EVENTOS-FIX] Error en inserción directa de info:", error);
      return false;
    }
  }
  
  // Encontrar el contenedor de logs de eventos
  function findEventsLogContainer() {
    // Lista de contenedores posibles (de más específico a más general)
    const possibleContainers = [
      // Por ID específico
      document.getElementById('visible-events-log'),
      
      // Por selector específico en documento actual
      document.querySelector('.events__log-content'),
      document.querySelector('[id*="events-log"]'),
      
      // En la pestaña eventos
      findElementInAllFrames('visible-events-log'),
      findElementInAllFrames('.events__log-content'),
      
      // Búsqueda genérica basada en contenido
      findElementByInnerHTML('Eventos')
    ];
    
    // Usar el primer contenedor que encontremos
    for (const container of possibleContainers) {
      if (container) {
        return container;
      }
    }
    
    // Intento desesperado: crear el contenedor si no existe
    try {
      const tabContainer = document.querySelector('.events__logs-container') || 
                           document.querySelector('#eventos-tab') ||
                           document.querySelector('.tab-content');
      
      if (tabContainer) {
        console.log("[EVENTOS-FIX] Creando contenedor de eventos que no existe");
        const newContainer = document.createElement('div');
        newContainer.id = 'visible-events-log';
        newContainer.className = 'events__log-content';
        newContainer.style.height = '400px';
        newContainer.style.overflow = 'auto';
        newContainer.style.backgroundColor = 'rgba(0,0,0,0.3)';
        newContainer.style.padding = '10px';
        newContainer.style.borderRadius = '5px';
        newContainer.style.fontFamily = 'monospace';
        newContainer.style.fontSize = '12px';
        
        tabContainer.appendChild(newContainer);
        return newContainer;
      }
    } catch (e) {
      console.warn("[EVENTOS-FIX] Error al crear contenedor de eventos:", e);
    }
    
    console.warn("[EVENTOS-FIX] No se encontró contenedor para eventos");
    return null;
  }
  
  // Encontrar el contenedor de logs de info
  function findInfoLogContainer() {
    // Lista de contenedores posibles (de más específico a más general)
    const possibleContainers = [
      // Por ID específico
      document.getElementById('visible-info-log'),
      
      // Por selector específico en documento actual
      document.querySelectorAll('.events__log-content')[1],
      document.querySelector('[id*="info-log"]'),
      
      // En la pestaña eventos
      findElementInAllFrames('visible-info-log'),
      findElementInAllFrames('.events__log-content:nth-child(2)'),
      
      // Búsqueda genérica basada en contenido
      findElementByInnerHTML('Actualizaciones')
    ];
    
    // Usar el primer contenedor que encontremos
    for (const container of possibleContainers) {
      if (container) {
        return container;
      }
    }
    
    // Intento desesperado: crear el contenedor si no existe
    try {
      const tabContainer = document.querySelector('.events__logs-container') || 
                           document.querySelector('#eventos-tab') ||
                           document.querySelector('.tab-content');
      
      if (tabContainer) {
        console.log("[EVENTOS-FIX] Creando contenedor de info que no existe");
        const newContainer = document.createElement('div');
        newContainer.id = 'visible-info-log';
        newContainer.className = 'events__log-content';
        newContainer.style.height = '400px';
        newContainer.style.overflow = 'auto';
        newContainer.style.backgroundColor = 'rgba(0,0,0,0.3)';
        newContainer.style.padding = '10px';
        newContainer.style.borderRadius = '5px';
        newContainer.style.fontFamily = 'monospace';
        newContainer.style.fontSize = '12px';
        
        tabContainer.appendChild(newContainer);
        return newContainer;
      }
    } catch (e) {
      console.warn("[EVENTOS-FIX] Error al crear contenedor de info:", e);
    }
    
    console.warn("[EVENTOS-FIX] No se encontró contenedor para info");
    return null;
  }
  
  // Función auxiliar para buscar elementos por contenido innerHTML
  function findElementByInnerHTML(text) {
    try {
      // Buscar elementos que contengan el texto en su innerHTML
      const elements = document.querySelectorAll('*');
      for (let i = 0; i < elements.length; i++) {
        if (elements[i].innerHTML && elements[i].innerHTML.indexOf(text) > -1) {
          // Buscar dentro del elemento encontrado por un contenedor adecuado
          const container = elements[i].querySelector('div') || elements[i].parentNode;
          if (container && container.tagName === 'DIV') {
            return container;
          }
        }
      }
      
      // Buscar también en iframes
      const frames = document.querySelectorAll('iframe');
      for (let i = 0; i < frames.length; i++) {
        try {
          const frameDoc = frames[i].contentDocument || frames[i].contentWindow.document;
          const frameElements = frameDoc.querySelectorAll('*');
          
          for (let j = 0; j < frameElements.length; j++) {
            if (frameElements[j].innerHTML && frameElements[j].innerHTML.indexOf(text) > -1) {
              const container = frameElements[j].querySelector('div') || frameElements[j].parentNode;
              if (container && container.tagName === 'DIV') {
                return container;
              }
            }
          }
        } catch (e) {
          // Ignorar errores de seguridad
        }
      }
    } catch (e) {
      console.warn("[EVENTOS-FIX] Error buscando por innerHTML:", e);
    }
    
    return null;
  }
  
  // Función auxiliar para buscar elementos en todos los iframes
  function findElementInAllFrames(selector) {
    // Buscar en el documento actual
    let element = document.querySelector(selector);
    if (element) return element;
    
    // Buscar en todos los iframes
    const frames = document.querySelectorAll('iframe');
    for (let i = 0; i < frames.length; i++) {
      try {
        const frameDoc = frames[i].contentDocument || frames[i].contentWindow.document;
        element = frameDoc.querySelector(selector);
        if (element) return element;
      } catch (e) {
        // Ignorar errores de seguridad por acceso entre dominios
      }
    }
    
    // Búsqueda avanzada por ID parcial
    if (document.body) {
      const allElements = document.body.querySelectorAll('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (el.id) {
          // Buscar por ID parcial
          if ((selector.includes('event') && el.id.includes('event')) ||
              (selector.includes('info') && el.id.includes('info'))) {
            return el;
          }
        }
      }
    }
    
    return null;
  }
  
  // Función para actualizar estado de depuración
  function updateDebugStatus() {
    try {
      // Intentar actualizar el indicador de heartbeat si existe
      const allPossibleHeartbeats = [
        document.getElementById('heartbeat-indicator'),
        document.querySelector('[id*="heartbeat"]'),
        document.querySelector('[id*="indicator"]')
      ];
      
      for (const heartbeat of allPossibleHeartbeats) {
        if (heartbeat) {
          heartbeat.style.backgroundColor = '#00ff00';
          setTimeout(() => {
            heartbeat.style.backgroundColor = 'gray';
          }, 500);
        }
      }
      
      // Intentar actualizar el contador de eventos
      const allPossibleCounters = [
        document.getElementById('last-update-time'),
        document.querySelector('[id*="update"]'),
        document.querySelector('[id*="count"]')
      ];
      
      for (const counter of allPossibleCounters) {
        if (counter) {
          const now = new Date();
          const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                          now.getMinutes().toString().padStart(2, '0') + ':' + 
                          now.getSeconds().toString().padStart(2, '0');
          counter.textContent = `${timeStr} - Eventos: ${totalEventsSynced}, Info: ${totalInfoSynced}`;
        }
      }
      
      // También buscar en iframes
      const allIframes = document.querySelectorAll('iframe');
      for (const iframe of allIframes) {
        try {
          const iframeHeartbeat = iframe.contentDocument && iframe.contentDocument.getElementById('heartbeat-indicator');
          const iframeCounter = iframe.contentDocument && iframe.contentDocument.getElementById('last-update-time');
          
          if (iframeHeartbeat) {
            iframeHeartbeat.style.backgroundColor = '#00ff00';
            setTimeout(() => {
              iframeHeartbeat.style.backgroundColor = 'gray';
            }, 500);
          }
          
          if (iframeCounter) {
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                            now.getMinutes().toString().padStart(2, '0') + ':' + 
                            now.getSeconds().toString().padStart(2, '0');
            iframeCounter.textContent = `${timeStr} - Eventos: ${totalEventsSynced}, Info: ${totalInfoSynced}`;
          }
        } catch (iframeError) {
          // Ignorar errores de acceso entre dominios
        }
      }
    } catch (error) {
      console.warn("[EVENTOS-FIX] Error actualizando debug:", error);
    }
  }
  
  // Inicializar
  function init() {
    console.log("[EVENTOS-FIX] Iniciando sistema de captura directa IN_GAME → PESTAÑA");
    
    // Registrar listeners para eventos
    document.addEventListener('new-event', function(e) {
      if (e.detail && e.detail.eventData) {
        processNewEvent(e.detail.eventData);
      }
    });
    
    document.addEventListener('new-info', function(e) {
      if (e.detail && e.detail.infoData) {
        processNewInfo(e.detail.infoData);
      }
    });
    
    // IMPORTANTE: Interceptar eventos directamente desde Overwolf
    if (window.overwolf && window.overwolf.games && window.overwolf.games.events) {
      // Sacar una copia de las funciones originales
      const originalOnNewEvents = window.overwolf.games.events.onNewEvents;
      const originalOnInfoUpdates = window.overwolf.games.events.onInfoUpdates;
      
      // Reemplazar con nuestra versión que captura los eventos
      window.overwolf.games.events.onNewEvents = {
        addListener: function(callback) {
          // Llamar a la original
          if (originalOnNewEvents && originalOnNewEvents.addListener) {
            originalOnNewEvents.addListener(function(info) {
              // Capturar el evento
              if (info && info.events) {
                processNewEvent({
                  events: info.events
                });
              }
              // Y pasar al callback original
              callback(info);
            });
          } else {
            // Si la original no existe, al menos capturamos
            callback = function(info) {
              if (info && info.events) {
                processNewEvent({
                  events: info.events
                });
              }
            };
          }
        }
      };
      
      window.overwolf.games.events.onInfoUpdates = {
        addListener: function(callback) {
          // Llamar a la original
          if (originalOnInfoUpdates && originalOnInfoUpdates.addListener) {
            originalOnInfoUpdates.addListener(function(info) {
              // Capturar la info
              if (info && info.info) {
                processNewInfo({
                  info: info.info,
                  feature: "gep"
                });
              }
              // Y pasar al callback original
              callback(info);
            });
          } else {
            // Si la original no existe, al menos capturamos
            callback = function(info) {
              if (info && info.info) {
                processNewInfo({
                  info: info.info,
                  feature: "gep"
                });
              }
            };
          }
        }
      };
    }
    
    // Iniciar sincronización
    console.log("[EVENTOS-FIX] Iniciando sincronización cada", SYNC_INTERVAL, "ms");
    setInterval(syncData, SYNC_INTERVAL);
    
    // Sincronizar cuando el documento se vuelve visible
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        console.log("[EVENTOS-FIX] Documento visible, forzando sincronización");
        syncData();
      }
    });
    
    // NUEVO: Forzar carga de eventos si no hay eventos después de un tiempo
    setTimeout(() => {
      if (totalEventsSynced === 0) {
        console.log("[EVENTOS-FIX] Sin eventos después de 3 segundos, forzando creación de eventos de prueba");
        
        // Crear eventos ficticios para depuración
        for (let i = 0; i < 3; i++) {
          const fakeEvent = {
            events: [
              {
                name: "match_clock", 
                data: (Math.floor(Date.now() / 1000) + i).toString()
              }
            ]
          };
          processNewEvent(fakeEvent);
        }
      }
    }, 3000);
    
    // Sincronización inicial
    setTimeout(syncData, 1000);
    
    // Otra sincronización después de 5 segundos
    setTimeout(syncData, 5000);
  }
  
  // Iniciar todo
  init();
})(); 