import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] p-6 flex items-center justify-center" dir="rtl">
          <Card className="max-w-md w-full border-destructive/20 bg-destructive/5 text-center shadow-lg">
            <CardHeader className="pb-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive grid place-items-center mb-2">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">
                {this.props.fallbackTitle ?? "حدث خطأ غير متوقع"}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {this.props.fallbackDescription ??
                  "نعتذر عن هذا الخطأ، حدثت مشكلة أثناء عرض هذا الجزء من المنصة."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error?.message && (
                <div className="p-3 bg-background/80 rounded-lg text-xs font-mono text-destructive/80 text-left overflow-x-auto border">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleReset}
                  className="flex items-center gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" />
                  إعادة المحاولة
                </Button>
                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className="flex items-center gap-1.5"
                >
                  <Link to="/">
                    <Home className="h-4 w-4" />
                    الصفحة الرئيسية
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
