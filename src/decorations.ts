import {
  DecorationOptions,
  DecorationRenderOptions,
  TextEditor,
  TextEditorDecorationType,
  window,
  TextLine,
  ExtensionContext,
  Range,
  Position,
  workspace
} from "vscode";
import {
  FoxColorSelection,
  FoxDecorationOptions,
  FoxDecorationMapping,
  FoxLineDecoration,
  FoxSessionDecorations,
  FoxStandardDecorationTypes,
  FoxTraceLineResult,
  FoxParsedTraceResults,
  FoxValue
} from "./types";
import { foxTextColorProvider } from "./colors";
import { foxIconProvider } from "./icons";
import {
  getActiveEditor,
  formatFoxResponseElement,
  stringEscape,
  clamp
} from "./utils";
const beautify = require("js-beautify").js;

export function foxDecorationStoreFactory(context: ExtensionContext) {
  return new FoxDecorationsController(context);
}

export class FoxDecorationsController {
  private _decorations: FoxDecorationMapping = {};
  private _decorationTypes: FoxStandardDecorationTypes;
  private _preparedDecorations: FoxSessionDecorations;

  constructor(public context: ExtensionContext) { }

  private createEditorDecorationForGutters = (
    gutterIconColor: FoxColorSelection,
    leftMargin: number = 3
  ): TextEditorDecorationType => {
    return window.createTextEditorDecorationType({
      after: {
        margin: `0 0 0 ${leftMargin}em`,
        textDecoration: "none"
      },
      isWholeLine: true,
      rangeBehavior: 1,
      overviewRulerLane: 1,
      overviewRulerColor: foxTextColorProvider(gutterIconColor),
      gutterIconPath: foxIconProvider(
        this.context,
        gutterIconColor,
        this.pawprints
      ),
      gutterIconSize: "cover"
    } as DecorationRenderOptions);
  };

  private createFoxDecorationOptions = (
    options: FoxDecorationOptions
  ): DecorationOptions => {
    const truncLength: number = workspace
      .getConfiguration("fox")
      .get("maxLineLength");
    const textLength: number = options.text.length;
    const ellipsis: string = textLength > truncLength ? " ..." : "";
    return {
      range: options.range,
      hoverMessage: {
        language: options.language || "python",
        value: options.hoverText
      },
      renderOptions: {
        after: {
          contentText:
            options.text.slice(0, clamp(1, 1000, truncLength)) + ellipsis,
          fontWeight: "normal",
          fontStyle: "normal",
          color: foxTextColorProvider(options.color)
        }
      } as DecorationRenderOptions
    } as DecorationOptions;
  };
  public deleteDecorationAtLine = (lineNo: number): void => {
    delete this._decorations[lineNo];
  };

  public deleteDecorationsAndShiftUp = (
    start: number,
    end: number,
    step?: number
  ): void => {
    for (let index = start + 1; index <= end + 1; index++) {
      delete this._decorations[index];
    }
    this.shiftDecorationsUp({
      start: start + 1,
      swap: false,
      step: step || end - start
    });
  };
  public filterDecorationsAfterCallCount = (target: number): void => {
    const newDecorations = {} as FoxDecorationMapping;
    Object.keys(this._decorations).forEach(deco => {
      if (this._decorations[deco].calls < target) {
        newDecorations[deco] = this._decorations[deco];
      }
    });
    this.setDecorations(newDecorations);
  };

  public getAllDecorations = (): FoxDecorationMapping => {
    return this._decorations;
  };

  public getDecorationAtLine = (lineNo: number): FoxLineDecoration => {
    return this._decorations[lineNo];
  };

  public getDecorationTypes = (): FoxStandardDecorationTypes => {
    return this._decorationTypes;
  };

  public getEmptyDecorations = (): FoxSessionDecorations => {
    return {
      success: [],
      error: []
    } as FoxSessionDecorations;
  };

  private getLineDecorationOrDefault = (lineNo: number): FoxLineDecoration => {
    return (
      this.getDecorationAtLine(lineNo) ||
      ({ data: [], pretty: [] } as FoxLineDecoration)
    );
  };

  public getPreparedDecorations = (): FoxSessionDecorations => {
    if (this._preparedDecorations) {
      return this._preparedDecorations as FoxSessionDecorations;
    } else {
      return this.getEmptyDecorations();
    }
  };

  public prepareParsedPythonData = (data: FoxParsedTraceResults): void => {
    for (let line of data) {
      this.parseLineAndSetDecoration(line);
    }
  };

