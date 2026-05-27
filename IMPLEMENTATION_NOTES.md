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

## 계획 v2-2 (행 분해 + 마커 에디터 + 포커스)

### Task 1~5 — ✅ 완료
- Task1 markerMath 순수함수: 커밋 `18e2114`(9 테스트). 스펙+품질 ✅.
- Task2 TrackEditor: 커밋 `55f8e74`. 결합 리뷰 ✅.
- Task3 MarkerEditor(포커스 SVG/언포커스 캔버스): 커밋 `53a0287`. 결합 리뷰 ✅.
- Task4 TrackRow: 커밋 `77b30d9`. 결합 리뷰 ✅.
- Task5 styles.css v2 행 분해 블록(append): 커밋 `f649c3b`. v1 보존 확인.
- 전체 110 통과, tsc OK 유지.

### Task 6 — ✅ 완료 (아키텍처 통합, 컨트롤러 직접 구현)
- 커밋 `7c083d0`. 스펙+품질 리뷰 ✅ Approved.
- **계획↔계약 불일치 해소(중요):** 계획 v2-2 파일목록엔 Timeline.tsx 수정이 없으나, 설계 §4와
  계약 §1이 `TrackRow[]`를 Timeline 하위(헤더 행 아래)로 규정. 프로토콜의 "계약 우선" 원칙에 따라
  Timeline.tsx를 헤더 행(좌 고정 컬럼: 트랙 헤더+추가버튼 | 우 arrange: BaseFlowLane+PlayheadOverlay)
  + `.timeline__rows`(TrackRow[])로 재구성. Timeline이 store에서 tracks/selectedTrackId/addTrack 구독.
- 브라우저 검증(헤드리스, `/tmp/bof-driver/v2-2-shot.mjs`) — **모두 확인됨:**
  - 트랙 행 2컬럼(editor|lane) 렌더, **컬럼 정렬 정확**(arrangeLeft==laneLeft==404, alignDiff=0).
  - 포커스 확장: collapsed 40px → focused 88px(트랜지션, 요구 9).
  - 하이브리드: 포커스 트랙=SVG 1개 / 언포커스=캔버스 오버뷰 1개(요구 11).
  - 마커 편집(레코드+라이트+포커스): 좌클릭 0→2 추가, 우클릭 2→1 삭제(요구 5). 게이팅 동작.
  - 콘솔 에러 favicon 404뿐. 스크린샷: `/tmp/bof-v22-{editor,markers}.png`.

### Task 7 — ✅ 완료 (브라우저 검증)
- 위 Task 6 검증으로 요구 5·9·11 시각 동작 모두 헤드리스 확인됨(사람 미검증 항목 없음).
- 가시영역 가상화(스크롤/줌 시 [0,width]만): markerMath 단위테스트로 검증, 시각은 v2-1 줌 검증과 동일 뷰포트.

## 계획 v2-2 결과 요약
- 7개 태스크 전부 완료. 전체 110 통과, tsc 통과.
- 알려진 향후 개선(결함 아님): wheel 팬/줌 리스너가 헤더 arrange에만 등록됨(공유 뷰포트라 모든 레인에
  반영되나, 트랙 레인 위에서 직접 휠 시도는 페이지 스크롤). 필요 시 후속 계획에서 컨테이너로 확장 가능.

