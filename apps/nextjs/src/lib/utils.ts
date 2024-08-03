import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import urlJoin from "url-join";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getHostname = () => {
  if ("VERCEL" in process.env && process.env.VERCEL === "1") {
    return `https://${process.env.VERCEL_URL}`;
  }

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
  list: string[],
): Promise<{ example: string; content: string }[]> => {
  return Promise.all(
    list.map((iconName) =>
      fetch(urlJoin(getHostname(), "/lucide", iconName))
        .then((res) => res.text())
        .then((text) => text.trim())
        .then((content) => ({ content, example: iconName })),
    ),
  );
};

export const getGithubStarsForRepo = async (repo: string) => {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    next: {
      revalidate: 60,
    },
  });
  const data = (await res.json()) as unknown as { stargazers_count: string };
  const stars = parseInt(data.stargazers_count);
  return isNaN(stars) ? undefined : stars;
};
