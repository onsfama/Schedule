import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/event_data.dart';

class ApiService {
  ApiService({this.baseUrl = 'http://172.16.45.67:8787'});

  /// 실기기 테스트 기준 기본값(PC의 Wi-Fi IP). PC의 IP가 바뀌면(DHCP 재할당 등)
  /// `ipconfig`로 다시 확인해서 이 값을 갱신하세요. 에뮬레이터를 쓸 경우
  /// 'http://10.0.2.2:8787'(호스트 PC 루프백)로 바꿔서 생성하세요.
  final String baseUrl;

  Future<EventData> extractEvent(File image) async {
    final uri = Uri.parse('$baseUrl/api/extract-event');
    final request = http.MultipartRequest('POST', uri)
      ..files.add(await http.MultipartFile.fromPath('image', image.path));

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode != 200) {
      final message = _extractErrorMessage(response.body);
      throw ApiException(message);
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return EventData.fromJson(json);
  }

  String _extractErrorMessage(String body) {
    try {
      final json = jsonDecode(body) as Map<String, dynamic>;
      return json['error'] as String? ?? '일정 추출에 실패했습니다.';
    } catch (_) {
      return '일정 추출에 실패했습니다.';
    }
  }
}

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}
