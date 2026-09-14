import React, { useState } from "react";

export function LoginCat() {
  const [speech, setSpeech] = useState("");

  const meows = ["Meow! 🐾", "Meo meo~ 🐱", "Purr... ❤️", "Vocab cat! ✨", "Ngoao~ 🐾"];

  const handleCatClick = () => {
    const randomMeow = meows[Math.floor(Math.random() * meows.length)];
    setSpeech(randomMeow);

    // Play a gentle playful synth meow
    try {
      if (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(550, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.28);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {
      // Ignore audio failure if not allowed
    }

    setTimeout(() => {
      setSpeech("");
    }, 1800);
  };

  return (
    <div className="login-cat-patrol-area" aria-label="Chú mèo đen chạy qua chạy lại">
      <div
        className="pixel-black-cat"
        onClick={handleCatClick}
        title="Nhấn vào chú mèo đen để nghe kêu meow! 🐾"
        role="button"
        tabIndex={0}
      >
        {speech && <div className="cat-speech-bubble">{speech}</div>}

        <svg
          viewBox="0 0 48 38"
          width="46"
          height="36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="cat-svg"
        >
          {/* Soft Ground shadow underneath cat paws */}
          <ellipse cx="24" cy="36" rx="15" ry="2" fill="rgba(30, 20, 10, 0.22)" />

          {/* Animated Swishing Tail */}
          <g className="cat-tail-group">
            <path
              d="M11 25 C7 23 4 17 7 12 C9 9 13 10 12 13 C11 16 12 21 14 24"
              stroke="#18181b"
              strokeWidth="3.4"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* Back Leg Left */}
          <g className="cat-leg-wrap cat-leg-back-left">
            <rect x="12" y="26" width="3.8" height="9.5" rx="1.9" fill="#121214" />
          </g>

          {/* Back Leg Right */}
          <g className="cat-leg-wrap cat-leg-back-right">
            <rect x="17" y="26" width="3.8" height="9.5" rx="1.9" fill="#18181b" />
          </g>

          {/* Body */}
          <rect x="11" y="18" width="22" height="12" rx="6" fill="#18181b" />

          {/* Front Leg Left */}
          <g className="cat-leg-wrap cat-leg-front-left">
            <rect x="25" y="26" width="3.8" height="9.5" rx="1.9" fill="#121214" />
          </g>

          {/* Front Leg Right */}
          <g className="cat-leg-wrap cat-leg-front-right">
            <rect x="30" y="26" width="3.8" height="9.5" rx="1.9" fill="#18181b" />
          </g>

          {/* Cute Red Collar & Golden Bell */}
          <path d="M28 20 C29.5 22.5 33.5 22.5 35 20" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="31.5" cy="22" r="1.6" fill="#fbbf24" />

          {/* Head & Facial Features */}
          <g className="cat-head-group">
            {/* Left Ear */}
            <path d="M27.5 13 L30.5 4.5 L34.5 11 Z" fill="#18181b" />
            <path d="M29 11.5 L31 6.5 L33.5 10.5 Z" fill="#f472b6" />

            {/* Right Ear */}
            <path d="M37 11 L41 4.5 L44 13 Z" fill="#18181b" />
            <path d="M38.5 10.5 L40.8 6.5 L42.5 11.5 Z" fill="#f472b6" />

            {/* Head Base */}
            <ellipse cx="36" cy="15" rx="8" ry="7" fill="#18181b" />

            {/* Eyes (Golden yellow with expressive shine) */}
            <ellipse cx="34" cy="14" rx="2" ry="2.4" fill="#facc15" />
            <ellipse cx="34.2" cy="14" rx="0.8" ry="2" fill="#121214" />
            <circle cx="33.4" cy="13" r="0.65" fill="#ffffff" />

            <ellipse cx="39" cy="14" rx="2" ry="2.4" fill="#facc15" />
            <ellipse cx="39.2" cy="14" rx="0.8" ry="2" fill="#121214" />
            <circle cx="38.4" cy="13" r="0.65" fill="#ffffff" />

            {/* Nose & Mouth */}
            <polygon points="36.5,17 35.6,16 37.4,16" fill="#fb7185" />
            <path d="M35.6 17.4 Q36.5 18.3 37.4 17.4" stroke="#71717a" strokeWidth="0.75" fill="none" />

            {/* Whiskers */}
            <line x1="42" y1="15" x2="47" y2="14" stroke="#a1a1aa" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="42" y1="17" x2="46" y2="18" stroke="#a1a1aa" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="30" y1="15" x2="25" y2="14" stroke="#a1a1aa" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="30" y1="17" x2="26" y2="18" stroke="#a1a1aa" strokeWidth="0.7" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </div>
  );
}
