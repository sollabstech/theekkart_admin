// Simple frontend-only admin auth using env vars
// Replace with Firebase Auth in production for real security

const ADMIN_USERS = (process.env.NEXT_PUBLIC_ADMIN_USERS || '').split(',').map(u => u.trim());
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';

export function adminLogin(username, password) {
  if (ADMIN_USERS.includes(username) && password === ADMIN_PASSWORD) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('theekart_admin', 'true');
      sessionStorage.setItem('theekart_admin_user', username);
    }
    return true;
  }
  return false;
}

export function adminLogout() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('theekart_admin');
    sessionStorage.removeItem('theekart_admin_user');
  }
}

export function isAdminLoggedIn() {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('theekart_admin') === 'true';
  }
  return false;
}

export function getAdminUser() {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('theekart_admin_user') || 'Admin';
  }
  return 'Admin';
}
