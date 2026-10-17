import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../l10n/app_localizations.dart';
import '../../core/localization/locale_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _tenantController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final identifier = _emailController.text.trim();
    final password = _passwordController.text;
    final tenant = _tenantController.text.trim();
    final apiClient = ref.read(apiClientProvider);

    try {
      await ref
          .read(authProvider.notifier)
          .login(
            identifier: identifier,
            password: password,
            tenantId: tenant.isNotEmpty ? tenant : null,
            apiClient: apiClient,
          );
      // Navigation is handled reactively by appRouter observing authProvider
    } on DioException catch (dioErr) {
      String msg =
          'Authentication failed. Please check your network and credentials.';
      final resData = dioErr.response?.data;
      if (resData is Map) {
        if (resData['error'] is Map && resData['error']['message'] != null) {
          final errMsg = resData['error']['message'];
          msg = errMsg is List ? errMsg.join(', ') : errMsg.toString();
        } else if (resData['error'] is String) {
          msg = resData['error'] as String;
        } else if (resData['message'] is String) {
          msg = resData['message'] as String;
        } else if (resData['message'] is List) {
          msg = (resData['message'] as List).join(', ');
        }
      } else if (dioErr.type == DioExceptionType.connectionError ||
          dioErr.type == DioExceptionType.connectionTimeout) {
        msg =
            'Cannot connect to server (${apiClient.baseUrl}). Please verify your internet connection.';
      } else if (dioErr.response?.statusCode == 401) {
        msg =
            'Invalid credentials. Please verify your identifier and password.';
      } else if (dioErr.response?.statusCode == 404) {
        msg = 'School or service not found on server (${apiClient.baseUrl}).';
      }

      if (mounted) {
        setState(() {
          _errorMessage = msg;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _tenantController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: const [
          LanguageSelectorButton(color: Color(0xFF1E40AF)),
          SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.school_rounded,
                    size: 64,
                    color: Color(0xFF1E40AF),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    l10n?.appTitle ?? 'EduLanka Mobile',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  Text(
                    l10n?.appSubtitle ??
                        'Offline-First School Learning Platform',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(height: 32),

                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline,
                            color: Color(0xFFDC2626),
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                color: Color(0xFFDC2626),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // School / Tenant Slug
                  TextFormField(
                    controller: _tenantController,
                    decoration: InputDecoration(
                      labelText:
                          l10n?.schoolDomain ?? 'School Domain / Tenant Slug',
                      hintText: 'e.g. ananda-college',
                      prefixIcon: const Icon(Icons.domain_rounded),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Identifier / Email / Phone
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Email, phone, or student ID is required';
                      }
                      return null;
                    },
                    decoration: InputDecoration(
                      labelText: l10n?.emailOrPhone ?? 'Email, Phone, or ID',
                      hintText: 'user@school.lk or 0771234567',
                      prefixIcon: const Icon(Icons.person_outline),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Password
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    validator: (val) {
                      if (val == null || val.isEmpty) {
                        return 'Password is required';
                      }
                      return null;
                    },
                    decoration: InputDecoration(
                      labelText: l10n?.password ?? 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      backgroundColor: const Color(0xFF1E40AF),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            l10n?.signIn ?? 'Sign In to EduLanka',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
