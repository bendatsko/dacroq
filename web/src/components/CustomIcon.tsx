// Option 1: Clean Crossbar Pattern (Recommended)
import React from 'react';

interface DacroqLogoProps {
    className?: string;
    size?: number;
}

export const DacroqLogo: React.FC<DacroqLogoProps> = ({
                                                          className = "h-5 w-5",
                                                          size = 20
                                                      }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Chip outline - tighter padding */}
            <rect
                x="3"
                y="3"
                width="26"
                height="26"
                rx="4"
                fill="currentColor"
            />

            {/* Clean crossbar pattern */}
            <g transform="translate(8, 8)">
                {/* Primary active connections - diagonal pattern */}
                <circle cx="2" cy="2" r="1.8" className="fill-background/95" />
                <circle cx="14" cy="2" r="1.8" className="fill-background/95" />
                <circle cx="8" cy="8" r="1.8" className="fill-background/95" />
                <circle cx="2" cy="14" r="1.8" className="fill-background/95" />
                <circle cx="14" cy="14" r="1.8" className="fill-background/95" />

                {/* Secondary connections - smaller, creating flow */}
                <circle cx="8" cy="2" r="1" className="fill-background/40" />
                <circle cx="2" cy="8" r="1" className="fill-background/40" />
                <circle cx="14" cy="8" r="1" className="fill-background/40" />
                <circle cx="8" cy="14" r="1" className="fill-background/40" />

                {/* Connection flow lines - only meaningful ones */}
                <g className="stroke-background/60" strokeWidth="1" fill="none">
                    <path d="M2,2 L8,8" strokeLinecap="round" opacity="0.8" />
                    <path d="M8,8 L14,14" strokeLinecap="round" opacity="0.8" />
                    <path d="M14,2 L8,8" strokeLinecap="round" opacity="0.8" />
                    <path d="M8,8 L2,14" strokeLinecap="round" opacity="0.8" />
                </g>
            </g>
        </svg>
    );
};