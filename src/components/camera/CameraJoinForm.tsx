"use client";

import {
  useActionState,
  useOptimistic,
  startTransition,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Form from "next/form";
import { joinCameraAction, type CameraJoinState } from "@/app/actions/camera";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Camera, User, QrCode, Smartphone } from "lucide-react";

// Form validation schema
const cameraJoinFormSchema = z.object({
  participationCode: z
    .string()
    .min(1, "参加コードは必須です")
    .max(10, "参加コードは10文字以内で入力してください")
    .regex(/^[A-Z0-9]+$/, "参加コードは英数字（大文字）で入力してください"),
  participantName: z
    .string()
    .max(100, "参加者名は100文字以内で入力してください")
    .optional(),
});

type CameraJoinFormData = z.infer<typeof cameraJoinFormSchema>;

interface CameraJoinFormProps {
  initialParticipationCode?: string;
}

const initialState: CameraJoinState = {
  success: false,
  message: "",
};

export function CameraJoinForm({
  initialParticipationCode,
}: CameraJoinFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    joinCameraAction,
    initialState
  );

  // Client-side only state for device info
  const [isClient, setIsClient] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    platform: "unknown",
    browser: "unknown",
    screenResolution: "unknown",
  });

  // Optimistic state for immediate UI feedback
  const [optimisticState, setOptimisticState] = useOptimistic(
    state,
    (currentState, optimisticValue: Partial<CameraJoinState>) => ({
      ...currentState,
      ...optimisticValue,
    })
  );

  const {
    register,
    formState: { errors },
    setValue,
  } = useForm<CameraJoinFormData>({
    resolver: zodResolver(cameraJoinFormSchema),
    defaultValues: {
      participationCode: initialParticipationCode?.toUpperCase() || "",
      participantName: "",
    },
  });

  // Set initial participation code if provided
  useEffect(() => {
    if (initialParticipationCode) {
      setValue("participationCode", initialParticipationCode.toUpperCase());
    }
  }, [initialParticipationCode, setValue]);

  // Initialize client-side device info
  useEffect(() => {
    setIsClient(true);

    if (typeof window !== "undefined") {
      const userAgent = navigator.userAgent;
      const screenResolution = `${screen.width}x${screen.height}`;

      // Detect platform
      let platform = "desktop";
      if (/Android/i.test(userAgent)) platform = "android";
      else if (/iPhone|iPad|iPod/i.test(userAgent)) platform = "ios";
      else if (/Mobile/i.test(userAgent)) platform = "mobile";

      // Detect browser
      let browser = "unknown";
      if (/Chrome/i.test(userAgent)) browser = "chrome";
      else if (/Firefox/i.test(userAgent)) browser = "firefox";
      else if (/Safari/i.test(userAgent)) browser = "safari";
      else if (/Edge/i.test(userAgent)) browser = "edge";

      setDeviceInfo({
        platform,
        browser,
        screenResolution,
      });
    }
  }, []);

  // Detect device information (client-side only)
  const getDeviceInfo = () => {
    // Check if we're on the client side
    if (typeof window === "undefined") {
      return {
        userAgent: "unknown",
        screenResolution: "unknown",
        platform: "unknown",
        browser: "unknown",
        connectionType: "unknown",
      };
    }

    const userAgent = navigator.userAgent;
    const screenResolution = `${screen.width}x${screen.height}`;

    // Detect platform
    let platform = "desktop";
    if (/Android/i.test(userAgent)) platform = "android";
    else if (/iPhone|iPad|iPod/i.test(userAgent)) platform = "ios";
    else if (/Mobile/i.test(userAgent)) platform = "mobile";

    // Detect browser
    let browser = "unknown";
    if (/Chrome/i.test(userAgent)) browser = "chrome";
    else if (/Firefox/i.test(userAgent)) browser = "firefox";
    else if (/Safari/i.test(userAgent)) browser = "safari";
    else if (/Edge/i.test(userAgent)) browser = "edge";

    // Detect connection type (if available)
    const connection =
      (navigator as unknown as { connection?: unknown }).connection ||
      (navigator as unknown as { mozConnection?: unknown }).mozConnection ||
      (navigator as unknown as { webkitConnection?: unknown }).webkitConnection;
    const connectionType = (connection as { effectiveType?: string })?.effectiveType || "unknown";

    return {
      userAgent,
      screenResolution,
      platform,
      browser,
      connectionType,
    };
  };

  // Enhanced form action that includes device info and client-side validation
  const enhancedFormAction = async (formData: FormData) => {
    console.log('Form submission started');
    
    // Client-side validation using react-hook-form
    const participationCode = formData.get("participationCode") as string;
    const participantName = formData.get("participantName") as string;
    
    const validationResult = cameraJoinFormSchema.safeParse({
      participationCode: participationCode?.toUpperCase(),
      participantName: participantName || undefined,
    });
    
    if (!validationResult.success) {
      // Handle validation errors
      console.error('Client-side validation failed:', validationResult.error);
      return;
    }
    
    startTransition(() => {
      // Show optimistic feedback
      setOptimisticState({
        success: false,
        message: "イベントに参加中...",
      });

      // Add device information to form data
      const deviceInfo = getDeviceInfo();
      formData.append("userAgent", deviceInfo.userAgent);
      formData.append("screenResolution", deviceInfo.screenResolution);
      formData.append("platform", deviceInfo.platform);
      formData.append("browser", deviceInfo.browser);
      formData.append("connectionType", deviceInfo.connectionType);

      // Ensure participation code is uppercase
      if (participationCode) {
        formData.set("participationCode", participationCode.toUpperCase());
      }

      console.log('Calling formAction with participation code:', participationCode?.toUpperCase());
      formAction(formData);
    });
  };

  // Handle successful join
  useEffect(() => {
    if (state.success && state.eventId && state.roomToken) {
      console.log('Storing session data:', {
        eventId: state.eventId,
        roomToken: state.roomToken ? 'present' : 'missing',
        roomName: state.roomName || 'empty',
        cameraConnectionId: state.cameraConnectionId || 'missing',
        authToken: state.authToken ? 'present' : 'missing',
        liveKitToken: state.liveKitToken ? 'present' : 'missing'
      });

      // Store authentication tokens in localStorage for persistent auth
      if (state.authToken) {
        localStorage.setItem("harecame-token", state.authToken);
        
        // Store user auth data
        const authUser = {
          id: state.cameraConnectionId || `camera-${Date.now()}`,
          type: 'camera',
          eventId: state.eventId,
          participantName: document.querySelector<HTMLInputElement>('#participantName')?.value,
          token: state.authToken,
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
        };
        localStorage.setItem("harecame-auth", JSON.stringify(authUser));
      }

      // Store room information in sessionStorage for the camera interface
      sessionStorage.setItem("harecame_room_token", state.roomToken);
      sessionStorage.setItem("harecame_room_name", state.roomName || "");
      sessionStorage.setItem("harecame_event_id", state.eventId);
      
      // Store LiveKit token if available
      if (state.liveKitToken) {
        sessionStorage.setItem("harecame_livekit_token", state.liveKitToken);
      }
      
      // Store camera connection ID
      if (state.cameraConnectionId) {
        sessionStorage.setItem("harecame_camera_connection_id", state.cameraConnectionId);
      }
      
      // Store participant name if provided
      const participantName = document.querySelector<HTMLInputElement>('#participantName')?.value;
      if (participantName) {
        sessionStorage.setItem("harecame_participant_name", participantName);
      }

      console.log('Session storage set, redirecting to:', `/camera/${state.eventId}`);

      // Redirect to camera interface
      router.push(`/camera/${state.eventId}`);
    }
  }, [state.success, state.eventId, state.roomToken, state.roomName, state.cameraConnectionId, state.authToken, state.liveKitToken, router]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4 sm:pb-6">
        <CardTitle className="flex items-center justify-center gap-2 text-lg sm:text-xl">
          <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
          カメラで参加
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          参加コードを入力してライブ配信に参加しましょう
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form action={enhancedFormAction} className="space-y-4">
          {/* Participation Code */}
          <div className="space-y-2">
            <Label
              htmlFor="participationCode"
              className="flex items-center gap-2"
            >
              <QrCode className="h-4 w-4" />
              参加コード *
            </Label>
            <Input
              id="participationCode"
              placeholder="例: SPRING"
              {...register("participationCode")}
              className={`text-center font-mono text-lg sm:text-xl min-h-[48px] touch-manipulation ${
                errors.participationCode ? "border-red-500" : ""
              }`}
              disabled={isPending}
              style={{ textTransform: "uppercase" }}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
                register("participationCode").onChange(e);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            {errors.participationCode && (
              <p className="text-sm text-red-500">
                {errors.participationCode.message}
              </p>
            )}
            {state.errors?.participationCode && (
              <p className="text-sm text-red-500">
                {state.errors.participationCode[0]}
              </p>
            )}
          </div>

          {/* Participant Name */}
          <div className="space-y-2">
            <Label
              htmlFor="participantName"
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              参加者名（任意）
            </Label>
            <Input
              id="participantName"
              placeholder="例: 田中太郎"
              {...register("participantName")}
              className={`min-h-[48px] touch-manipulation ${errors.participantName ? "border-red-500" : ""}`}
              disabled={isPending}
              autoComplete="name"
            />
            {errors.participantName && (
              <p className="text-sm text-red-500">
                {errors.participantName.message}
              </p>
            )}
            {state.errors?.participantName && (
              <p className="text-sm text-red-500">
                {state.errors.participantName[0]}
              </p>
            )}
          </div>

          {/* Device Info Display */}
          {isClient && (
            <div className="p-3 bg-muted rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  デバイス情報
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>プラットフォーム: {deviceInfo.platform}</div>
                <div>ブラウザ: {deviceInfo.browser}</div>
                <div>画面解像度: {deviceInfo.screenResolution}</div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {optimisticState.message && (
            <Alert
              className={
                optimisticState.success
                  ? "border-green-200 bg-green-50"
                  : state.errors
                  ? "border-red-200 bg-red-50"
                  : "border-blue-200 bg-blue-50"
              }
            >
              <AlertDescription
                className={
                  optimisticState.success
                    ? "text-green-700"
                    : state.errors
                    ? "text-red-700"
                    : "text-blue-700"
                }
              >
                {optimisticState.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button - タッチ最適化 */}
          <Button 
            type="submit" 
            disabled={isPending} 
            className="w-full min-h-[48px] touch-manipulation text-base sm:text-sm"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                参加中...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                カメラで参加
              </>
            )}
          </Button>

          {/* Help Text */}
          <div className="text-center text-sm text-muted-foreground">
            <p>参加コードはイベント主催者から受け取ってください</p>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
