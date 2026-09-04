import VM from "scratch-vm";

// =====================
// Locale state
// =====================
export interface LocalesState {
    isRtl: boolean;
    locale: string;
    messagesByLocale: Record<string, Record<string, string>>;
    messages: Record<string, string>;
}

// =====================
// Scratch Paint state
// =====================
export interface ScratchPaintState {
    [key: string]: unknown;
}

// =====================
// Scratch GUI sub-reducers
// =====================

export interface AddonUtilState {
    soundEditorWaveformChunkSize: number;
}

export interface AlertItem {
    alertId?: string;
    alertType?: string;
    closeButton?: boolean;
    content?: React.ReactNode;
    extensionId?: string;
    extensionName?: string;
    iconURL?: string;
    iconSpinner?: boolean;
    level?: string;
    message?: string;
    showReconnect?: boolean;
    showDownload?: boolean;
    showSaveNow?: boolean;
}

export interface AlertsState {
    visible: boolean;
    alertsList: AlertItem[];
}

export interface AssetDragState {
    dragging: boolean;
    currentOffset: { x: number; y: number } | null;
    img: HTMLImageElement | null;
}

export interface CardsState {
    visible: boolean;
    content: unknown;
    activeDeckId: string | null;
    step: number;
    x: number;
    y: number;
    expanded: boolean;
    dragging: boolean;
}

export interface ColorPickerState {
    active: boolean;
    callback: (color: string) => void;
}

export interface ConnectionModalState {
    extensionId: string | null;
}

export interface CustomProceduresState {
    active: boolean;
    mutator: unknown | null;
    callback: ((mutator: unknown) => void) | null;
}

export interface EditorTabState {
    activeTabIndex: number;
}

export interface HoveredTargetState {
    sprite: string | null;
    receivedBlocks: boolean;
}

export interface ModeState {
    isEmbedded: boolean;
    isFullScreen: boolean;
    isPlayerOnly: boolean;
    hasEverEnteredEditor: boolean;
}

export interface ModalsState {
    backdropLibrary: boolean;
    costumeLibrary: boolean;
    extensionLibrary: boolean;
    loadingProject: boolean;
    telemetryModal: boolean;
    soundLibrary: boolean;
    spriteLibrary: boolean;
    soundRecorder: boolean;
    connectionModal: boolean;
    tipsLibrary: boolean;
    usernameModal: boolean;
    settingsModal: boolean;
    customExtensionModal: boolean;
    restorePointModal: boolean;
    fontsModal: boolean;
    extensionModalSwapId: string | null;
}

export interface MonitorLayoutRect {
    upperStart: { x: number; y: number };
    lowerEnd: { x: number; y: number };
}

export interface MonitorLayoutState {
    monitors: Record<string, MonitorLayoutRect>;
    savedMonitorPositions: Record<string, { x: number; y: number }>;
}

export interface ProjectStateData {
    error: Error | null;
    projectData: string | object | null;
    projectId: string | number | null;
    loadingState: string;
}

export interface ProjectTitleState {
    projectTitle: string;
}

export interface RestoreDeletionState {
    restoreFun: (() => void) | null;
    deletedItem: string;
}

export interface StageSizeState {
    stageSize: string;
}

export interface TargetState {
    id?: string;
    isStage?: boolean;
    name?: string;
    order?: number;
    [key: string]: unknown;
}

export interface TargetsState {
    sprites: Record<string, TargetState>;
    stage: TargetState;
    editingTarget?: string;
    highlightedTargetId: string | null;
    highlightedTargetTime: number | null;
}

export interface TimeoutState {
    autoSaveTimeoutId: ReturnType<typeof setTimeout> | null;
}

export interface ToolboxState {
    toolboxXML: string;
}

export interface TwCompilerOptions {
    enabled: boolean;
    warpTimer: boolean;
}

export interface TwRuntimeOptions {
    maxClones: number;
    miscLimits: boolean;
    dangerousOptimizations: boolean;
    disableOffscreenRendering: boolean;
    disableDirectionClamping: boolean;
    fencing: boolean;
}

export interface TwAuthor {
    username: string;
    thumbnail: string;
}

export interface TwDescription {
    instructions: string;
    credits: string;
}

export interface TwExtraProjectInfo {
    accepted: boolean;
    isRemix: boolean;
    remixId: string;
    tooLarge: boolean;
    author: string;
    releaseDate: Date;
    isUpdated: boolean;
}

export interface TwRemixedProjectInfo {
    loaded: boolean;
    name: string;
    author: string;
}

export interface TwState {
    framerate: number;
    interpolation: boolean;
    cloud: boolean;
    username: string;
    highQualityPen: boolean;
    compilerOptions: TwCompilerOptions;
    runtimeOptions: TwRuntimeOptions;
    isWindowFullScreen: boolean;
    dimensions: [number, number];
    author: TwAuthor;
    description: TwDescription;
    extraProjectInfo: TwExtraProjectInfo;
    remixedProjectInfo: TwRemixedProjectInfo;
    compileErrors: unknown[];
    fileHandle: unknown | null;
    usernameInvalid: boolean;
    usernameLoggedIn: boolean;
    hasCloudVariables: boolean;
    cloudHost: string;
}

export interface CustomStageSizeState {
    width: number;
    height: number;
}

export interface VmStatusState {
    running: boolean;
    paused: boolean;
    started: boolean;
    turbo: boolean;
}

export interface WorkspaceMetricsTarget {
    scrollX: number;
    scrollY: number;
    scale: number;
}

export interface WorkspaceMetricsState {
    targets: Record<string, WorkspaceMetricsTarget>;
}

// =====================
// Combined GUI state
// =====================
export interface ScratchGuiState {
    addonUtil: AddonUtilState;
    alerts: AlertsState;
    assetDrag: AssetDragState;
    blockDrag: boolean;
    cards: CardsState;
    colorPicker: ColorPickerState;
    connectionModal: ConnectionModalState;
    customStageSize: CustomStageSizeState;
    customProcedures: CustomProceduresState;
    editorTab: EditorTabState;
    mode: ModeState;
    hoveredTarget: HoveredTargetState;
    stageSize: StageSizeState;
    menus: Record<string, unknown>;
    micIndicator: boolean;
    modals: ModalsState;
    monitors: unknown; // OrderedMap
    monitorLayout: MonitorLayoutState;
    projectChanged: boolean;
    projectState: ProjectStateData;
    projectTitle: string;
    fontsLoaded: boolean;
    restoreDeletion: RestoreDeletionState;
    targets: TargetsState;
    timeout: TimeoutState;
    toolbox: ToolboxState;
    tw: TwState;
    vm: VM;
    vmStatus: VmStatusState;
    workspaceMetrics: WorkspaceMetricsState;
}

// =====================
// Root Redux state
// =====================
export interface RootState {
    locales: LocalesState;
    scratchGui: ScratchGuiState;
    scratchPaint: ScratchPaintState;
}

// =====================
// Typed selector helpers
// =====================
import { useSelector } from "react-redux";

/** Typed `useSelector` — use this instead of the bare hook. */
export function useAppSelector<T>(selector: (state: RootState) => T): T;

/** Shortcut to select the VM instance. */
export function useVM(): VM;
