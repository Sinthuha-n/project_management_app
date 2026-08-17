import axios from "axios";
import { clearTokens, getRefreshToken, getValidToken, getUserFromToken, refreshAccessToken } from "@/lib/auth";
import { buildVerifyEmailPath, isEmailVerificationRequired, rememberPendingVerificationEmail } from "@/lib/email-verification";
import { getApiBaseUrl } from "@/lib/api-base-url";

const api = axios.create({
    withCredentials: true,
});

function resolveBaseUrl(configBaseUrl?: string): string {
    return configBaseUrl || getApiBaseUrl();
}

// Add request interceptor to include auth token (exclude auth endpoints)
api.interceptors.request.use(
    (config) => {
        config.baseURL = resolveBaseUrl(config.baseURL);

        // When data is FormData, remove Content-Type so Axios/browser automatically creates multipart/form-data with boundary
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
            if (config.headers) {
                if (typeof config.headers.delete === 'function') {
                    config.headers.delete('Content-Type');
                    config.headers.delete('content-type');
                }
                delete (config.headers as Record<string, unknown>)['Content-Type'];
                delete (config.headers as Record<string, unknown>)['content-type'];
            }
        }

        // Don't add token to auth endpoints
        const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/forgot', '/api/auth/reset', '/api/auth/reg/verify', '/api/auth/resend', '/api/auth/refresh'];
        const isAuthEndpoint = authEndpoints.some(endpoint => config.url?.includes(endpoint));
        
        if (!isAuthEndpoint && typeof window !== 'undefined') {
            if (hasRedirectedToLogin || (!getValidToken() && !getRefreshToken())) {
                // Short-circuit background polling/requests during logout/redirect to prevent 401 cascades
                const controller = new AbortController();
                controller.abort();
                config.signal = controller.signal;
                return config;
            }

            const token = getValidToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Proactively refresh the access token if it expires within 60 seconds
api.interceptors.request.use(async (config) => {
    config.baseURL = resolveBaseUrl(config.baseURL);

    const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/forgot', '/api/auth/reset', '/api/auth/reg/verify', '/api/auth/resend', '/api/auth/refresh'];
    const isAuthEndpoint = authEndpoints.some(endpoint => config.url?.includes(endpoint));
    if (!isAuthEndpoint && typeof window !== 'undefined' && !hasRedirectedToLogin) {
        try {
            if (!getValidToken()) {
                if (!getRefreshToken()) {
                    return config;
                }
                const newToken = await refreshAccessToken({ allowCookieRefresh: true });
                config.headers['Authorization'] = `Bearer ${newToken}`;
                return config;
            }

            const user = getUserFromToken();
            if (user?.exp && (user.exp - Date.now() / 1000) < 60) {
                if (!getRefreshToken()) {
                    return config;
                }
                const newToken = await refreshAccessToken({ allowCookieRefresh: true });
                config.headers['Authorization'] = `Bearer ${newToken}`;
                return config;
            }
        } catch { /* token expired or invalid — let the 401 handler deal with it */ }
    }
    return config;
});

// Track whether a token refresh is in progress to avoid infinite loop
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];
let hasRedirectedToLogin = false;

if (typeof window !== 'undefined') {
    window.addEventListener('planora-auth-token-changed', () => {
        if (getValidToken()) {
            hasRedirectedToLogin = false;
        }
    });
}

function redirectToLoginOnce() {
    if (typeof window === 'undefined' || hasRedirectedToLogin) return;
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath === '/' || /^\/(login|register|signup|forgot-password|reset-password|verify-email)(\/|$)/.test(currentPath);
    if (isAuthPage) return;

    hasRedirectedToLogin = true;
    clearTokens();
    window.location.href = '/login';
}

function processQueue(error: unknown, token: string | null = null) {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    failedQueue = [];
}

// Add response interceptor to handle auth errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (isEmailVerificationRequired(error, ['EMAIL_NOT_VERIFIED'])) {
            if (typeof window !== 'undefined') {
                const email = getUserFromToken()?.email;
                rememberPendingVerificationEmail(email);
                window.location.assign(buildVerifyEmailPath(email));
            }
            return Promise.reject(error);
        }

        // Don't attempt refresh on auth endpoints
        const authEndpoints = ['/api/auth/login', '/api/auth/forgot', '/api/auth/reset', '/api/auth/register', '/api/auth/reg/verify', '/api/auth/refresh'];
        const isAuthEndpoint = authEndpoints.some(endpoint => originalRequest?.url?.includes(endpoint));

        if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
            if (typeof window !== 'undefined' && !getRefreshToken()) {
                redirectToLoginOnce();
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Wait for the in-progress refresh to complete, then retry
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const newAccessToken = await refreshAccessToken({ allowCookieRefresh: true });
                processQueue(null, newAccessToken);
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                // Only redirect to login if the session is definitively expired (401/403 from refresh).
                // Network errors or 5xx (backend restarting) should NOT force a logout.
                const message = refreshError instanceof Error ? refreshError.message : '';
                if (message.includes('session expired')) {
                    redirectToLoginOnce();
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);


export default api;
