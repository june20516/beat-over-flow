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

---

# Editor v2 재편 (무인 자율 실행 2회차)

`docs/superpowers/EXECUTION.md` v2 프로토콜. v2 계획 6개를 1→6 순차 구현.
v2 시작 베이스라인: `736596c`, 테스트 71 통과, `tsc -b` 통과.

## 계획 v2-1 (뷰포트/타임라인)

### Task 1: viewportMath 순수함수 — ✅ 완료
- 커밋 `d27efd9`. viewportMath.ts + test (16 테스트). 전체 87 통과, tsc OK.
- 스펙 리뷰 ✅ / 코드품질 리뷰 ✅ Approved.
- 리뷰 Minor(미반영, 사유): `xToTime` `pxPerMs===0` 시 Infinity/NaN → 계약 §4 순수 공식
  유지 우선 + 호출부 가드. 테스트 분리/centeredScrollLeftPx(Task7)는 계획대로 둠.

### Task 2: useViewport 스토어 — ✅ 완료
- 커밋 `dfc4303`. viewport.ts + test (7 테스트). 전체 94 통과, tsc OK.
- 스펙 리뷰 ✅ / 코드품질 리뷰 ✅ Approved.
- 리뷰 메모(Task 7에서 챙길 것): followPlayhead/setFollowPlayhead/followTo 추가 +
  `panByPx`에 `followPlayhead:false` + 테스트 `reset()`에 `followPlayhead:true` 동기화.

### Task 3: BaseFlowLane — ✅ 완료
- 커밋 `a5b16ca`. BaseFlowLane.tsx. 전체 94 통과, tsc OK. 결합 리뷰 ✅ Approved.

### Task 4: PlayheadOverlay — ✅ 완료
- 커밋 `0f91dca`. PlayheadOverlay.tsx. 전체 94 통과, tsc OK. 결합 리뷰 ✅ Approved.

### Task 5: Timeline 컨테이너 — ✅ 완료
- 커밋 `f2957d1`. Timeline.tsx. 전체 94 통과, tsc OK. 결합 리뷰 ✅ Approved.

### Task 6: Editor 연결 + TimelineCanvas 삭제 — ✅ 완료
- 커밋 `f9d6b3d`. Editor가 Timeline 사용, render/TimelineCanvas.tsx 삭제, 잔존 참조 0.
  전체 94 통과, tsc OK. 스펙+품질 리뷰 ✅ Approved.
- 브라우저 검증(헤드리스 Chrome, `/tmp/bof-driver/v2-1-shot.mjs`): 홈→편집→새 프로젝트
  업로드→에디터. `.timeline__arrange`/`.base-flow-lane`/canvas 렌더 확인,
  `.playhead-overlay__line` 존재 확인. shift+wheel 줌 시 캔버스가 더 조밀한 막대로 재렌더됨
  (샘플 3초라 줌 배율 폭은 minPxPerMs↔MAX로 좁음). 스크린샷: `/tmp/bof-v2-{editor,play,zoom,pan}.png`.
- 추가 수정 커밋 `9100df9`: 브라우저 검증에서 "Unable to preventDefault inside passive event
  listener" 경고 확인 → 계획 Task5 비고대로 Timeline wheel을 `addEventListener(...,{passive:false})`
  네이티브 리스너로 전환. 재검증 시 경고 사라짐(남은 콘솔 에러는 favicon 404뿐, 무해).

### Task 7: 재생 중 auto-follow — ✅ 완료
- 커밋 `c2e9adf`. centeredScrollLeftPx + followPlayhead/setFollowPlayhead/followTo,
  panByPx가 follow 해제, runtime(play/seek/RAF) 연동. 전체 101 통과, tsc OK.
- 스펙 리뷰 ✅ / 코드품질 리뷰 ✅ Approved.
  - 리뷰 Minor(미반영): seek가 `source.currentTimeMs()`를 (스토어 경유) 2회 읽음 → 계획이 명시한
    `followTo(useStore.getState().playheadMs)` 형태이고 setPlayheadMs가 동기라 동작 정확. 계획 준수 유지.
    `setFollowPlayhead(b)` 파라미터명, zoomAt가 follow 유지(계약 §5 의도)도 그대로 둠.
- 브라우저 검증(헤드리스, `/tmp/bof-driver/follow.mjs`): **auto-follow 확인됨.**
  arrangeWidth=1016(중앙≈508). 최대 줌인 후 재생 시 플레이헤드 x: 176→355(초반, scroll0)→
  508→508→505(중반, **중앙 고정**)→588(종반, scroll 최대 클램프로 우측 이동). 의도한 추종 동작.
  콘솔 에러 favicon 404 외 없음. 수동팬 해제/재생 재활성은 단위테스트로 검증(시각 느낌은 사람 확인 권장).

## 계획 v2-1 결과 요약
- 7개 태스크 전부 완료. 커밋 d27efd9 / dfc4303 / a5b16ca / 0f91dca / f2957d1 / f9d6b3d / 9100df9(passive fix) / c2e9adf.
- 최종 `yarn test:run` 101 통과, `yarn tsc -b` 통과.

## Editor v2 — 사람 검증 필요 항목
- (계획 v2-1) 휠 팬/줌의 정밀한 커서 앵커 정확도·부드러움: 샘플이 3초로 짧아 줌 배율 폭이
  좁아 헤드리스로는 앵커 정확도까지 단정 불가(순수함수 zoomedViewport 단위테스트로 수학은 검증됨).
  더 긴 오디오로 사람이 shift+wheel 줌/가로 팬 시 커서 기준 확대·페이지 스크롤 없음 확인 권장.
- (계획 v2-1) auto-follow의 "수동 팬 시 추종 해제 → 재생 누르면 재활성"의 실제 사용 느낌(단위테스트는 통과).
