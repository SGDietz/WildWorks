export type WildfireViewerImage = {
  src: string;
  alt: string;
};

export type WildfireFinishedImage = WildfireViewerImage & {
  className: string;
};

export const WILDFIRE_CONSTRUCTION_IMAGE_COUNT = 93;

export const wildfireFinishedImages: WildfireFinishedImage[] = [
  {
    src: "/ww-wildfire-night-04-garden-fireplace.jpg",
    alt: "Project Wildfire garden, boulders, rooftop lounge, and fireplace lighting",
    className: "wild-wildfire-photo--hero",
  },
  {
    src: "/ww-wildfire-night-02-celtic-patio.jpg",
    alt: "Project Wildfire Celtic cross patio and outdoor fireplace from above",
    className: "wild-wildfire-photo--deck",
  },
  {
    src: "/ww-wildfire-night-01-fireplace-patio-lights-off-dark-20260801.png",
    alt: "Project Wildfire outdoor fireplace, Celtic cross patio, and stonework lit at night",
    className: "wild-wildfire-photo--garden",
  },
  {
    src: "/ww-wildfire-night-03-deck-fireplace.jpg",
    alt: "Project Wildfire rooftop lounge and outdoor fireplace at night",
    className: "wild-wildfire-photo--patio",
  },
  {
    src: "/ww-wildfire-night-05-celtic-detail.jpg",
    alt: "Project Wildfire Celtic cross patio stone detail",
    className: "wild-wildfire-photo--detail",
  },
];

export const wildfireConstructionImages = Array.from(
  { length: WILDFIRE_CONSTRUCTION_IMAGE_COUNT },
  (_, zeroBasedIndex) => {
    const oneBasedIndex = zeroBasedIndex + 1;
    return {
      index: oneBasedIndex,
      src: `/wildfire/${String(oneBasedIndex).padStart(2, "0")}.jpg`,
      alt: `Project Wildfire construction field photo ${String(oneBasedIndex).padStart(2, "0")}, documenting the outdoor fireplace, patio, lounge, and upper deck build`,
    };
  },
);

// G's full browse order is all 93 construction photos followed by the five
// finished fireplace/patio photographs at one-based positions 94 through 98.
export const wildfireViewerImages: WildfireViewerImage[] = [
  ...wildfireConstructionImages,
  ...wildfireFinishedImages,
];
