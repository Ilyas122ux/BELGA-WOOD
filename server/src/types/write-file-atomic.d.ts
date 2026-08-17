declare module 'write-file-atomic' {
  export default function writeFileAtomic(filename: string, data: string | NodeJS.ArrayBufferView): Promise<void>;
}
