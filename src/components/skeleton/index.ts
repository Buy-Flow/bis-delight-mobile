/**
 * Single entry point for the skeleton system.
 *
 * Layers:
 *  - Primitives (`Sk`, `SkCircle`, `SkText`) — atomic blocks over the `.sk`
 *    CSS class (see `src/styles.css`).
 *  - Kit — generic compositions (KPI rows, lists, tables, charts, forms,
 *    card grids, admin page shell).
 *  - App skeletons — compositions matched 1:1 to real app surfaces so
 *    layouts don't shift when data arrives.
 *  - Provider — reads `skeleton_settings` and pushes CSS vars to `:root`
 *    (realtime).
 *
 * Always import from `@/components/skeleton` — never reach into subfiles.
 */
export * from "./Sk";
export * from "./SkeletonKit";
export * from "./app-skeletons";
export { SkeletonProvider, applySkeletonSettings, DEFAULT_SKELETON_SETTINGS } from "./SkeletonProvider";
export type { SkeletonSettings } from "./SkeletonProvider";
