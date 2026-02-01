package com.signage.kiosk

import android.content.Intent
import android.os.Bundle
import android.webkit.WebStorage
import android.widget.Button
import android.widget.EditText
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Settings screen for app configuration.
 * Accessible via long-press (3 seconds) in MainActivity.
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var urlInput: EditText
    private lateinit var autoStartSwitch: Switch
    private lateinit var saveButton: Button
    private lateinit var clearCacheButton: Button
    private lateinit var backButton: Button
    private lateinit var versionText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        urlInput = findViewById(R.id.urlInput)
        autoStartSwitch = findViewById(R.id.autoStartSwitch)
        saveButton = findViewById(R.id.saveButton)
        clearCacheButton = findViewById(R.id.clearCacheButton)
        backButton = findViewById(R.id.backButton)
        versionText = findViewById(R.id.versionText)

        // Load current settings
        urlInput.setText(PrefsHelper.getPlayerUrl(this) ?: "")
        autoStartSwitch.isChecked = PrefsHelper.isAutoStartEnabled(this)

        // Show version
        try {
            val pInfo = packageManager.getPackageInfo(packageName, 0)
            versionText.text = "Version ${pInfo.versionName}"
        } catch (e: Exception) {
            versionText.text = "Version 1.0.0"
        }

        // Save button
        saveButton.setOnClickListener {
            val url = urlInput.text.toString().trim()

            if (url.isEmpty()) {
                Toast.makeText(this, "Please enter a URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                Toast.makeText(this, "URL must start with http:// or https://", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            PrefsHelper.setPlayerUrl(this, url)
            PrefsHelper.setAutoStart(this, autoStartSwitch.isChecked)

            Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()

            // Restart main activity with new settings
            val intent = Intent(this, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            finish()
        }

        // Clear cache button
        clearCacheButton.setOnClickListener {
            WebStorage.getInstance().deleteAllData()
            Toast.makeText(this, "Cache cleared", Toast.LENGTH_SHORT).show()
        }

        // Back button
        backButton.setOnClickListener {
            finish()
        }
    }
}
