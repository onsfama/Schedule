import 'package:device_calendar/device_calendar.dart';
import 'package:timezone/timezone.dart' as tz;

import '../models/event_data.dart';

class CalendarOption {
  CalendarOption({required this.id, required this.label});

  final String id;
  final String label;
}

class CalendarService {
  final DeviceCalendarPlugin _plugin = DeviceCalendarPlugin();

  Future<bool> ensurePermissions() async {
    var result = await _plugin.hasPermissions();
    if (result.isSuccess && result.data == true) {
      return true;
    }
    result = await _plugin.requestPermissions();
    return result.isSuccess && result.data == true;
  }

  /// 기기에 등록된 모든 캘린더(구글 계정, 삼성캘린더 등)를 반환한다.
  /// 계정 타입 문자열이 기기마다 달라 "구글"/"삼성"으로 억지로 라벨링하지 않고,
  /// 캘린더 이름 + 계정명을 그대로 보여준다.
  Future<List<CalendarOption>> listCalendars() async {
    final result = await _plugin.retrieveCalendars();
    if (!result.isSuccess || result.data == null) {
      throw CalendarException(result.errors.map((e) => e.errorMessage).join(', '));
    }
    return result.data!
        .where((calendar) => calendar.isReadOnly != true && calendar.id != null)
        .map((calendar) => CalendarOption(
              id: calendar.id!,
              label: calendar.accountName != null && calendar.accountName != calendar.name
                  ? '${calendar.name} (${calendar.accountName})'
                  : calendar.name ?? calendar.id!,
            ))
        .toList();
  }

  Future<void> addEvent(EventData event, String calendarId) async {
    final start = _parseDateTime(event.date, event.startTime);
    final end = event.allDay
        ? start.add(const Duration(days: 1))
        : _parseDateTime(
            event.date,
            event.endTime.isNotEmpty ? event.endTime : _addOneHour(event.startTime),
          );

    final newEvent = Event(
      calendarId,
      title: event.title,
      description: event.description,
      location: event.location,
      allDay: event.allDay,
      start: tz.TZDateTime.from(start, tz.local),
      end: tz.TZDateTime.from(end, tz.local),
    );

    final result = await _plugin.createOrUpdateEvent(newEvent);
    if (result == null || !result.isSuccess) {
      final message = result?.errors.map((e) => e.errorMessage).join(', ') ?? '알 수 없는 오류';
      throw CalendarException(message);
    }
  }

  DateTime _parseDateTime(String date, String time) {
    final dateParts = date.split('-').map(int.parse).toList();
    if (time.isEmpty) {
      return DateTime(dateParts[0], dateParts[1], dateParts[2]);
    }
    final timeParts = time.split(':').map(int.parse).toList();
    return DateTime(dateParts[0], dateParts[1], dateParts[2], timeParts[0], timeParts[1]);
  }

  String _addOneHour(String time) {
    if (time.isEmpty) return '';
    final parts = time.split(':').map(int.parse).toList();
    final hour = (parts[0] + 1) % 24;
    return '${hour.toString().padLeft(2, '0')}:${parts[1].toString().padLeft(2, '0')}';
  }
}

class CalendarException implements Exception {
  CalendarException(this.message);

  final String message;

  @override
  String toString() => message;
}
