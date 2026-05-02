/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Michroma', 'sans-serif'], // For headers and tech accents
            },
            colors: {
                brand: {
                    50: 'rgb(var(--brand-50) / <alpha-value>)',
                    100: 'rgb(var(--brand-100) / <alpha-value>)',
                    200: 'rgb(var(--brand-200) / <alpha-value>)',
                    300: 'rgb(var(--brand-300) / <alpha-value>)',
                    400: 'rgb(var(--brand-400) / <alpha-value>)',
                    500: 'rgb(var(--brand-500) / <alpha-value>)',
                    600: 'rgb(var(--brand-600) / <alpha-value>)',
                    700: 'rgb(var(--brand-700) / <alpha-value>)',
                    800: 'rgb(var(--brand-800) / <alpha-value>)',
                    900: 'rgb(var(--brand-900) / <alpha-value>)',
                    950: '#0a0a0f', // Deep dark for backgrounds
                },
                surface: {
                    DEFAULT: '#0f1115', // Dashboard surface
                    hover: '#15181e',
                    border: '#1f242d',
                }
            },
            transitionTimingFunction: {
                'aero': 'cubic-bezier(0.85, 0, 0.15, 1)', // "Zero to Sixty" acceleration
            },
            boxShadow: {
                'hud': '0 0 15px rgba(var(--brand-500), 0.1)',
                'hud-glow': '0 0 25px rgba(var(--brand-500), 0.25)',
                'glass-inner': 'inset 0 1px 1px rgba(255, 255, 255, 0.05), inset 0 -1px 1px rgba(0, 0, 0, 0.5)',
            },
            backgroundImage: {
                'glass-gradient': 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                'metallic-border': 'linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.1))',
            }
        },
    },
    plugins: [],
}
