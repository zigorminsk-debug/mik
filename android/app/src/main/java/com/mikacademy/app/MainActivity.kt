package com.mikacademy.app

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerController
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * Оболочка приложения: локальный PWA курса по MikroTik RouterOS.
 *
 * Веб-приложение раздаётся через WebViewAssetLoader по адресу
 * https://appassets.androidplatform.net/assets/www/index.html —
 * это безопасный https-Origin, поэтому внутри работают service worker,
 * localStorage, fetch и офлайн-режим.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val assetLoader: WebViewAssetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(APP_DOMAIN)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Запросы service worker идут мимо WebViewClient, поэтому их нужно
        // перенаправить в загрузчик ресурсов отдельно. Без этого видео и другие
        // файлы из assets уходили бы в сеть, где домена appassets.androidplatform.net
        // не существует, и не воспроизводились.
        try {
            ServiceWorkerController.getInstance().setServiceWorkerClient(
                object : ServiceWorkerClientCompat() {
                    override fun shouldInterceptRequest(
                        request: WebResourceRequest
                    ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
                }
            )
        } catch (e: Throwable) {
            Log.w(TAG, "ServiceWorkerClient недоступен: ${e.message}")
        }

        // Аппаратная кнопка «Назад» возвращает по истории веб-приложения
        // (в нём hash-роутинг), а не выбрасывает пользователя из урока.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(0xFF0D1117.toInt())
            overScrollMode = WebView.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                textZoom = 100
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }

            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val url = request.url
                    return if (url.host == APP_DOMAIN) {
                        false
                    } else {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                        true
                    }
                }
            }

            isVerticalScrollBarEnabled = false
        }

        setContentView(webView)

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        webView.onPause()
        webView.pauseTimers()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.resumeTimers()
        webView.onResume()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "MikAcademy"
        private const val APP_DOMAIN = "appassets.androidplatform.net"
        private const val START_URL = "https://$APP_DOMAIN/assets/www/index.html"
    }
}
