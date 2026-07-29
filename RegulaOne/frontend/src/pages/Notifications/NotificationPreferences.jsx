// Notification preferences — lets a user choose which delivery channels they receive on,
// a digest frequency, and quiet hours. In-app is always on (it's the canonical store).
// Email/push toggles take effect once those channels ship (Phase 3 / 5).

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Bell, Mail, Smartphone, Check } from 'lucide-react';
import { usePreferences, useUpdatePreferences } from '../../hooks/useNotifications';

const CHANNELS = [
  { key: 'IN_APP', label: 'In-app', desc: 'The bell and notification center. Always on.', icon: Bell, locked: true },
  { key: 'EMAIL',  label: 'Email',  desc: 'Important notifications by email.',            icon: Mail },
  { key: 'PUSH',   label: 'Mobile push', desc: 'Push notifications on the mobile app.',   icon: Smartphone },
];

const DIGESTS = [
  { key: 'IMMEDIATE', label: 'Immediately' },
  { key: 'HOURLY',    label: 'Hourly digest' },
  { key: 'DAILY',     label: 'Daily digest' },
];

export default function NotificationPreferences() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { data: prefs, isLoading } = usePreferences();
  const update = useUpdatePreferences();

  // Local working copy.
  const [channels, setChannels] = useState({ IN_APP: true, EMAIL: true, PUSH: true });
  const [digest, setDigest] = useState('IMMEDIATE');
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietFrom, setQuietFrom] = useState(22);
  const [quietTo, setQuietTo] = useState(7);

  // Seed from the server once loaded.
  useEffect(() => {
    if (!prefs) return;
    setChannels({
      IN_APP: prefs.channelDefaults?.IN_APP ?? true,
      EMAIL:  prefs.channelDefaults?.EMAIL ?? true,
      PUSH:   prefs.channelDefaults?.PUSH ?? true,
    });
    setDigest(prefs.digestFrequency ?? 'IMMEDIATE');
    setQuietEnabled(prefs.quietHoursEnabled ?? false);
    if (prefs.quietHoursFromHour != null) setQuietFrom(prefs.quietHoursFromHour);
    if (prefs.quietHoursToHour != null) setQuietTo(prefs.quietHoursToHour);
  }, [prefs]);

  const toggleChannel = (key) => {
    if (key === 'IN_APP') return; // always on
    setChannels((c) => ({ ...c, [key]: !c[key] }));
  };

  const handleSave = () => {
    update.mutate({
      channelDefaults: { ...channels, IN_APP: true },
      digestFrequency: digest,
      quietHoursEnabled: quietEnabled,
      quietHoursFromHour: quietFrom,
      quietHoursToHour: quietTo,
    });
  };

  const goBack = () => navigate(`/company/${tenantId}/notifications`);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <button onClick={goBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Notifications
      </button>

      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Notification preferences</h2>
        <p className="text-sm text-slate-500 font-medium">Choose how and when you want to be notified.</p>
      </div>

      {isLoading ? (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></CardContent>
        </Card>
      ) : (
        <>
          {/* Channels */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="text-sm font-bold text-slate-800">Delivery channels</CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-0">
              {CHANNELS.map((ch) => {
                const on = channels[ch.key];
                return (
                  <div key={ch.key} className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-50 last:border-0">
                    <div className="h-9 w-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <ch.icon className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{ch.label}</p>
                      <p className="text-[11px] text-slate-400">{ch.desc}</p>
                    </div>
                    <button
                      onClick={() => toggleChannel(ch.key)}
                      disabled={ch.locked}
                      className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
                        on ? 'bg-red-600' : 'bg-slate-200'
                      } ${ch.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      aria-label={`Toggle ${ch.label}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Digest frequency */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="text-sm font-bold text-slate-800">Email frequency</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <div className="grid grid-cols-3 gap-2">
                {DIGESTS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDigest(d.key)}
                    className={`h-10 rounded-lg border text-xs font-bold transition-all ${
                      digest === d.key ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200 hover:border-red-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quiet hours */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-100 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800">Quiet hours</CardTitle>
                <button
                  onClick={() => setQuietEnabled((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${quietEnabled ? 'bg-red-600' : 'bg-slate-200'}`}
                  aria-label="Toggle quiet hours"
                >
                  <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-all ${quietEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            </CardHeader>
            <CardContent className="py-4">
              <p className="text-[11px] text-slate-400 mb-3">
                Mute non-critical email/push during these hours. Critical and security alerts are always delivered.
              </p>
              <div className={`flex items-center gap-3 ${quietEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
                <label className="text-xs font-semibold text-slate-600">From
                  <select value={quietFrom} onChange={(e) => setQuietFrom(Number(e.target.value))}
                    className="ml-2 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">To
                  <select value={quietTo} onChange={(e) => setQuietTo(Number(e.target.value))}
                    className="ml-2 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={update.isPending}
              className="bg-red-600 text-white hover:bg-red-700 font-bold px-6">
              {update.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : <><Check className="h-4 w-4 mr-1.5" />Save preferences</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
