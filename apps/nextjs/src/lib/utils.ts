import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import urlJoin from "url-join";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getHostname = () => {
  return process.env.NODE_ENV === "production"
    ? "https://svg-to-swiftui.quassum.com"
    : "http://localhost:3000";
};

export const getIconList = async () => {
  const url = urlJoin(getHostname(), "lucide.txt");
  const res = await fetch(url);
  const text = (await res.text()).trim();
  return text.split("\n");
};

export const getIconContent = async (
  list: string[]
): Promise<{ example: string; content: string }[]> => {
  return Promise.all(
    list.map((iconName) =>
      fetch(urlJoin(getHostname(), "/lucide", iconName))
        .then((res) => res.text())
        .then((text) => text.trim())
        .then((content) => ({ content, example: iconName }))
    )
  );
};
