import { TextEditor, TextDocument } from "vscode";
import { FoxActiveSessionCollection } from "./types";
import { getActiveEditor } from "./utils";

export function foxSessionStoreFactory() {
  return new FoxSessionController();
}

export class FoxSessionController {
  private _sessions: FoxActiveSessionCollection = {};

  public clearAllSessions(): void {
    this._sessions = {} as FoxActiveSessionCollection;
  }

  public clearSessionByName(name): void {
    delete this._sessions[name];
  }

  public createSessionFromEditor(editor: TextEditor): void {
    this._sessions[editor.document.fileName] = editor;
  }

  public getActiveSession() {
    const activeEditor: TextEditor = getActiveEditor();
    return this._sessions[activeEditor.document.fileName];
  }

  public getAllSessions(): FoxActiveSessionCollection {
    return this._sessions;
  }

  public getSessionByFileName(fileName: string): TextEditor {
    return this._sessions[fileName];
  }

  public sessionIsActiveByDocument(document: TextDocument): boolean {
    return this._sessions[document.fileName] ? true : false;
  }

  public sessionIsActiveByFileName(fileName: string): boolean {
    return this._sessions[fileName] ? true : false;
  }

  public get collection(): FoxActiveSessionCollection {
    return this._sessions;
  }

  public get sessionNames(): string[] {
    return Object.keys(this._sessions);
  }
}
