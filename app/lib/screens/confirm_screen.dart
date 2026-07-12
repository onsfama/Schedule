import 'package:flutter/material.dart';

import '../models/event_data.dart';
import '../services/calendar_service.dart';

class ConfirmScreen extends StatefulWidget {
  const ConfirmScreen({super.key, required this.event});

  final EventData event;

  @override
  State<ConfirmScreen> createState() => _ConfirmScreenState();
}

class _ConfirmScreenState extends State<ConfirmScreen> {
  final CalendarService _calendarService = CalendarService();

  late final TextEditingController _titleController;
  late final TextEditingController _dateController;
  late final TextEditingController _startTimeController;
  late final TextEditingController _endTimeController;
  late final TextEditingController _locationController;
  late final TextEditingController _descriptionController;
  late bool _allDay;

  List<CalendarOption> _calendars = [];
  String? _selectedCalendarId;
  bool _isLoadingCalendars = true;
  bool _isSaving = false;
  String? _calendarError;

  @override
  void initState() {
    super.initState();
    final event = widget.event;
    _titleController = TextEditingController(text: event.title);
    _dateController = TextEditingController(text: event.date);
    _startTimeController = TextEditingController(text: event.startTime);
    _endTimeController = TextEditingController(text: event.endTime);
    _locationController = TextEditingController(text: event.location);
    _descriptionController = TextEditingController(text: event.description);
    _allDay = event.allDay;
    _loadCalendars();
  }

  Future<void> _loadCalendars() async {
    try {
      final granted = await _calendarService.ensurePermissions();
      if (!granted) {
        setState(() {
          _calendarError = '캘린더 권한이 필요합니다.';
          _isLoadingCalendars = false;
        });
        return;
      }
      final calendars = await _calendarService.listCalendars();
      setState(() {
        _calendars = calendars;
        _selectedCalendarId = calendars.isNotEmpty ? calendars.first.id : null;
        _isLoadingCalendars = false;
      });
    } catch (error) {
      setState(() {
        _calendarError = '$error';
        _isLoadingCalendars = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final initial = DateTime.tryParse(_dateController.text) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (picked != null) {
      _dateController.text =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _pickTime(TextEditingController controller) async {
    final now = TimeOfDay.now();
    final picked = await showTimePicker(context: context, initialTime: now);
    if (picked != null) {
      controller.text =
          '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _register() async {
    if (_titleController.text.trim().isEmpty || _dateController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('제목과 날짜는 필수입니다.')));
      return;
    }
    if (_selectedCalendarId == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('등록할 캘린더를 선택해주세요.')));
      return;
    }

    setState(() => _isSaving = true);
    try {
      final event = EventData(
        title: _titleController.text.trim(),
        date: _dateController.text.trim(),
        startTime: _allDay ? '' : _startTimeController.text.trim(),
        endTime: _allDay ? '' : _endTimeController.text.trim(),
        location: _locationController.text.trim(),
        description: _descriptionController.text.trim(),
        allDay: _allDay,
      );
      await _calendarService.addEvent(event, _selectedCalendarId!);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('캘린더에 등록되었습니다.')));
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('등록 실패: $error')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _dateController.dispose();
    _startTimeController.dispose();
    _endTimeController.dispose();
    _locationController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('일정 확인')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.event.confidence == 'low')
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.amber.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('이미지에서 일정 정보를 명확히 읽지 못했어요. 아래 내용을 확인/수정해주세요.'),
            ),
          TextField(
            controller: _titleController,
            decoration: const InputDecoration(labelText: '제목'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _dateController,
            readOnly: true,
            onTap: _pickDate,
            decoration: const InputDecoration(labelText: '날짜', suffixIcon: Icon(Icons.calendar_today)),
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('하루 종일'),
            value: _allDay,
            onChanged: (value) => setState(() => _allDay = value),
          ),
          if (!_allDay) ...[
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _startTimeController,
                    readOnly: true,
                    onTap: () => _pickTime(_startTimeController),
                    decoration: const InputDecoration(labelText: '시작 시간'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _endTimeController,
                    readOnly: true,
                    onTap: () => _pickTime(_endTimeController),
                    decoration: const InputDecoration(labelText: '종료 시간'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _locationController,
            decoration: const InputDecoration(labelText: '장소'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            decoration: const InputDecoration(labelText: '설명'),
            maxLines: 3,
          ),
          const SizedBox(height: 24),
          Text('등록할 캘린더', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_isLoadingCalendars)
            const Center(child: CircularProgressIndicator())
          else if (_calendarError != null)
            Text(_calendarError!, style: const TextStyle(color: Colors.red))
          else if (_calendars.isEmpty)
            const Text('기기에서 사용 가능한 캘린더를 찾지 못했습니다.')
          else
            DropdownButtonFormField<String>(
              value: _selectedCalendarId,
              items: _calendars
                  .map((c) => DropdownMenuItem(value: c.id, child: Text(c.label)))
                  .toList(),
              onChanged: (value) => setState(() => _selectedCalendarId = value),
            ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _isSaving ? null : _register,
            child: _isSaving
                ? const SizedBox(
                    width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('캘린더에 등록'),
          ),
        ],
      ),
    );
  }
}
