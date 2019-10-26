import { MessageItem, WorkspaceConfiguration, window, workspace } from "vscode";

export function hotModeWarning() {
  const config: WorkspaceConfiguration = workspace.getConfiguration("fox");
  const disableWarnings: MessageItem = { title: "Don't ask again" };

  const notificationText =
    "Fox evalutes your code on save.";

  if (config.get("disableHotModeWarning") !== true) {
    window
      .showInformationMessage(notificationText, disableWarnings)
      .then(result => {
        if (result === disableWarnings) {
          config.update("disableHotModeWarning", true);
        }
      });
  }
}
