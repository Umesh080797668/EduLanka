import 'package:flutter/material.dart';
import '../../core/database/local_database.dart';

class DisasterPackSheet extends StatefulWidget {
  const DisasterPackSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => const DisasterPackSheet(),
    );
  }

  @override
  State<DisasterPackSheet> createState() => _DisasterPackSheetState();
}

class _DisasterPackSheetState extends State<DisasterPackSheet> {
  List<Map<String, dynamic>> _contacts = [];
  List<Map<String, dynamic>> _shelters = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final contacts = await LocalDatabase.instance.getEmergencyContacts();
    final shelters = await LocalDatabase.instance.getEmergencyShelters();

    if (mounted) {
      setState(() {
        _contacts = contacts;
        _shelters = shelters;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  controller: scrollController,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Row(
                      children: [
                        Icon(Icons.emergency_share_rounded, color: Color(0xFFEF4444), size: 28),
                        SizedBox(width: 10),
                        Text(
                          'Disaster Readiness Pack',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Cached locally in SQLite storage for immediate offline access during emergencies.',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                    ),
                    const SizedBox(height: 20),

                    // ── Emergency Contacts Section ───────────────────
                    const Text(
                      'Emergency Contacts',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    if (_contacts.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'No contacts cached. Tap the top sync button to download the latest disaster pack.',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                        ),
                      )
                    else
                      ..._contacts.map(
                        (c) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: c['is_primary'] == 1
                                  ? const Color(0xFFEF4444)
                                  : const Color(0xFF3B82F6),
                              foregroundColor: Colors.white,
                              child: const Icon(Icons.phone, size: 20),
                            ),
                            title: Text(
                              c['name'] ?? 'Contact',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            subtitle: Text('${c['role'] ?? 'Official'} • ${c['phone'] ?? ''}'),
                            trailing: Text(
                              c['phone'] ?? '',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E40AF),
                              ),
                            ),
                          ),
                        ),
                      ),

                    const SizedBox(height: 20),

                    // ── Emergency Shelters Section ───────────────────
                    const Text(
                      'Evacuation Shelters',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    if (_shelters.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'No shelters cached. Sync with your school server to download local evacuation shelters.',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                        ),
                      )
                    else
                      ..._shelters.map(
                        (s) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: const CircleAvatar(
                              backgroundColor: Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              child: Icon(Icons.location_on, size: 20),
                            ),
                            title: Text(
                              s['name'] ?? 'Shelter',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            subtitle: Text(
                              '${s['address'] ?? ''}${s['capacity'] != null ? ' • Cap: ${s['capacity']}' : ''}',
                            ),
                            trailing: s['gps_lat'] != null
                                ? const Icon(Icons.navigation, color: Color(0xFF10B981))
                                : null,
                          ),
                        ),
                      ),
                  ],
                ),
        );
      },
    );
  }
}
