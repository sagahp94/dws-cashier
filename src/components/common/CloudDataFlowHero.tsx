import React, { useMemo } from 'react';

interface CloudDataFlowHeroProps {
  progress: number; // 0 to 100
  status: 'idle' | 'syncing' | 'completed' | 'error';
  errorMessage?: string;
}

export const CloudDataFlowHero: React.FC<CloudDataFlowHeroProps> = ({
  progress,
  status,
  errorMessage,
}) => {
  const isCompleted = status === 'completed';
  const isError = status === 'error';
  const isSyncing = status === 'syncing' || status === 'idle';

  // Cloud dimensions: viewBox="0 0 320 240"
  // Cloud path bounds:
  // Left: 28, Right: 298. Width: 270. Center X: 163.
  // Top: 18, Bottom: 155. Height: 137. Center Y: 86.5.
  const cloudPath =
    'M 75 155 C 48 155 28 138 28 112 C 28 88 44 71 67 67 C 73 39 101 18 135 18 C 164 18 189 34 199 59 C 209 53 221 49 234 49 C 264 49 288 73 288 102 C 288 105 287 109 286 112 C 293 119 298 128 298 139 C 298 152 288 155 275 155 Z';

  // Calculate liquid fill level from real progress percentage (0 to 100)
  // 0% -> y = 155 (empty, outline only)
  // 100% -> y = 18 (fully filled)
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const fillY = 155 - (clampedProgress / 100) * 137;

  // Stream Bézier curve paths (converging upwards from bottom)
  const streamPaths = [
    { id: 's1', d: 'M 65 230 C 75 198 92 176 108 155', dur: '1.4s', delay: '0s', color: '#00C9A7' },
    { id: 's2', d: 'M 110 235 C 118 198 128 176 136 155', dur: '1.8s', delay: '0.4s', color: '#398BFF' },
    { id: 's3', d: 'M 160 240 C 160 200 160 176 160 155', dur: '1.2s', delay: '0.2s', color: '#00C9A7' },
    { id: 's4', d: 'M 210 235 C 202 198 192 176 184 155', dur: '1.7s', delay: '0.6s', color: '#398BFF' },
    { id: 's5', d: 'M 255 230 C 245 198 228 176 212 155', dur: '1.5s', delay: '0.3s', color: '#00C9A7' },
  ];

  // Confetti particles for completion
  const confettiPieces = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      x: 35 + (i * 14) % 250,
      y: 20 + ((i * 23) % 120),
      size: 4 + (i % 3) * 2,
      color: ['#00C9A7', '#398BFF', '#10B981', '#38BDF8', '#F59E0B'][i % 5],
      delay: (i * 0.08).toFixed(2),
      duration: (1.4 + (i % 4) * 0.3).toFixed(2),
    }));
  }, []);

  // Cloud burst light particles
  const burstParticles = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const angle = (i * 30 * Math.PI) / 180;
      const distance = 46 + (i % 3) * 12;
      return {
        id: i,
        cx: 160 + Math.cos(angle) * distance,
        cy: 86.5 + Math.sin(angle) * distance,
        r: 3 + (i % 2) * 1.5,
      };
    });
  }, []);

  return (
    <div className="relative w-full flex flex-col items-center justify-center py-2 select-none">
      {/* 3D Perspective Stage for Cloud and Celebration */}
      <div
        className="relative w-full max-w-[320px] aspect-[4/3] flex items-center justify-center"
        style={{ perspective: '1000px' }}
      >
        {/* Main SVG Hero Canvas */}
        <svg
          viewBox="0 0 320 240"
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Cloud Clip Path */}
            <clipPath id="cloudShapeClip">
              <path d={cloudPath} />
            </clipPath>

            {/* Liquid Fill Gradient (Teal #00C9A7 to Royal Blue #398BFF) */}
            <linearGradient id="cloudLiquidGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#00C9A7" />
              <stop offset="60%" stopColor="#1EAEFF" />
              <stop offset="100%" stopColor="#398BFF" />
            </linearGradient>

            {/* Error Liquid Fill Gradient */}
            <linearGradient id="cloudLiquidErrorGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#FB7185" />
            </linearGradient>

            {/* Ambient Internal Glow */}
            <radialGradient id="cloudInnerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#398BFF" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#00C9A7" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#00C9A7" stopOpacity="0" />
            </radialGradient>

            {/* Stream Light Glow Filter */}
            <filter id="streamGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Cloud Outer Bloom Filter */}
            <filter id="cloudBloom" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
              <feFlood
                floodColor={isCompleted ? '#00C9A7' : isError ? '#F43F5E' : '#398BFF'}
                floodOpacity={isCompleted ? '0.45' : '0.25'}
                result="color"
              />
              <feComposite in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* SECTION A: Upward Data Flow Streams (Active during sync) */}
          <g
            className={`transition-opacity duration-500 ${
              isSyncing ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {streamPaths.map((stream) => (
              <g key={stream.id}>
                {/* Guide track */}
                <path
                  d={stream.d}
                  fill="none"
                  stroke={stream.color}
                  strokeWidth="1.2"
                  strokeOpacity="0.22"
                  strokeDasharray="3 3"
                />

                {/* Animated Light Packet */}
                <path
                  d={stream.d}
                  fill="none"
                  stroke={stream.color}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  filter="url(#streamGlow)"
                  className="cloud-stream-packet"
                  style={{
                    animation: `streamFlow ${stream.dur} cubic-bezier(0.4, 0, 0.2, 1) infinite`,
                    animationDelay: stream.delay,
                  }}
                />

                {/* Leading Particle Head */}
                <circle
                  r="2.5"
                  fill="#FFFFFF"
                  filter="url(#streamGlow)"
                  className="cloud-stream-dot"
                >
                  <animateMotion
                    path={stream.d}
                    dur={stream.dur}
                    begin={stream.delay}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ))}
          </g>

          {/* SECTION B & C: Cloud Entity with 3D Y-Axis Rotation on 100% */}
          <g
            className={`transform-gpu origin-[160px_86.5px] ${
              isCompleted
                ? 'cloud-rotate-celebrate'
                : ''
            }`}
            style={{
              transformBox: 'view-box',
              transformOrigin: '160px 86.5px',
            }}
          >
            {/* Outer Cloud Ambient Shadow / Glow Base */}
            <path
              d={cloudPath}
              fill={isCompleted ? '#ECFDF5' : isError ? '#FFF1F2' : '#F0F9FF'}
              stroke="none"
              filter="url(#cloudBloom)"
            />

            {/* Internal Liquid Fill Group (Clipped strictly by cloud silhouette) */}
            <g clipPath="url(#cloudShapeClip)">
              {/* Cloud Empty Base Fill */}
              <rect
                x="20"
                y="10"
                width="280"
                height="160"
                fill={isCompleted ? '#D1FAE5' : isError ? '#FFE4E6' : '#E0F2FE'}
                opacity="0.35"
              />

              {/* Ambient radial lighting inside cloud */}
              <circle cx="160" cy="85" r="90" fill="url(#cloudInnerGlow)" />

              {/* Liquid Level Group positioned strictly at fillY */}
              <g
                className="transition-transform duration-700 ease-out"
                style={{
                  transform: `translateY(${fillY}px)`,
                }}
              >
                {/* Secondary Wave Layer (Back wave, slight offset for liquid depth) */}
                <path
                  d="M -160 0 Q -120 -5, -80 0 T 0 0 T 80 0 T 160 0 T 240 0 T 320 0 T 400 0 T 480 0 L 480 180 L -160 180 Z"
                  fill={isError ? 'url(#cloudLiquidErrorGrad)' : 'url(#cloudLiquidGrad)'}
                  opacity="0.45"
                  className={isSyncing ? 'cloud-wave-back' : ''}
                />

                {/* Primary Wave Layer (Foreground wave with crisp surface meniscus) */}
                <path
                  d="M -160 0 Q -120 5, -80 0 T 0 0 T 80 0 T 160 0 T 240 0 T 320 0 T 400 0 T 480 0 L 480 180 L -160 180 Z"
                  fill={isError ? 'url(#cloudLiquidErrorGrad)' : 'url(#cloudLiquidGrad)'}
                  opacity="0.92"
                  className={isSyncing ? 'cloud-wave-front' : ''}
                />

                {/* Liquid Surface Gleam / Highlight line */}
                <line
                  x1="20"
                  y1="0"
                  x2="300"
                  y2="0"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
              </g>
            </g>

            {/* Cloud Outline Frame (Crisp vector stroke) */}
            <path
              d={cloudPath}
              fill="none"
              stroke={
                isCompleted
                  ? '#059669'
                  : isError
                  ? '#E11D48'
                  : clampedProgress > 0
                  ? '#0284C7'
                  : '#94A3B8'
              }
              strokeWidth={isCompleted ? '3' : '2.5'}
              strokeLinejoin="round"
              className="transition-colors duration-500"
            />

            {/* Celebration Cloud Burst Particles */}
            {isCompleted && (
              <g className="cloud-burst-group">
                {burstParticles.map((p) => (
                  <circle
                    key={p.id}
                    cx={p.cx}
                    cy={p.cy}
                    r={p.r}
                    fill={p.id % 2 === 0 ? '#00C9A7' : '#398BFF'}
                    className="cloud-burst-particle"
                  />
                ))}
              </g>
            )}

            {/* 100% Celebration Central Morphing Checkmark */}
            {isCompleted && (
              <g
                className="cloud-checkmark-appear origin-center"
                style={{
                  transformBox: 'view-box',
                  transformOrigin: '160px 86.5px',
                }}
              >
                {/* White circular backdrop badge for checkmark */}
                <circle
                  cx="160"
                  cy="86.5"
                  r="24"
                  fill="#FFFFFF"
                  filter="url(#streamGlow)"
                  className="shadow-md"
                />
                <circle
                  cx="160"
                  cy="86.5"
                  r="24"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                />

                {/* Animated Stroke-Draw Green Checkmark */}
                <path
                  d="M 149 86.5 L 157 94.5 L 172 78.5"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cloud-check-stroke"
                />
              </g>
            )}

            {/* Error Icon Indicator when failed */}
            {isError && (
              <g
                className="origin-center"
                style={{
                  transformBox: 'view-box',
                  transformOrigin: '160px 86.5px',
                }}
              >
                <circle cx="160" cy="86.5" r="22" fill="#FFE4E6" stroke="#F43F5E" strokeWidth="2.5" />
                <path
                  d="M 152 78.5 L 168 94.5 M 168 78.5 L 152 94.5"
                  fill="none"
                  stroke="#E11D48"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>

          {/* Celebration Floating Confetti */}
          {isCompleted && (
            <g className="cloud-confetti-group pointer-events-none">
              {confettiPieces.map((c) => (
                <rect
                  key={c.id}
                  x={c.x}
                  y={c.y}
                  width={c.size}
                  height={c.size * 1.4}
                  rx="1"
                  fill={c.color}
                  className="cloud-confetti-item"
                  style={{
                    animationDelay: `${c.delay}s`,
                    animationDuration: `${c.duration}s`,
                  }}
                />
              ))}
            </g>
          )}
        </svg>

        {/* Embedded Scoped CSS Animations for 60fps Liquid Flow */}
        <style>{`
          @keyframes streamFlow {
            0% {
              stroke-dasharray: 0, 160;
              stroke-dashoffset: 0;
              opacity: 0;
            }
            15% {
              opacity: 1;
            }
            80% {
              stroke-dasharray: 45, 160;
              opacity: 0.95;
            }
            100% {
              stroke-dasharray: 45, 160;
              stroke-dashoffset: -140;
              opacity: 0;
            }
          }

          @keyframes waveDriftFront {
            0% { transform: translateX(0); }
            100% { transform: translateX(-160px); }
          }

          @keyframes waveDriftBack {
            0% { transform: translateX(-160px); }
            100% { transform: translateX(0); }
          }

          .cloud-wave-front {
            animation: waveDriftFront 3.8s linear infinite;
          }

          .cloud-wave-back {
            animation: waveDriftBack 5.2s linear infinite;
          }

          /* 3D Vertical Rotation Celebration */
          @keyframes cloudRotateY {
            0% {
              transform: rotateY(0deg) scale(1);
            }
            40% {
              transform: rotateY(180deg) scale(1.06);
            }
            80% {
              transform: rotateY(360deg) scale(1);
            }
            100% {
              transform: rotateY(360deg) scale(1);
            }
          }

          .cloud-rotate-celebrate {
            animation: cloudRotateY 1.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          }

          /* Checkmark Morphing Scale-in & Stroke Draw */
          @keyframes checkmarkAppear {
            0% {
              transform: scale(0);
              opacity: 0;
            }
            60% {
              transform: scale(1.15);
              opacity: 1;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes checkStrokeDraw {
            0% {
              stroke-dasharray: 40;
              stroke-dashoffset: 40;
            }
            100% {
              stroke-dasharray: 40;
              stroke-dashoffset: 0;
            }
          }

          .cloud-checkmark-appear {
            animation: checkmarkAppear 0.55s 0.85s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }

          .cloud-check-stroke {
            animation: checkStrokeDraw 0.45s 1.05s ease-out both;
          }

          /* Cloud Burst Particle Animation */
          @keyframes burstExpand {
            0% {
              transform: scale(0.2);
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              transform: scale(1.3);
              opacity: 0;
            }
          }

          .cloud-burst-particle {
            transform-origin: 160px 86.5px;
            animation: burstExpand 0.75s 0.15s ease-out forwards;
          }

          /* Confetti Drift */
          @keyframes confettiFloat {
            0% {
              transform: translateY(-10px) rotate(0deg);
              opacity: 0;
            }
            20% {
              opacity: 1;
            }
            100% {
              transform: translateY(60px) rotate(320deg);
              opacity: 0;
            }
          }

          .cloud-confetti-item {
            animation: confettiFloat 1.8s ease-out forwards;
          }

          @media (prefers-reduced-motion: reduce) {
            .cloud-wave-front,
            .cloud-wave-back,
            .cloud-stream-packet,
            .cloud-stream-dot,
            .cloud-rotate-celebrate,
            .cloud-confetti-item {
              animation: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
