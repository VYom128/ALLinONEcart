/** Design tokens: colours come from CSS variables in global.css (light + dark). */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        'on-primary': token('on-primary'),
        primary: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => [
            step,
            token(`primary-${step}`),
          ]),
        ),
      },
      borderRadius: {
        card: '16px',
        control: '12px',
      },
    },
  },
  plugins: [],
};
