package com.signageplayer;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Native module to set screen orientation at the Android Activity level.
 * This is necessary because React Native CSS transforms (rotate) do NOT
 * affect Android SurfaceView/TextureView used by ExoPlayer for video.
 *
 * Maps dashboard orientation values to Android screen orientations:
 *   "0"   → SCREEN_ORIENTATION_LANDSCAPE (default TV orientation)
 *   "90"  → SCREEN_ORIENTATION_REVERSE_PORTRAIT
 *   "180" → SCREEN_ORIENTATION_REVERSE_LANDSCAPE
 *   "270" → SCREEN_ORIENTATION_PORTRAIT
 */
public class ScreenOrientationModule extends ReactContextBaseJavaModule {

    public ScreenOrientationModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "ScreenOrientationModule";
    }

    @ReactMethod
    public void setOrientation(final String degrees) {
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                Activity activity = getCurrentActivity();
                if (activity == null) return;

                int orientation;
                switch (degrees) {
                    case "90":
                        orientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT;
                        break;
                    case "180":
                        orientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE;
                        break;
                    case "270":
                        orientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
                        break;
                    case "0":
                    default:
                        orientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE;
                        break;
                }

                activity.setRequestedOrientation(orientation);
            }
        });
    }
}
