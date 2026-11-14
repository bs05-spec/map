# 길결

장소를 검색해 두 지점 사이의 자동차 이동 거리와 지도를 확인하는 웹앱입니다.

## 실행

`index.html`을 브라우저에서 열거나, 프로젝트 폴더를 정적 웹 호스팅에 배포하면 됩니다. 빌드 단계, 서버, Redis, API 키 또는 환경변수는 필요하지 않습니다.

## Vercel 배포

GitHub 저장소에 코드를 올린 뒤 Vercel에서 저장소를 Import하세요. 프레임워크는 **Other**를 선택하고 Build Command는 비워 두며 Output Directory는 `.`으로 설정하면 됩니다.

## 데이터 제공처

- 장소 검색: [Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org/)
- 자동차 경로 및 거리: [OSRM demo server](https://router.project-osrm.org/)
- 지도 및 경로 보기: [OpenStreetMap](https://www.openstreetmap.org/)

장소 검색은 입력 후 검색 버튼을 눌렀을 때만 요청합니다. Nominatim 사용 정책에 따라 검색 요청 사이에 간격을 둡니다. 두 서비스는 별도 인증키 없이 공개 API를 제공하지만, 외부 서비스의 이용 정책과 가용성에 영향을 받습니다.
