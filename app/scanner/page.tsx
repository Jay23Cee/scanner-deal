import { ScannerWorkbench } from '@/components/scanner/ScannerWorkbench'
import { getImageSearchFeatureState } from '@/lib/image-search/config'

export const dynamic = 'force-dynamic'

export default function ScannerPage() {
  return <ScannerWorkbench initialImageSearchFeatureState={getImageSearchFeatureState()} />
}
