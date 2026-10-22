import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../core/sync/sync_service.dart';
import '../disaster/disaster_pack_dialog.dart';
import '../tutorial/tutorial_engine.dart';
import '../../l10n/app_localizations.dart';
import '../../core/localization/locale_provider.dart';

class IndependentLearnerHomeScreen extends ConsumerStatefulWidget {
  final bool enableAutoSync;
  final bool enableTutorialTour;

  const IndependentLearnerHomeScreen({
    super.key,
    this.enableAutoSync = true,
    this.enableTutorialTour = true,
  });

  @override
  ConsumerState<IndependentLearnerHomeScreen> createState() =>
      _IndependentLearnerHomeScreenState();
}

class _IndependentLearnerHomeScreenState
    extends ConsumerState<IndependentLearnerHomeScreen> {
  SyncService? _syncService;
  bool _isSyncing = false;
  int _pendingCount = 0;
  int _lastSequence = 0;

  Map<String, dynamic>? _learnerProfile;
  Map<String, dynamic>? _activeGrant;

  @override
  void initState() {
    super.initState();
    if (widget.enableAutoSync) {
      _syncService = ref.read(syncServiceProvider);
      _syncService?.startAutoSync();
    }
    _refreshSyncState();
    _loadCachedProfile();
    if (widget.enableTutorialTour) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        TutorialEngine.showTourIfUnseen(context, 'onboarding_tour');
      });
    }
  }

  @override
  void dispose() {
    if (widget.enableAutoSync) {
      _syncService?.stopAutoSync();
    }
    super.dispose();
  }

  Future<void> _refreshSyncState() async {
    final pending = await LocalDatabase.instance.getPendingOutboxCount();
    final seq = await LocalDatabase.instance.getLastSequence();
    if (mounted) {
      setState(() {
        _pendingCount = pending;
        _lastSequence = seq;
      });
    }
  }

  Future<void> _loadCachedProfile() async {
    try {
      final cached = await LocalDatabase.instance.getSyncMetadata(
        'cached_user_profile',
      );
      if (cached != null && cached.isNotEmpty) {
        final dynamic decoded = jsonDecode(cached);
        final data = decoded is Map<String, dynamic> ? decoded : null;
        if (mounted && data != null) {
          setState(() {
            _learnerProfile = data['independent_learner'] is Map
                ? Map<String, dynamic>.from(data['independent_learner'])
                : null;
            _activeGrant = data['active_grant'] is Map
                ? Map<String, dynamic>.from(data['active_grant'])
                : null;
          });
        }
      }
    } catch (_) {
      // Offline fallback: keep cached or default state
    }
  }

  Future<void> _syncRemoteProfile() async {
    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.dio.get('/users/me');
      final data = response.data is Map
          ? response.data['data'] ?? response.data
          : null;
      if (mounted && data != null) {
        await LocalDatabase.instance.saveSyncMetadata(
          'cached_user_profile',
          jsonEncode(data),
        );
        if (mounted) {
          setState(() {
            _learnerProfile = data['independent_learner'] is Map
                ? Map<String, dynamic>.from(data['independent_learner'])
                : null;
            _activeGrant = data['active_grant'] is Map
                ? Map<String, dynamic>.from(data['active_grant'])
                : null;
          });
        }
      }
    } catch (_) {
      // Network failure, continue offline
    }
  }

  Future<void> _handleSync() async {
    setState(() => _isSyncing = true);
    final result = await ref.read(syncServiceProvider).syncAll();
    await _refreshSyncState();
    await _syncRemoteProfile();

    if (mounted) {
      setState(() => _isSyncing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message),
          backgroundColor: result.success
              ? const Color(0xFF10B981)
              : const Color(0xFFEF4444),
        ),
      );
    }
  }

  void _showUpgradeSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _IndependentUpgradeModal(
        currentPlan: _learnerProfile?['plan']?.toString() ?? 'FREE_INDIVIDUAL',
        onUpgraded: (newPlan) {
          setState(() {
            if (_learnerProfile != null) {
              _learnerProfile!['plan'] = newPlan;
            } else {
              _learnerProfile = {'plan': newPlan};
            }
          });
          _loadCachedProfile();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final plan = _learnerProfile?['plan']?.toString() ?? 'FREE_INDIVIDUAL';
    final stream = _learnerProfile?['stream']?.toString() ?? 'Science';
    final candidateLevel =
        _learnerProfile?['candidate_level']?.toString() ?? 'A/L';

    final examYear = DateTime.now().year;
    final alExamDate = DateTime(examYear, 11, 25, 8, 30);
    final daysRemaining = alExamDate
        .difference(DateTime.now())
        .inDays
        .clamp(0, 365);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Independent Learner Hub'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'App Tour & Help',
            icon: const Icon(Icons.help_outline_rounded),
            onPressed: () =>
                TutorialEngine.showTour(context, 'independent_learner_tour'),
          ),
          IconButton(
            tooltip: l10n?.syncChanges ?? 'Sync Changes',
            icon: _isSyncing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.sync_rounded),
            onPressed: _isSyncing ? null : _handleSync,
          ),
          const LanguageSelectorButton(),
          IconButton(
            tooltip: l10n?.signOut ?? 'Sign Out',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => showLogoutConfirmation(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _refreshSyncState();
          await _syncRemoteProfile();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Hero Banner with Exam Countdown ──────────────────────
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFF1E3A8A),
                    Color(0xFF2563EB),
                    Color(0xFF1D4ED8),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1E3A8A).withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.auto_awesome_rounded,
                              color: Color(0xFFFBBF24),
                              size: 14,
                            ),
                            SizedBox(width: 4),
                            Text(
                              'Independent Candidate',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_activeGrant != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFF10B981,
                            ).withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: const Color(
                                0xFF34D399,
                              ).withValues(alpha: 0.5),
                            ),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.volunteer_activism_rounded,
                                color: Color(0xFF6EE7B7),
                                size: 13,
                              ),
                              SizedBox(width: 4),
                              Text(
                                'Sponsored Grant Active',
                                style: TextStyle(
                                  color: Color(0xFFD1FAE5),
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Track: G.C.E. $candidateLevel • $stream Stream',
                    style: const TextStyle(
                      color: Color(0xFFBFDBFE),
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'National Syllabus & Past Papers',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.event_available_rounded,
                          color: Color(0xFF93C5FD),
                          size: 28,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$daysRemaining Days Remaining',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                              const Text(
                                'Target: G.C.E. A/L National Examination',
                                style: TextStyle(
                                  color: Color(0xFFBFDBFE),
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Subscription & Quota Card ─────────────────────────────
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Current Plan',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              plan == 'FREE_INDIVIDUAL'
                                  ? 'Free Individual'
                                  : plan == 'INDIVIDUAL_PRO'
                                  ? 'Individual Pro'
                                  : 'Individual Premium',
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: plan == 'INDIVIDUAL_PREMIUM'
                                ? const Color(
                                    0xFF8B5CF6,
                                  ).withValues(alpha: 0.15)
                                : plan == 'INDIVIDUAL_PRO'
                                ? const Color(
                                    0xFF2563EB,
                                  ).withValues(alpha: 0.15)
                                : const Color(
                                    0xFF64748B,
                                  ).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            plan == 'INDIVIDUAL_PREMIUM'
                                ? 'Pro Max Tier'
                                : plan == 'INDIVIDUAL_PRO'
                                ? 'LKR 299/mo'
                                : 'Free Tier',
                            style: TextStyle(
                              color: plan == 'INDIVIDUAL_PREMIUM'
                                  ? const Color(0xFF7C3AED)
                                  : plan == 'INDIVIDUAL_PRO'
                                  ? const Color(0xFF1D4ED8)
                                  : const Color(0xFF475569),
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: _buildQuotaIndicator(
                            icon: Icons.smart_toy_outlined,
                            title: 'AI Assistant',
                            value: plan == 'FREE_INDIVIDUAL'
                                ? '5 queries / day'
                                : plan == 'INDIVIDUAL_PRO'
                                ? '20k tokens / mo'
                                : '60k tokens / mo',
                            color: const Color(0xFF2563EB),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _buildQuotaIndicator(
                            icon: Icons.cloud_download_outlined,
                            title: 'Offline Storage',
                            value: plan == 'FREE_INDIVIDUAL'
                                ? '200 MB'
                                : plan == 'INDIVIDUAL_PRO'
                                ? '2 GB Encrypted'
                                : '8 GB Encrypted',
                            color: const Color(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    if (plan != 'INDIVIDUAL_PREMIUM')
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 11),
                          ),
                          icon: const Icon(Icons.bolt_rounded, size: 18),
                          label: const Text(
                            'Upgrade Subscription (from LKR 299/mo)',
                          ),
                          onPressed: () => _showUpgradeSheet(context),
                        ),
                      )
                    else
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3E8FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.verified_rounded,
                              color: Color(0xFF7C3AED),
                              size: 16,
                            ),
                            SizedBox(width: 6),
                            Text(
                              'Premium Member — Maximum Quotas Active',
                              style: TextStyle(
                                color: Color(0xFF6D28D9),
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Offline Readiness Status ──────────────────────────────
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              color: const Color(0xFFEFF6FF),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    const Icon(
                      Icons.offline_pin_rounded,
                      color: Color(0xFF2563EB),
                      size: 32,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _pendingCount > 0
                                ? 'Offline Changes Queued'
                                : 'Offline Ready & Encrypted',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Sequence #$_lastSequence • Outbox queue: $_pendingCount pending',
                            style: const TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Study Navigation Grid ─────────────────────────────────
            const Text(
              'Candidate Learning Resources',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.25,
              children: [
                _buildFeatureCard(
                  icon: Icons.menu_book_rounded,
                  title: 'Past Papers Hub',
                  subtitle: 'O/L & A/L Schemes',
                  color: const Color(0xFF2563EB),
                  onTap: () => context.push('/papers'),
                ),
                _buildFeatureCard(
                  icon: Icons.video_collection_rounded,
                  title: 'Offline Lessons',
                  subtitle: 'Encrypted Downloads',
                  color: const Color(0xFF7C3AED),
                  onTap: () => context.push('/media'),
                ),
                _buildFeatureCard(
                  icon: Icons.newspaper_rounded,
                  title: 'Academic Blogs',
                  subtitle: 'Subject Discourse',
                  color: const Color(0xFF059669),
                  onTap: () => context.push('/blogs'),
                ),
                _buildFeatureCard(
                  icon: Icons.emergency_share_rounded,
                  title: 'Disaster Readiness',
                  subtitle: 'Offline Contacts',
                  color: const Color(0xFFEF4444),
                  onTap: () => DisasterPackSheet.show(context),
                ),
              ],
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildQuotaIndicator({
    required IconData icon,
    required String title,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFF64748B),
                  ),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bottom Sheet modal for mobile self-service plan upgrades (Blueprint §7d)
class _IndependentUpgradeModal extends StatefulWidget {
  final String currentPlan;
  final ValueChanged<String> onUpgraded;

  const _IndependentUpgradeModal({
    required this.currentPlan,
    required this.onUpgraded,
  });

  @override
  State<_IndependentUpgradeModal> createState() =>
      _IndependentUpgradeModalState();
}

class _IndependentUpgradeModalState extends State<_IndependentUpgradeModal> {
  String _selectedPlan = 'INDIVIDUAL_PRO';
  String _billingCycle = 'MONTHLY';
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.currentPlan == 'INDIVIDUAL_PRO') {
      _selectedPlan = 'INDIVIDUAL_PREMIUM';
    }
  }

  Future<void> _submitCheckout() async {
    setState(() => _isSubmitting = true);
    try {
      final container = ProviderScope.containerOf(context);
      final apiClient = container.read(apiClientProvider);

      final response = await apiClient.dio.post(
        '/billing/individual/checkout',
        data: {'plan': _selectedPlan, 'billingCycle': _billingCycle},
      );

      final data = response.data is Map
          ? response.data['data'] ?? response.data
          : null;
      final planName = _selectedPlan == 'INDIVIDUAL_PREMIUM'
          ? 'Individual Premium'
          : 'Individual Pro';
      final txnRef = data?['transactionId'] ?? 'TXN-STUB';

      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onUpgraded(_selectedPlan);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '$planName activated! Ref: $txnRef (Sandbox Gateway Stub)',
          ),
          backgroundColor: const Color(0xFF10B981),
          duration: const Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Checkout failed: $e'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Icon(Icons.bolt_rounded, color: Color(0xFF2563EB), size: 24),
                SizedBox(width: 8),
                Text(
                  'Upgrade Candidate Subscription',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Unlock full AI Academic Assistant RAG, encrypted downloads, and exam predictions.',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
            ),
            const SizedBox(height: 16),

            // Billing Cycle Selector
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Monthly Billing'),
                    selected: _billingCycle == 'MONTHLY',
                    onSelected: (_) =>
                        setState(() => _billingCycle = 'MONTHLY'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Annual (Save 2 Mo)'),
                    selected: _billingCycle == 'ANNUAL',
                    onSelected: (_) => setState(() => _billingCycle = 'ANNUAL'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Plan Selection Tiles
            _buildPlanTile(
              planKey: 'INDIVIDUAL_PRO',
              title: 'Individual Pro',
              price: _billingCycle == 'MONTHLY'
                  ? 'LKR 299 / mo'
                  : 'LKR 2,990 / yr',
              features:
                  '20k AI tokens/mo • 2 GB offline storage • Exam prediction',
              color: const Color(0xFF2563EB),
            ),
            const SizedBox(height: 8),
            _buildPlanTile(
              planKey: 'INDIVIDUAL_PREMIUM',
              title: 'Individual Premium',
              price: _billingCycle == 'MONTHLY'
                  ? 'LKR 599 / mo'
                  : 'LKR 5,990 / yr',
              features:
                  '60k AI tokens/mo • 8 GB offline storage • National Leaderboard',
              color: const Color(0xFF7C3AED),
            ),
            const SizedBox(height: 12),

            // Architecture / Payment Gateway Sandbox Callout
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFBFDBFE)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.credit_card_rounded,
                    color: Color(0xFF2563EB),
                    size: 16,
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Payment Gateway Notice: Self-service checkout is currently powered by our Sandbox Gateway Stub (§7d). Real PayHere / Stripe gateway integration will be deployed in upcoming release.',
                      style: TextStyle(color: Color(0xFF1E40AF), fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _isSubmitting ? null : _submitCheckout,
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        'Confirm Upgrade (${_selectedPlan == 'INDIVIDUAL_PRO' ? (_billingCycle == 'MONTHLY' ? 'LKR 299' : 'LKR 2,990') : (_billingCycle == 'MONTHLY' ? 'LKR 599' : 'LKR 5,990')})',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanTile({
    required String planKey,
    required String title,
    required String price,
    required String features,
    required Color color,
  }) {
    final isSelected = _selectedPlan == planKey;
    return InkWell(
      onTap: () => setState(() => _selectedPlan = planKey),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? color : const Color(0xFFE2E8F0),
            width: isSelected ? 2 : 1,
          ),
          color: isSelected
              ? color.withValues(alpha: 0.04)
              : Colors.transparent,
        ),
        child: Row(
          children: [
            Icon(
              isSelected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_off_rounded,
              color: isSelected ? color : const Color(0xFF94A3B8),
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                      Text(
                        price,
                        style: TextStyle(
                          color: color,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    features,
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
