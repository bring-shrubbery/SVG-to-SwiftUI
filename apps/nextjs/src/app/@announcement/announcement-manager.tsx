"use client";

import {
  AnnouncementProductHuntComingSoon,
  AnnouncementProductHuntOutNow,
} from "./announcement-producthunt";

export const AnnouncementManager = () => {
  // Launch on September 17th, 2024
  const isProductHuntActive = Date.now() > new Date("2024-09-17").getTime();

  return isProductHuntActive ? (
    <AnnouncementProductHuntOutNow />
  ) : (
    <AnnouncementProductHuntComingSoon />
  );
};
