import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ExternalLink, Loader2, Unplug, Plug, AlertCircle, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const CONNECTOR_ID = '6a1ad944111a79e68db13407';

export default function GoogleCalendarPanel() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [connectedEmail, setConnectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getGoogleCalendarEvents', {});
      setEvents(res.data.events || []);
      setConnectedEmail(res.data.connectedEmail || null);
      setConnected(true);
    } catch (err) {
      const errData = err?.response?.data;
      if (errData?.error === 'not_connected') {
        setConnected(false);
      } else if (errData?.error === 'token_expired') {
        setConnected(false);
        setError('Your Google Calendar session expired. Please reconnect.');
      } else if (errData?.error === 'permission_denied') {
        setConnected(false);
        setError('Permission denied. Please reconnect and allow calendar access.');
      } else {
        setError(errData?.message || 'Failed to load Google Calendar events.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      const popup = window.open(url, '_blank');
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          fetchEvents();
          setConnecting(false);
        }
      }, 500);
    } catch (err) {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await base44.connectors.disconnectAppUser(CONNECTOR_ID);
      setConnected(false);
      setEvents([]);
      setConnectedEmail(null);
      setError(null);
    } catch (err) {
      // ignore
    }
  };

  const formatEventTime = (event) => {
    if (event.isAllDay) return 'All day';
    try {
      return format(parseISO(event.start), 'EEE, MMM d · h:mm a');
    } catch {
      return event.start;
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-lg">Google Calendar</CardTitle>
            {connected && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                Connected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <>
                <Button variant="ghost" size="sm" onClick={fetchEvents} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-red-600 border-red-200 hover:bg-red-50">
                  <Unplug className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </>
            )}
            {!connected && !loading && (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={connecting}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plug className="h-4 w-4 mr-1" />}
                Connect Google Calendar
              </Button>
            )}
          </div>
        </div>
        {connected && connectedEmail && (
          <p className="text-sm text-slate-500 mt-1">{connectedEmail}</p>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-red-700">{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={handleConnect}>
                Reconnect
              </Button>
            </div>
          </div>
        ) : !connected ? (
          <div className="text-center py-8 text-slate-400">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Connect your Google Calendar to see upcoming events here.</p>
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No upcoming events found.</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 hover:bg-blue-50 transition-colors group">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatEventTime(event)}</p>
                  {event.location && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{event.location}</p>
                  )}
                </div>
                {event.htmlLink && (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="h-4 w-4 text-blue-500" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}