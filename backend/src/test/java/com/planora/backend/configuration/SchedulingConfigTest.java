package com.planora.backend.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;

import static org.assertj.core.api.Assertions.assertThat;

class SchedulingConfigTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(SchedulingConfig.class);

    @Test
    void schedulingEnabledByDefault() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(SchedulingConfig.class);
            assertThat(context).hasSingleBean(ScheduledAnnotationBeanPostProcessor.class);
        });
    }

    @Test
    void schedulingExplicitlyEnabled() {
        contextRunner
                .withPropertyValues("spring.task.scheduling.enabled=true")
                .run(context -> {
                    assertThat(context).hasSingleBean(SchedulingConfig.class);
                    assertThat(context).hasSingleBean(ScheduledAnnotationBeanPostProcessor.class);
                });
    }

    @Test
    void schedulingExplicitlyDisabled() {
        contextRunner
                .withPropertyValues("spring.task.scheduling.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(SchedulingConfig.class);
                    assertThat(context).doesNotHaveBean(ScheduledAnnotationBeanPostProcessor.class);
                });
    }
}
