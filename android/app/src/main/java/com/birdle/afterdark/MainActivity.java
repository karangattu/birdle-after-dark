package com.birdle.afterdark;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Hosts the game in immersive sticky fullscreen.
 *
 * The app targets SDK 36, so Android draws the system bars edge-to-edge on top of
 * the WebView. On a Samsung tablet the 3-button navigation bar then covered the HUD
 * header (timer/score, pause and quit buttons) and the sighting panel footer, making
 * those buttons partly untappable. Hiding the system bars keeps the whole viewport for
 * the game; they reappear on a swipe and auto-hide again, and the layout also honours
 * the injected safe-area insets for the cases where a bar is visible anyway.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // The system bars come back after a transient swipe or when the activity is
        // resumed, so hide them again as soon as we regain focus.
        if (hasFocus) {
            enterImmersiveMode();
        }
    }

    private void enterImmersiveMode() {
        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insetsController.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        insetsController.hide(WindowInsetsCompat.Type.systemBars());
    }
}
