"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  fullScreen?: boolean;
  className?: string;
  variant?: "default" | "primary" | "secondary";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const variantClasses = {
  default: "text-muted-foreground",
  primary: "text-primary",
  secondary: "text-muted-foreground/70",
};

export function LoadingSpinner({
  size = "md",
  text,
  fullScreen = false,
  className,
  variant = "default",
}: LoadingSpinnerProps) {
  const spinnerContent = (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        fullScreen ? "min-h-screen" : "p-8",
        className
      )}
    >
      <Loader2
        className={cn(
          "animate-spin",
          sizeClasses[size],
          variantClasses[variant],
          text && "mb-3"
        )}
      />
      {text && (
        <p className={cn("text-sm font-medium", variantClasses[variant])}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 backdrop-blur-sm z-50 flex items-center justify-center">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
}

// Componente específico para páginas
export function PageLoader({ text = "Cargando..." }: { text?: string }) {
  return (
    <LoadingSpinner
      size="lg"
      text={text}
      fullScreen
      variant="primary"
      className="bg-gray-50"
    />
  );
}

// Componente para botones
export function ButtonSpinner({ size = "sm" }: { size?: "sm" | "md" }) {
  return <Loader2 className={cn("animate-spin", sizeClasses[size])} />;
}

// Componente para contenido inline
export function InlineLoader({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <LoadingSpinner size="sm" text={text} variant="secondary" />
    </div>
  );
}

export default LoadingSpinner;
