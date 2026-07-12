import 'package:flutter/material.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import 'screens/home_screen.dart';

void main() {
  tz_data.initializeTimeZones();
  // MVP 범위: 한국 사용자를 기준으로 시간대를 고정한다.
  tz.setLocalLocation(tz.getLocation('Asia/Seoul'));
  runApp(const ScheduleApp());
}

class ScheduleApp extends StatelessWidget {
  const ScheduleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '일정 자동 등록',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const HomeScreen(),
    );
  }
}
