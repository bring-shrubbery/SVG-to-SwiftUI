import { Navbar } from "@/components/Navbar";
import { AnnouncementBar } from "@/components/announcement-bar";
import { App } from "./App";
import { getIconContent, getIconList } from "@/lib/utils";

export default async function Home() {
  const iconList = await getIconList();
  const content = await getIconContent(iconList);

  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="block text-black dark:text-white">
        <App exampleList={content} />
      </main>
      {/* <ConsentToast /> */}
    </>
  );
}
