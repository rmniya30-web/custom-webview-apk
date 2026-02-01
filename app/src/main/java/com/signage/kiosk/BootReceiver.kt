package com.signage.kiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Receiver that auto-starts the app on device boot (if enabled in settings).
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {

            val prefs = context.getSharedPreferences(PrefsHelper.PREFS_NAME, Context.MODE_PRIVATE)
            val autoStart = prefs.getBoolean(PrefsHelper.KEY_AUTO_START, false)

            if (autoStart) {
                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(launchIntent)
            }
        }
    }
}
