import { useState, useEffect, useCallback } from 'react';
import {
  Network,
  Terminal,
  CheckCircle2,
  RefreshCw,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  Power,
  Loader2,
} from 'lucide-react';
import {
  getKsefStatus,
  declareKsefEmergency,
  declareKsefUnavailability,
  declareKsefOnline,
} from '../api/ksefApi';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../lib/permissions';

export default function IntegrationCenter({ tenant, role, permissions, govStatus, onSetGovStatus, onAddNotification }) {
  const { language, t } = useLanguage();
  const [selectedEnv, setSelectedEnv] = useState('SANDBOX');
  const [isTesting, setIsTesting] = useState(false);
  const [pingSpeed, setPingSpeed] = useState(342);

  // Declaring emergency / unavailability / online is KSEF_TENANT_ADMIN-only —
  // matches the backend guards on /ksef-status/*.
  const isAdmin = can.manageAvailability(permissions);

  // ── Real KSeF availability state (C7) ─────────────────────────────────────────
  const [ksefStatus, setKsefStatus]   = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionBusy, setActionBusy]   = useState(false);

  const loadKsefStatus = useCallback(() => {
    setStatusLoading(true);
    getKsefStatus()
      .then(setKsefStatus)
      .catch(() => { /* non-fatal — leave the card in its "unknown" state */ })
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => { loadKsefStatus(); }, [loadKsefStatus]);

  // Declare a state change. action is the API function; it needs a reason for the audit trail.
  const runDeclare = async (action, label, needReason) => {
    let reason = `${label} (przez panel integracji)`;
    if (needReason) {
      const input = window.prompt(t('integration.promptReason', { action: label }));
      if (input == null) return;            // user cancelled
      if (!input.trim()) { onAddNotification(t('common.error'), t('integration.reasonRequired'), 'error'); return; }
      reason = input.trim();
    }
    setActionBusy(true);
    try {
      const status = await action(reason);
      setKsefStatus(status);
      onAddNotification(t('integration.statusUpdatedTitle'), t('integration.statusUpdatedDesc', { mode: status.mode }), 'info');
    } catch (err) {
      onAddNotification(t('integration.statusUpdateError'), err.message || (language === 'pl' ? 'Operacja nie powiodła się.' : 'Operation failed.'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const [apiLogs, setApiLogs] = useState([
    {
      id: 'apilog-1',
      timestamp: '2026-05-20T09:12:44Z',
      method: 'POST',
      endpoint: '/api/online/Session/Init',
      statusCode: 201,
      requestPayload: `{"Identifier": {"NIP": "${tenant.nip}"}, "CertificateType": "PFX_KIR", "Encryption": "AES_256"}`,
      responsePayload: `{"SessionToken": "ST-9a0812b3c4d5e6f7a8b9c0d", "Status": "AUTHENTICATED", "Timestamp": "2026-05-20T09:12:45Z"}`
    },
    {
      id: 'apilog-2',
      timestamp: '2026-05-20T09:13:02Z',
      method: 'POST',
      endpoint: '/api/online/Invoice/Send',
      statusCode: 202,
      requestPayload: `{"InvoiceHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "Version": "FA_3"}`,
      responsePayload: `{"ReferenceNumber": "20260520-SE-8F2BDAC41", "KSeF-ID": "${tenant.nip}-20260520-FB4CE921", "State": "ACCEPTED"}`
    }
  ]);

  const triggerSelfTest = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      if (govStatus === 'Downtime Sim') {
        const failLog = {
          id: `apilog-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          method: 'GET',
          endpoint: '/api/online/Session/Status',
          statusCode: 504,
          requestPayload: '{}',
          responsePayload: '{"error": "Gateway Timeout", "message": "Failed to resolve DNS ksef-test.mf.gov.pl. Primary and secondary pipelines offline."}'
        };
        setApiLogs([failLog, ...apiLogs]);
        setPingSpeed(null);
        onAddNotification(
          t('integration.testFailTitle'),
          t('integration.testFailDesc'),
          'error'
        );
      } else {
        const successLog = {
          id: `apilog-success-${Date.now()}`,
          timestamp: new Date().toISOString(),
          method: 'GET',
          endpoint: '/api/online/Session/Status',
          statusCode: 200,
          requestPayload: '{}',
          responsePayload: '{"health": "OK", "uptime": "99.98%", "active_nodes": 6, "auth_engines": "KIR_PASSIVE"}'
        };
        setApiLogs([successLog, ...apiLogs]);
        setPingSpeed(Math.floor(Math.random() * 120) + 200);
        onAddNotification(
          t('integration.testSuccessTitle'),
          t('integration.testSuccessDesc'),
          'success'
        );
      }
    }, 1500);
  };

  const clearLogs = () => {
    setApiLogs([]);
    onAddNotification(t('integration.logsClearedTitle'), t('integration.logsClearedDesc'), 'info');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Network className="text-red-700" size={20} />
          {t('integration.title')}
        </h2>
        <p className="text-zinc-500 text-xs mt-0.5">{t('integration.desc')}</p>
      </div>

      {/* ── LIVE KSeF availability (authoritative, from the backend) ─────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <ShieldCheck size={15} className="text-red-650" /> {t('integration.ksefModeHeader')}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {t('integration.ksefModeDesc')}
            </p>
          </div>
          <button
            onClick={loadKsefStatus}
            disabled={statusLoading}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-707 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60"
          >
            {statusLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {t('integration.refresh')}
          </button>
        </div>

        {(() => {
          const mode = ksefStatus?.mode ?? 'UNKNOWN';
          const badge = mode === 'ONLINE'
            ? { cls: 'bg-emerald-50 text-emerald-707 border-emerald-200', text: t('integration.modeOnline') }
            : mode === 'EMERGENCY'
              ? { cls: 'bg-red-50 text-red-707 border-red-200', text: t('integration.modeEmergency') }
              : mode === 'OFFLINE_UNAVAILABILITY'
                ? { cls: 'bg-orange-50 text-orange-707 border-orange-200', text: t('integration.modeUnavailable') }
                : { cls: 'bg-slate-100 text-slate-505 border-slate-200', text: t('integration.modeUnknown') };
          return (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.cls}`}>{badge.text}</span>
              {ksefStatus?.reason && <span className="text-slate-500">{t('integration.reasonLabel')} <strong className="text-slate-700">{ksefStatus.reason}</strong></span>}
              {ksefStatus?.declaredBy && <span className="text-slate-400">{t('integration.declaredByLabel')} <span className="font-mono">{ksefStatus.declaredBy}</span></span>}
              {ksefStatus?.since && <span className="text-slate-400">{t('integration.sinceLabel')} {new Date(ksefStatus.since).toLocaleString('pl-PL')}</span>}
            </div>
          );
        })()}

        {/* Admin controls */}
        {isAdmin ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => runDeclare(declareKsefEmergency, t('integration.modeEmergency'), true)}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60"
            >
              <ShieldAlert size={13} /> {t('integration.btnDeclareEmergency')}
            </button>
            <button
              onClick={() => runDeclare(declareKsefUnavailability, t('integration.modeUnavailable'), true)}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-orange-50 border border-orange-200 text-orange-700 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60"
            >
              <Power size={13} /> {t('integration.btnDeclareUnavailable')}
            </button>
            <button
              onClick={() => runDeclare(declareKsefOnline, t('integration.modeOnline'), false)}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck size={13} /> {t('integration.btnRestoreOnline')}
            </button>
            {actionBusy && <Loader2 size={14} className="animate-spin text-slate-400 self-center" />}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">{t('integration.adminOnlyWarning')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b pb-3 border-stone-100">
            <h3 className="font-semibold text-stone-850 text-sm">{t('integration.activeConfigHeader')}</h3>
            <p className="text-stone-500 text-xs">{t('integration.activeConfigDesc')}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs text-stone-505 font-medium block">{t('integration.targetEndpointUrl')}</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedEnv('SANDBOX')}
                  className={`py-2 px-3.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                    selectedEnv === 'SANDBOX'
                      ? 'bg-red-50 border-red-300 text-red-950 shadow-xs'
                      : 'bg-white border-stone-200 text-stone-605 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-[10px] font-bold text-red-700">{t('integration.testApis')}</span>
                  <span className="font-mono text-[11px]">ksef-test.mf.gov.pl</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedEnv('PRODUCTION');
                    onAddNotification(t('integration.prodRestrictionTitle'), t('integration.prodRestrictionDesc'), 'warn');
                  }}
                  className={`py-2 px-3.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                    selectedEnv === 'PRODUCTION'
                      ? 'bg-stone-900 border-stone-850 text-stone-100 shadow-md'
                      : 'bg-white border-stone-200 text-stone-605 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-[10px] font-bold text-amber-500">{t('integration.production')}</span>
                  <span className="font-mono text-[11px]">ksef.mf.gov.pl</span>
                </button>
              </div>
            </div>

            <div className="space-y-3.5 bg-stone-50 border rounded-xl p-4 text-xs font-sans">
              <div className="flex justify-between items-center">
                <span className="text-stone-600 font-medium">{t('integration.healthIndicatorLabel')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  govStatus === 'Connected' ? 'bg-emerald-105 text-emerald-800' : 'bg-red-105 text-red-850'
                }`}>
                  {govStatus === 'Connected' ? t('integration.statusActive') : t('integration.statusOffline')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-stone-600 font-bold">{t('integration.latencyLabel')}</span>
                <span className="font-mono font-bold text-stone-800">
                  {pingSpeed ? `${pingSpeed} ms` : t('integration.timedOut')}
                </span>
              </div>

              <div className="h-px bg-stone-250 my-1"></div>

              <div className="space-y-2">
                <span className="text-[10px] text-stone-400 uppercase font-semibold block">{t('integration.simulateFailuresHeader')}</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onSetGovStatus('Connected');
                      setPingSpeed(320);
                      onAddNotification(t('integration.connSuccessTitle'), t('integration.connSuccessDesc'), 'success');
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border ${
                      govStatus === 'Connected' ? 'bg-emerald-105 border-emerald-300 text-emerald-955' : 'bg-white hover:bg-stone-55 text-stone-700'
                    }`}
                  >
                    {t('integration.btnSetOnline')}
                  </button>

                  <button
                    onClick={() => {
                      onSetGovStatus('Downtime Sim');
                      setPingSpeed(null);
                      onAddNotification(t('integration.downtimeSimTitle'), t('integration.downtimeSimDesc'), 'warn');
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border ${
                      govStatus === 'Downtime Sim' ? 'bg-orange-105 border-orange-300 text-orange-955 font-bold' : 'bg-white hover:bg-stone-55 text-stone-750'
                    }`}
                  >
                    {t('integration.btnSimulateFailure')}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={triggerSelfTest}
                disabled={isTesting}
                className="w-full bg-red-700 hover:bg-red-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <Cpu size={14} className={isTesting ? 'animate-spin' : ''} />
                {isTesting ? t('integration.runningTest') : t('integration.btnRunTest')}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-stone-950 border border-stone-900 rounded-xl p-5 shadow-lg flex flex-col justify-between text-stone-300 space-y-4">
          <div className="flex justify-between items-center border-b border-stone-850 pb-3">
            <h4 className="font-mono text-zinc-400 font-bold text-xs flex items-center gap-2">
              <Terminal size={15} className="text-red-505 animate-pulse" />
              {t('integration.terminalHeader')}
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 size={11} /> {t('integration.tlsLabel')}
              </span>
              <button
                onClick={clearLogs}
                className="text-stone-400 hover:text-stone-101 text-[10px] bg-stone-900 border border-stone-800 px-2 py-0.5 rounded transition"
              >
                {t('integration.btnClearTerminal')}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[300px] max-h-[380px] overflow-y-auto space-y-5 pr-2 font-mono text-[11px] leading-relaxed select-text">
            {apiLogs.map((log) => (
              <div key={log.id} className="border-b last:border-b-0 border-stone-900 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-505">{log.timestamp}</span>
                  <div className="space-x-1.5 flex">
                    <span className="bg-stone-850 px-1.5 py-0.5 rounded text-red-400 font-bold">{log.method}</span>
                    <span className="bg-stone-900 px-1.5 py-0.5 rounded text-stone-200">{log.endpoint}</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold ${log.statusCode < 300 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-955 text-red-400'}`}>{log.statusCode}</span>
                  </div>
                </div>

                <div className="space-y-1 bg-stone-900/50 p-2.5 rounded-lg border border-stone-900">
                  <div className="text-zinc-500 text-[9.5px]">REQUEST PAYLOAD:</div>
                  <pre className="text-stone-400 truncate text-[10px] max-w-full overflow-x-auto">{log.requestPayload}</pre>

                  <div className="text-zinc-505 text-[9.5px] mt-2">GOVERNMENT RESPONSE HEADERS & JSON:</div>
                  <pre className="text-amber-100 text-[10px] overflow-x-auto w-full max-w-full whitespace-pre-wrap leading-normal font-mono break-all">{log.responsePayload}</pre>
                </div>
              </div>
            ))}
            {apiLogs.length === 0 && (
              <div className="text-center text-zinc-605 font-mono py-16">
                {t('integration.terminalEmpty')}
              </div>
            )}
          </div>

          <div className="border-t border-stone-900 pt-3 text-[10px] text-stone-500 flex justify-between items-center leading-normal">
            <span>{t('integration.certAlgorithm')}</span>
            <span>{t('integration.serverVersion')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