## 계획 v2-3 (트랙에디터 컨트롤 고도화) — ✅ 완료
- Task1 formatKeyCode(TDD, 16테스트): 커밋 `4770a2b`. 스펙+품질 ✅.
- Task2 clearMarkers 액션(TDD, append): 커밋 `2f7a574`. 스펙+품질 ✅.
- Task3 KeyCap: 커밋 `9973c2a`. 결합 리뷰 ✅.
- Task4 StatusGrid(+CSS): 커밋 `255f1fc`. 결합 리뷰 ✅.
- Task5 VolumeControl(+CSS): 커밋 `14d981a`. 결합 리뷰 ✅.
- Task6 TrackEditor 통합: 커밋 `5a5d061`. 스펙+품질 ✅.
- 전체 130 통과, tsc OK.
- Task7 브라우저 검증(헤드리스, `/tmp/bof-driver/v2-3-shot.mjs`) — **모두 확인됨:**
  - StatusGrid 4칸[M,L,P,W], 선택 1개, 라이트 클릭 시 선택 이동(요구 2).
  - KeyCap: "Key" → A키 입력 → "A"(formatKeyCode, 요구 3).
  - VolumeControl: 스피커 클릭→팝오버(세로 range) 표시 → Escape로 닫힘(요구 1).
  - 마커 비우기 버튼: 마커 2 → 0(요구 7).
  - 콘솔 에러 favicon 404뿐. 스크린샷 `/tmp/bof-v23-controls.png`.

## 계획 v2-4 (드래그 순서변경, 요구 8) — ✅ 완료
- Task1 dnd-kit 설치(core/sortable/utilities): 커밋 `810712d`.
- Task2+3 reorderTracks(TDD, RED→GREEN, 9테스트): 커밋 `e56fa1f`. 범위가드/단일전이. 스펙+품질 ✅.
- Task4 영속 통합테스트(autosave→IndexedDB 라운드트립): 커밋 `c742a65`. 결합 리뷰 ✅(실제 영속 검증).
- Task5 TrackEditor 드래그핸들(useSortable+DotsSixVertical): 커밋 `e057d54`. 결합 리뷰 ✅.
- Task6 Timeline DndContext/SortableContext 래핑: 커밋 `e7c5692`. 결합 리뷰 ✅.
- 전체 141 통과, tsc OK.
- Task7 브라우저 검증(헤드리스, `/tmp/bof-driver/v2-4-shot.mjs`) — **드래그 재정렬 종단 확인됨:**
  - 트랙마다 드래그 핸들(⠿ DotsSixVertical) 렌더(handles=3).
  - **실제 포인터 드래그**(핸들을 단계적 mouse.move로): ["트랙1","트랙2","트랙3"] → 트랙1을 3행 아래로
    → ["트랙2","트랙3","트랙1"]. reorderTracks(0,2) 종단 동작 확인(reordered=true). 우측 레인은 같은 행이라 자동 동기.
  - 콘솔 에러 favicon 404뿐. 스크린샷 `/tmp/bof-v24-{handles,afterdrag}.png`.
  - 영속(새로고침 후 순서 유지)은 autosave 통합테스트(Task4)로 검증됨.
- 사람 검증 권장(무인 확정 어려움): 드래그 중 시각 피드백(opacity/transform) 느낌, 핸들 외 컨트롤이
  드래그와 충돌하지 않는 실사용 감(8px distance 가드는 적용됨, 헤드리스 클릭/입력은 정상 동작 확인).

## 계획 v2-5 (전역 툴바 + 인라인 시퀀서, 요구 4) — ✅ 완료
- Task1 useEditorUi(TDD, 6테스트): 커밋 `2a258fd`. 스펙+품질 ✅.
- Task2 EditorToolbar(+CSS): 커밋 `2b27638`. (요구4 통합 리뷰에 포함 ✅)
- Task3-5 통합(시퀀서 인라인화): 커밋 `e65ccd2`. StepSequencerPanel props제거→useEditorUi,
  TrackRow 자식 렌더, Editor 재배선. 스펙+품질 ✅.
  - **프로토콜 결정:** 계획은 Task 3/4/5를 분리했으나 중간 단계에서 tsc가 깨져(Editor가 props 없는
    패널에 props 전달) "태스크 종료 시 그린" 규약 위반 → 세 변경을 한 그린 커밋으로 통합.
