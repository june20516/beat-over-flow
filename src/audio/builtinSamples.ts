export interface BuiltinSample {
  id: string;
  label: string;
}

export const BUILTIN_SAMPLES: BuiltinSample[] = [
  { id: "kick", label: "킥" },
  { id: "snare", label: "스네어" },
  { id: "hat", label: "하이햇" },
  { id: "clap", label: "클랩" },
  { id: "tom", label: "톰" },
  { id: "perc", label: "퍼커션" },
];

export function sampleUrl(id: string): string {
  return `/samples/${id}.ogg`;
}
