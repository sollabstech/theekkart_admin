// Tiny shared store for what needs the admin's attention: live counts (sidebar
// badges, bell) and a feed of recent alerts (bell). Written by
// NotificationWatcher, read by Sidebar and the header bell. No React imports
// except the hook, so the logic is plain JS.
import { useSyncExternalStore } from 'react';

const MAX_ALERTS = 30;
const EMPTY_COUNTS = { ordersTotal: 0, newOrders: 0, needsRider: 0, needsVendor: 0, requests: 0, services: 0 };

let state = { counts: EMPTY_COUNTS, alerts: [], unread: 0 };
const listeners = new Set();
const emit = () => listeners.forEach(l => l());

export function getAlertState() { return state; }

export function subscribeAlerts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replace some of the live counts (only changed values trigger a re-render). */
export function setCounts(partial) {
  const next = { ...state.counts, ...partial };
  if (Object.keys(next).every(k => next[k] === state.counts[k])) return;
  state = { ...state, counts: next };
  emit();
}

/** Add one alert to the feed (newest first) and bump the unread number. */
export function pushAlert({ title, body = '', url = '' }) {
  const at = Date.now();
  state = {
    ...state,
    alerts: [{ id: `${at}-${state.alerts.length}`, at, title, body, url }, ...state.alerts].slice(0, MAX_ALERTS),
    unread: state.unread + 1,
  };
  emit();
}

export function markAlertsRead() {
  if (state.unread === 0) return;
  state = { ...state, unread: 0 };
  emit();
}

export function resetAlerts() {
  state = { counts: EMPTY_COUNTS, alerts: [], unread: 0 };
  emit();
}

export function useAlerts() {
  return useSyncExternalStore(subscribeAlerts, getAlertState, getAlertState);
}
