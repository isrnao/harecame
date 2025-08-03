import * as React from "react"

import { cn } from "@/lib/utils"
import { hasTransformStyle, type VideoStyleProps } from "@/lib/type-guards"

// React 19: ComponentPropsWithRefを使用したref as propパターンの実装例
// forwardRefを使用せずに、refを通常のpropsとして受け取る
function Video({
  className,
  autoPlay = true,
  muted = true,
  playsInline = true,
  // 追加: プレビュー用に水平反転するかどうかを選べるフラグ
  mirror = false,
  ...props
}: React.ComponentPropsWithRef<"video"> & { mirror?: boolean }) {
  return (
    <video
      data-slot="video"
      className={cn(
        "w-full h-full object-cover rounded-md bg-black",
        // mirror=true のときだけ水平反転。オーバーレイ等の別DOMは影響なし
        mirror && "transform -scale-x-100",
        className
      )}
      // CSS transform を上書きしてしまう inline style にも対応（既存の transform を保ちつつ scaleX を足す）
      style={(() => {
        const existingStyle = props.style;
        const safeStyle = hasTransformStyle(existingStyle) ? existingStyle : {};
        const baseTransform = safeStyle.transform || "translateZ(0)";
        const baseWebkitTransform = safeStyle.WebkitTransform || "translateZ(0)";

        return {
          ...safeStyle,
          transform: `${baseTransform}${mirror ? " scaleX(-1)" : ""}`,
          WebkitTransform: `${baseWebkitTransform}${mirror ? " scaleX(-1)" : ""}`,
        } satisfies VideoStyleProps;
      })()}
      autoPlay={autoPlay}
      muted={muted}
      playsInline={playsInline}
      {...props}
    />
  )
}

export { Video }
