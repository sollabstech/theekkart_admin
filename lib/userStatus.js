// Is a customer signed in? The Customer app writes `signedIn` (true/false) on
// the user's document at sign-in / sign-out. Users from before that existed
// have no such field, so their state is honestly "unknown" — never shown as
// "Signed in" by default.
export function signInState(user) {
  if (user?.signedIn === true) return 'in';
  if (user?.signedIn === false) return 'out';
  return 'unknown';
}

export const SIGN_IN_LABELS = { in: 'Signed in', out: 'Signed out', unknown: 'Not tracked yet' };

export function countSignInStates(users) {
  const c = { all: users.length, in: 0, out: 0, unknown: 0 };
  for (const u of users) c[signInState(u)]++;
  return c;
}
