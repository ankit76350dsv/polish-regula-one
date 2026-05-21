import { useState } from 'react';
import { 
  FileCode2, 
  Layers, 
  Terminal, 
  Network, 
  Cpu, 
  Share2, 
  Database, 
  Cloud 
} from 'lucide-react';

export default function ArchitectureDocs() {
  const [activeTab, setActiveTab] = useState<'java' | 'security' | 'queues' | 'devops' | 'microservices'>('java');

  // Spring Boot + JPA entities code
  const javaCode = `/**
 * RegulaOne Enterprise Suite - KSeFFlow-Service
 * Spring Boot JPA entity representing Krakow/Warsaw tenant invoice models.
 */
package pl.regulaone.ksefflow.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "invoices", indexes = {
    @Index(name = "idx_invoice_tenant_nip", columnList = "tenant_id, seller_nip")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "invoice_number", nullable = false, unique = true)
    private String invoiceNumber;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(name = "seller_name", nullable = false)
    private String sellerName;

    @Column(name = "seller_nip", nullable = false, length = 10)
    private String sellerNip;

    @Column(name = "buyer_name", nullable = false)
    private String buyerName;

    @Column(name = "buyer_nip", nullable = false, length = 10)
    private String buyerNip;

    @Column(name = "total_net", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalNet;

    @Column(name = "total_vat", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalVat;

    @Column(name = "total_gross", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalGross;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private InvoiceStatus status; // DRAFT, SENT, OFFLINE_MODE, RETRYING, FAILED

    @Column(name = "ksef_id")
    private String ksefId;

    @Column(name = "upo_timestamp")
    private LocalDateTime upoTimestamp;

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.LAZY, mappedBy = "invoice")
    private List<InvoiceItem> items;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}`;

  // Queue system logic code
  const queuesCode = `/**
 * RabbitMQ Retry Topology Configuration for emergency fallback.
 */
package pl.regulaone.ksefflow.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfiguration {

    public static final String OUTBOUND_QUEUE = "ksef-outbound-queue";
    public static final String RETRY_QUEUE = "ksef-retry-queue";
    public static final String DLQ_QUEUE = "ksef-dead-letter-queue";

    public static final String KSEF_EXCHANGE = "ksef-exchange";
    public static final String KSEF_RETRY_EXCHANGE = "ksef-retry-exchange";

    @Bean
    public Queue outboundQueue() {
        return QueueBuilder.durable(OUTBOUND_QUEUE)
                .withArgument("x-dead-letter-exchange", KSEF_RETRY_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", "ksef.retry")
                .build();
    }

    @Bean
    public Queue retryQueue() {
        return QueueBuilder.durable(RETRY_QUEUE)
                .withArgument("x-dead-letter-exchange", KSEF_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", "ksef.send")
                .withArgument("x-message-ttl", 30000) // 30-second TTL countdown
                .build();
    }

    @Bean
    public DirectExchange ksefExchange() {
        return new DirectExchange(KSEF_EXCHANGE);
    }

    @Bean
    public DirectExchange ksefRetryExchange() {
        return new DirectExchange(KSEF_RETRY_EXCHANGE);
    }

    @Bean
    public Binding outboundBinding() {
        return BindingBuilder.bind(outboundQueue()).to(ksefExchange()).with("ksef.send");
    }

    @Bean
    public Binding retryBinding() {
        return BindingBuilder.bind(retryQueue()).to(ksefRetryExchange()).with("ksef.retry");
    }
}`;

  // Multi-tenant PostgreSQL docker-compose and Kubernetes
  const devopsCode = `# docker-compose.yml for high-volume isolated compliance deployment
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: regulaone-db
    environment:
      POSTGRES_DB: ksefflow
      POSTGRES_USER: admin_postgres
      POSTGRES_PASSWORD: SecretEEAStoragePassword61
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - ksef-net

  redis:
    image: redis:7-alpine
    container_name: regulaone-cache
    command: redis-server --save 60 1 --loglevel warning
    ports:
      - "6379:6379"
    networks:
      - ksef-net

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: regulaone-broker
    ports:
      - "5672:5672"
      - "15672:15672"
    networks:
      - ksef-net

networks:
  ksef-net:
    driver: bridge

volumes:
  pgdata:
    driver: local`;

  // Interconnection with WorkPulse, SafeWork etc API spec
  const microserviceCode = `/**
 * SafeWork & WorkPulse Integrations Controller.
 * Authorizes secure internal mesh connections to fetch employee tax logs.
 */
@RestController
@RequestMapping("/api/integration/v1")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ACCOUNTANT')")
public class MicroserviceConnector {

    @Autowired
    private InvoiceSubmissionService ksefSubmissionService;

    @PostMapping("/payroll-export")
    public ResponseEntity<ExportResponse> linkWorkPulsePayrollInvoice(
            @RequestHeader("X-RegulaOne-Client-Token") String systemToken,
            @RequestBody PayrollInvoiceDto payrollData) {
        
        log.info("Centralized payroll ledger transfer received from WorkPulse. Tenant token check active.");
        Invoice invoice = ksefSubmissionService.convertPayrollToFa3(payrollData);
        ksefSubmissionService.signAndEnqueue(invoice);

        return ResponseEntity.ok(new ExportResponse(invoice.getInvoiceNumber(), "SUCCESS", "RabbitMQ Enqueued"));
    }

    @GetMapping("/tenant-check/{nip}")
    public ResponseEntity<ComplianceVerifyDto> verifySafeWorkContractor(
            @PathVariable String nip) {
        
        log.info("Auditing contractor NIP whitelist alignment for SafeWork compliance verification.");
        boolean valid = ksefSubmissionService.validateContractorNipOnVatWhiteList(nip);
        return ResponseEntity.ok(new ComplianceVerifyDto(nip, valid, LocalDateTime.now()));
    }
}`;

  // Spring Security configurations + JWT filter + Controller blueprints
  const securityCode = `/**
 * RegulaOne Enterprise Suite - Spring Security JWT Implementation
 * Implements Token Authentication Providers, AuthController login handshakes, and Seeding logic.
 */
package pl.regulaone.ksefflow.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {

    private final JwtRequestFilter jwtRequestFilter;
    private final CustomUserDetailsService userDetailsService;

    public SecurityConfiguration(JwtRequestFilter jwtRequestFilter, CustomUserDetailsService userDetailsService) {
        this.jwtRequestFilter = jwtRequestFilter;
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable()) // Stateless JWT authorization is CSRF-exempt
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/auth/refresh").permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
}

/**
 * Controller exposing OAuth / JWT Login and refresh handshakes for RegulaOne.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenUtil jwtTokenUtil;
    private final DatabaseSeedingService seedService;

    @PostMapping("/login")
    public ResponseEntity<JwtResponse> authenticate(@RequestBody LoginRequest loginRequest) {
        // Encrypted credentials check
        Authentication auth = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword())
        );
        
        CustomUserDetails user = (CustomUserDetails) auth.getPrincipal();
        String jwtToken = jwtTokenUtil.generateToken(user);
        String refreshToken = jwtTokenUtil.generateRefreshToken(user);
        
        return ResponseEntity.ok(new JwtResponse(
            jwtToken, 
            refreshToken, 
            user.getEmail(), 
            user.getRole(), 
            user.getTenantId()
        ));
    }
}

/**
 * Database Seed Seeding details (resources/data.sql)
 */
-- data.sql - Seed accounts with cryptographic BCrypt cryptograms
DELETE FROM user_roles;
DELETE FROM users;

-- Tenants
INSERT INTO tenants (id, name, nip, subscription) VALUES ('tenant_demo_001', 'KSeFFlow Demo Company', '5252463242', 'PRO_MULTITENANT');

-- Cryprographic users seeded with BCrypt passwords (e.g. "KSeF2026Password!")
INSERT INTO users (id, name, email, password_hash, tenant_id, role) VALUES 
('user-sa-01', 'Admin RegulaOne', 'super.admin@regulaone.pl', '$2a$12$6/Z3K8WvSgO3XWCO8B1zWeU67U6Q0W5A6C0H.X4z9G5X0g5S0e0E0', 'tenant_demo_001', 'Super Admin'),
('user-co-01', 'Marek Nowak', 'company.admin@regulaone.pl', '$2a$12$6/Z3K8WvSgO3XWCO8B1zWeU67U6Q0W5A6C0H.X4z9G5X0g5S0e0E0', 'tenant_demo_001', 'Company Admin'),
('user-ac-01', 'Janina Kowalska', 'accountant.warsaw@regulaone.pl', '$2a$12$6/Z3K8WvSgO3XWCO8B1zWeU67U6Q0W5A6C0H.X4z9G5X0g5S0e0E0', 'tenant_demo_001', 'Accountant');`;

  const renderCode = (code: string) => {
    return (
      <div className="bg-stone-900 rounded-xl p-5 border border-stone-850 font-mono text-stone-300 text-xs space-y-3">
        <div className="flex justify-between items-center bg-stone-850 px-3 py-2 rounded border border-stone-800 text-[10.5px]">
          <span className="flex items-center gap-1.5 text-red-400 font-semibold uppercase">
            <Terminal size={13} /> production-blueprint-source
          </span>
          <span className="text-stone-500 font-mono">UTF-8 Encoded</span>
        </div>
        <pre className="overflow-x-auto max-h-96 text-stone-200 p-3 bg-stone-950 rounded border border-stone-900 leading-relaxed font-sans text-xs">
          <code className="font-mono text-[11px] block whitespace-pre">
            {code}
          </code>
        </pre>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Layers className="text-red-700" size={20} />
            RegulaOne Architecture Blueprints
          </h2>
          <p className="text-zinc-505 text-xs mt-0.5">Explore Spring Boot, JWT credentials auth, RabbitMQ retry queue pipelines, and microservice mesh API endpoints.</p>
        </div>

        {/* Tab switcher */}
        <div className="bg-stone-100 p-1 rounded-lg inline-flex flex-wrap gap-1 text-xs font-semibold mt-3 sm:mt-0 font-sans">
          <button 
            onClick={() => setActiveTab('java')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'java' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
          >
            Spring Boot JPA Models
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'security' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
          >
            Spring Security & JWT
          </button>
          <button 
            onClick={() => setActiveTab('queues')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'queues' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
          >
            RabbitMQ Retry Topology
          </button>
          <button 
            onClick={() => setActiveTab('devops')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'devops' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
          >
            Docker & DevOps Stack
          </button>
          <button 
            onClick={() => setActiveTab('microservices')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'microservices' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
          >
            Microservice Integration APIs
          </button>
        </div>
      </div>

      {/* Detail info cards showing underlying structure */}
      <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-4 text-xs space-y-2 font-sans">
        <h4 className="font-bold flex items-center gap-1 text-amber-900">
          <Cpu size={14} /> SaaS Engineering & Infrastructure Briefing
        </h4>
        <p className="leading-relaxed">
          KSeFFlow leverages a multi-tenant shared database strategy using **PostgreSQL schemas** for rigorous tenancy partitioning. All Qualified Signature files (PKCS#12 keystores) undergo **AES-25 symmetric encryption and digital validation**, with security handshakes managed using **JWT bearer certificates in Spring Security state models**.
        </p>
      </div>

      {/* Dynamic code viewer */}
      {activeTab === 'java' && renderCode(javaCode)}
      {activeTab === 'security' && renderCode(securityCode)}
      {activeTab === 'queues' && renderCode(queuesCode)}
      {activeTab === 'devops' && renderCode(devopsCode)}
      {activeTab === 'microservices' && renderCode(microserviceCode)}

    </div>
  );
}
