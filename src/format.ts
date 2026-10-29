const points = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });

/** Swiss grouping (1’000) with a real minus sign. */
export const formatPoints = (n: number) => points.format(n).replace("-", "−");
