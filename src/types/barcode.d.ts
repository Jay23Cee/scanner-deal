declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}

