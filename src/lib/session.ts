import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession, SessionPayload } from './auth';

export async function getServerSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
