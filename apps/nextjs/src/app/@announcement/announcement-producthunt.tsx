import type { VariantProps } from "class-variance-authority";
import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

export const AnnouncementProductHuntOutNow = () => {
  return (
    <AnnouncementRoot className="bg-orange-600 dark:bg-orange-600">
      <AnnouncementContainer>
        We are live on Product Hunt!{" "}
        <a
          className="cursor-pointer font-semibold text-orange-50 hover:text-white"
          href="https://www.producthunt.com/posts/svg-to-swiftui-converter"
          target="_blank"
          rel="noopener noreferrer"
        >
          Upvote us!
        </a>{" "}
        {"💛"}
      </AnnouncementContainer>
    </AnnouncementRoot>
  );
};

export const AnnouncementProductHuntComingSoon = () => {
  return (
    <AnnouncementRoot>
      <AnnouncementContainer>
        We are launching on Product Hunt on September 17th.{" "}
        <a
          className="cursor-pointer text-blue-500 hover:text-blue-600"
          download="svg-to-swiftui-producthunt.ics"
          href="/svg-to-swiftui-producthunt.ics"
        >
          Save the date!
        </a>{" "}
        {"❤️"}
      </AnnouncementContainer>
    </AnnouncementRoot>
  );
};

const announcementVariants = cva("group relative flex w-full items-center", {
  variants: {
    size: {
      small: "h-10 text-sm",
      medium: "h-20 text-sm",
      large: "h-30 text-default",
    },
    colorScheme: {
      default: "bg-zinc-100 text-black dark:bg-zinc-800 dark:text-white",
    },
  },
  defaultVariants: {
    size: "small",
    colorScheme: "default",
  },
});

const AnnouncementRoot = ({
  children,
  className,
  size,
}: PropsWithChildren<
  VariantProps<typeof announcementVariants> & { className?: string }
>) => {
  return (
    <div className={cn(announcementVariants({ size }), className)}>
      {children}
    </div>
  );
};

const announcementContainerVariants = cva("w-max", {
  variants: {
    containerSize: {
      default: "mx-auto max-w-screen-lg",
    },
  },
  defaultVariants: {
    containerSize: "default",
  },
});

const AnnouncementContainer = ({
  containerSize,
  children,
}: PropsWithChildren<VariantProps<typeof announcementContainerVariants>>) => {
  return (
    <div className={cn(announcementContainerVariants({ containerSize }))}>
      {children}
    </div>
  );
};
