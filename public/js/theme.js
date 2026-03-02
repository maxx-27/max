/**
 * maxs1el Theme Switcher — Manages theme color persistence via localStorage
 */
const ThemeManager = {
    STORAGE_KEY: 'maxs1el_theme',

    themes: {
        cyan: {
            name: 'Cyan Neon',
            primary: '#0df2f2',
            variables: {
                '--color-primary': '#0df2f2',
                '--tw-primary': '13 242 242',
            }
        },
        purple: {
            name: 'Cyber Purple',
            primary: '#a855f7',
            variables: {
                '--color-primary': '#a855f7',
                '--tw-primary': '168 85 247',
            }
        },
        green: {
            name: 'Matrix Green',
            primary: '#22c55e',
            variables: {
                '--color-primary': '#22c55e',
                '--tw-primary': '34 197 94',
            }
        },
        pink: {
            name: 'Vapor Pink',
            primary: '#ec4899',
            variables: {
                '--color-primary': '#ec4899',
                '--tw-primary': '236 72 153',
            }
        }
    },

    getCurrentTheme() {
        return localStorage.getItem(this.STORAGE_KEY) || 'cyan';
    },

    setTheme(themeKey) {
        if (!this.themes[themeKey]) return;

        localStorage.setItem(this.STORAGE_KEY, themeKey);
        this.applyTheme(themeKey);
    },

    applyTheme(themeKey) {
        const theme = this.themes[themeKey || this.getCurrentTheme()];
        if (!theme) return;

        // Update CSS custom properties
        const root = document.documentElement;
        Object.entries(theme.variables).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Update Tailwind config primary color dynamically
        if (window.tailwind && window.tailwind.config) {
            window.tailwind.config.theme.extend.colors.primary = theme.primary;
        }

        // Update all elements that use the primary color class directly
        document.querySelectorAll('.text-primary').forEach(el => {
            el.style.color = theme.primary;
        });
        document.querySelectorAll('.bg-primary').forEach(el => {
            el.style.backgroundColor = theme.primary;
        });
        document.querySelectorAll('.border-primary').forEach(el => {
            el.style.borderColor = theme.primary;
        });
    },

    init() {
        this.applyTheme(this.getCurrentTheme());
    }
};

// Auto-apply theme on load
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
});