- 전체 147 통과, tsc OK.
- Task6 브라우저 검증(헤드리스, `/tmp/bof-driver/v2-5-shot.mjs`) — **모두 확인됨:**
  - 툴바 버튼 [시퀀서, 줌 리셋] 렌더, 시퀀서 토글 active 강조.
  - 포커스 없으면 토글해도 시퀀서 안 보임 / 포커스 트랙 아래 인라인 표시(요구 4 게이팅).
  - **시퀀서 body 좌측 = MarkerEditor lane 좌측(alignDiff=0, gutter 384px 정렬).**
  - 포커스 변경(트랙1→2): 시퀀서가 새 행으로 이동 + 칸수 16→8 초기화 + 열림 유지(resetForTrack).
  - 토글 off 시 시퀀서 노드 사라짐. 콘솔 에러 favicon 404뿐. 스크린샷 `/tmp/bof-v25-seq.png`.
  - 줌 리셋 버튼: 존재+fitAll 결선 확인(시각 fitAll 동작은 v2-1에서 검증). 시퀀서 칸 토글/반복채우기는 v1 기능 보존.

## 계획 v2-6 (키보드 레이어, 요구 6·12) — ✅ 완료
- Task1-3 transport 모델/액션/기본값: 커밋 `ad0f2da`/`0bb6947`/`37fdd80`. setPlayPauseKey TDD(5테스트). 스펙+품질 ✅.
- Task4 decideKeyAction(TDD, 12테스트): 커밋 `d507dd4`. 계약 §9 순서(repeat→입력필드→모드차단→재생키→트랙키). 스펙+품질 ✅.
- Task5 KeyboardController 재구성: 커밋 `697d520`. decideKeyAction 기반 + 모드차단 + 재생토글, record/perform 회귀 없음. 스펙+품질 ✅.
- Task6 TransportBar 재생키 KeyCap: 커밋 `35250fa`. setPlayPauseKey 연결. 스펙+품질 ✅.
- 전체 164 통과, tsc OK.
- Task7 브라우저 검증(헤드리스, `/tmp/bof-driver/v2-6-{shot,toggle}.mjs`) — **핵심 동작 확인됨:**
  - 재생키 바인딩: TransportBar KeyCap "Key"→"P"(formatKeyCode, 요구 12).
  - **재생키(P)로 토글**: seek 0→704→1403ms 전진(재생) → pause 후 정지. record 모드에서도 1408→2203 전진
    → 모든 모드에서 토글(요구 12) 확인. 콘솔 에러 0.
  - 레코드 모드 트랙키(J) → 마커 0→1 추가(요구 6 경로, record 동작 회귀 없음).
  - preventDefault(play/record 모드 기본동작 차단, 요구 6): decideKeyAction 단위테스트 + 컨트롤러 e.preventDefault() 결선으로 검증.
- 사람 검증 권장(헤드리스 한계): play/record 모드에서 Space 등으로 페이지 스크롤/버튼클릭이 실제로 안 일어나는
  시각 확인, perform 모드 소리·채점의 청취 확인(Web Audio 출력은 헤드리스로 청취 불가).

# 🎉 Editor v2 — 6개 계획 전부 완료
- v2-1(뷰포트/타임라인) · v2-2(행 분해/마커) · v2-3(트랙에디터 컨트롤) · v2-4(DnD 정렬) ·
  v2-5(툴바/인라인 시퀀서) · v2-6(키보드) 모두 구현·검증·푸시 완료.
- 최종: `yarn test:run` 164 통과, `yarn tsc -b` 통과. 브랜치 `feat/editor-v2`.

## Editor v2 — 사람 검증 필요 항목
- (계획 v2-1) 휠 팬/줌의 정밀한 커서 앵커 정확도·부드러움: 샘플이 3초로 짧아 줌 배율 폭이
  좁아 헤드리스로는 앵커 정확도까지 단정 불가(순수함수 zoomedViewport 단위테스트로 수학은 검증됨).
  더 긴 오디오로 사람이 shift+wheel 줌/가로 팬 시 커서 기준 확대·페이지 스크롤 없음 확인 권장.
- (계획 v2-1) auto-follow의 "수동 팬 시 추종 해제 → 재생 누르면 재활성"의 실제 사용 느낌(단위테스트는 통과).
