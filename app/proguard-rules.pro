# ProGuard rules for SignageKiosk

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep crash handler
-keep class com.signage.kiosk.CrashHandler { *; }
