# 구현 진행 노트 (무인 자율 실행)

EXECUTION.md 프로토콜에 따라 `docs/superpowers/plans`의 계획 1→4를 순차 구현한다.
이 파일 하나로 밤새 진행 상황을 파악할 수 있게 누적 기록한다.

## 진행 로그

### 계획 1 — 기반 + 베이스 플로우 재생 (진행 중)

- Task 1 스캐폴드: 완료. 커밋 `0e83189`.
- Task 2 도메인 타입+id: 완료.
- Task 3 디바운스: 완료. 커밋 `d99c3e5`.
- Task 4 AssetRepository / Task 5 ProjectRepository: 완료 (테스트 5/5 통과).

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
