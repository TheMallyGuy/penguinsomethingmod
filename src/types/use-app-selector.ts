import { useSelector, Selector } from "react-redux";
import type { RootState, VM } from "./redux-state";

/**
 * Typed `useSelector` — replaces the bare `useSelector` with full
 * RootState inference so you get autocomplete and type-safety.
 *
 * @example
 *   const vm = useAppSelector(state => state.scratchGui.vm);
 *   const isPlayer = useAppSelector(state => state.scratchGui.mode.isPlayerOnly);
 */
export const useAppSelector: <T>(selector: Selector<RootState, T>) => T =
    useSelector;

/**
 * Shorthand to grab the Scratch VM instance from the store.
 *
 * @example
 *   const vm = useVM();
 *   vm.greenFlag();
 */
export const useVM = (): VM => useAppSelector((state) => state.scratchGui.vm);

// Re-export types for convenience
export type { RootState, ScratchGuiState } from "./redux-state";
