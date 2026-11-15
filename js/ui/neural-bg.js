// Lightweight SVG neural-synaptic resonance field for cognitive pacing and calm visual depth.
// Pure vector paths + compositor-friendly stroke/transform motion (zero canvas loop overhead).

export function createNeuralBackdrop({ variant = 'portal' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `neural-backdrop is-${variant}`;
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `
    <svg class="neural-svg" viewBox="0 0 960 640" preserveAspectRatio="xMidYMid slice" fill="none">
      <defs>
        <radialGradient id="neuralGlowA" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--l-foundations)" stop-opacity="0.22" />
          <stop offset="100%" stop-color="var(--l-foundations)" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="neuralGlowB" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--l-functions)" stop-opacity="0.2" />
          <stop offset="100%" stop-color="var(--l-functions)" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- Soft circadian ambient fields -->
      <circle class="neural-field is-slow" cx="250" cy="210" r="210" fill="url(#neuralGlowA)" />
      <circle class="neural-field is-alt" cx="690" cy="430" r="230" fill="url(#neuralGlowB)" />

      <!-- Base structural axonal lattice -->
      <g class="neural-tracts" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <path d="M-40 160 C 120 150, 170 250, 310 230 C 440 212, 470 110, 620 135 C 760 158, 820 270, 990 245" />
        <path d="M-30 350 C 130 330, 210 210, 360 265 C 490 312, 540 460, 710 420 C 830 392, 900 320, 1000 355" />
        <path d="M80 -20 C 170 120, 280 140, 310 230 C 345 335, 220 440, 280 650" />
        <path d="M510 -20 C 480 120, 560 190, 620 135 C 710 52, 740 280, 710 420 C 685 535, 760 600, 810 660" />
        <path d="M-20 510 C 170 460, 320 520, 480 410 C 610 320, 730 220, 980 120" />
      </g>

      <!-- Action-potential synaptic pulses -->
      <g class="neural-pulses" stroke-width="2.4" stroke-linecap="round" fill="none">
        <path class="np np-1" pathLength="100" stroke="var(--l-foundations)" d="M-40 160 C 120 150, 170 250, 310 230 C 440 212, 470 110, 620 135 C 760 158, 820 270, 990 245" />
        <path class="np np-2" pathLength="100" stroke="var(--l-functions)" d="M-30 350 C 130 330, 210 210, 360 265 C 490 312, 540 460, 710 420 C 830 392, 900 320, 1000 355" />
        <path class="np np-3" pathLength="100" stroke="var(--l-objects)" d="M80 -20 C 170 120, 280 140, 310 230 C 345 335, 220 440, 280 650" />
        <path class="np np-4" pathLength="100" stroke="var(--l-pro)" d="M-20 510 C 170 460, 320 520, 480 410 C 610 320, 730 220, 980 120" />
      </g>

      <!-- Synaptic soma anchor nodes -->
      <g class="neural-nodes">
        <circle class="nn nn-a" cx="310" cy="230" r="5" fill="var(--l-foundations)" />
        <circle class="nn-ring nn-ring-a" cx="310" cy="230" r="14" stroke="var(--l-foundations)" stroke-width="1.5" />
        <circle class="nn nn-b" cx="620" cy="135" r="4.5" fill="var(--l-functions)" />
        <circle class="nn-ring nn-ring-b" cx="620" cy="135" r="13" stroke="var(--l-functions)" stroke-width="1.5" />
        <circle class="nn nn-c" cx="710" cy="420" r="5" fill="var(--l-objects)" />
        <circle class="nn-ring nn-ring-c" cx="710" cy="420" r="14" stroke="var(--l-objects)" stroke-width="1.5" />
        <circle class="nn nn-d" cx="480" cy="410" r="4.5" fill="var(--l-pro)" />
      </g>
    </svg>
  `;
  return wrap;
}
