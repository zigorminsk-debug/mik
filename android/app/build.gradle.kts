plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersionCode: Int = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1
val appVersionName: String = (project.findProperty("versionName") as String?) ?: "1.0.0"

// Путь к keystore берётся из переменных окружения (их задаёт GitHub Actions)
val keystorePath: String? = System.getenv("MIK_KEYSTORE_PATH")
val storePassword: String? = System.getenv("MIK_STORE_PASSWORD")
val keyAlias: String? = System.getenv("MIK_KEY_ALIAS")
val keyPassword: String? = System.getenv("MIK_KEY_PASSWORD")

android {
    namespace = "com.mikacademy.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mikacademy.app"
        minSdk = 24
        targetSdk = 34
        versionCode = appVersionCode
        versionName = appVersionName
        resourceConfigurations += listOf("ru", "en")
    }

    // Веб-приложение копируется в assets на этапе сборки — исходники хранятся один раз, в /web
    val syncWebAssets by tasks.registering(Copy::class) {
        description = "Копирует веб-приложение из /web в assets приложения"
        from(rootProject.layout.projectDirectory.dir("../web"))
        into(layout.buildDirectory.dir("generated/webAssets/www"))
        exclude("**/.DS_Store")
    }

    sourceSets.getByName("main") {
        assets.srcDir(layout.buildDirectory.dir("generated/webAssets"))
    }

    tasks.named("preBuild") { dependsOn(syncWebAssets) }

    signingConfigs {
        if (keystorePath != null && storePassword != null && keyAlias != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = storePassword
                keyAlias = keyAlias
                keyPassword = keyPassword ?: storePassword
                storeType = "pkcs12"
                enableV1Signing = false
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isMinifyEnabled = false
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

    applicationVariants.all {
        outputs.all {
            val output = this as com.android.build.gradle.internal.api.BaseVariantOutputImpl
            output.outputFileName = "mik-academy-${appVersionName}-${variant.buildType.name}.apk"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
