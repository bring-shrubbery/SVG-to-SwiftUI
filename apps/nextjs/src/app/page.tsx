import { Navbar } from "@/components/Navbar";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Toolbar } from "@/components/toolbar";

import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { App } from "./App";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="block text-black dark:text-white">
        <App />
      </main>
      {/* <ConsentToast /> */}
    </>
  );
}
