# 내장 샘플 라이선스

이 디렉터리의 원샷 샘플(`kick`, `snare`, `hat`, `clap`, `tom`, `perc`)은
`scripts/gen-samples.mjs`로 **직접 합성한 자작 사운드**다. 외부 출처가 없으므로
저작권 제약이 없으며 **CC0(퍼블릭 도메인)**으로 배포한다.

## 포맷에 대한 주의

파일 확장자는 `.ogg`지만 **내용은 16-bit PCM WAV**다. 빌드/배포 환경에 ffmpeg/sox가
없어 Ogg Vorbis 인코딩이 불가능했기 때문이다. Web Audio의 `decodeAudioData`는 확장자가
아니라 파일 내용(RIFF/WAVE 헤더)으로 포맷을 판별하므로 브라우저에서 정상 재생된다.
`sampleUrl()`이 `.ogg` 경로를 만드는 계획상의 계약은 그대로 유지된다.

추후 실제 Ogg Vorbis(또는 다른 CC0 샘플 라이브러리)로 교체해도 무방하다.
재생성: `node scripts/gen-samples.mjs`

## 데모 베이스플로우

`moodmode-demo.mp3`는 데모/개발 검증용 베이스플로우 트랙이다. 출처: MoodMode의
**저작권 없는(no-copyright / royalty-free) 음원**. 에디터(가로 스크롤/줌, 플레이헤드,
시퀀서 등)를 충분히 긴 트랙으로 검증하기 위해 포함한다.
