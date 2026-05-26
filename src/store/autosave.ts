import { useStore } from "./useStore";
import { saveProject } from "../persistence/projects";
import { debounce } from "../domain/debounce";
import type { Project } from "../types";

/** project 상태 변경을 구독해 디바운스 저장한다. 구독 해제 함수를 반환. */
export function startAutosave(delayMs = 500): () => void {
  const persist = debounce((p: Project) => {
    void saveProject(p);
  }, delayMs);

  return useStore.subscribe((state, prev) => {
    if (state.project && state.project !== prev.project) {
      persist(state.project);
    }
  });
}
