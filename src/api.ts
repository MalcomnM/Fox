import * as fs from "fs";
import {
  FoxDecorationsController,
  foxDecorationStoreFactory
} from "./decorations";
import {
  FoxSessionDecorations,
  FoxTracerInterface,
  FoxParsedTraceResults,
  FoxTraceLineResult
} from "./types";
import {
  commands,
  extensions,
  ExtensionContext,
  OutputChannel,
  TextDocumentChangeEvent,
  TextDocument,
  TextEditor,
  workspace
} from "vscode";
import { FoxSessionController, foxSessionStoreFactory } from "./sessions";
import { FoxStickyController, foxStickyControllerFactory } from "./sticky";
import { PythonTracer, pythonTracerFactory } from "./tracer";
import { getActiveEditor, makeTempFile } from "./utils";
import { hotModeWarning } from "./hotWarning";
import { foxOutputFactory, FoxOutputController } from "./output";

export function foxStandardApiFactory(
  context: ExtensionContext,
  options: { output: OutputChannel }
) {
  const foxDecorationStore = foxDecorationStoreFactory(context);
  const foxOutputChannel = foxOutputFactory(options.output);

  return new FoxAPI(
    context,
    foxOutputChannel,
    foxDecorationStore,
    foxSessionStoreFactory(),
    foxStickyControllerFactory(foxDecorationStore),
    pythonTracerFactory()
  );
}

export class FoxAPI {
  private _endOfFile: number = 0;
  public _changedConfigFlag: boolean = false;
  constructor(
    public context: ExtensionContext,
    private _outputController: FoxOutputController,
    private _decorationController: FoxDecorationsController,
    private _sessionController: FoxSessionController,
    private _stickyController: FoxStickyController,
    private _pythonTracer: PythonTracer
  ) { }

  public stepInFox = (): void => {
    this.decorations.setDefaultDecorationOptions("green", "red");
    this.sessions.createSessionFromEditor(this.activeEditor);
    this.updateLineCount(this.activeEditor.document.lineCount);
    this.traceOrRenderPreparedDecorations(true);
    this.enterFoxContext();
  };

  public stopFox = (): void => {
    this.decorations.reInitDecorationCollection();
    this.clearAllSessionsAndDecorations();
    this.exitFoxContext();
  };

  public enterFoxContext = (): void => {
    commands.executeCommand("setContext", "inFoxContext", true);
  };

  public exitFoxContext = (): void => {
    commands.executeCommand("setContext", "inFoxContext", false);
  };

  public clearDecorationsForActiveSession = (): void => {
    this.clearDecorationsForSession(getActiveEditor());
  };

  public clearDecorationsForSession = (session: TextEditor): void => {
    const emptyDecorations = this.decorations.getEmptyDecorations();
    this.setDecorationsForSession(session, emptyDecorations);
  };

  public clearAllDecorations = (): void => {
    this.decorations.reInitDecorationCollection();
    for (let name of this.sessions.sessionNames) {
      const session = this.sessions.getSessionByFileName(name);
      this.clearDecorationsForSession(session);
    }
  };

  public clearAllSessionsAndDecorations = (): void => {
    this.clearAllDecorations();
    this.sessions.clearAllSessions();
  };

  public dataContainsErrorLines = (data: FoxParsedTraceResults): number => {
    for (let line of data) {
      if (line.error) {
        return line.lineno;
      }
    }
    return -1;
  };

  public filterParsedPythonData = (
    visitor: (
      value: FoxTraceLineResult,
      index?: number,
      collection?: FoxParsedTraceResults
    ) => boolean,
    data: FoxParsedTraceResults
  ): FoxParsedTraceResults => {
    return data.filter(visitor);
  };

  public handleDidChangeTextDocument = (document: TextDocument): void => {
    const tempFileObj = makeTempFile(document.fileName);
    const newSource = document.getText();
    this.clearDecorationsForActiveSession();
    this.decorations.reInitDecorationCollection();
    fs.writeFileSync(tempFileObj.name, newSource);
    this.tracer.tracePythonScriptForDocument({
      pythonPath: this.pythonPath,
      fileName: tempFileObj.name,
      rootDir: this.rootExtensionDir,
      afterInstall: this.traceOrRenderPreparedDecorations, // Recurse if Hunter had to be installed first,
      onData: data => {
        tempFileObj.removeCallback();
        this.onPythonDataSuccess(data);
      },
      onError: data => {
        tempFileObj.removeCallback();
        this.onPythonDataError(data);
      }
    } as FoxTracerInterface);
  };

  public isDocumentFoxSession = (document: TextDocument): boolean => {
    return this.sessions.sessionIsActiveByDocument(document);
  };

  public logToOutput = (...text): void => {
    this._outputController.log(text.join(" "));
  };

  private prettyPrintFoxData(data: FoxParsedTraceResults): string[] {
    return data.map(
      l =>
        `LINENO: ${l.lineno} - VALUE: ${l.value}${
        l.error ? `, ERROR: ${l.error}` : ""
        }`
    );
  }

