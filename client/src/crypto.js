const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromB64(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}

async function keyFor(me, them) {
  const pair = [me.userId, them.userId].sort().join(':');
  const material = await crypto.subtle.importKey('raw', enc.encode(`scc:${pair}`), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('secret-calculator-chat'), iterations: 120000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(text, me, them) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(me, them);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { content: b64(cipher), iv: b64(iv) };
}

export async function decryptText(message, me, them) {
  if (!message.iv) return message.content;
  try {
    const key = await keyFor(me, them);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(message.iv) }, key, fromB64(message.content));
    return dec.decode(plain);
  } catch {
    return '[Encrypted message]';
  }
}
