package com.signage.kiosk

import android.content.Context
import android.content.SharedPreferences

/**
 * Helper class for SharedPreferences access.
 */
object PrefsHelper {
    const val PREFS_NAME = "kiosk_prefs"
    const val KEY_PLAYER_URL = "player_url"
    const val KEY_AUTO_START = "auto_start"
    const val KEY_SETUP_COMPLETE = "setup_complete"

    fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun getPlayerUrl(context: Context): String? {
        return getPrefs(context).getString(KEY_PLAYER_URL, null)
    }

    fun setPlayerUrl(context: Context, url: String) {
        getPrefs(context).edit().putString(KEY_PLAYER_URL, url).apply()
    }

    fun isAutoStartEnabled(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_AUTO_START, false)
    }

    fun setAutoStart(context: Context, enabled: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_AUTO_START, enabled).apply()
    }

    fun isSetupComplete(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_SETUP_COMPLETE, false)
    }

    fun setSetupComplete(context: Context, complete: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_SETUP_COMPLETE, complete).apply()
    }
}
