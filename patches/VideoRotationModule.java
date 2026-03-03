package com.signageplayer;

import android.graphics.Matrix;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.app.Activity;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;

/**
 * VideoRotationModule — Rotates video content using TextureView.setTransform(Matrix).
 *
 * CSS transforms on parent Views do NOT rotate TextureView content on Android TV API 28.
 * This module walks the view hierarchy, finds all TextureViews (used by ExoPlayer when
 * useTextureView={true}), and applies a hardware-level Matrix transform that rotates
 * the video texture directly on the GPU.
 *
 * For 90°/270°: rotates + scales to fill the TextureView bounds.
 * For 180°: just rotates.
 * For 0°: resets to identity matrix.
 */
public class VideoRotationModule extends ReactContextBaseJavaModule {

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
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Activity activity = getCurrentActivity();
                if (activity == null) return;

                View rootView = activity.getWindow().getDecorView().getRootView();
                applyRotationToTextureViews(rootView, degrees);
            }
        });
    }

    /**
     * Returns the currently set rotation degrees (for re-applying after player recreation).
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    public int getRotation() {
        return currentDegrees;
    }

    private void applyRotationToTextureViews(View view, int degrees) {
        if (view instanceof TextureView) {
            applyMatrixRotation((TextureView) view, degrees);
            return;
        }

        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                applyRotationToTextureViews(group.getChildAt(i), degrees);
            }
        }
    }

    private void applyMatrixRotation(TextureView tv, int degrees) {
        float w = tv.getWidth();
        float h = tv.getHeight();

        if (w <= 0 || h <= 0) return;

        Matrix matrix = new Matrix();

        if (degrees == 0) {
            // Reset to identity — no rotation
            tv.setTransform(matrix);
            return;
        }

        float cx = w / 2f;
        float cy = h / 2f;

        // Rotate around center
        matrix.postRotate(degrees, cx, cy);

        if (degrees == 90 || degrees == 270) {
            // After rotating 90°/270°, the content dimensions swap.
            // Scale to fill the TextureView bounds so the rotated content
            // covers the entire view without letterboxing.
            // scaleX = viewWidth / viewHeight stretches the rotated height to fill width
            // scaleY = viewHeight / viewWidth compresses the rotated width to fill height
            float scaleX = w / h;
            float scaleY = h / w;
            matrix.postScale(scaleX, scaleY, cx, cy);
        }
        // 180°: just rotate, no scaling needed (dimensions don't change)

        tv.setTransform(matrix);
    }
}
