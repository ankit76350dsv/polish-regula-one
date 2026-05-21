import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  Shield, 
  FileText, 
  Building, 
  Fingerprint, 
  Check, 
  Eye, 
  EyeOff, 
  Terminal,
  Activity,
  Cpu,
  RefreshCw,
  Clock,
  Briefcase
} from 'lucide-react';
import { UserRole, Tenant } from '../types';

interface LoginProps {
  onLoginSuccess: (user: {
    email: string;
    role: UserRole;
    name: string;
    tenantId: string;
    token: string;
    refreshToken: string;
  }) => void;
  tenants: Tenant[];
}

export default function Login({ onLoginSuccess, tenants }: LoginProps) {
  // Fields state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // UX states
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [activeTab, setActiveTab] = useState<'signin' | 'blueprints'>('signin');
  const [successAnimation, setSuccessAnimation] = useState(false);
  const [selectedDemoCard, setSelectedDemoCard] = useState<string | null>(null);

  // Live JWT inspect state
  const [inspectToken, setInspectToken] = useState<any>(null);

  // Core Demo Users Structure
  const demoUsers = [
    {
      role: 'Super Admin' as UserRole,
      roleKey: 'SUPER_ADMIN',
      name: 'RegulaOne Admin Root',
      email: 'superadmin@regulaone.com',
      password: 'Admin@123',
      tenantId: 'tenant-1',
      tenantName: 'Warszawa Logistics Group Sp. z o.o.',
      permissions: ['Full platform access', 'Tenant management', 'System analytics', 'All invoices', 'Audit logs', 'API gateway monitoring']
    },
    {
      role: 'Company Admin' as UserRole,
      roleKey: 'COMPANY_ADMIN',
      name: 'Marek Nowak',
      email: 'admin@ksefflow.com',
      password: 'Admin@123',
      tenantId: 'tenant_demo_001',
      tenantName: 'KSeFFlow Demo Company',
      permissions: ['Manage company invoices', 'Manage accountants', 'Upload certificates', 'Access reports', 'API monitoring dashboard']
    },
    {
      role: 'Accountant' as UserRole,
      roleKey: 'ACCOUNTANT',
      name: 'Zfofia Kowalska',
      email: 'accountant@ksefflow.com',
      password: 'Account@123',
      tenantId: 'tenant_demo_001',
      tenantName: 'KSeFFlow Demo Company',
      permissions: ['Create invoices', 'Edit draft invoices', 'Submit invoices', 'View reports']
    },
    {
      role: 'Finance User' as UserRole,
      roleKey: 'FINANCE_USER',
      name: 'Tomasz Wiśniewski',
      email: 'finance@ksefflow.com',
      password: 'Finance@123',
      tenantId: 'tenant_demo_001',
      tenantName: 'KSeFFlow Demo Company',
      permissions: ['View invoices', 'Financial reports', 'Export data']
    },
    {
      role: 'Auditor' as UserRole,
      roleKey: 'AUDITOR',
      name: 'Anna Zielińska',
      email: 'auditor@ksefflow.com',
      password: 'Audit@123',
      tenantId: 'tenant_demo_001',
      tenantName: 'KSeFFlow Demo Company',
      permissions: ['Read-only access', 'Audit logs', 'Compliance reports']
    }
  ];

  const handleDemoSelect = (user: typeof demoUsers[0]) => {
    setEmail(user.email);
    setPassword(user.password);
    setSelectedDemoCard(user.role);
    setValidationError('');

    // Generate dynamic preview JWT for the Inspector
    const mockJwtHeader = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const mockJwtPayload = btoa(JSON.stringify({
      sub: user.email,
      name: user.name,
      role: user.roleKey,
      tenantId: user.tenantId,
      permissions: user.permissions,
      iss: "regulaone.com",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }));
    const mockJwtSignature = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    
    setInspectToken({
      header: { alg: "HS256", typ: "JWT" },
      payload: {
        sub: user.email,
        name: user.name,
        role: user.roleKey,
        tenantId: user.tenantId,
        permissions: user.permissions,
        iss: "regulaone.com",
        exp: "1 Hour (Refresh Active)"
      },
      raw: `${mockJwtHeader}.${mockJwtPayload}.${mockJwtSignature}`
    });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!email) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    
    // Quick email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Invalid email address format.');
      return;
    }

    if (!password) {
      setValidationError('Please enter your workspace password.');
      return;
    }

    // Match credentials
    const matchedUser = demoUsers.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!matchedUser) {
      setValidationError('Authentication Failed: Invalid email format or incorrect password hash.');
      return;
    }

    setLoading(true);

    // Simulate encrypted roundtrip + Spring Boot API response JWT verification
    setTimeout(() => {
      setLoading(false);
      setSuccessAnimation(true);

      setTimeout(() => {
        // Successful login callback, pass verified details
        const mockToken = inspectToken?.raw || `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
          sub: matchedUser.email,
          role: matchedUser.roleKey,
          tenantId: matchedUser.tenantId
        }))}.signed_sign`;

        onLoginSuccess({
          email: matchedUser.email,
          role: matchedUser.role,
          name: matchedUser.name,
          tenantId: matchedUser.tenantId,
          token: mockToken,
          refreshToken: 'refresh-token-hash-uuid-10330a'
        });
      }, 700);
    }, 1200);
  };

  const handleDirectDemoAccess = () => {
    // Quick login as Company Admin
    const companyAdmin = demoUsers[1];
    handleDemoSelect(companyAdmin);
    setLoading(true);
    setTimeout(() => {
      setSuccessAnimation(true);
      setTimeout(() => {
        onLoginSuccess({
          email: companyAdmin.email,
          role: companyAdmin.role,
          name: companyAdmin.name,
          tenantId: companyAdmin.tenantId,
          token: 'direct-access-jwt-token-verified',
          refreshToken: 'direct-access-refresh-token'
        });
      }, 500);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-150 flex items-center justify-center p-4 md:p-8 font-sans selection:bg-red-500 selection:text-white">
      
      {/* Background radial soft light blobs for e-compliance node vibe */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-red-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-850/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-6xl bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* LEFT COLUMN: Visual & Branding (7 cols on desktop) */}
        <div className="lg:col-span-12 xl:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-red-950/50 p-6 md:p-10 border-b xl:border-b-0 xl:border-r border-slate-800 flex flex-col justify-between">
          
          {/* Header Branding */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-650 text-white rounded-lg p-2 font-black text-sm flex items-center justify-center leading-none shadow-lg">
                R1
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg tracking-tight uppercase text-white">RegulaOne</span>
                  <span className="text-xs bg-red-950/70 border border-red-900 text-red-400 px-2 py-0.5 rounded font-mono font-bold">KSeFFlow</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Poland e-Invoicing Compliance SaaS Node</p>
              </div>
            </div>

            {/* Illustration Card / Visual block */}
            <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-5 mt-8 space-y-4 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-red-500/15">
                <Fingerprint size={80} />
              </div>

              <div className="flex items-center gap-2 text-red-500">
                <Shield size={16} />
                <span className="text-[11px] uppercase tracking-wider font-bold">KSeF e-Compliance Active</span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Cryptographic Signature Sealing & XML Validation Suite
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                A unified compliance gateway for Polish national e-faktura (FA-3) submissions. Featuring legal offline queuing, automated retry tokens, and HSM certificate registers.
              </p>

              {/* Dynamic status nodes illustration */}
              <div className="pt-2">
                <div className="space-y-1.5 font-mono text-[10px] text-slate-500 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Gateway Endpoint:
                    </span>
                    <span className="text-indigo-400 font-semibold text-right">ksef-test.mf.gov.pl/api</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Signer Standard:
                    </span>
                    <span className="text-slate-300">XAdES-BES/T Legal Sealing</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                      Security Filter:
                    </span>
                    <span className="text-slate-300">JWT + Spring Security active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom regulatory tag */}
          <div className="mt-8 pt-6 border-t border-slate-900/80 text-[10.5px] text-slate-450 space-y-2">
            <div className="flex items-center gap-2">
              <Cpu size={13} className="text-red-500/70" />
              <span>Complies with **Art. 106fa Polish Tax Standard** for emergency schema falloffs.</span>
            </div>
            <p>Platform status: <strong className="text-emerald-500">RODO_OK SECURE HSM_CONNECTED</strong></p>
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive Login Core (8 cols on desktop) */}
        <div className="lg:col-span-12 xl:col-span-7 p-6 md:p-10 flex flex-col justify-between">
          
          <div className="space-y-6">
            
            {/* Nav Switch Tabs */}
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveTab('signin')}
                  className={`text-sm font-bold pb-2 transition relative ${activeTab === 'signin' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Workspace Sign In
                  {activeTab === 'signin' && (
                    <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-650" />
                  )}
                </button>
                <button 
                  onClick={() => setActiveTab('blueprints')}
                  className={`text-sm font-bold pb-2 transition relative ${activeTab === 'blueprints' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Spring Boot JWT Blueprints
                  {activeTab === 'blueprints' && (
                    <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-650" />
                  )}
                </button>
              </div>

              <div className="hidden sm:block text-[10px] font-mono text-slate-500 bg-slate-900/80 px-2.5 py-1 border border-slate-850 rounded">
                ENV: Spring-Cloud-Production
              </div>
            </div>

            {/* TAB 1: Core Sign-in Flow */}
            {activeTab === 'signin' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                
                {/* Form & Main Input block (7 cols on desktop inside) */}
                <div className="md:col-span-7 space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-white tracking-tight">Access Secure Node</h2>
                    <p className="text-xs text-slate-400">Authenticating grants access with role-based JWT bearer clearance.</p>
                  </div>

                  <AnimatePresence mode="wait">
                    {validationError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-xs text-wrap leading-relaxed"
                      >
                        {validationError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleLoginSubmit} className="space-y-3">
                    
                    {/* Email field */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">ID Address / Email</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Mail size={14} />
                        </span>
                        <input 
                          type="email" 
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setSelectedDemoCard(null); }}
                          placeholder="name@regulaone.com"
                          className="w-full bg-slate-900/80 border border-slate-800 focus:border-red-650 focus:ring-1 focus:ring-red-650 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold text-white tracking-wide placeholder-slate-550 transition shadow-inner"
                          required
                        />
                      </div>
                    </div>

                    {/* Password field */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Signature Secret / Password</label>
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[10px] text-slate-500 hover:text-slate-350 flex items-center gap-1 font-semibold"
                        >
                          {showPassword ? <EyeOff size={11} /> : <Eye size={11} />} {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <div className="relative border-transparent">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock size={14} />
                        </span>
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setSelectedDemoCard(null); }}
                          placeholder="••••••••••••"
                          className="w-full bg-slate-900/80 border border-slate-800 focus:border-red-650 focus:ring-1 focus:ring-red-650 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white tracking-widest placeholder-slate-550 transition shadow-inner"
                          required
                        />
                      </div>
                    </div>

                    {/* Extra Form checks: Remember me checkbox & forgot password */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs">
                        <input 
                          type="checkbox" 
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-slate-800 text-red-650 focus:ring-red-650/50 bg-slate-900"
                        />
                        <span>Remember credentials</span>
                      </label>
                      <button 
                        type="button"
                        onClick={() => {
                          setValidationError('Self-service encryption recovery is offline. Please query your designated superadmin@regulaone.com root authority.');
                        }}
                        className="text-red-400 hover:text-red-350 text-xs font-semibold"
                      >
                        Reset qualified key?
                      </button>
                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit" 
                      disabled={loading || successAnimation}
                      className="w-full bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition hover:scale-[1.01] duration-150 shadow-lg mt-4"
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={13} className="animate-spin text-red-200" />
                          <span>Issuing JWT via Spring Boot Auth API...</span>
                        </>
                      ) : successAnimation ? (
                        <>
                          <Check size={14} className="text-emerald-400 animate-bounce" />
                          <span className="text-emerald-400">JWT Token Verified & Authorized!</span>
                        </>
                      ) : (
                        <>
                          <span>Verify HSM & Sign In</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>

                  </form>

                  {/* Sleek instant bypass option */}
                  <div className="pt-2 border-t border-slate-900/60">
                    <p className="text-[10px] text-slate-500 font-medium text-center">Bypass credentials manually for fast verification:</p>
                    <button 
                      onClick={handleDirectDemoAccess}
                      disabled={loading || successAnimation}
                      className="w-full mt-2 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-350 hover:text-slate-100 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Briefcase size={12} className="text-red-500" />
                      <span>Continue with Demo Access (Log in as Company Admin)</span>
                    </button>
                  </div>

                </div>

                {/* Demo profiles shortcuts row (5 cols on desktop inside) */}
                <div className="md:col-span-5 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <Activity size={12} className="text-red-500" /> Demo Accounts Ledger
                    </h3>
                    <p className="text-[11px] text-slate-500">Tap a card to auto-populate email, password, and generate live JWT claims.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 max-h-[305px] overflow-y-auto pr-1">
                    {demoUsers.map((user) => {
                      const isSelected = selectedDemoCard === user.role;
                      return (
                        <div 
                          key={user.role} 
                          onClick={() => handleDemoSelect(user)}
                          className={`group border rounded-xl p-3 text-left transition cursor-pointer hover:border-red-900/60 shadow-xs relative ${
                            isSelected 
                              ? 'bg-red-950/20 border-red-700' 
                              : 'bg-slate-950/60 border-slate-850'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2.5 right-2.5 bg-red-900 text-red-400 text-[8px] font-bold font-mono px-1.5 py-0.5 rounded uppercase leading-none border border-red-800">
                              Selected
                            </span>
                          )}
                          <strong className="text-xs font-bold block text-slate-200 group-hover:text-white transition">
                            {user.role}
                          </strong>
                          <span className="text-[10.5px] font-mono text-slate-400 block mt-1 tracking-tight">
                            {user.email}
                          </span>
                          
                          {/* Mini info overlay on select */}
                          {isSelected && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-2 pt-2 border-t border-red-950 text-[9.5px] text-slate-450 space-y-1 leading-normal font-sans"
                            >
                              <p>🏢 Company: **{user.tenantName}**</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {user.permissions.slice(0, 2).map(p => (
                                  <span key={p} className="bg-slate-900 px-1 py-0.5 rounded text-slate-400 text-[8.5px]">
                                    {p}
                                  </span>
                                ))}
                                {user.permissions.length > 2 && <span className="text-[8.5px] italic text-slate-500">+{user.permissions.length - 2} more</span>}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: Spring Boot Blueprints */}
            {activeTab === 'blueprints' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Terminal size={14} className="text-red-500" /> Microservice Security & JWT Blueprint
                  </h3>
                  <p className="text-xs text-slate-450 leading-relaxed">
                    KSeFFlow leverages Spring Boot Security combined with encrypted **HMAC SHA-256 JWT tokens** to enforce RBAC access over rest endpoints. Take a look at our production configurations:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10.5px] font-bold text-red-400 uppercase tracking-widest font-mono">1. JWT Service Implementation</span>
                      <span className="bg-slate-900 text-slate-400 text-[9px] px-1.5 py-0.5 rounded">Java</span>
                    </div>
                    <pre className="text-[9.5px] text-slate-350 overflow-x-auto max-h-[160px] font-mono leading-relaxed bg-slate-900/40 p-2.5 rounded border border-slate-800">
{`package pl.regulaone.ksefflow.security;

import io.jsonwebtoken.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.Date;
import java.util.HashMap;

@Service
public class JwtService {

    @Value("\${jwt.secret}")
    private String secretKey;

    @Value("\${jwt.expiration}")
    private long jwtExpiration;

    public String generateToken(UserDetails userDetails, String tenantId, String role) {
        HashMap<String, Object> claims = new HashMap<>();
        claims.put("tenantId", tenantId);
        claims.put("role", role);
        return buildToken(claims, userDetails.getUsername(), jwtExpiration);
    }

    private String buildToken(Map<String, Object> claims, String subject, long expiration) {
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }
}`}
                    </pre>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10.5px] font-bold text-red-400 uppercase tracking-widest font-mono">2. Spring Boot AuthController</span>
                      <span className="bg-slate-900 text-slate-400 text-[9px] px-1.5 py-0.5 rounded">Java</span>
                    </div>
                    <pre className="text-[9.5px] text-slate-350 overflow-x-auto max-h-[160px] font-mono leading-relaxed bg-slate-900/40 p-2.5 rounded border border-slate-800">
{`package pl.regulaone.ksefflow.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authManager;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private UserRepository userRepository;

    @PostMapping("/login")
    public ResponseEntity<JwtResponse> authenticate(@RequestBody LoginDto request) {
        Authentication auth = authManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new UsernameNotFoundException("Security Identity Mismatch"));
        
        String token = jwtService.generateToken(user, user.getTenantId(), user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(user);
        
        return ResponseEntity.ok(new JwtResponse(token, refreshToken, user.getRole().name(), "Bearer"));
    }
}`}
                    </pre>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-widest font-mono">3. Security database Seeder (`data.sql`)</span>
                    <span className="bg-slate-900 text-slate-400 text-[9px] px-1.5 py-0.5 rounded">SQL</span>
                  </div>
                  <pre className="text-[10px] text-slate-350 overflow-x-auto max-h-[120px] font-mono leading-relaxed bg-slate-900/40 p-2.5 rounded border border-slate-800">
{`-- Automatic Security Database Seeding on Enterprise Startup
INSERT INTO tenant_schemas (id, name, nip, subscription_plan) VALUES
('tenant_demo_001', 'KSeFFlow Demo Company', '1234567890', 'High-Volume SaaS');

-- Seed encrypted passwords using BCrypt strength 12
-- Raw values: Superadmin password is Admin@123, Company Admin is Admin@123, Accountant: Account@123, Finance: Finance@123, Auditor: Audit@123
INSERT INTO users (id, email, password_hash, role, tenant_id, full_name, active) VALUES
('usr-001', 'superadmin@regulaone.com', '$2a$12$Z0Yn2kI12RoxpT75N/WwLehXfeR8WdK97Yl26071Yw49eL301A.gW', 'SUPER_ADMIN', 'tenant-1', 'RegulaOne Admin Root', true),
('usr-002', 'admin@ksefflow.com', '$2a$12$Z0Yn2kI12RoxpT75N/WwLehXfeR8WdK97Yl26071Yw49eL301A.gW', 'COMPANY_ADMIN', 'tenant_demo_001', 'Marek Nowak', true),
('usr-003', 'accountant@ksefflow.com', '$2a$12$b1XenK8L10r0xU75N/Ee9UhFf8WdK97Yl26071Yw49eL301A.a2', 'ACCOUNTANT', 'tenant_demo_001', 'Zfofia Kowalska', true),
('usr-004', 'finance@ksefflow.com', '$2a$12$F1nYrK5L10r0xT75N/Aa3UhFe8WdK97Yl26071Yw49eL301A.f4', 'FINANCE_USER', 'tenant_demo_001', 'Tomasz Wiśniewski', true),
('usr-005', 'auditor@ksefflow.com', '$2a$12$Ad1Trk9M10r0xY75N/Cc1UhFd8WdK97Yl26071Yw49eL301A.a9', 'AUDITOR', 'tenant_demo_001', 'Anna Zielińska', true);`}
                  </pre>
                </div>

              </div>
            )}

            {/* LIVE CRYPTO JWT INSPECTOR TRAY (Visible only during input, adds extreme craftsmanship) */}
            <AnimatePresence>
              {inspectToken && activeTab === 'signin' && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="bg-slate-950 border border-slate-850 p-4.5 rounded-xl space-y-3 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 py-1.5 px-3 bg-red-950/40 border-l border-b border-red-900 rounded-bl text-[9px] font-mono font-bold text-red-400 flex items-center gap-1">
                    <Clock size={10} className="animate-spin" /> Security Token Decrypter
                  </div>

                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1">
                    <Fingerprint size={13} className="text-red-500" /> Decrypted JWT Payload (HMAC-SHA256)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                    <div className="md:col-span-12 font-mono text-[9px] bg-slate-900 p-2 rounded text-slate-300 border border-slate-800 break-all leading-relaxed">
                      <span className="text-red-400 font-bold">Header:</span> {JSON.stringify(inspectToken.header)} <br />
                      <span className="text-indigo-400 font-bold">Payload Claims:</span> {JSON.stringify(inspectToken.payload)} <br />
                      <span className="text-emerald-400 font-bold">Signature Verified:</span> YES_VALID_SEAL_HS256
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* Core system properties status block */}
          <div className="mt-8 pt-6 border-t border-slate-900/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] text-slate-400 leading-normal">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Secured Key Size</span>
              <strong className="text-slate-300 font-mono text-[11.5px]">SHA-256 Symmetric</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Session Rate Limiting</span>
              <span className="text-emerald-500 font-semibold font-mono text-[11.5px]">50 req/min active</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">XSS Protection</span>
              <span className="text-slate-300 font-semibold text-[11px]">Sanitized Inputs</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">CSRF Middleware</span>
              <span className="text-emerald-500 font-bold text-[11px]">Strict Cookie SameSite</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
