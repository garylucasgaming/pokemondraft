// Generate a device fingerprint for automatic login
export function generateDeviceFingerprint() {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    window.screen.colorDepth,
    window.screen.width + 'x' + window.screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage
  ];

  const fingerprint = components.join('|');
  
  // Create a simple hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

export function getDeviceInfo() {
  return {
    fingerprint: generateDeviceFingerprint(),
    userAgent: navigator.userAgent
  };
}
