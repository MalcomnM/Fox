import { OutputChannel } from "vscode";

export function foxOutputFactory(channel: OutputChannel) {
  return new FoxOutputController(channel);
}

export class FoxOutputController {
  constructor(private _channel: OutputChannel) {}

  public log(text: string): void {
    this._channel.append(text);
  }

  public clear(): void {
    this._channel.clear();
  }
}
