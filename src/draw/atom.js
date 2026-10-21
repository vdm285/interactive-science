// Bohr drawing from the shells array. The picture is a model, not a photograph, and the caption says so.

import { svg } from 'lit';

const CAP = [2, 8, 18, 32, 32, 18, 8, 2];

export function atomSvg(element, { animate = true, size = 320, color = '#e8c872' } = {}) {
  const shells = element.shells || [];
  const cx = size / 2;
  const cy = size / 2;
  const step = (size / 2 - 26) / Math.max(shells.length, 1);
  const rings = shells.map((count, index) => {
    const radius = 24 + (index + 1) * step;
    const dots = [];
    const show = Math.min(count, 32);
    for (let i = 0; i < show; i++) {
      const angle = (-Math.PI / 2) + (i / show) * Math.PI * 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      dots.push(svg`<circle class="electron" cx=${x.toFixed(1)} cy=${y.toFixed(1)} r=${index === shells.length - 1 ? 3.4 : 2.6} style=${animate ? `animation-delay:${index * 160 + i * 18}ms` : ''} />`);
    }
    const early = CAP[index] && count < CAP[index] && shells[index + 1] > 0;
    const dur = 40 + index * 18;
    return svg`<g class="ring ${animate ? 'spin' : ''}" style=${animate ? `animation-duration:${dur}s;transform-origin:${cx}px ${cy}px` : ''}>
      <circle class="shell ${early ? 'early' : ''}" cx=${cx} cy=${cy} r=${radius} />
      ${dots}
      ${count > 32 ? svg`<text class="more" x=${cx} y=${(cy - radius + 12).toFixed(1)}>${count}</text>` : ''}
    </g>`;
  });
  return svg`<svg class="atom" viewBox="0 0 ${size} ${size}" role="img" aria-label=${`${element.symbol}, ${shells.join('-')}`}>
    <circle class="nucleus" cx=${cx} cy=${cy} r="18" fill=${color} />
    <text class="symbol" x=${cx} y=${cy + 5} text-anchor="middle">${element.symbol}</text>
    ${rings}
  </svg>`;
}
