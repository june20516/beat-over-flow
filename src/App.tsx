import { useEffect, useState } from "react";
import { ProjectList } from "./ui/ProjectList";
import { Editor } from "./ui/Editor";
import { startAutosave } from "./store/autosave";

export function App() {
  const [view, setView] = useState<"list" | "editor">("list");

  useEffect(() => {
    const stop = startAutosave();
    return stop;
  }, []);

  return view === "list" ? (
    <ProjectList onOpen={() => setView("editor")} />
  ) : (
    <Editor onExit={() => setView("list")} />
  );
}
