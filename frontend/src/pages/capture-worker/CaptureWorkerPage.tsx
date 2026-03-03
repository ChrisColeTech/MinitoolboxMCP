import { useEffect, useRef } from 'react';

/**
 * Hidden capture worker page — loaded in an invisible BrowserWindow at /#/capture.
 * Listens for capture requests from the main process via preload bridge,
 * uses getUserMedia with chromeMediaSource to grab real GPU-rendered frames.
 */
export default function CaptureWorkerPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!window.electronAPI) return;

        window.electronAPI.onCaptureRequest(async (sourceId, requestId) => {
            const video = videoRef.current!;
            const canvas = canvasRef.current!;
            let stream: MediaStream | null = null;

            try {
                stream = await (navigator.mediaDevices as any).getUserMedia({
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId,
                        },
                    },
                });

                video.srcObject = stream;

                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
                    video.onloadeddata = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                });

                // Extra frame to settle
                await new Promise((r) => setTimeout(r, 100));

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d')!.drawImage(video, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');

                window.electronAPI.sendCaptureResult(requestId, dataUrl, canvas.width, canvas.height);
            } catch (err: any) {
                window.electronAPI.sendCaptureError(requestId, err.message);
            } finally {
                // Always stop all tracks and release the stream to kill the sharing indicator
                if (stream) {
                    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
                }
                video.srcObject = null;
            }
        });

        window.electronAPI.workerReady();
    }, []);

    return (
        <>
            <video ref={videoRef} autoPlay muted style={{ display: 'none' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </>
    );
}
