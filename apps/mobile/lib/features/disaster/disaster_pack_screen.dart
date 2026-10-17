import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/database/local_database.dart';
import '../../l10n/app_localizations.dart';
import '../tutorial/tutorial_engine.dart';

class DisasterPackScreen extends StatefulWidget {
  const DisasterPackScreen({super.key});

  @override
  State<DisasterPackScreen> createState() => _DisasterPackScreenState();
}

class _DisasterPackScreenState extends State<DisasterPackScreen> {
  List<Map<String, dynamic>> _contacts = [];
  List<Map<String, dynamic>> _shelters = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'phase3_disaster_pack');
    });
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

  Future<void> _callPhone(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Emergency Disaster Pack',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: const Color(0xFFDC2626),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Local Data',
            onPressed: () {
              setState(() => _isLoading = true);
              _loadData();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Offline Readiness Banner ───────────────────────
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: const BoxDecoration(
                                color: Color(0xFFDC2626),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.offline_bolt_rounded,
                                color: Colors.white,
                                size: 24,
                              ),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '100% Offline Ready',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: Color(0xFF991B1B),
                                    ),
                                  ),
                                  Text(
                                    'Cached in local SQLite database for power outages & cellular loss.',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF7F1D1D),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Emergency Contacts Section ─────────────────────
                  Row(
                    children: [
                      const Icon(
                        Icons.contact_phone_rounded,
                        color: Color(0xFFDC2626),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Priority Emergency Contacts',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${_contacts.length} cached',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (_contacts.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.info_outline, color: Colors.grey),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'No contacts cached. Connect to internet and trigger a sync to cache school emergency contacts.',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    ..._contacts.map((c) {
                      final isPrimary = c['is_primary'] == 1;
                      final phone = c['phone']?.toString() ?? '';
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        elevation: isPrimary ? 3 : 1,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: isPrimary
                              ? const BorderSide(
                                  color: Color(0xFFDC2626),
                                  width: 1.5,
                                )
                              : BorderSide.none,
                        ),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: isPrimary
                                ? const Color(0xFFDC2626)
                                : const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            child: Icon(
                              isPrimary ? Icons.emergency : Icons.phone,
                            ),
                          ),
                          title: Row(
                            children: [
                              Text(
                                c['name'] ?? 'Contact',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if (isPrimary) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEE2E2),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text(
                                    'PRIMARY',
                                    style: TextStyle(
                                      color: Color(0xFFDC2626),
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          subtitle: Text('${c['role'] ?? 'Official'} • $phone'),
                          trailing: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFDC2626),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                            ),
                            icon: const Icon(Icons.call, size: 16),
                            label: Text(l10n?.callEmergency ?? 'Call'),
                            onPressed: phone.isNotEmpty
                                ? () => _callPhone(phone)
                                : null,
                          ),
                        ),
                      );
                    }),

                  const SizedBox(height: 24),

                  // ── Evacuation Shelters Section ────────────────────
                  Row(
                    children: [
                      const Icon(
                        Icons.holiday_village_rounded,
                        color: Color(0xFF059669),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Designated Evacuation Shelters',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${_shelters.length} cached',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (_shelters.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.info_outline, color: Colors.grey),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'No evacuation shelters cached. Sync while online to download approved shelter locations.',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    ..._shelters.map((s) {
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: ListTile(
                          leading: const CircleAvatar(
                            backgroundColor: Color(0xFF059669),
                            foregroundColor: Colors.white,
                            child: Icon(Icons.location_on),
                          ),
                          title: Text(
                            s['name'] ?? 'Shelter',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text(
                            '${s['address'] ?? 'Address on file'}${s['capacity'] != null ? ' • Capacity: ${s['capacity']} people' : ''}',
                          ),
                          trailing: s['gps_lat'] != null && s['gps_lng'] != null
                              ? IconButton(
                                  icon: const Icon(
                                    Icons.map,
                                    color: Color(0xFF059669),
                                  ),
                                  tooltip:
                                      'Coordinates: ${s['gps_lat']}, ${s['gps_lng']}',
                                  onPressed: () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          'GPS: ${s['gps_lat']}, ${s['gps_lng']}',
                                        ),
                                      ),
                                    );
                                  },
                                )
                              : null,
                        ),
                      );
                    }),

                  const SizedBox(height: 24),

                  // ── Emergency Protocols Guidance ──────────────────
                  const Row(
                    children: [
                      Icon(Icons.shield_rounded, color: Color(0xFF2563EB)),
                      SizedBox(width: 8),
                      Text(
                        'Standard Emergency Protocols',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '1. Immediate Student Safety',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'During severe weather or flood alerts, remain in designated upper-level assembly points until school administrative clearance.',
                            style: TextStyle(
                              color: Colors.black87,
                              fontSize: 13,
                            ),
                          ),
                          Divider(height: 20),
                          Text(
                            '2. Roll Call & Verification',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Teachers should use the offline roll call module to record present students. Sync will propagate automatically when connectivity returns.',
                            style: TextStyle(
                              color: Colors.black87,
                              fontSize: 13,
                            ),
                          ),
                          Divider(height: 20),
                          Text(
                            '3. Parent Reunification',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Students may only be released to verified parents/guardians listed in the offline contact directory.',
                            style: TextStyle(
                              color: Colors.black87,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
