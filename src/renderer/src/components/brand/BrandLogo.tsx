import React from 'react'

interface BrandLogoProps {
    className?: string
    onClick?: () => void
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = 'w-24 h-24', onClick }) => {
    return (
        <svg
            className={`cursor-pointer transition-transform duration-300 hover:scale-105 select-none ${className}`}
            viewBox="0 0 400 400"
            xmlns="http://www.w3.org/2000/svg"
            onClick={onClick}
        >
            <defs>
                <linearGradient id="brandGradient" gradientUnits="userSpaceOnUse" x1="80" y1="0" x2="320" y2="0">
                    <stop offset="0%" stopColor="var(--accent-from, #00e5ff)" />
                    <stop offset="100%" stopColor="var(--accent-to, #b400ff)" />
                </linearGradient>

                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <g filter="url(#glow)">
                {/* Particle Cloud Left & Outer */}
                <g fill="url(#brandGradient)">
                    <circle cx="200" cy="70" r="3" />
                    <circle cx="160" cy="85" r="2" />
                    <circle cx="115" cy="120" r="4" />
                    <circle cx="150" cy="105" r="2" />
                    <circle cx="290" cy="190" r="4" />
                    <circle cx="275" cy="215" r="2" />
                    <circle cx="125" cy="240" r="2" />
                    <circle cx="310" cy="265" r="3" />
                    <circle cx="245" cy="290" r="4" />
                    <circle cx="140" cy="310" r="3" />
                    <circle cx="200" cy="330" r="4" />
                </g>

                {/* Central Core U Path */}
                <path
                    d="M 150 140 L 150 210 A 50 50 0 0 0 250 210 L 250 140"
                    fill="none"
                    stroke="url(#brandGradient)"
                    strokeWidth="26"
                    strokeLinecap="round"
                />

                {/* Particle Cloud Right & Outer */}
                <g fill="url(#brandGradient)">
                    <circle cx="240" cy="80" r="4" />
                    <circle cx="220" cy="100" r="2" />
                    <circle cx="180" cy="110" r="4" />
                    <circle cx="245" cy="110" r="2" />
                    <circle cx="280" cy="115" r="3" />
                    <circle cx="310" cy="160" r="2" />
                    <circle cx="90" cy="170" r="3" />
                    <circle cx="115" cy="200" r="5" />
                    <circle cx="325" cy="210" r="4" />
                    <circle cx="85" cy="220" r="2" />
                    <circle cx="285" cy="240" r="3" />
                    <circle cx="145" cy="265" r="2" />
                    <circle cx="105" cy="270" r="4" />
                    <circle cx="170" cy="290" r="5" />
                    <circle cx="210" cy="305" r="2" />
                    <circle cx="270" cy="315" r="2" />
                </g>
            </g>
        </svg>
    )
}