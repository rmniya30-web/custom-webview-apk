package com.signage.kiosk

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import kotlin.system.exitProcess

/**
 * Global crash handler that auto-restarts the app on crash.
 */
class CrashHandler(private val application: Application) : Thread.UncaughtExceptionHandler {

    private val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        try {
            // Schedule app restart
            val intent = Intent(application, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }

            val pendingIntent = PendingIntent.getActivity(
                application,
                0,
                intent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = application.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.set(
                AlarmManager.RTC,
                System.currentTimeMillis() + 1000, // Restart after 1 second
                pendingIntent
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Let the default handler finish the crash process
        defaultHandler?.uncaughtException(thread, throwable)
        exitProcess(1)
    }
}
