package com.signageplayer;

import android.app.Activity;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class RestartModule extends ReactContextBaseJavaModule {

    public RestartModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "RestartModule";
    }

    @ReactMethod
    public void restart() {
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                Activity currentActivity = getCurrentActivity();
                if (currentActivity == null) {
                    // Fallback if no activity context
                    System.exit(0);
                    return;
                }

                Intent intent = currentActivity.getPackageManager()
                        .getLaunchIntentForPackage(currentActivity.getPackageName());
                
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                    currentActivity.startActivity(intent);
                    currentActivity.finish();
                    Runtime.getRuntime().exit(0);
                } else {
                    System.exit(0);
                }
            }
        });
    }
}
