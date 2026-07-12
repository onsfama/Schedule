# 앱 실행 준비 (최초 1회)

이 저장소에는 `lib/`와 `pubspec.yaml`만 작성되어 있고, 네이티브 Android/iOS 셸은
Flutter SDK가 설치된 환경에서 아래 명령으로 생성해야 합니다 (이 개발 환경에는
Flutter SDK가 설치되어 있지 않아 여기서는 실행할 수 없었습니다).

## 1. 네이티브 플랫폼 폴더 생성

`app/` 디렉터리에서 실행 (기존 `lib/`, `pubspec.yaml`은 건드리지 않고 `android/`, `ios/`만 추가됨):

```
flutter create --platforms=android,ios --org com.example .
```

## 2. 패키지 설치

```
flutter pub get
```

## 3. Android 권한 추가

`android/app/src/main/AndroidManifest.xml`의 `<manifest>` 태그 바로 아래에 추가:

```xml
<uses-permission android:name="android.permission.READ_CALENDAR" />
<uses-permission android:name="android.permission.WRITE_CALENDAR" />
<uses-permission android:name="android.permission.CAMERA" />
```

`android/app/build.gradle`에서 `minSdkVersion`을 21 이상으로 설정 (device_calendar 요구사항).

## 4. iOS 권한 추가 (iOS도 빌드할 경우)

`ios/Runner/Info.plist`에 추가 (삼성캘린더는 iOS에 없으므로 iOS에서는 기기에 연동된
구글/iCloud 캘린더만 목록에 나타남):

```xml
<key>NSCalendarsUsageDescription</key>
<string>일정을 캘린더에 등록하기 위해 접근이 필요합니다.</string>
<key>NSCameraUsageDescription</key>
<string>일정이 담긴 사진을 촬영하기 위해 접근이 필요합니다.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>일정이 담긴 이미지를 선택하기 위해 접근이 필요합니다.</string>
```

## 5. 백엔드 주소 맞추기

`lib/services/api_service.dart`의 `ApiService(baseUrl: ...)` 기본값은 안드로이드
에뮬레이터 기준(`http://10.0.2.2:8787`)입니다. 실기기로 테스트할 때는 PC와 같은
Wi-Fi에 연결한 뒤 PC의 사설 IP로 바꿔주세요 (예: `http://192.168.0.10:8787`).

## 6. 실행

백엔드(`server/`)를 먼저 `npm run dev`로 띄운 뒤, 다음을 실행:

```
flutter run
```

캘린더 목록이 비어 있다면, 기기의 설정 > 계정에서 구글 계정 캘린더 동기화가
켜져 있는지, 삼성캘린더 앱에 로그인되어 있는지 확인하세요.
