package com.signageplayer;

import android.app.Activity;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.View;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;

/**
 * VideoRotationModule — Rotates the entire Activity content view.
 *
 * TextureView.setTransform(Matrix) is overwritten by ExoPlayer's PlayerView
 * for resize mode handling. CSS transforms are ignored by TextureView on API 28.
 *
 * This module rotates android.R.id.content (the root FrameLayout of the Activity),
 * which rotates EVERYTHING at the Android compositor level — including SurfaceView
 * and TextureView content. This is the same mechanism as system display rotation.
 *
 * For 90°/270°: rotates the root view + scales to fill the screen.
 * For 180°: just rotates (same dimensions).
 * For 0°: resets to identity.
 */
public class VideoRotationModule extends ReactContextBaseJavaModule {

    private static final String TAG = "VideoRotation";
    private int currentDegrees = 0;

    public VideoRotationModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "VideoRotationModule";
    }

    @ReactMethod
    public void setRotation(final int degrees) {
        currentDegrees = degrees;
        Log.d(TAG, "setRotation called with degrees=" + degrees);

        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Activity activity = getCurrentActivity();
                if (activity == null) {
                    Log.e(TAG, "setRotation: getCurrentActivity() returned null");
                    return;
                }

                View contentView = activity.findViewById(android.R.id.content);
                if (contentView == null) {
                    Log.e(TAG, "setRotation: content view is null");
                    return;
                }

                DisplayMetrics dm = new DisplayMetrics();
                activity.getWindowManager().getDefaultDisplay().getMetrics(dm);
                float screenW = dm.widthPixels;
                float screenH = dm.heightPixels;

                Log.d(TAG, "setRotation: applying deg=" + degrees
                        + " screen=" + screenW + "x" + screenH
                        + " contentView=" + contentView.getWidth() + "x" + contentView.getHeight());

                // Set pivot point to center of screen
                contentView.setPivotX(screenW / 2f);
                contentView.setPivotY(screenH / 2f);

                if (degrees == 0) {
                    // Reset — no rotation
                    contentView.setRotation(0);
                    contentView.setScaleX(1f);
                    contentView.setScaleY(1f);
                    Log.d(TAG, "setRotation: reset to 0°");
                } else if (degrees == 90 || degrees == 270) {
                    // Rotate and scale to fill screen
                    // After rotating 90°, the content's visual width = screenH
                    // and visual height = screenW. We need to scale so:
                    //   scaleX stretches content width to fill screen width
                    //   scaleY compresses content height to fit screen height
                    // Since scale is applied BEFORE rotation in Android's transform order:
                    //   scaleX (pre-rotation horizontal) → becomes post-rotation vertical
                    //   scaleY (pre-rotation vertical) → becomes post-rotation horizontal
                    // So scaleX = screenH/screenW (shrink pre-rotation width)
                    //    scaleY = screenW/screenH (stretch pre-rotation height)
                    // After rotation, this results in content filling the screen.
                    contentView.setRotation(degrees);
                    contentView.setScaleX(screenH / screenW);
                    contentView.setScaleY(screenW / screenH);
                    Log.d(TAG, "setRotation: applied " + degrees + "°"
                            + " scaleX=" + (screenH / screenW)
                            + " scaleY=" + (screenW / screenH));
                } else if (degrees == 180) {
                    // Just flip upside-down, no scaling needed
                    contentView.setRotation(180);
                    contentView.setScaleX(1f);
                    contentView.setScaleY(1f);
                    Log.d(TAG, "setRotation: applied 180° (no scale)");
                }
            }
        });
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public int getRotation() {
        return currentDegrees;
    }
}
