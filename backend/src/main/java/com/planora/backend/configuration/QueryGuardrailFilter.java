package com.planora.backend.configuration;

import java.io.IOException;
import java.util.UUID;

import javax.sql.DataSource;

import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import net.ttddyy.dsproxy.QueryCountHolder;
import net.ttddyy.dsproxy.QueryCount;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 50)
@ConditionalOnClass(QueryCountHolder.class)
@ConditionalOnProperty(prefix = "nplus1.guard", name = "enabled", havingValue = "true")
public class QueryGuardrailFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(QueryGuardrailFilter.class);

    @Value("${nplus1.guard.warn-threshold:40}")
    private int warnThreshold;

    @Value("${nplus1.guard.fail-threshold:120}")
    private int failThreshold;

    @Value("${nplus1.guard.fail-on-exceed:false}")
    private boolean failOnExceed;

    @Value("${nplus1.guard.slow-request-threshold-ms:1000}")
    private long slowRequestThresholdMs;

    private final ObjectProvider<DataSource> dataSourceProvider;

    public QueryGuardrailFilter(ObjectProvider<DataSource> dataSourceProvider) {
        this.dataSourceProvider = dataSourceProvider;
    }

    @PostConstruct
    void validateThresholds() {
        if (warnThreshold < 1 || failThreshold <= warnThreshold) {
            throw new IllegalStateException(
                    "N+1 guard thresholds must satisfy 0 < warn-threshold < fail-threshold"
            );
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long startNanos = System.nanoTime();
        String requestId = resolveRequestId(request);
        response.setHeader("X-Request-Id", requestId);
        MDC.put("requestId", requestId);
        QueryCountHolder.clear();
        try {
            filterChain.doFilter(request, response);
        } finally {
            QueryCount count = QueryCountHolder.getGrandTotal();
            long totalQueries = count != null ? count.getTotal() : 0L;
            String requestKey = request.getMethod() + " " + request.getRequestURI();
            long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000L;
            int status = response.getStatus();
            PoolSnapshot poolSnapshot = getPoolSnapshot();

            if (totalQueries > warnThreshold) {
                log.warn("[RequestMetrics] requestId={} route=\"{}\" status={} durationMs={} sqlCount={} hikariActive={} hikariPending={} reason=sql-threshold warn>{} fail>{}",
                        requestId, requestKey, status, elapsedMs, totalQueries,
                        poolSnapshot.activeConnections(), poolSnapshot.pendingThreads(),
                        warnThreshold, failThreshold);
            }

            if (elapsedMs > slowRequestThresholdMs) {
                log.warn("[RequestMetrics] requestId={} route=\"{}\" status={} durationMs={} sqlCount={} hikariActive={} hikariPending={} reason=slow-request thresholdMs={}",
                        requestId, requestKey, status, elapsedMs, totalQueries,
                        poolSnapshot.activeConnections(), poolSnapshot.pendingThreads(),
                        slowRequestThresholdMs);
            }

            if (log.isDebugEnabled() && request.getRequestURI().contains("/chat")) {
                log.debug("[RequestMetrics] requestId={} route=\"{}\" status={} durationMs={} sqlCount={} hikariActive={} hikariPending={}",
                        requestId, requestKey, status, elapsedMs, totalQueries,
                        poolSnapshot.activeConnections(), poolSnapshot.pendingThreads());
            }

            boolean failThresholdExceeded = failOnExceed && totalQueries > failThreshold;
            MDC.remove("requestId");

            if (failThresholdExceeded) {
                throw new ServletException("[N+1 Guard] Query threshold exceeded for " + requestKey
                        + " - total SQL statements: " + totalQueries);
            }
        }
    }

    private String resolveRequestId(HttpServletRequest request) {
        String existingRequestId = request.getHeader("X-Request-Id");
        if (existingRequestId != null && !existingRequestId.isBlank()) {
            return existingRequestId;
        }
        return UUID.randomUUID().toString();
    }

    private PoolSnapshot getPoolSnapshot() {
        if (dataSourceProvider == null) {
            return new PoolSnapshot(-1, -1);
        }

        DataSource dataSource = dataSourceProvider.getIfAvailable();
        if (dataSource instanceof HikariDataSource hikariDataSource && hikariDataSource.getHikariPoolMXBean() != null) {
            return new PoolSnapshot(
                    hikariDataSource.getHikariPoolMXBean().getActiveConnections(),
                    hikariDataSource.getHikariPoolMXBean().getThreadsAwaitingConnection()
            );
        }
        return new PoolSnapshot(-1, -1);
    }

    private record PoolSnapshot(int activeConnections, int pendingThreads) {}
}
