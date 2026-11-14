plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersionCode: Int = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1
val appVersionName: String = (project.findProperty("versionName") as String?) ?: "1.0.0"

// Параметры подписи приходят из переменных окружения (их задаёт GitHub Actions).
// Имена с суффиксом Env, чтобы не перекрывать свойства SigningConfig.
val keystorePathEnv: String? = System.getenv("MIK_KEYSTORE_PATH")
val storePasswordEnv: String? = System.getenv("MIK_STORE_PASSWORD")
val keyAliasEnv: String? = System.getenv("MIK_KEY_ALIAS")
val keyPasswordEnv: String? = System.getenv("MIK_KEY_PASSWORD")

android {
    namespace = "com.mikacademy.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mikacademy.app"
        minSdk = 24
        targetSdk = 34
        versionCode = appVersionCode
        versionName = appVersionName
    }

    // Веб-приложение копируется в assets на этапе сборки — исходники хранятся один раз, в /web
    val syncWebAssets by tasks.registering(Copy::class) {
        description = "Копирует веб-приложение из /web в assets приложения"
        from(rootProject.layout.projectDirectory.dir("../web"))
        into(project.layout.buildDirectory.dir("generated/webAssets/www"))
        exclude("**/.DS_Store")
    }

    sourceSets.getByName("main") {
        assets.srcDir(project.layout.buildDirectory.dir("generated/webAssets"))
    }

    tasks.named("preBuild") { dependsOn(syncWebAssets) }

    signingConfigs {
        // Релизный ключ приходит из секретов GitHub (Actions secrets).
        if (keystorePathEnv != null && storePasswordEnv != null && keyAliasEnv != null) {
            create("release") {
                storeFile = rootProject.file(keystorePathEnv)
                storePassword = storePasswordEnv
                keyAlias = keyAliasEnv
                keyPassword = keyPasswordEnv ?: storePasswordEnv
                storeType = "pkcs12"
                enableV1Signing = false
                enableV2Signing = true
                enableV3Signing = true
            }
        }

        // Отладочный ключ лежит в репозитории: он ничего не защищает, но постоянный,
        // поэтому отладочные сборки устанавливаются поверх предыдущих.
        create("debugStable") {
            // читаем mik-debug.properties вручную: в Kotlin DSL имя `java`
            // перехватывается расширением java-плагина
            val props = mutableMapOf<String, String>()
            val propsFile = rootProject.file("keystore/mik-debug.properties")
            if (propsFile.exists()) {
                propsFile.readLines().forEach { line ->
                    val t = line.trim()
                    if (t.isNotEmpty() && !t.startsWith("#") && t.contains("=")) {
                        val i = t.indexOf("=")
                        props[t.substring(0, i).trim()] = t.substring(i + 1).trim()
                    }
                }
            }
            storeFile = rootProject.file("keystore/mik-debug.p12")
            storePassword = props["store_password"] ?: "mikdebug"
            keyAlias = props["key_alias"] ?: "mikdebug"
            keyPassword = props["key_password"] ?: props["store_password"] ?: "mikdebug"
            storeType = "pkcs12"
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debugStable")
        }
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources.excludes += setOf("META-INF/{AL2.0,LGPL2.1}", "META-INF/DEPENDENCIES")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
