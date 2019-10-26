import {
  FoxIconColorType,
  FoxHexColorType,
  FoxColorSelection,
  FoxHexColor,
  FoxIconColor
} from "./types";

const FoxIconColorMap = {
  blue: "blue",
  cornflower: "blue",
  red: "red",
  green: "green"
} as FoxIconColorType;

const FoxHexColorMap = {
  cornflower: "#6495ed",
  blue: "#00a1f1",
  green: "#7cbb00",
  red: "#ea2f36"
} as FoxHexColorType;

export function foxIconColorProvider(color: FoxColorSelection) {
  return FoxIconColorMap[color] as FoxIconColor;
}

export function foxTextColorProvider(color: FoxColorSelection) {
  return FoxHexColorMap[color] as FoxHexColor;
}
