// Restored from the identical SHA-256 helper in Login.jsx.
export async function sha256(string) {
    const utf8 = new Uint8Array(new TextEncoder().encode(string));
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
