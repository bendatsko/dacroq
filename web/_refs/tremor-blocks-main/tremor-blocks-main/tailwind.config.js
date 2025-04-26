// import type { Config } from "tailwindcss";
import colors from 'tailwindcss/colors';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    transparent: 'transparent',
    current: 'currentColor',
    extend: {
      backgroundImage: {
        'code-fade': `linear-gradient(90deg, rgba(0,0,0,0), rgba(2,6,23,1) 24px)`,
      },
      
      keyframes: {
        flash: {
          '0%': { opacity: '0.2' },
          '20%': { opacity: '1' },
          '100%': { opacity: '0.2' },
        },
        'fade-up': {
          from: {
            opacity: 0,
            transform: 'translateY(16px)',
          },
          to: {
            opacity: 1,
            transform: 'translateY(0px)',
          },
        },
        reveal: {
          '0%': {
            opacity: 0,
            // clipPath: 'inset(5%)',
            transform: 'scale(98%)',
          },
          '100%': {
            opacity: 1,
            // clipPath: 'inset(0)',
            transform: 'scale(1)',
          },
        },
        shimmer: {
          '100%': {
            transform: 'translateX(100%)',
          },
        },
        hide: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        slideDownAndFade: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeftAndFade: {
          from: { opacity: '0', transform: 'translateX(6px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideUpAndFade: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideRightAndFade: {
          from: { opacity: '0', transform: 'translateX(-6px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        accordionOpen: {
          from: { height: '0px' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        accordionClose: {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: { height: '0px' },
        },
        dialogOverlayShow: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        dialogContentShow: {
          from: {
            opacity: '0',
            transform: 'translate(-50%, -45%) scale(0.95)',
          },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        revealBottom: {
          from: {
            opacity: '0',
            transform: 'translateY(12px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0px)',
          },
        },
      },
      animation: {
        flash: 'flash 1.4s infinite linear',
        'fade-up': 'fade-up 800ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        reveal: 'reveal 400ms ease-in-out',
        shimmer: 'shimmer 2s ease-in-out infinite',
        hide: 'hide 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideDownAndFade:
          'slideDownAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideLeftAndFade:
          'slideLeftAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideUpAndFade: 'slideUpAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideRightAndFade:
          'slideRightAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        // Accordion
        accordionOpen: 'accordionOpen 150ms cubic-bezier(0.87, 0, 0.13, 1)',
        accordionClose: 'accordionClose 150ms cubic-bezier(0.87, 0, 0.13, 1)',
        // Dialog
        dialogOverlayShow:
          'dialogOverlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        dialogContentShow:
          'dialogContentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        revealBottom: 'revealBottom 300ms ease-in-out backwards',
      },
      typography: ({ theme }) => ({
        tremor: {
          css: {
            '--tw-prose-body': theme('colors.slate[00]'),
            '--tw-prose-headings': theme('colors.slate[900]'),
            '--tw-prose-lead': theme('colors.slate[700]'),
            '--tw-prose-links': theme('colors.blue[500]'),
            '--tw-prose-bold': theme('colors.slate[900]'),
            '--tw-prose-counters': theme('colors.slate[600]'),
            '--tw-prose-bullets': theme('colors.slate[400]'),
            '--tw-prose-hr': theme('colors.slate[300]'),
            '--tw-prose-quotes': theme('colors.blue[700]'),
            '--tw-prose-quote-borders': theme('colors.blue[700]'),
            '--tw-prose-captions': theme('colors.slate[700]'),
            '--tw-prose-code': theme('colors.slate[800]'),
            '--tw-prose-pre-code': theme('colors.slate[100]'),
            '--tw-prose-pre-bg': theme('colors.slate[900]'),
            '--tw-prose-th-borders': theme('colors.slate[300]'),
            '--tw-prose-td-borders': theme('colors.slate[200]'),
          },
        },
      }),
    },
  },
  plugins: [
    require('@headlessui/tailwindcss'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};
