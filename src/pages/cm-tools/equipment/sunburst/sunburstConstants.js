// Color palette - balanced medium tones with good contrast for dark text
export const baseColors = [
  "#5BA3C0", // steel blue
  "#E8B84A", // golden yellow
  "#6BBF70", // grass green
  "#E07B7B", // salmon red
  "#A67BBF", // medium purple
  "#4DBFB0", // teal
  "#E8945A", // burnt orange
  "#7B9FBF", // slate blue
  "#5BBF8A", // sea green
  "#BF8A5B", // caramel
  "#BF5B8A", // raspberry
  "#5B8ABF", // ocean blue
  "#8ABF5B", // lime
  "#BF5B5B", // brick red
  "#D4A84A", // amber
  "#8A8A9F", // cool gray
  "#6B7BBF", // periwinkle
  "#4AA87B", // jade
  "#C99B6B", // tan
  "#9B6BC9", // violet
  "#7BBF7B", // fern green
];

// Label colors for standard vs misc
export const LABEL_COLOR_STANDARD = "#1a1a1a"; // near black
export const LABEL_COLOR_MISC = "#8B0000"; // dark red

// Animation timing
export const ANIMATION_DURATION = 500;

// Angular gaps (in radians)
export const SEGMENT_GAP = 0.01;

// Ring gap as fraction of radius
export const RING_GAP_FRACTION = 0.0075;

// Pagination constants
export const MODEL_PAGE_SIZE = 51; // Maximum models to show per page

// Angle constants (in radians)
export const TARGET_MODEL_ANGLE = (10 * Math.PI) / 180; // 10 degrees
export const MIN_SEGMENT_ANGLE = (5 * Math.PI) / 180; // 5 degrees
export const MIN_COLLAPSED_ANGLE = (1 * Math.PI) / 180; // 1 degree - minimum for collapsed/inactive segments
export const MAX_EXPANSION_RATIO = 0.95; // 95%
export const TOTAL_ANGLE = 2 * Math.PI;

// Ring configuration factory
export const createRingConfig = (radius, ringGap) => ({
  // Ring 1 (innermost): Categories
  ring1Inner: radius * 0.15,
  ring1Outer: radius * 0.33,
  // Ring 2: Classes - starts after a gap
  ring2Inner: radius * 0.33 + ringGap,
  ring2Outer: radius * 0.53,
  // Ring 3: Makes
  ring3Inner: radius * 0.53 + ringGap,
  ring3Outer: radius * 0.73,
  // Ring 4 (outermost): Models
  ring4Inner: radius * 0.73 + ringGap,
  ring4Outer: radius * 0.93,
});
