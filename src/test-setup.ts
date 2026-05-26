import "fake-indexeddb/auto";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";

// jsdom의 Blob/File은 text()/arrayBuffer()를 구현하지 않아 structuredClone 시 깨진다.
// node:buffer의 spec 준수 구현으로 교체해 IndexedDB 라운드트립과 디코딩 글루를 테스트 가능하게 한다.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;
