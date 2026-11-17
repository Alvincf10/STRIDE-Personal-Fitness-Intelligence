declare module "fit-file-parser" {
  type FitParserOptions = {
    force?: boolean;
    speedUnit?: string;
    lengthUnit?: string;
    temperatureUnit?: string;
    elapsedRecordField?: boolean;
  };

  export default class FitParser {
    constructor(options?: FitParserOptions);
    parse(
      buffer: Buffer | ArrayBuffer | Uint8Array,
      callback: (error: Error | undefined, data: unknown) => void
    ): void;
  }
}
