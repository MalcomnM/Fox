import * as vscode from "vscode";
import {
  ExtensionContext,
  OutputChannel,
  TextDocumentChangeEvent
} from "vscode";

import { foxStandardApiFactory, FoxAPI } from "./api";
import { ActiveTextEditorChangeEventResult } from "./types";
import { registerCommand } from "./utils";

export function activate(context: ExtensionContext) {
  const output: OutputChannel = vscode.window.createOutputChannel("Fox");
  const foxAPI: FoxAPI = foxStandardApiFactory(context, { output });

  initializeFoxExtension();

  function initializeFoxExtension(): void {
    context.subscriptions.push(
      registerCommand("fox.touchBarStart", startFox),
      registerCommand("fox.touchBarStop", stopFox),
      registerCommand("fox.barkAtCurrentFile", startFox),
      registerCommand("fox.stopBarking", stopFox)
    );

    const opts = [null, context.subscriptions];
    vscode.window.onDidChangeActiveTextEditor(changedActiveTextEditor, ...opts);
    vscode.workspace.onDidChangeTextDocument(changedTextDocument, ...opts);
    vscode.workspace.onDidChangeConfiguration(changedConfiguration, ...opts);
  }

  function startFox(): void {
    if (foxAPI.activeEditorIsDirty) {
      const message = "Please save the document before running Fox.";
      vscode.window.showInformationMessage(message);
    } else {
      if (foxAPI.shouldShowHotModeWarning) {
        foxAPI.displayHotModeWarning();
      }
      foxAPI.stepInFox();
    }
  }

  function stopFox(): void {
    foxAPI.stopFox();
    cancelPending();
  }

  function changedActiveTextEditor(
    editor: ActiveTextEditorChangeEventResult
  ): void {
    if (editor) {
      if (foxAPI.sessions.sessionIsActiveByDocument(editor.document)) {
        if (foxAPI.configChanged) {
          vscode.window.showInformationMessage(
            "Fox detected a change to the Hot Mode configuration and was shut off.. " +
            "Attempting to restart."
          );
          foxAPI.setConfigUpdatedFlag(false);
          stopFox();
          startFox();
        } else {
          foxAPI.enterFoxContext();
          throttledHandleDidChangeTextDocument({
            document: editor.document
          } as TextDocumentChangeEvent);
        }
      } else {
        foxAPI.exitFoxContext();
      }
    }
  }

  function changedTextDocument(event: TextDocumentChangeEvent): void {
    if (foxAPI.isDocumentFoxSession(event.document)) {
      throttledHandleDidChangeTextDocument(event);
    }
  }

  function changedConfiguration(event): void {
    if (
      event.affectsConfiguration("fox.pawPrintsInGutter") ||
      event.affectsConfiguration("fox.updateFrequency") ||
      event.affectsConfiguration("fox.maxLineLength")
    ) {
      foxAPI.setConfigUpdatedFlag(true);
    }
  }

  let updateTimeout = null;

  function cancelPending(): void {
    [updateTimeout].forEach(pending => {
      if (pending) clearTimeout(pending);
    });
  }

  function throttledHandleDidChangeTextDocument(
    event: TextDocumentChangeEvent
  ): void {
    if (!foxAPI.activeEditorIsDirty) {
      foxAPI.handleDidChangeTextDocument(event.document)
    }
    // if (updateTimeout) {
    //   clearTimeout(updateTimeout);
    // }
    // updateTimeout = setTimeout(
    //   () => foxAPI.handleDidChangeTextDocument(event.document),
    //   clamp(100, 10000, foxAPI.updateFrequency)
    // );
  }
}