  public parseLineAndSetDecoration = (line: FoxTraceLineResult): void => {
    const annotation: FoxValue = formatFoxResponseElement(line);
    const lineNo: number = line.lineno;
    const pretty: string = beautify(line.value, {
      indent_size: 4,
      space_in_empty_paren: true
    });
    const existing: FoxLineDecoration = this.getLineDecorationOrDefault(
      lineNo
    );
    const decoration = {
      data: [...existing.data, stringEscape(annotation)],
      lineno: lineNo,
      error: line.error ? true : false,
      loop: line.hasOwnProperty("_loop"),
      pretty: [...existing.pretty, pretty]
    } as FoxLineDecoration;
    this.setDecorationAtLine(lineNo, decoration);
  };

  public reInitDecorationCollection = (): void => {
    this._decorations = {} as FoxDecorationMapping;
  };

  private setDecorations = (decorations: FoxDecorationMapping): void => {
    this._decorations = decorations;
  };

  public setDecorationAtLine = (
    lineNo: number,
    decoration: FoxLineDecoration
  ): void => {
    this._decorations[lineNo] = decoration;
  };

  public setDefaultDecorationOptions = (
    successColor: FoxColorSelection,
    errorColor: FoxColorSelection
  ): void => {
    const successDecorationType = this.createEditorDecorationForGutters(
      successColor
    );
    const errorDecorationType = this.createEditorDecorationForGutters(
      errorColor
    );
    this._decorationTypes = {
      success: successDecorationType,
      error: errorDecorationType
    };
  };

  public setPreparedDecorationsForActiveEditor = (): void => {
    const activeEditor: TextEditor = getActiveEditor();
    this.setPreparedDecorationsForEditor(activeEditor);
  };

  public setPreparedDecorationsForEditor = (editor: TextEditor): void => {
    const decorations: DecorationOptions[] = [];
    const errorDecorations: DecorationOptions[] = [];

    Object.keys(this._decorations).forEach(key => {
      const lineNo: number = parseInt(key, 10);
      const lineIndex: number = lineNo - 1;
      const decorationData: FoxLineDecoration = this.getDecorationAtLine(
        lineNo
      );

      if (!decorationData.data || editor.document.lineCount < lineNo) {
        return;
      }

      const textLine: TextLine = editor.document.lineAt(lineIndex);
      const source = textLine.text;
      const decoRange = new Range(
        new Position(lineIndex, textLine.firstNonWhitespaceCharacterIndex),
        new Position(lineIndex, textLine.text.indexOf(source) + source.length)
      );
      const decoration: DecorationOptions = this.createFoxDecorationOptions({
        range: decoRange,
        text: decorationData.data.join(" => "), // This seperator should be adjustable from the config
        hoverText: decorationData.pretty.join("\n"),
        color: decorationData.error ? "red" : "cornflower"
      } as FoxDecorationOptions);
      (decorationData.error ? errorDecorations : decorations).push(decoration);
    });

    this._preparedDecorations = {
      success: decorations,
      error: errorDecorations
    } as FoxSessionDecorations;
  };

  public shiftDecorationsDown = ({
    start,
    end = -1,
    swap = true,
    step = 1
  }) => {
    const nextAnnotations = {};
    Object.keys(this._decorations).forEach(key => {
      const intKey = parseInt(key, 10);
      let nextKey;
      if (end !== -1) {
        nextKey = start <= intKey && intKey <= end ? intKey + step : intKey;
      } else {
        nextKey = start <= intKey ? intKey + step : intKey;
      }
      nextAnnotations[nextKey] = { ...this._decorations[key] };
    });
    if (swap) {
      nextAnnotations[start] = { ...this._decorations[end] };
      nextAnnotations[end + 1] = { ...this._decorations[end + 1] };
    }

    this._decorations = { ...nextAnnotations };
  };

  public shiftDecorationsUp = ({ start, end = -1, swap = true, step = 1 }) => {
    const nextAnnotations = {};
    Object.keys(this._decorations).forEach(key => {
      const intKey = parseInt(key, 10);
      let nextKey;
      if (end !== -1) {
        nextKey = start <= intKey && intKey <= end ? intKey - step : intKey;
      } else {
        nextKey = start <= intKey ? intKey - step : intKey;
      }
      nextAnnotations[nextKey] = { ...this._decorations[key] };
    });
    if (swap) {
      nextAnnotations[end] = { ...this._decorations[start] };
      nextAnnotations[start - 1] = { ...this._decorations[start - 1] };
    }
    this._decorations = { ...nextAnnotations };
  };

  public get collection(): FoxDecorationMapping {
    return this._decorations;
  }

  public get hasDecoratons(): boolean {
    return Object.keys(this._decorations).length > 0;
  }

  public get pawprints(): boolean {
    return true;
    // return workspace.getConfiguration("fox").get("pawPrintsInGutter")
    //   ? true
    //   : false;
  }
}
