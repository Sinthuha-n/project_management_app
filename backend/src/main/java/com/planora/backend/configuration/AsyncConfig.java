package com.planora.backend.configuration;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        return boundedExecutor("Async-", 4, 16, 500);
    }

    @Bean(name = "chatTaskExecutor")
    public Executor chatTaskExecutor() {
        return boundedExecutor("ChatAsync-", 5, 20, 500);
    }

    @Bean(name = "emailTaskExecutor")
    public Executor emailTaskExecutor() {
        return boundedExecutor("EmailAsync-", 2, 5, 100);
    }

    private ThreadPoolTaskExecutor boundedExecutor(String prefix, int core, int max, int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(core);
        executor.setMaxPoolSize(max);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix(prefix);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
