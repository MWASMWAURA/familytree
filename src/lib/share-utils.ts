export interface ShareableFamily {
  familyId: string;
  familyName: string;
  data: any;
  createdAt: string;
}

export function generateShareableLink(familyId: string, familyName: string, familyData: any): string {
  // Create a unique share ID
  const shareId = `${familyId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store shareable data in localStorage with the share ID
  const shareableData: ShareableFamily = {
    familyId,
    familyName,
    data: familyData,
    createdAt: new Date().toISOString()
  };
  
  localStorage.setItem(`shared-family-${shareId}`, JSON.stringify(shareableData));
  
  // Generate the shareable URL
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?share=${shareId}`;
}

export function getSharedFamilyData(shareId: string): ShareableFamily | null {
  try {
    const stored = localStorage.getItem(`shared-family-${shareId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load shared family data:', error);
  }
  return null;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    return new Promise((resolve, reject) => {
      if (document.execCommand('copy')) {
        textArea.remove();
        resolve();
      } else {
        textArea.remove();
        reject(new Error('Copy command failed'));
      }
    });
  }
}