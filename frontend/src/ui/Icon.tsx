/** Eigene Strich-Icons (24×24, currentColor) – keine Icon-Bibliothek nötig. */
const PATHS: Record<string, string> = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 4l9 16H3zM12 10v4M12 17.5v.01',
  camera: 'M4 8h3l2-2.5h6L17 8h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  pen: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  share: 'M12 4v11M8 8l4-4 4 4M5 13v7h14v-7',
  download: 'M12 4v11M8 11l4 4 4-4M5 20h14',
  key: 'M8 15a4 4 0 110-8 4 4 0 010 8zM11.5 11H20M17 11v3M20 11v2',
  gauge: 'M4 16a8 8 0 1116 0M12 16l4-5M3 20h18',
  reset: 'M5 12a7 7 0 117 7M5 12V7M5 12h5',
  chevronDown: 'M6 9l6 6 6-6',
  // Prüfpunkte
  wall: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v5M15 10v5M9 15v4',
  floor: 'M3 8l9-4 9 4-9 4zM3 8v8l9 4 9-4V8',
  ceiling: 'M3 5h18M12 5v5M8 14a4 4 0 008 0z',
  window: 'M5 4h14v16H5zM12 4v16M5 12h14',
  door: 'M6 21V3h11v18M14 12h.01M3 21h18',
  radiator: 'M5 6v12M9 6v12M13 6v12M17 6v12M3 18h18M3 6h18',
  tiles: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  socket: 'M5 5h14v14H5zM10 10v.01M14 10v.01M9 15h6',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0012 3z',
  water: 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',
  sparkle: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18',
  oven: 'M4 4h16v16H4zM4 9h16M8 6.5h.01M12 6.5h.01M8 13h8v4H8z',
  fridge: 'M6 3h12v18H6zM6 10h12M9 6v2M9 13v3',
  shower: 'M4 20V8a4 4 0 018 0M9 8h6M10 12v1M13 12v1M16 12v1M10 16v1M13 16v1M16 16v1',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  smoke: 'M12 12a3 3 0 100-.01M5 9a8 8 0 0114 0M7 19h10',
  fence: 'M4 20V7l2-2 2 2v13M10 20V7l2-2 2 2v13M16 20V7l2-2 2 2v13M3 11h18M3 16h18',
};

export type IconKey = keyof typeof PATHS;

export function Icon({ name, size = 20, title }: { name: string; size?: number; title?: string }) {
  const d = PATHS[name] ?? PATHS.box;
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (!title) {
    return (
      <svg {...shared} aria-hidden={true}>
        <path d={d} />
      </svg>
    );
  }
  return (
    <svg {...shared} role="img">
      <title>{title}</title>
      <path d={d} />
    </svg>
  );
}
