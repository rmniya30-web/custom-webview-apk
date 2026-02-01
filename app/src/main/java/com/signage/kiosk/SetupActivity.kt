package com.signage.kiosk

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * First-launch setup screen for configuring the player URL.
 */
class SetupActivity : AppCompatActivity() {

    private lateinit var urlInput: EditText
    private lateinit var saveButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        urlInput = findViewById(R.id.urlInput)
        saveButton = findViewById(R.id.saveButton)

        // Pre-fill with existing URL if any
        PrefsHelper.getPlayerUrl(this)?.let {
            urlInput.setText(it)
        }

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

            // Save URL and mark setup complete
            PrefsHelper.setPlayerUrl(this, url)
            PrefsHelper.setSetupComplete(this, true)

            // Launch main activity
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}