  private onPythonDataSuccess = (data: FoxParsedTraceResults): void => {
    this.prepareAndRenderDecorationsForActiveSession(data);
    if (this.printLogging) {
      let prettyFox = this.prettyPrintFoxData(data);
      this._outputController.clear();
      this.logToOutput("(Fox Output):", JSON.stringify(prettyFox, null, 4));
      this.logToOutput("\n\nTotal Line Count:", data.length);
    }
  };

  private onPythonDataError = (data): void => {
    if (this.shouldLogErrors) {
      this.logToOutput("(Fox Error):", data);
    }
  };

  private prepareAndRenderDecorationsForActiveSession = (
    data: FoxParsedTraceResults
  ): void => {
    this.prepareAndRenderDecorationsForSession(this.activeEditor, data);
  };

  private prepareAndRenderDecorationsForSession = (
    session: TextEditor,
    data: FoxParsedTraceResults
  ) => {
    this.prepareParsedPythonData(data);
    this.clearDecorationsForSession(session);
    this.decorations.setPreparedDecorationsForEditor(session);
    this.setPreparedDecorationsForSession(session);
  };

  private prepareParsedPythonData = (data: FoxParsedTraceResults): void => {
    this.decorations.prepareParsedPythonData(data);
  };

  private renderPreparedDecorationsForActiveSession = (): void => {
    this.renderPreparedDecorationsForSession(this.activeEditor);
  };

  private renderPreparedDecorationsForSession = (session: TextEditor): void => {
    this.decorations.setPreparedDecorationsForEditor(session);
    this.setPreparedDecorationsForSession(session);
  };

  public setConfigUpdatedFlag(v: boolean) {
    this._changedConfigFlag = v;
  }

  private setDecorationsForSession = (
    session: TextEditor,
    decorations: FoxSessionDecorations
  ): void => {
    const decorationTypes = this.decorations.getDecorationTypes();
    session.setDecorations(decorationTypes.success, decorations.success);
    session.setDecorations(decorationTypes.error, decorations.error);
  };

  private setPreparedDecorationsForSession = (session: TextEditor): void => {
    const decorations = this.decorations.getPreparedDecorations();
    this.setDecorationsForSession(session, decorations);
  };

  public displayHotModeWarning(): void {
    hotModeWarning();
  }

  private traceAndRenderDecorationsForActiveSession = (): void => {
    this.decorations.reInitDecorationCollection();
    this.tracer.tracePythonScriptForActiveEditor({
      pythonPath: this.pythonPath,
      rootDir: this.rootExtensionDir,
      afterInstall: this.traceOrRenderPreparedDecorations, // Recurse if Hunter had to be installed first,
      onData: this.onPythonDataSuccess,
      onError: this.onPythonDataError
    } as FoxTracerInterface);
  };

  private traceOrRenderPreparedDecorations = (trace: boolean): void => {
    if (trace) {
      this.traceAndRenderDecorationsForActiveSession();
    } else {
      this.renderPreparedDecorationsForActiveSession();
    }
  };

  public updateLineCount = (count: number): void => {
    this.oldLineCount = count;
  };

  public updateStickys = (event: TextDocumentChangeEvent): void => {
    if (this.isHot) {
      this.stickys.updateStickyDecorations(event, this.oldLineCount);
      this.renderPreparedDecorationsForActiveSession();
      this.updateLineCount(event.document.lineCount);
    }
  };

  public updateStickysHot = (event: TextDocumentChangeEvent): void => {
    this.updateStickys(event);
    this.activeEditor.document.save();
  };

  public get activeEditor() {
    return getActiveEditor();
  }

  public get activeEditorIsDirty() {
    return getActiveEditor().document.isDirty;
  }

  public get config() {
    return workspace.getConfiguration("fox");
  }

  public get configChanged() {
    return this._changedConfigFlag;
  }

  public get decorations() {
    return this._decorationController;
  }

  public get isHot() {
    return this.config.get<boolean>("hot");
  }

  public get updateFrequency() {
    return this.config.get<number>("updateFrequency");
  }

  public get oldLineCount() {
    return this._endOfFile;
  }

  public set oldLineCount(v: number) {
    this._endOfFile = v;
  }

  public get printLogging() {
    return this.config.get<boolean>("printLoggingEnabled");
  }

  public get rootExtensionDir() {
    return extensions.getExtension("MalcomnM.fox").extensionPath;
  }

  public get sessions() {
    return this._sessionController;
  }

  public get shouldLogErrors() {
    return this.config.get("logErrors") === true;
  }

  public get shouldShowHotModeWarning() {
    return this.config.get("disableHotModeWarning") !== true;
  }

  public get stickys() {
    return this._stickyController;
  }

  public get tracer() {
    return this._pythonTracer;
  }

  public get pythonPath() {
    return this.config.get<string>("pythonPath")
  }
}
