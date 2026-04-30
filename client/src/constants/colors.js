// Projabze CAD renk paleti — merkezi renk yönetimi
// Tüm viewer bileşenleri bu sabitten yararlanır, hardcode renk kullanmaz.

export const COLORS = {
  symbol: {
    default:  0x2c3e50,
    selected: 0x3b82f6,
    hover:    0x60a5fa,
    error:    0xef4444,
    warning:  0xf59e0b,
    disabled: 0x9ca3af,
  },
  wall: {
    default:  0x374151,
    selected: 0x6366f1,
  },
  cable: {
    phase:    0xef4444,
    neutral:  0x3b82f6,
    ground:   0x22c55e,
    selected: 0xfbbf24,
  },
  area: {
    room:     0xf1f5f9,
    selected: 0xdbeafe,
  },
  grid:       0xe2e8f0,
  selection: {
    outline:  0x3b82f6,
    box:      0x93c5fd,
    windowFill:   'rgba(59,130,246,0.2)',
    windowBorder: '#3b82f6',
    crossFill:    'rgba(34,197,94,0.2)',
    crossBorder:  '#22c55e',
  },
  paint: {
    mavi:  { hex: 0x3b82f6, ad: 'Mavi' },
    gri:   { hex: 0x6b7280, ad: 'Gri' },
    beyaz: { hex: 0xffffff, ad: 'Beyaz' },
  },
}

export default COLORS
