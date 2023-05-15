import { Navbar } from "@/components/Navbar";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Toolbar } from "@/components/toolbar";
import { cookies } from "next/headers";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="block h-[calc(100%-128px)]">
        <Toolbar />
      </main>
      ;{/* <ConsentToast /> */}
    </>
  );
}
