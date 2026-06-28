declare module 'expo-image-manipulator' {
  export enum SaveFormat {
    JPEG = 'jpeg',
    PNG = 'png',
    WEBP = 'webp',
  }

  export type Action = {
    resize?: { width?: number; height?: number };
  };

  export type ManipulateOptions = {
    compress?: number;
    format?: SaveFormat;
  };

  export function manipulateAsync(
    uri: string,
    actions: Action[],
    options?: ManipulateOptions,
  ): Promise<{ uri: string; width: number; height: number }>;
}
