package com.signage.kiosk

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.PointerIcon
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Main WebView activity for kiosk mode.
 * Features:
 * - Immersive fullscreen (no system UI)
 * - Auto-hide cursor after 5 seconds idle
 * - Long-press (3s) to access settings
 * - Hardware accelerated WebView
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val handler = Handler(Looper.getMainLooper())

    // Cursor auto-hide
    private val cursorHideDelay = 5000L // 5 seconds
    private var isCursorHidden = false
    private val hideCursorRunnable = Runnable { hideCursor() }

    // Long-press detection for settings
    private val longPressDelay = 3000L // 3 seconds
    private var longPressStartTime = 0L
    private val checkLongPressRunnable = Runnable { openSettings() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check if setup is complete
        if (!PrefsHelper.isSetupComplete(this)) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Setup fullscreen immersive mode
        setupFullscreen()

        // Create and configure WebView
        webView = createWebView()
        setContentView(webView)

        // Load player URL
        val url = PrefsHelper.getPlayerUrl(this)
        if (url != null) {
            webView.loadUrl(url)
        }

        // Start cursor hide timer
        scheduleCursorHide()
    }

    private fun setupFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        // Legacy flags for older API levels
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        )
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun createWebView(): WebView {
        return WebView(this).apply {
            // Hardware acceleration
            setLayerType(View.LAYER_TYPE_HARDWARE, null)

            // WebView settings
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                displayZoomControls = false
                builtInZoomControls = false
            }

            // Handle navigation within WebView
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    return false // Load all URLs in WebView
                }
            }

            // Suppress video controls
            webChromeClient = object : WebChromeClient() {
                override fun onHideCustomView() {
                    super.onHideCustomView()
                    setupFullscreen() // Restore fullscreen after video
                }
            }

            // Touch handling for cursor hide + long-press settings
            setOnTouchListener { _, event ->
                handleTouch(event)
                false
            }
        }
    }

    private fun handleTouch(event: MotionEvent) {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                // Show cursor on touch
                showCursor()
                scheduleCursorHide()

                // Start long-press timer
                longPressStartTime = System.currentTimeMillis()
                handler.postDelayed(checkLongPressRunnable, longPressDelay)
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                // Cancel long-press detection
                handler.removeCallbacks(checkLongPressRunnable)
            }

            MotionEvent.ACTION_MOVE -> {
                // Show cursor on movement
                showCursor()
                scheduleCursorHide()
            }
        }
    }

    private fun scheduleCursorHide() {
        handler.removeCallbacks(hideCursorRunnable)
        handler.postDelayed(hideCursorRunnable, cursorHideDelay)
    }

    private fun hideCursor() {
        if (!isCursorHidden) {
            isCursorHidden = true
            // Use transparent pointer icon (API 24+)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                webView.pointerIcon = PointerIcon.getSystemIcon(this, PointerIcon.TYPE_NULL)
            }
        }
    }

    private fun showCursor() {
        if (isCursorHidden) {
            isCursorHidden = false
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                webView.pointerIcon = PointerIcon.getSystemIcon(this, PointerIcon.TYPE_DEFAULT)
            }
        }
    }

    private fun openSettings() {
        startActivity(Intent(this, SettingsActivity::class.java))
    }

    override fun onResume() {
        super.onResume()
        setupFullscreen()
        webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        webView.destroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Disable back button in kiosk mode
        // User must long-press to access settings
    }
}
