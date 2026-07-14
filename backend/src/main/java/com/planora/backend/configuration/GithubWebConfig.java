package com.planora.backend.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class GithubWebConfig implements WebMvcConfigurer {

    private final GithubIntegrationInterceptor interceptor;

    public GithubWebConfig(GithubIntegrationInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor)
                .addPathPatterns("/api/github/**", "/api/projects/*/automations/github/**", "/api/users/me/github-username/**")
                .excludePathPatterns("/api/github/mobile/oauth/callback");
    }
}
