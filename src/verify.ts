import { verifyKey } from 'discord-interactions';

export function verifyDiscordRequest(
  request: Request,
  body: string,
  publicKey: string
): boolean {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) return false;

  return verifyKey(body, signature, timestamp, publicKey);
}
