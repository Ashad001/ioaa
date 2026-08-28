/**
 * Minimal typings for mp4box.js — only the surface the scroll-scrub frame bank
 * touches. The package ships plain JavaScript with no types of its own.
 */
declare module "mp4box" {
  export interface MP4VideoTrack {
    id: number;
    codec: string;
    timescale: number;
    duration: number;
    nb_samples: number;
    video?: { width: number; height: number };
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    videoTracks: MP4VideoTrack[];
  }

  export interface MP4Sample {
    number: number;
    is_sync: boolean;
    cts: number;
    dts: number;
    duration: number;
    timescale: number;
    data: Uint8Array;
  }

  export interface MP4ArrayBuffer extends ArrayBuffer {
    fileStart: number;
  }

  /** A box in the sample-description entry — avcC / hvcC / vpcC / av1C. */
  export interface MP4DescriptionBox {
    write(stream: unknown): void;
    size: number;
  }

  export interface MP4SampleEntry {
    avcC?: MP4DescriptionBox;
    hvcC?: MP4DescriptionBox;
    vpcC?: MP4DescriptionBox;
    av1C?: MP4DescriptionBox;
  }

  export interface MP4Track {
    mdia: { minf: { stbl: { stsd: { entries: MP4SampleEntry[] } } } };
  }

  export interface MP4File {
    onReady: ((info: MP4Info) => void) | null;
    onError: ((error: string) => void) | null;
    onSamples:
      | ((trackId: number, user: unknown, samples: MP4Sample[]) => void)
      | null;
    appendBuffer(buffer: MP4ArrayBuffer): number;
    flush(): void;
    start(): void;
    stop(): void;
    getTrackById(id: number): MP4Track | undefined;
    setExtractionOptions(
      id: number,
      user?: unknown,
      options?: { nbSamples?: number; rapAlignment?: boolean },
    ): void;
  }

  export function createFile(keepMdatData?: boolean): MP4File;

  export class DataStream {
    constructor(size?: number, offset?: number, endianness?: boolean);
    static BIG_ENDIAN: boolean;
    static LITTLE_ENDIAN: boolean;
    buffer: ArrayBuffer;
    endianness: boolean;
  }

  const MP4Box: {
    createFile: typeof createFile;
    DataStream: typeof DataStream;
  };

  export default MP4Box;
}
