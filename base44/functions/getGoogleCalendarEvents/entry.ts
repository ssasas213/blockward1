import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONNECTOR_ID = '6a1ad944111a79e68db13407';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let connection;
    try {
      connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
    } catch (err) {
      return Response.json({ error: 'not_connected', message: 'Google Calendar not connected' }, { status: 403 });
    }

    const { accessToken } = connection;

    const now = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(now)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.status === 401) {
      return Response.json({ error: 'token_expired', message: 'Google Calendar token expired. Please reconnect.' }, { status: 401 });
    }

    if (res.status === 403) {
      return Response.json({ error: 'permission_denied', message: 'Permission denied. Please reconnect and grant calendar access.' }, { status: 403 });
    }

    if (!res.ok) {
      const errData = await res.json();
      return Response.json({ error: 'api_error', message: errData?.error?.message || 'Google Calendar API error' }, { status: 500 });
    }

    const data = await res.json();

    const events = (data.items || []).map(event => ({
      id: event.id,
      title: event.summary || '(No title)',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || null,
      description: event.description || null,
      isAllDay: !!event.start?.date && !event.start?.dateTime,
      htmlLink: event.htmlLink,
    }));

    return Response.json({ events, connectedEmail: data.summary });
  } catch (error) {
    return Response.json({ error: 'server_error', message: error.message }, { status: 500 });
  }
});