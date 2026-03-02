/**
 * maxs1el API Client — Shared utilities for all frontend pages
 */
const API = {
    BASE_URL: '',

    // ─── Token Management ───
    getToken() {
        return localStorage.getItem('maxs1el_token');
    },

    setToken(token) {
        localStorage.setItem('maxs1el_token', token);
    },

    removeToken() {
        localStorage.removeItem('maxs1el_token');
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    // ─── HTTP Methods ───
    async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        const headers = {
            ...options.headers,
        };

        // Add auth token if available
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Don't set Content-Type for FormData (browser sets boundary automatically)
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    this.removeToken();
                    if (window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('login')) {
                        window.location.href = '/admin/login';
                    }
                }
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (err) {
            console.error(`API Error [${endpoint}]:`, err.message);
            throw err;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        const options = { method: 'POST' };
        if (body instanceof FormData) {
            options.body = body;
        } else {
            options.body = JSON.stringify(body);
        }
        return this.request(endpoint, options);
    },

    put(endpoint, body) {
        const options = { method: 'PUT' };
        if (body instanceof FormData) {
            options.body = body;
        } else {
            options.body = JSON.stringify(body);
        }
        return this.request(endpoint, options);
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // ─── Convenience Methods ───
    async login(username, password) {
        const data = await this.post('/api/auth/login', { username, password });
        if (data.token) {
            this.setToken(data.token);
        }
        return data;
    },

    logout() {
        this.removeToken();
        window.location.href = '/admin/login';
    },

    // ─── Track Page Visit ───
    trackVisit() {
        this.post('/api/analytics/visit', { path: window.location.pathname }).catch(() => { });
    },

    // ─── Track Link Click ───
    trackClick(linkId) {
        return this.post(`/api/links/click/${linkId}`);
    }
};

// Auto track visit on page load
document.addEventListener('DOMContentLoaded', () => {
    API.trackVisit();
});
