'use client'

import { useEffect, useRef, useState } from 'react'

type Status = 'idle' | 'scanning' | 'unsupported' | 'error'

export function BarcodeScanner({
  onDetected
}: {
  onDetected: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('Use your phone camera if BarcodeDetector is supported.')

  const stopScanner = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setStatus('idle')
  }

  useEffect(() => stopScanner, [])

  const startScanner = async () => {
    const Detector = window.BarcodeDetector
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      setMessage('BarcodeDetector is unavailable here. Use manual GTIN entry instead.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        }
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const detector = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
      })

      setStatus('scanning')
      setMessage('Point the barcode at the camera.')

      intervalRef.current = window.setInterval(async () => {
        const video = videoRef.current
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return
        }

        try {
          const codes = await detector.detect(video)
          const code = codes[0]?.rawValue?.trim()
          if (code) {
            onDetected(code)
            setMessage(`Captured barcode: ${code}`)
            stopScanner()
          }
        } catch {
          setStatus('error')
          setMessage('Barcode scan failed. Try again or enter the GTIN manually.')
          stopScanner()
        }
      }, 650)
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to access the camera. Use manual GTIN entry instead.'
      )
    }
  }

  return (
    <section className="scanner-camera">
      <div className="scanner-camera__header">
        <div>
          <p className="eyebrow">Camera</p>
          <h3>Barcode scan</h3>
        </div>
        {status === 'scanning' ? (
          <button type="button" className="button button--ghost" onClick={stopScanner}>
            Stop
          </button>
        ) : (
          <button type="button" className="button button--ghost" onClick={startScanner}>
            Start scanner
          </button>
        )}
      </div>

      <div className="scanner-camera__stage">
        <video ref={videoRef} muted playsInline />
        <p>{message}</p>
      </div>
    </section>
  )
}

