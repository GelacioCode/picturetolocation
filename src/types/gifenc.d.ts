declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; repeat?: number; transparent?: number }
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }
  export function quantize(data: Uint8ClampedArray | Uint8Array, maxColors: number, opts?: object): number[][]
  export function applyPalette(data: Uint8ClampedArray | Uint8Array, palette: number[][]): Uint8Array
  export function nearestColorIndex(palette: number[][], r: number, g: number, b: number): number
  export function nearestColor(palette: number[][], r: number, g: number, b: number): number[]
}
