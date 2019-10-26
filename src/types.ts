import {
  DecorationOptions,
  Range,
  TextEditor,
  TextEditorDecorationType
} from "vscode";

export type FoxIcon = string;
export type FoxHexColor = string;
export type FoxColorSelection = "red" | "cornflower" | "blue" | "green";
export type FoxIconColor = "red" | "green" | "blue";

export type FoxHexColorType = { [P in FoxColorSelection]: FoxHexColor };
export type FoxIconColorType = { [P in FoxColorSelection]: FoxIconColor };

export interface FoxActiveSessionCollection {
  [id: string]: TextEditor;
}

export interface FoxGutterDecorationOptions {
  gutterIconColor: FoxColorSelection;
  leftMargin?: number;
}

export type FoxValue = string | number;

export interface FoxResponse { }

export interface FoxLineDecoration {
  data: FoxValue[];
  lineno: number;
  error: boolean;
  loop: boolean;
  source: string;
  pretty: FoxValue[];
  calls: number;
}

export interface FoxDecorationMapping {
  [id: string]: FoxLineDecoration;
}

export interface FoxDecorationOptions {
  range: Range;
  text: string;
  hoverText: string;
  color: FoxColorSelection;
  language?: "python" | string;
}

export interface FoxStandardDecorationTypes {
  success: TextEditorDecorationType;
  error: TextEditorDecorationType;
}

export interface FoxSessionDecorations {
  success: DecorationOptions[];
  error: DecorationOptions[];
}

export interface FoxTraceLineResult {
  lineno: number;
  value: FoxValue;
  kind: string;
  source: string;
  pretty: string;
  error: boolean;
  calls: number;
  _loop?: boolean;
}

export type FoxParsedTraceResults = FoxTraceLineResult[] | null;

export interface FoxTracerInterface {
  pythonPath: string;
  fileName: string;
  rootDir: string;
  afterInstall: () => void;
  onData: (FoxParsedTraceResults) => void;
  onError: (string) => void;
}

export type ActiveTextEditorChangeEventResult = TextEditor | undefined;
