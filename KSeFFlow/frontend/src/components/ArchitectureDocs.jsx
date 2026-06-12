import { useState } from 'react';
import {
  Layers,
  Terminal,
  Cpu
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ArchitectureDocs() {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('java');

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

    @Column(name = "seller_nip", nullable = false, length = 10)
    private String sellerNip;

    @Column(name = "buyer_nip", nullable = false, length = 10)
    private String buyerNip;

    @Column(name = "total_gross", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalGross;

    @Getter
    @Setter
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private InvoiceStatus status; // DRAFT, SENT, OFFLINE_MODE, RETRYING, FAILED

    @Column(name = "ksef_id")
    private String ksefId;

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.LAZY, mappedBy = "invoice")
    private List<InvoiceItem> items;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}`;

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

    @Bean
    public Queue outboundQueue() {
        return QueueBuilder.durable(OUTBOUND_QUEUE)
                .withArgument("x-dead-letter-exchange", "ksef-retry-exchange")
                .withArgument("x-dead-letter-routing-key", "ksef.retry")
                .build();
    }

    @Bean
    public Queue retryQueue() {
        return QueueBuilder.durable(RETRY_QUEUE)
                .withArgument("x-dead-letter-exchange", "ksef-exchange")
                .withArgument("x-message-ttl", 30000) // 30-second TTL countdown
                .build();
    }
}`;

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

  const microserviceCode = `/**
 * SafeWork & WorkPulse Integrations Controller.
 */
@RestController
@RequestMapping("/api/integration/v1")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ACCOUNTANT')")
public class MicroserviceConnector {

    @PostMapping("/payroll-export")
    public ResponseEntity<ExportResponse> linkWorkPulsePayrollInvoice(
            @RequestHeader("X-RegulaOne-Client-Token") String systemToken,
            @RequestBody PayrollInvoiceDto payrollData) {

        Invoice invoice = ksefSubmissionService.convertPayrollToFa3(payrollData);
        ksefSubmissionService.signAndEnqueue(invoice);
        return ResponseEntity.ok(new ExportResponse(invoice.getInvoiceNumber(), "SUCCESS", "RabbitMQ Enqueued"));
    }

    @GetMapping("/tenant-check/{nip}")
    public ResponseEntity<ComplianceVerifyDto> verifySafeWorkContractor(
            @PathVariable String nip) {
        boolean valid = ksefSubmissionService.validateContractorNipOnVatWhiteList(nip);
        return ResponseEntity.ok(new ComplianceVerifyDto(nip, valid, LocalDateTime.now()));
    }
}`;

  const securityCode = `/**
 * RegulaOne Enterprise Suite - Spring Security JWT Implementation
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/auth/refresh").permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/login")
    public ResponseEntity<JwtResponse> authenticate(@RequestBody LoginRequest loginRequest) {
        Authentication auth = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword())
        );
        CustomUserDetails user = (CustomUserDetails) auth.getPrincipal();
        String jwtToken = jwtTokenUtil.generateToken(user);
        return ResponseEntity.ok(new JwtResponse(jwtToken, user.getEmail(), user.getRole(), user.getTenantId()));
    }
}`;

  const renderCode = (code) => {
    return (
      <div className="bg-stone-900 rounded-xl p-5 border border-stone-850 font-mono text-stone-300 text-xs space-y-3">
        <div className="flex justify-between items-center bg-stone-850 px-3 py-2 rounded border border-stone-800 text-[10.5px]">
          <span className="flex items-center gap-1.5 text-red-400 font-semibold uppercase">
            <Terminal size={13} /> {t('architecture.blueprintSource')}
          </span>
          <span className="text-stone-500 font-mono">{t('architecture.utf8Encoded')}</span>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Layers className="text-red-700" size={20} />
            {t('architecture.title')}
          </h2>
          <p className="text-zinc-505 text-xs mt-0.5">{t('architecture.desc')}</p>
        </div>

        <div className="bg-stone-100 p-1 rounded-lg inline-flex flex-wrap gap-1 text-xs font-semibold mt-3 sm:mt-0 font-sans">
          {[
            { key: 'java', label: t('architecture.tabJava') },
            { key: 'security', label: t('architecture.tabSecurity') },
            { key: 'queues', label: t('architecture.tabQueues') },
            { key: 'devops', label: t('architecture.tabDevops') },
            { key: 'microservices', label: t('architecture.tabMicroservices') },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === tab.key ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-955 rounded-xl p-4 text-xs space-y-2 font-sans">
        <h4 className="font-bold flex items-center gap-1 text-amber-900">
          <Cpu size={14} /> {t('architecture.briefingTitle')}
        </h4>
        <p className="leading-relaxed">
          {t('architecture.briefingDesc')}
        </p>
      </div>

      {activeTab === 'java' && renderCode(javaCode)}
      {activeTab === 'security' && renderCode(securityCode)}
      {activeTab === 'queues' && renderCode(queuesCode)}
      {activeTab === 'devops' && renderCode(devopsCode)}
      {activeTab === 'microservices' && renderCode(microserviceCode)}
    </div>
  );
}
