"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2Icon, CheckIcon, LoaderCircleIcon } from "lucide-react";
import { usePlausible } from "next-plausible";
import useLocalStorage from "use-local-storage";

import { NeonGradientCard } from "./magic-ui/neon-gradient-card";
import { Button } from "./ui/button";

export const AnalyticsPopup = () => {
  const plausible = usePlausible();
  const [status, setStatus] = useState<
    "idle" | "loading" | "success-initial" | "success-final" | "hidden"
  >("idle");
  const [analyticsAccepted, setAnalyticsAccepted] = useLocalStorage(
    "analytics_accepted",
    false,
  );

  const handleAccept = () => {
    plausible("analytics-accepted");

    setStatus("loading");
  };

  useEffect(() => {
    if (status === "loading") {
      setTimeout(() => {
        setStatus("success-initial");
      }, 500);
    }

    if (status === "success-initial") {
      setTimeout(() => {
        setStatus("success-final");
      }, 10);
    }

    if (status === "success-final") {
      setTimeout(() => {
        setStatus("hidden");
      }, 500);
    }

    if (status === "hidden") {
      setTimeout(() => {
        setAnalyticsAccepted(true);
      }, 250);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (analyticsAccepted) return null;

  return (
    <NeonGradientCard
      className={cn(
        "fixed bottom-4 left-4 h-fit min-h-48 w-[400px] p-0 opacity-100 transition-opacity",
        status === "hidden" && "opacity-0",
      )}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Before you continue 🍪</h2>
        <p className="text-sm text-muted-foreground">
          <b>We collect anonymous analytics</b>. You can see more information
          about what we collect in our{" "}
          <a
            href="/privacy-policy"
            className="text-blue-500 hover:text-blue-600"
          >
            privacy policy
          </a>
          . Your code never leaves your browser.
        </p>

        <div className="flex w-full items-center justify-between">
          <div className="text-xs">
            Before continuing, confirm that you're ok with that.{" "}
          </div>

          <div className="relative flex w-fit gap-2">
            <Button onClick={handleAccept} className="gap-2">
              <StatusIcon status={status} />
              Accept
            </Button>
          </div>
        </div>
      </div>
    </NeonGradientCard>
  );
};

const StatusIcon = ({
  status,
}: {
  status: "idle" | "loading" | "success-initial" | "success-final" | "hidden";
}) => {
  switch (status) {
    case "idle":
      return <CheckIcon size={20} className="-ml-1" />;
    case "loading":
      return <LoaderCircleIcon size={20} className="-ml-1 animate-spin" />;
    case "success-initial":
    case "success-final":
    case "hidden":
      return (
        <CheckCircle2Icon
          size={20}
          className={cn(
            "-ml-1 scale-0 text-green-400 transition-transform",
            status === "success-final" && "scale-100",
          )}
        />
      );
  }
};
