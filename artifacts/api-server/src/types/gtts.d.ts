declare module "gtts" {
  export default class gTTS {
    constructor(text: string, lang?: string, slow?: boolean);
    stream(callback: (err: Error | null, stream: NodeJS.ReadableStream) => void): void;
    save(filePath: string, callback?: (err: Error | null) => void): void;
  }
}
