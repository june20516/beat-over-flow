import { useEffect, useState } from "react";
import screen from "./ui/screen.module.css";
import { ProjectList } from "./ui/ProjectList";
import { Editor } from "./ui/Editor";
import { Home } from "./ui/Home";
import { PlayPlaceholder } from "./ui/PlayPlaceholder";
import { NotFound } from "./ui/NotFound";
import { usePathname, matchRoute, navigate } from "./router/router";
import { useStore } from "./store/useStore";
import { loadProject } from "./persistence/projects";
import { startAutosave } from "./store/autosave";
import { LoadingOverlay } from "./ui/primitives/LoadingOverlay";
import { AssetLibraryModal } from "./ui/asset-library/AssetLibraryModal";

function EditorRoute({ projectId }: { projectId: string }) {
  const setProject = useStore((s) => s.setProject);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    useStore.getState().project?.id === projectId ? "ready" : "loading",
  );

  useEffect(() => {
    if (useStore.getState().project?.id === projectId) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    (async () => {
      const loaded = await loadProject(projectId);
      if (cancelled) return;
      if (loaded) {
        setProject(loaded);
        setStatus("ready");
      } else {
        setStatus("notfound");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, setProject]);

  if (status === "loading")
    return (
      <div className={screen.screen}>
        <div className={screen.screenSpinner} />
        <p className={screen.screenLead}>불러오는 중…</p>
      </div>
    );
  if (status === "notfound") return <NotFound />;
  return <Editor onExit={() => navigate("/edit")} />;
}

export function App() {
  const pathname = usePathname();
  const route = matchRoute(pathname);

  useEffect(() => {
    const stop = startAutosave();
    return stop;
  }, []);

  return (
    <>
      {(() => {
        switch (route.kind) {
          case "home":
            return <Home />;
          case "projectList":
            return <ProjectList onOpen={(project) => navigate(`/edit/${project.id}`)} />;
          case "editor":
            return <EditorRoute key={route.projectId} projectId={route.projectId} />;
          case "play":
            return <PlayPlaceholder />;
          case "notFound":
            return <NotFound />;
        }
      })()}
      <AssetLibraryModal />
      <LoadingOverlay />
    </>
  );
}
