// Bohr drawing. Shells come from the data. The picture is a model, not a photo.

const CAP = [2, 8, 18, 32, 32, 18, 8, 2];

export function atomSvg(element, { animate = true } = {}) {
  const shells = element.shells || [];
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const rings = shells.map((count, index) => {
    const radius = 28 + index * 16;
    const dots = [];
    for (let i = 0; i < count; i++) {
      const angle = (-Math.PI / 2) + (i / count) * Math.PI * 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const delay = animate ? (index * 180 + i * 28) : 0;
      dots.push(`<circle class="electron" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" style="animation-delay:${delay}ms" />`);
    }
    const warn = CAP[index] && count < CAP[index] && shells[index + 1] > 0;
    return `<circle class="shell ${warn ? 'early' : ''}" cx="${cx}" cy="${cy}" r="${radius}" />${dots.join('')}`;
  }).join('');
  return `<svg class="atom" viewBox="0 0 ${size} ${size}" role="img" aria-label="${element.symbol}">
    <circle class="nucleus" cx="${cx}" cy="${cy}" r="16" />
    <text x="${cx}" y="${cy + 5}" text-anchor="middle">${element.symbol}</text>
    ${rings}
  </svg>`;
}
