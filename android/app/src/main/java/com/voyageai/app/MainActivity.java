package com.voyageai.app;

import android.os.Build;
import android.os.Bundle;
import android.app.Notification;
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
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            // 渠道设置首次创建后即被系统冻结：此前版本未设可见性，
            // 旧渠道固化在默认 PRIVATE（锁屏只见「内容已隐藏」甚至不显示）。
            // 检测到旧渠道可见性不对时删除重建，才能让锁屏展示生效。
            NotificationChannel existing = manager.getNotificationChannel("travel-updates");
            if (existing != null && existing.getLockscreenVisibility() != Notification.VISIBILITY_PUBLIC) {
                manager.deleteNotificationChannel("travel-updates");
            }

            if (manager.getNotificationChannel("travel-updates") == null) {
                NotificationChannel channel = new NotificationChannel(
                    "travel-updates",
                    "Travel Updates",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Travel plan update notifications");
                channel.enableLights(true);
                channel.enableVibration(true);
                // 锁屏完全可见：PUBLIC 显示全部内容（默认 PRIVATE 只显示「内容已隐藏」）
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

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
