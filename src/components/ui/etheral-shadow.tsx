'use client';

import React, { useRef, useId, useEffect, CSSProperties } from 'react';
import { animate, useMotionValue, AnimationPlaybackControls } from 'framer-motion';

interface AnimationConfig {
    scale: number;
    speed: number;
}

interface NoiseConfig {
    opacity: number;
    scale: number;
}

interface EtheralShadowProps {
    sizing?: 'fill' | 'stretch';
    color?: string;
    animation?: AnimationConfig;
    noise?: NoiseConfig;
    style?: CSSProperties;
    className?: string;
}

function mapRange(
    value: number,
    fromLow: number,
    fromHigh: number,
    toLow: number,
    toHigh: number
): number {
    if (fromLow === fromHigh) {
        return toLow;
    }
    const percentage = (value - fromLow) / (fromHigh - fromLow);
    return toLow + percentage * (toHigh - toLow);
}

const useInstanceId = (): string => {
    const id = useId();
    const cleanId = id.replace(/:/g, "");
    return `shadowoverlay-${cleanId}`;
};

export function EtheralShadow({
    sizing = 'fill',
    color = 'rgba(128, 128, 128, 1)',
    animation,
    noise,
    style,
    className
}: EtheralShadowProps) {
    const id = useInstanceId();
    const noiseId = `${id}-noise`;
    const gradientId = `${id}-gradient`;
    const animationEnabled = animation && animation.scale > 0;
    const feColorMatrixRef = useRef<SVGFEColorMatrixElement>(null);
    const hueRotateMotionValue = useMotionValue(180);
    const hueRotateAnimation = useRef<AnimationPlaybackControls | null>(null);

    const displacementScale = animation ? mapRange(animation.scale, 1, 100, 20, 100) : 0;
    const animationDuration = animation ? mapRange(animation.speed, 1, 100, 1000, 50) : 1;

    useEffect(() => {
        if (feColorMatrixRef.current && animationEnabled) {
            if (hueRotateAnimation.current) {
                hueRotateAnimation.current.stop();
            }
            hueRotateMotionValue.set(0);
            hueRotateAnimation.current = animate(hueRotateMotionValue, 360, {
                duration: animationDuration / 25,
                repeat: Infinity,
                repeatType: "loop",
                repeatDelay: 0,
                ease: "linear",
                delay: 0,
                onUpdate: (value: number) => {
                    if (feColorMatrixRef.current) {
                        feColorMatrixRef.current.setAttribute("values", String(value));
                    }
                }
            });

            return () => {
                if (hueRotateAnimation.current) {
                    hueRotateAnimation.current.stop();
                }
            };
        }
    }, [animationEnabled, animationDuration, hueRotateMotionValue]);

    return (
        <div
            className={className}
            style={{
                overflow: "hidden",
                position: "relative",
                width: "100%",
                height: "100%",
                backgroundColor: "#060d0b",
                ...style
            }}
        >
            {/* SVG filter + inline mask (no external URLs) */}
            <svg style={{ position: "absolute", width: 0, height: 0 }}>
                <defs>
                    {animationEnabled && (
                        <filter id={id}>
                            <feTurbulence
                                result="undulation"
                                numOctaves="3"
                                baseFrequency={`${mapRange(animation.scale, 0, 100, 0.002, 0.001)},${mapRange(animation.scale, 0, 100, 0.006, 0.003)}`}
                                seed="0"
                                type="turbulence"
                            />
                            <feColorMatrix
                                ref={feColorMatrixRef}
                                in="undulation"
                                type="hueRotate"
                                values="180"
                            />
                            <feColorMatrix
                                in="dist"
                                result="circulation"
                                type="matrix"
                                values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0"
                            />
                            <feDisplacementMap
                                in="SourceGraphic"
                                in2="circulation"
                                scale={displacementScale}
                                result="dist"
                            />
                            <feDisplacementMap
                                in="dist"
                                in2="undulation"
                                scale={displacementScale}
                                result="output"
                            />
                        </filter>
                    )}
                    {/* Inline noise filter */}
                    <filter id={noiseId}>
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.65"
                            numOctaves="3"
                            stitchTiles="stitch"
                        />
                    </filter>
                    {/* Radial gradient mask so edges fade to dark */}
                    <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="white" stopOpacity="1" />
                        <stop offset="70%" stopColor="white" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                </defs>
            </svg>

            {/* Main shadow layer */}
            <div
                style={{
                    position: "absolute",
                    inset: animationEnabled ? -displacementScale : 0,
                    filter: animationEnabled ? `url(#${id}) blur(6px)` : "none"
                }}
            >
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        background: `radial-gradient(ellipse at 30% 40%, ${color} 0%, rgba(8, 22, 18, 0.8) 40%, rgba(6, 14, 12, 0.4) 70%, transparent 100%),
                                     radial-gradient(ellipse at 70% 60%, rgba(15, 55, 45, 0.5) 0%, rgba(8, 25, 20, 0.25) 50%, transparent 100%)`,
                    }}
                />
            </div>

            {/* Noise texture overlay */}
            {noise && noise.opacity > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        opacity: noise.opacity * 0.4,
                        filter: `url(#${noiseId})`,
                        mixBlendMode: "soft-light",
                    }}
                />
            )}

            {/* Vignette — darkens edges */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(ellipse at center, transparent 30%, rgba(4, 10, 8, 0.85) 100%)",
                }}
            />
        </div>
    );
}
