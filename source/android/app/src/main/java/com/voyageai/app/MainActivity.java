package com.voyageai.app;

import android.os.Build;
import android.os.Bundle;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        WebView.setWebContentsDebuggingEnabled(true);
    }

    @Override
    public void onStart() {
        super.onStart();
        clearWebViewCache();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "travel-updates",
                "Travel Updates",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Travel plan update notifications");
            channel.enableLights(true);
            channel.enableVibration(true);

            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void clearWebViewCache() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
                webView.clearCache(true);
                webView.clearHistory();
                webView.clearFormData();
                webView.clearSslPreferences();
                deleteDatabase("webview.db");
                deleteDatabase("webviewCache.db");
            }
        } catch (Exception e) {
            // WebView not yet initialized — will retry on next start
        }
    }
}
