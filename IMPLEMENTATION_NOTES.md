# 구현 진행 노트 (무인 자율 실행)

EXECUTION.md 프로토콜에 따라 `docs/superpowers/plans`의 계획 1→4를 순차 구현한다.
이 파일 하나로 밤새 진행 상황을 파악할 수 있게 누적 기록한다.

## 진행 로그

### 계획 1 — 기반 + 베이스 플로우 재생 ✅ 완료 (push: 606f54e)

- Task 1~15 전부 구현. 전체 17 테스트 통과, `tsc -b` 통과.
- autosave 테스트: 계획의 `advanceTimersByTimeAsync(0)`는 fake-indexeddb 내부
  setImmediate 큐를 플러시하지 못해 타임아웃 → `runAllTimersAsync()`로 교체(저장 동작은 동일).

### 계획 2 — 트랙 + 사운드 + 리스닝 모드 ✅ 완료 (push: d50ebd4)

- Task 1~9 전부 구현. 전체 33 테스트 통과, `tsc -b` 통과.
- Task 5 샘플: ffmpeg/sox 부재 → `scripts/gen-samples.mjs`로 퍼커션 6종을 직접 합성(자작=CC0),
  16-bit PCM WAV 내용을 `.ogg` 파일명으로 저장. decodeAudioData는 내용으로 판별하므로 실제 재생됨.

### 계획 3 — 레코드 모드 + 스텝 시퀀서 ✅ 완료 (push: dad31f5)

- Task 1~8 전부 구현. 전체 45 테스트 통과, `tsc -b` 통과.

### 계획 4 — 플레이 모드 + 채점 ✅ 완료

- Task 1~8 전부 구현. **전체 61 테스트 통과, `tsc -b` 통과, `npm run build`(vite) 통과(76 모듈).**

## 최종 상태

4개 계획 모두 구현 완료. `npm run test:run`(61 통과), `npx tsc -b`(통과), `npm run build`(통과).
`tsconfig.tsbuildinfo`(빌드 캐시)를 .gitignore에 추가하고 추적 해제함.

## 계획에서 벗어난 결정 (deviation)

- **test-setup.ts에 Node Blob/File 주입** (계획 1 Task 1·4 관련):
  jsdom의 `Blob`은 `.text()`/`.arrayBuffer()`를 구현하지 않아, 계획의 assets 테스트
  (`await got.blob.text()`)가 `text is not a function`으로 실패하고 structuredClone 시
  Blob이 일반 Object로 깨졌다. 근본 원인은 jsdom Blob의 기능 누락.
  해결: `src/test-setup.ts`에서 `globalThis.Blob`/`File`을 `node:buffer`의 spec 준수
  구현으로 교체. 앱 로직·계획의 테스트 단언은 그대로 유지. (실 브라우저는 원래 정상)
  - 부수효과: `node:buffer` import 타입 해석을 위해 `@types/node`를 devDependencies에 추가.

## 사람 검증 필요 (무인 환경에서 진짜로 확인 불가)

- 계획 1 Task 15 수동 검증(브라우저): 오디오 업로드→파형 표시, ▶ 재생/플레이헤드 이동,
  캔버스/슬라이더 탐색, 볼륨 변화, 새로고침 후 프로젝트 유지. (Web Audio·Canvas는 jsdom 미지원)
