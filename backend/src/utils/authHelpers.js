export function requireAuth(user) {
  if (!user) throw new Error('UNAUTHENTICATED');
}
