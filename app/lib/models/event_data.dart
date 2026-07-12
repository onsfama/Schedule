class EventData {
  EventData({
    required this.title,
    required this.date,
    this.startTime = '',
    this.endTime = '',
    this.location = '',
    this.description = '',
    this.allDay = false,
    this.confidence = 'low',
  });

  factory EventData.fromJson(Map<String, dynamic> json) {
    return EventData(
      title: json['title'] as String? ?? '',
      date: json['date'] as String? ?? '',
      startTime: json['startTime'] as String? ?? '',
      endTime: json['endTime'] as String? ?? '',
      location: json['location'] as String? ?? '',
      description: json['description'] as String? ?? '',
      allDay: json['allDay'] as bool? ?? false,
      confidence: json['confidence'] as String? ?? 'low',
    );
  }

  final String title;
  final String date;
  final String startTime;
  final String endTime;
  final String location;
  final String description;
  final bool allDay;
  final String confidence;

  EventData copyWith({
    String? title,
    String? date,
    String? startTime,
    String? endTime,
    String? location,
    String? description,
    bool? allDay,
  }) {
    return EventData(
      title: title ?? this.title,
      date: date ?? this.date,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      location: location ?? this.location,
      description: description ?? this.description,
      allDay: allDay ?? this.allDay,
      confidence: confidence,
    );
  }
}
