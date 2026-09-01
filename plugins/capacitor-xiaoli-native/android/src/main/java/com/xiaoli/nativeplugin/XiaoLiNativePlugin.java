package com.xiaoli.nativeplugin;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Iterator;

@CapacitorPlugin(name = "XiaoLiNative")
public class XiaoLiNativePlugin extends Plugin {

    private static final String UA =
        "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

    @PluginMethod
    public void get(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        String charset = call.getString("charset", "UTF-8");
        JSObject headers = call.getObject("headers");
        new Thread(() -> {
            try {
                HttpURLConnection conn = openConnection(url, headers);
                int code = conn.getResponseCode();
                InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                String body = readString(is, charset);
                if (is != null) {
                    is.close();
                }
                conn.disconnect();

                JSObject ret = new JSObject();
                ret.put("status", code);
                ret.put("data", body == null ? "" : body);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("http_failed: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256", "");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "update");
                if (!dir.exists()) {
                    dir.mkdirs();
                }
                File apk = new File(dir, "update-" + System.currentTimeMillis() + ".apk");

                HttpURLConnection conn = openConnection(url, null);
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(180000);
                long total = conn.getContentLengthLong();
                long received = 0;
                int lastPercent = -1;
                long lastEmit = 0;
                try (InputStream is = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(apk)) {
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = is.read(buf)) != -1) {
                        fos.write(buf, 0, n);
                        received += n;
                        int percent = total > 0 ? (int) ((received * 100) / total) : -1;
                        long now = System.currentTimeMillis();
                        if (percent != lastPercent || now - lastEmit > 300) {
                            emitDownloadProgress(received, total, false);
                            lastPercent = percent;
                            lastEmit = now;
                        }
                    }
                }
                emitDownloadProgress(total > 0 ? total : received, total, true);
                conn.disconnect();

                if (sha256 != null && !sha256.isEmpty()) {
                    String fileSha = sha256File(apk);
                    if (!fileSha.equalsIgnoreCase(sha256)) {
                        apk.delete();
                        call.reject("sha256 mismatch, expected " + sha256 + " but got " + fileSha);
                        return;
                    }
                }

                Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apk
                );
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);

                JSObject ret = new JSObject();
                ret.put("path", apk.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("install_failed: " + e.getMessage(), e);
            }
        }).start();
    }

    private HttpURLConnection openConnection(String url, JSObject headers) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("User-Agent", UA);
        conn.setRequestProperty("Accept", "*/*");
        conn.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9");
        if (headers != null) {
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = headers.getString(key);
                if (key != null && value != null && !key.isEmpty()) {
                    conn.setRequestProperty(key, value);
                }
            }
        }
        conn.setInstanceFollowRedirects(true);
        return conn;
    }

    private void emitDownloadProgress(long received, long total, boolean done) {
        JSObject progress = new JSObject();
        progress.put("received", received);
        progress.put("total", total);
        progress.put("done", done);
        notifyListeners("updateDownloadProgress", progress);
    }

    private String readString(InputStream is, String charset) throws Exception {
        if (is == null) {
            return "";
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) != -1) {
            out.write(buf, 0, n);
        }
        String cs = (charset == null || charset.isEmpty()) ? StandardCharsets.UTF_8.name() : charset;
        return out.toString(cs);
    }

    private String sha256File(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream is = new java.io.FileInputStream(file)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) {
                digest.update(buf, 0, n);
            }
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : digest.digest()) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
