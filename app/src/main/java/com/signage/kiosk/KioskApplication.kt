package com.signage.kiosk

import android.app.Application

class KioskApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // Set up global crash handler for auto-restart
        Thread.setDefaultUncaughtExceptionHandler(CrashHandler(this))
    }
}
