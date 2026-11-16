// Stickers for "Add a prop". The same SVG draws the tray tile, the sticker on the stage (react-native-svg)
// and the copy composited into the captured screenshot inside the 3D WebView, so what the user sees is what Bobo gets.
// `name` is what the backend hears (submitEdit props → director + image edit prompt).

const INK = "#2B2420";

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

// at: where a fresh sticker lands, as fractions of the stage (roughly where it belongs on a centered model).
export type PropKind = { id: string; name: string; label: string; at: [number, number]; svg: string };

export const PROPS: PropKind[] = [
  {
    id: "crown",
    at: [0.5, 0.2],
    name: "gold crown",
    label: "Crown",
    svg: svg(
      `<path d="M9 46 7 18l14 13 11-18 11 18 14-13-2 28z" fill="#F6C744"/><path d="M10 46h44v7H10z" fill="#F6C744"/><circle cx="32" cy="38" r="3.5" fill="#F07B2A"/><circle cx="20" cy="40" r="2.5" fill="#7CC35A"/><circle cx="44" cy="40" r="2.5" fill="#7CC35A"/>`,
    ),
  },
  {
    id: "party-hat",
    at: [0.5, 0.2],
    name: "party hat",
    label: "Party hat",
    svg: svg(
      `<path d="M32 8 14 54h36z" fill="#F07B2A"/><path d="M22 34c6 2 14 2 20 0M18 45c9 2.5 19 2.5 28 0" stroke="#FFF3D6" stroke-width="4"/><path d="M32 8 14 54h36z"/><circle cx="32" cy="8" r="5" fill="#F6C744"/>`,
    ),
  },
  {
    id: "sunglasses",
    at: [0.5, 0.4],
    name: "sunglasses",
    label: "Sunglasses",
    svg: svg(
      `<path d="M5 26h54" /><path d="M8 26c0 9 3 14 10 14s10-5 11-14z" fill="${INK}"/><path d="M35 26c1 9 4 14 11 14s10-5 10-14z" fill="${INK}"/><path d="M13 30l4-2M40 30l4-2" stroke="#FFFFFF" stroke-width="2.5"/>`,
    ),
  },
  {
    id: "flower",
    at: [0.66, 0.3],
    name: "pink flower",
    label: "Flower",
    svg: svg(
      `<circle cx="32" cy="16" r="10" fill="#F4A7B9"/><circle cx="47" cy="28" r="10" fill="#F4A7B9"/><circle cx="41" cy="46" r="10" fill="#F4A7B9"/><circle cx="23" cy="46" r="10" fill="#F4A7B9"/><circle cx="17" cy="28" r="10" fill="#F4A7B9"/><circle cx="32" cy="32" r="8" fill="#F6C744"/>`,
    ),
  },
  {
    id: "bow",
    at: [0.5, 0.56],
    name: "red bow",
    label: "Bow",
    svg: svg(
      `<path d="M30 30C20 16 6 16 7 30s14 16 23 2z" fill="#E5484D"/><path d="M34 30c10-14 24-14 23 0s-14 16-23 2z" fill="#E5484D"/><path d="M28 34l-7 18 7-3 4 6 1-19" fill="#E5484D"/><path d="M36 34l7 18-7-3-4 6-1-19" fill="#E5484D"/><rect x="26" y="25" width="12" height="12" rx="4" fill="#C8402F"/>`,
    ),
  },
];

// A sticker placed on the stage: center and size are fractions of the stage width/height,
// which match the WebView's viewport because the viewer fills the stage.
export type PlacedProp = { key: string; kind: PropKind; x: number; y: number; size: number };

export function propNames(placed: PlacedProp[]): string[] {
  return [...new Set(placed.map((p) => p.kind.name))];
}
