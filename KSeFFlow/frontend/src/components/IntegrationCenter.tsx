import { useState } from 'react';
import { Tenant, UserRole, ApiLog } from '../types';
import { 
  Network, 
  HelpCircle, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Cpu, 
  Globe, 
  Lock, 
  Workflow 
} from 'lucide-react';

interface IntegrationCenterProps {
  tenant: Tenant;
  role: UserRole;
  govStatus: 'Connected' | 'Restricted' | 'Disconnected' | 'Downtime Sim';
  onSetGovStatus: (status: 'Connected' | 'Restricted' | 'Disconnected' | 'Downtime Sim') => void;
  onAddNotification: (title: string, message: string, type: 'info' | 'success' | 'warn' | 'error') => void;
}

export default function IntegrationCenter({ tenant, role, govStatus, onSetGovStatus, onAddNotification }: IntegrationCenterProps) {
  const [selectedEnv, setSelectedEnv] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX');
  const [isTesting, setIsTesting] = useState(false);
  const [pingSpeed, setPingSpeed] = useState<number | null>(342);

  // Initial API Logs
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([
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

  // Test KSeF tunnel connectivity
  const triggerSelfTest = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      if (govStatus === 'Downtime Sim') {
        const failLog: ApiLog = {
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
          'Tunnel Diagnostics FAILED', 
          'Government server returned HTTP 504. System automatically redirected all outbound payloads to the local RabbitMQ queue.', 
          'error'
        );
      } else {
        const successLog: ApiLog = {
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
          'API Gateway Status: Excellent', 
          'Secure tunnel test completed successfully. Cryptographic session verified. Latency: 245ms', 
          'success'
        );
      }
    }, 1500);
  };

  const clearLogs = () => {
    setApiLogs([]);
    onAddNotification('Logs Cleared', 'Integration RAW terminal logs wiped.', 'info');
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Network className="text-red-700" size={20} />
          Government Integration Center
        </h2>
        <p className="text-zinc-500 text-xs mt-0.5">Control gateway parameters, verify REST API schema definitions, and configure emergency offline toggles.</p>
      </div>

      {/* Target Environment Config Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Environment Control Pane (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b pb-3 border-stone-100">
            <h3 className="font-semibold text-stone-850 text-sm">Active API Gateway Configuration</h3>
            <p className="text-stone-500 text-xs">Direct network adapters targeting the Ministry of Finance servers.</p>
          </div>

          <div className="space-y-4">
            {/* Environment Toggle Switches */}
            <div className="space-y-2">
              <span className="text-xs text-stone-500 font-medium block">Target Gateway Endpoint URL</span>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setSelectedEnv('SANDBOX')}
                  className={`py-2 px-3.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                    selectedEnv === 'SANDBOX' 
                      ? 'bg-red-50 border-red-300 text-red-950 shadow-xs' 
                      : 'bg-white border-stone-200 text-stone-605 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-[10px] font-bold text-red-700">TEST APIS</span>
                  <span className="font-mono text-[11px]">ksef-test.mf.gov.pl</span>
                </button>

                <button 
                  onClick={() => {
                    setSelectedEnv('PRODUCTION');
                    onAddNotification('PROD Endpoint Restriction', 'Connecting to Production KSeF requires verified Qualified Kir Signature.', 'warn');
                  }}
                  className={`py-2 px-3.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                    selectedEnv === 'PRODUCTION' 
                      ? 'bg-stone-900 border-stone-850 text-stone-100 shadow-md' 
                      : 'bg-white border-stone-200 text-stone-605 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-[10px] font-bold text-amber-500">PRODUCTION</span>
                  <span className="font-mono text-[11px]">ksef.mf.gov.pl</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Controls */}
            <div className="space-y-3.5 bg-stone-50 border rounded-xl p-4 text-xs font-sans">
              <div className="flex justify-between items-center">
                <span className="text-stone-600 font-medium">Gateway Health Indicator:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  govStatus === 'Connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-850'
                }`}>
                  {govStatus === 'Connected' ? 'ONLINE (ACTIVE)' : 'OFFLINE FALLBACK'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-stone-600 font-bold">Latency Index (Roundtrip):</span>
                <span className="font-mono font-bold text-stone-800">
                  {pingSpeed ? `${pingSpeed} ms` : 'TIMED OUT'}
                </span>
              </div>

              <div className="h-px bg-stone-250 my-1"></div>

              {/* Toggle government failure modes artificially to simulate robust SaaS action! */}
              <div className="space-y-2">
                <span className="text-[10px] text-stone-400 uppercase font-semibold block">Simulate Network Failures</span>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      onSetGovStatus('Connected');
                      setPingSpeed(320);
                      onAddNotification('Connection Established', 'KSeF Primary REST pipelines fully responsive.', 'success');
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border ${
                      govStatus === 'Connected' ? 'bg-emerald-100 border-emerald-300 text-emerald-950' : 'bg-white hover:bg-stone-55 text-stone-700'
                    }`}
                  >
                    Set Online (200 OK)
                  </button>

                  <button 
                    onClick={() => {
                      onSetGovStatus('Downtime Sim');
                      setPingSpeed(null);
                      onAddNotification('Downtime Simulated', 'National KSeF server offline triggered. Invoices will route to RabbitMQ failover queue.', 'warn');
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border ${
                      govStatus === 'Downtime Sim' ? 'bg-orange-100 border-orange-300 text-orange-950 font-bold' : 'bg-white hover:bg-stone-55 text-stone-750'
                    }`}
                  >
                    Simulate KSeF Failure
                  </button>
                </div>
              </div>
            </div>

            {/* Tunnel control Action deck */}
            <div className="pt-2">
              <button 
                onClick={triggerSelfTest}
                disabled={isTesting}
                className="w-full bg-red-700 hover:bg-red-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <Cpu size={14} className={isTesting ? 'animate-spin' : ''} />
                {isTesting ? 'Validating SSL & API Certificates...' : 'Execute Loopback Connectivity Test'}
              </button>
            </div>

          </div>
        </div>

        {/* Live Api Terminal XML/JSON response logs (7 cols) */}
        <div className="lg:col-span-7 bg-stone-950 border border-stone-900 rounded-xl p-5 shadow-lg flex flex-col justify-between text-stone-300 space-y-4">
          <div className="flex justify-between items-center border-b border-stone-850 pb-3">
            <h4 className="font-mono text-zinc-400 font-bold text-xs flex items-center gap-2">
              <Terminal size={15} className="text-red-500 animate-pulse" />
              KSeF-REST Gateway Interactive Terminal Logs
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 size={11} /> TLS V1.3 Secure
              </span>
              <button 
                onClick={clearLogs}
                className="text-stone-400 hover:text-stone-100 text-[10px] bg-stone-900 border border-stone-800 px-2 py-0.5 rounded transition"
              >
                Clear Terminal
              </button>
            </div>
          </div>

          {/* Logs scroll terminal wrapper */}
          <div className="flex-1 min-h-[300px] max-h-[380px] overflow-y-auto space-y-5 pr-2 font-mono text-[11px] leading-relaxed select-text">
            {apiLogs.map((log) => (
              <div key={log.id} className="border-b last:border-b-0 border-stone-900 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">{log.timestamp}</span>
                  <div className="space-x-1.5 flex">
                    <span className="bg-stone-850 px-1.5 py-0.5 rounded text-red-400 font-bold">{log.method}</span>
                    <span className="bg-stone-900 px-1.5 py-0.5 rounded text-stone-200">{log.endpoint}</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold ${log.statusCode < 300 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-950 text-red-400'}`}>{log.statusCode}</span>
                  </div>
                </div>

                <div className="space-y-1 bg-stone-900/50 p-2.5 rounded-lg border border-stone-900">
                  <div className="text-zinc-500 text-[9.5px]">REUEST PAYLOAD:</div>
                  <pre className="text-stone-400 truncate text-[10px] max-w-full overflow-x-auto">{log.requestPayload}</pre>
                  
                  <div className="text-zinc-500 text-[9.5px] mt-2">GOVERNMENT RESPONSE HEADERS & JSON:</div>
                  <pre className="text-amber-100 text-[10px] overflow-x-auto w-full max-w-full whitespace-pre-wrap leading-normal font-mono break-all">{log.responsePayload}</pre>
                </div>
              </div>
            ))}
            {apiLogs.length === 0 && (
              <div className="text-center text-zinc-600 font-mono py-16">
                Terminal empty. Trigger a loopback test or submit a compliance invoice to log encrypted government handshakes.
              </div>
            )}
          </div>

          <div className="border-t border-stone-900 pt-3 text-[10px] text-stone-500 flex justify-between items-center leading-normal">
            <span>Cert Authentication Algorithm: **SHA-256 with RSA 4096**</span>
            <span>RegulaOne API Server v3.4.1</span>
          </div>

        </div>

      </div>

    </div>
  );
}
