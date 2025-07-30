/**
 * Returns the closest matching aspect ratio string from predefined options
 * @param {number} ratio - Width divided by height
 * @returns {string} - One of "1:1", "3:4", "4:3", "16:9", or "9:16"
 */
export function getClosestAspectRatio(ratio) {
  const options = [
    { value: "1:1", ratio: 1 },
    { value: "3:4", ratio: 3 / 4 },
    { value: "4:3", ratio: 4 / 3 },
    { value: "16:9", ratio: 16 / 9 },
    { value: "9:16", ratio: 9 / 16 },
  ];

  return options.reduce((closest, option) => {
    const currentDiff = Math.abs(ratio - option.ratio);
    const closestDiff = Math.abs(ratio - closest.ratio);
    return currentDiff < closestDiff ? option : closest;
  }).value;
}
