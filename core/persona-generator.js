'use strict';

/**
 * Persona Generator Module
 * Manages persona selection and domain-based persistence using chrome.storage.session
 */

// In-memory cache for personas
let personasCache = null;

/**
 * Load personas from data/personas.json and cache in memory
 * @returns {Promise<Array>} Array of persona objects
 */
export async function loadPersonas() {
  if (personasCache) {
    return personasCache;
  }

  try {
    const url = chrome.runtime.getURL('data/personas.json');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load personas: ${response.status}`);
    }
    
    const personas = await response.json();
    
    if (!Array.isArray(personas) || personas.length === 0) {
      throw new Error('Invalid personas data: expected non-empty array');
    }
    
    // Validate each persona has required fields
    for (const persona of personas) {
      if (!persona.id || !persona.userAgent || !persona.screen) {
        throw new Error(`Invalid persona: missing required fields in ${persona.id || 'unknown'}`);
      }
    }
    
    personasCache = personas;
    console.log(`Loaded ${personas.length} personas from data/personas.json`);
    return personas;
  } catch (error) {
    console.error('Error loading personas:', error);
    // Return minimal fallback persona to prevent complete failure
    const fallbackPersona = {
      id: 'fallback-windows-chrome',
      name: 'Fallback Windows Chrome',
      os: 'windows',
      browser: 'chrome',
      deviceType: 'desktop',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        colorDepth: 24,
        pixelDepth: 24
      },
      devicePixelRatio: 1,
      timezone: 'America/Buenos_Aires',
      language: 'es-AR',
      languages: ['es-AR', 'es'],
      webgl: {
        vendor: 'Google Inc.',
        renderer: 'ANGLE (Intel, Intel(R) HD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
      },
      hardwareConcurrency: 4,
      platform: 'Win32'
    };
    
    personasCache = [fallbackPersona];
    return personasCache;
  }
}

/**
 * Pick a persona from the dataset, optionally filtered by OS preference
 * @param {string} [osPreference] - Optional OS filter ('windows', 'macos', 'linux')
 * @returns {Promise<Object>} Deep clone of selected persona
 */
export async function pickPersona(osPreference) {
  const personas = await loadPersonas();
  
  // Filter by OS preference if provided
  let filteredPersonas = personas;
  if (osPreference) {
    const filtered = personas.filter(p => p.os === osPreference.toLowerCase());
    if (filtered.length > 0) {
      filteredPersonas = filtered;
    }
    // If no personas match the OS preference, fall back to all personas
  }
  
  // Pick a random persona from the filtered list
  const randomIndex = Math.floor(Math.random() * filteredPersonas.length);
  const selectedPersona = filteredPersonas[randomIndex];
  
  // Return a deep clone to prevent accidental mutations
  return JSON.parse(JSON.stringify(selectedPersona));
}

/**
 * Get or create a persona for a specific domain, persisted in session storage
 * @param {string} domain - The domain to get/create persona for
 * @param {string} [osPreference] - Optional OS preference for new personas
 * @returns {Promise<Object>} Persona object for the domain
 */
export async function getOrCreatePersonaForDomain(domain, osPreference) {
  if (!domain || typeof domain !== 'string') {
    throw new Error('Domain is required and must be a string');
  }
  
  // Normalize domain (remove protocol, www prefix, etc.)
  const normalizedDomain = domain.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0]; // Remove port if present
  
  try {
    // Check if we already have a persona for this domain
    const domainKey = `ps:persona:byDomain`;
    const personaKey = `ps:persona:`;
    
    // Get domain to persona mapping
    const domainMapping = await chrome.storage.session.get(domainKey);
    const existingPersonaId = domainMapping[domainKey]?.[normalizedDomain];
    
    if (existingPersonaId) {
      // Get the stored persona object
      const personaData = await chrome.storage.session.get(`${personaKey}${existingPersonaId}`);
      const storedPersona = personaData[`${personaKey}${existingPersonaId}`];
      
      if (storedPersona) {
        console.log(`Retrieved existing persona ${existingPersonaId} for domain ${normalizedDomain}`);
        return storedPersona;
      }
    }
    
    // No existing persona, create a new one
    const newPersona = await pickPersona(osPreference);
    
    // Store the persona object
    await chrome.storage.session.set({
      [`${personaKey}${newPersona.id}`]: newPersona
    });
    
    // Update domain mapping
    const currentMapping = domainMapping[domainKey] || {};
    currentMapping[normalizedDomain] = newPersona.id;
    
    await chrome.storage.session.set({
      [domainKey]: currentMapping
    });
    
    console.log(`Created new persona ${newPersona.id} for domain ${normalizedDomain}`);
    return newPersona;
    
  } catch (error) {
    console.error('Error in getOrCreatePersonaForDomain:', error);
    // Fallback to picking a random persona without persistence
    return await pickPersona(osPreference);
  }
}

/**
 * Clear all stored personas (useful for testing or user privacy)
 * @returns {Promise<void>}
 */
export async function clearAllPersonas() {
  try {
    // Get all storage keys to find persona-related ones
    const allData = await chrome.storage.session.get(null);
    const keysToRemove = Object.keys(allData).filter(key => 
      key.startsWith('ps:persona:')
    );
    
    if (keysToRemove.length > 0) {
      await chrome.storage.session.remove(keysToRemove);
      console.log(`Cleared ${keysToRemove.length} persona storage entries`);
    }
  } catch (error) {
    console.error('Error clearing personas:', error);
  }
}

/**
 * Get persona statistics (for debugging/monitoring)
 * @returns {Promise<Object>} Statistics about stored personas
 */
export async function getPersonaStats() {
  try {
    const allData = await chrome.storage.session.get(null);
    const domainMappingKey = 'ps:persona:byDomain';
    const domainMapping = allData[domainMappingKey] || {};
    
    const personaKeys = Object.keys(allData).filter(key => 
      key.startsWith('ps:persona:') && key !== domainMappingKey
    );
    
    return {
      totalDomains: Object.keys(domainMapping).length,
      totalStoredPersonas: personaKeys.length,
      domains: Object.keys(domainMapping),
      personaIds: personaKeys.map(key => key.replace('ps:persona:', ''))
    };
  } catch (error) {
    console.error('Error getting persona stats:', error);
    return { totalDomains: 0, totalStoredPersonas: 0, domains: [], personaIds: [] };
  }
}