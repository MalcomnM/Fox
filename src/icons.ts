import { FoxColorSelection, FoxIcon, FoxIconColor } from "./types";
import { ExtensionContext } from "vscode";
import { foxIconColorProvider } from "./colors";

export function foxIconProvider(
  context: ExtensionContext,
  color: FoxColorSelection,
  pawprints: boolean
): FoxIcon {
  const iconColor: FoxIconColor = foxIconColorProvider(color);
  return context
    .asAbsolutePath(`media\\fox${pawprints ? "-paw" : ""}-${iconColor}.png`)
    .replace(/\\/g, "/");
}
