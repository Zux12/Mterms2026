(() => {
  'use strict';

  const API = 'https://mterm2026-559f9bf571b5.herokuapp.com';
  const ENDPOINT = `${API}/api/analytics/session`;
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const HEARTBEAT_MS = 15000;

  function randomId(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function getVisitorId() {
    const key = 'mterms_analytics_visitor';
    let id = localStorage.getItem(key);
    if (!id) {
      id = randomId('v');
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getSession() {
    const key = 'mterms_analytics_session';
    const now = Date.now();
    let data = null;

    try {
      data = JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch {
      data = null;
    }

    if (!data || !data.id || !data.lastActivity || (now - data.lastActivity) > SESSION_TIMEOUT_MS) {
      data = { id: randomId('s'), startedAt: now, lastActivity: now };
    } else {
      data.lastActivity = now;
    }

    sessionStorage.setItem(key, JSON.stringify(data));
    return data;
  }

  const visitorId = getVisitorId();
  const session = getSession();
  const pageStartedAt = Date.now();
  let lastSentDuration = -1;

  function payload(action) {
    const now = Date.now();
    session.lastActivity = now;
    sessionStorage.setItem('mterms_analytics_session', JSON.stringify(session));

    return {
      action,
      visitorId,
      sessionId: session.id,
      page: location.pathname || '/',
      title: document.title || '',
      language: navigator.language || '',
      screenWidth: window.screen?.width || 0,
      screenHeight: window.screen?.height || 0,
      pageDurationSeconds: Math.max(0, Math.round((now - pageStartedAt) / 1000)),
      sessionDurationSeconds: Math.max(0, Math.round((now - session.startedAt) / 1000))
    };
  }

  function send(action, useBeacon = false) {
    const data = payload(action);
    if (data.pageDurationSeconds === lastSentDuration && action === 'heartbeat') return;
    lastSentDuration = data.pageDurationSeconds;

    const body = JSON.stringify(data);

    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: action === 'end'
    }).catch(() => {});
  }

  send('start');

  const heartbeat = setInterval(() => {
    if (document.visibilityState === 'visible') send('heartbeat');
  }, HEARTBEAT_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send('heartbeat', true);
    else send('heartbeat');
  });

  window.addEventListener('pagehide', () => {
    clearInterval(heartbeat);
    send('end', true);
  });
})();
