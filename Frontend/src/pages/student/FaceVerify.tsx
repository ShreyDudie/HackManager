// =============================================================================
// FaceVerify.tsx — Student face capture for registration verification
// Uses browser getUserMedia to capture live photo.
// Stores base64 image in localStorage. One-time capture only.
// Admin can later compare this photo during on-campus verification.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Upload, Github, QrCode, Bell, UserCheck, Camera, CheckCircle, HelpCircle, Linkedin } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { findUserRegistration, updateRegistration } from "@/lib/storage";

const sidebarItems = [
    { to: "/student", label: "Overview", icon: LayoutDashboard },
    { to: "/student/ppt-upload", label: "PPT Upload", icon: Upload },
    { to: "/student/github", label: "GitHub Repo", icon: Github },
    { to: "/student/qr", label: "My QR Code", icon: QrCode },
    { to: "/student/notifications", label: "Notifications", icon: Bell },
    { to: "/student/verify", label: "Face Verify", icon: UserCheck },
    { to: "/student/grievance", label: "Grievance & Support", icon: HelpCircle },
    { to: "/student/linkedin", label: "LinkedIn Post", icon: Linkedin },
];

export default function FaceVerify() {
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [alreadyCaptured, setAlreadyCaptured] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);

    // Check if user already has a face image stored
    useEffect(() => {
        if (!user?.email) return;
        const reg = findUserRegistration(user.email);
        if (reg?.faceImage) {
            setCapturedImage(reg.faceImage);
            setAlreadyCaptured(true);
        }
    }, [user]);

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 480, height: 360, facingMode: "user" },
                audio: false,
            });
            setStream(mediaStream);
            setCameraActive(true);
            // Set video source after state update
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            }, 100);
        } catch (err) {
            toast({
                title: "Camera Error",
                description: "Could not access camera. Please allow camera permissions.",
                variant: "destructive",
            });
        }
    }, []);

    // Stop camera
    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
        setCameraActive(false);
    }, [stream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [stream]);

    // Capture photo from video feed
    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0);

        // Convert to base64 (JPEG for smaller size)
        const imageData = canvas.toDataURL("image/jpeg", 0.7);

        // Save to localStorage through registration
        if (user?.email) {
            const reg = findUserRegistration(user.email);
            if (reg) {
                updateRegistration(reg.id, { faceImage: imageData });
                toast({ title: "Photo Captured!", description: "Your face has been registered for verification." });
            } else {
                toast({
                    title: "Registration Required",
                    description: "Please register for a hackathon first.",
                    variant: "destructive",
                });
                return;
            }
        }

        setCapturedImage(imageData);
        setAlreadyCaptured(true);
        stopCamera();
    };

    return (
        <div className="flex min-h-screen pt-16">
            <DashboardSidebar items={sidebarItems} title="Student" />
            <main className="flex-1 p-6 md:p-8">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h1 className="mb-1 font-display text-2xl font-bold">Face Verification</h1>
                    <p className="mb-8 text-sm text-muted-foreground">
                        Capture your photo for identity verification at the event
                    </p>

                    <div className="glass-card max-w-lg p-6 space-y-5">
                        {/* Already captured state */}
                        {alreadyCaptured && capturedImage ? (
                            <div className="space-y-4 text-center">
                                <div className="flex items-center justify-center gap-2 text-success">
                                    <CheckCircle className="h-5 w-5" />
                                    <span className="font-semibold text-sm">Photo Registered</span>
                                </div>
                                <div className="mx-auto w-48 h-48 rounded-2xl overflow-hidden border-2 border-success/30">
                                    <img
                                        src={capturedImage}
                                        alt="Registered face"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Your photo has been saved. The admin will verify your identity on campus.
                                    <br />
                                    <strong>No retries allowed</strong> — contact admin if you need to re-capture.
                                </p>
                            </div>
                        ) : (
                            /* Camera capture interface */
                            <div className="space-y-4">
                                {!cameraActive ? (
                                    /* Start camera button */
                                    <div className="flex flex-col items-center gap-4 py-8">
                                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                                            <Camera className="h-12 w-12 text-primary/60" />
                                        </div>
                                        <p className="text-sm text-muted-foreground text-center max-w-xs">
                                            Take a clear photo of your face. Make sure your face is well-lit and clearly visible.
                                        </p>
                                        <button
                                            onClick={startCamera}
                                            className="btn-primary-glow px-8 py-3 text-sm font-bold"
                                        >
                                            START CAMERA
                                        </button>
                                    </div>
                                ) : (
                                    /* Live camera feed */
                                    <div className="space-y-4 text-center">
                                        <div className="mx-auto w-80 h-60 rounded-2xl overflow-hidden border-2 border-primary/30 bg-black">
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground animate-pulse">
                                            📸 Position your face clearly in the frame
                                        </p>
                                        <div className="flex justify-center gap-3">
                                            <button
                                                onClick={capturePhoto}
                                                className="btn-primary-glow px-8 py-3 text-sm font-bold"
                                            >
                                                CAPTURE PHOTO
                                            </button>
                                            <button
                                                onClick={stopCamera}
                                                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Hidden canvas for image capture */}
                    <canvas ref={canvasRef} className="hidden" />
                </motion.div>
            </main>
        </div>
    );
}
