// Expo config plugin: wires the Kotlin native modules, Cast SDK, manifest entries and Gradle deps
// into the generated android/ project during `expo prebuild`.
const {
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
  AndroidConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PKG = "com.smartbeam.app";
const DEPS = [
  "implementation 'com.google.android.gms:play-services-cast-framework:21.5.0'",
  "implementation 'androidx.documentfile:documentfile:1.0.1'",
  "implementation 'androidx.mediarouter:mediarouter:1.7.0'",
];

// AGP 9 (Expo SDK 58) rejects getDefaultProguardFile('proguard-android.txt'). Some third-party libraries
// (e.g. react-native-blob-util) still use it, so rewrite it to the -optimize variant at prebuild time.
function patchLegacyProguard(projectRoot) {
  const nm = path.join(projectRoot, "node_modules");
  if (!fs.existsSync(nm)) return;
  const pkgDirs = [];
  for (const e of fs.readdirSync(nm)) {
    if (e.startsWith(".")) continue;
    const full = path.join(nm, e);
    if (e.startsWith("@")) {
      try {
        for (const sub of fs.readdirSync(full))
          pkgDirs.push(path.join(full, sub));
      } catch (_) {}
    } else pkgDirs.push(full);
  }
  for (const dir of pkgDirs) {
    for (const name of ["build.gradle", "build.gradle.kts"]) {
      const f = path.join(dir, "android", name);
      try {
        if (!fs.existsSync(f)) continue;
        const src = fs.readFileSync(f, "utf8");
        if (!/proguard-android\.txt/.test(src)) continue;
        fs.writeFileSync(
          f,
          src.replace(
            /proguard-android\.txt/g,
            "proguard-android-optimize.txt",
          ),
        );
        console.log(
          `[withSmartBeam] patched legacy proguard file in ${path.relative(projectRoot, f)}`,
        );
      } catch (_) {
        /* best effort */
      }
    }
  }
}

module.exports = function withSmartBeam(config, props = {}) {
  const castAppId =
    process.env.SMARTBEAM_CAST_APP_ID || props.castAppId || "CC1AD845";

  config = withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    app["meta-data"] = app["meta-data"] || [];
    const setMeta = (name, value) => {
      const ex = app["meta-data"].find((m) => m.$["android:name"] === name);
      if (ex) ex.$["android:value"] = value;
      else
        app["meta-data"].push({
          $: { "android:name": name, "android:value": value },
        });
    };
    setMeta(
      "com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME",
      `${PKG}.nativemods.CastOptionsProvider`,
    );
    setMeta("com.smartbeam.CAST_APP_ID", String(castAppId));

    const manifest = c.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    const have = (n) =>
      manifest["uses-permission"].some((x) => x.$["android:name"] === n);
    [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.ACCESS_WIFI_STATE",
      "android.permission.CHANGE_WIFI_MULTICAST_STATE",
    ].forEach((p) => {
      if (!have(p))
        manifest["uses-permission"].push({ $: { "android:name": p } });
    });
    if (!have("android.permission.NEARBY_WIFI_DEVICES")) {
      manifest["uses-permission"].push({
        $: {
          "android:name": "android.permission.NEARBY_WIFI_DEVICES",
          "android:usesPermissionFlags": "neverForLocation",
        },
      });
    }
    manifest.$["xmlns:tools"] =
      manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";
    return c;
  });

  config = withAppBuildGradle(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes("play-services-cast-framework")) {
      src = src.replace(
        /dependencies\s*\{/,
        (m) => `${m}\n    ${DEPS.join("\n    ")}`,
      );
    }
    c.modResults.contents = src;
    return c;
  });

  config = withMainApplication(config, (c) => {
    let src = c.modResults.contents;
    const imp = `import ${PKG}.nativemods.SmartBeamPackage`;
    if (!src.includes(imp))
      src = src.replace(/(package [^\n]+\n)/, `$1\n${imp}\n`);
    if (!src.includes("SmartBeamPackage()")) {
      const patched = src.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        (m) => `${m}\n              add(SmartBeamPackage())`,
      );
      if (patched === src)
        throw new Error(
          'withSmartBeam: could not find "PackageList(this).packages.apply {" in MainApplication — SmartBeam native modules would not be registered.',
        );
      src = patched;
    }
    c.modResults.contents = src;
    return c;
  });

  config = withDangerousMod(config, [
    "android",
    async (c) => {
      patchLegacyProguard(c.modRequest.projectRoot);
      // Resolve relative to this plugin file so it works regardless of the working directory (local + EAS).
      const candidates = [
        path.join(__dirname, "..", "native", "android"),
        path.join(c.modRequest.projectRoot, "native", "android"),
      ];
      const src = candidates.find((d) => fs.existsSync(d));
      if (!src)
        throw new Error(
          `withSmartBeam: native Kotlin sources not found. Looked in: ${candidates.join(", ")}. Make sure the "native" folder is committed to git and not git-ignored.`,
        );
      const files = fs.readdirSync(src).filter((f) => f.endsWith(".kt"));
      if (!files.length)
        throw new Error(
          `withSmartBeam: no .kt files in ${src}. They may be git-ignored or missing from the upload.`,
        );
      const dest = path.join(
        c.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...PKG.split("."),
        "nativemods",
      );
      fs.mkdirSync(dest, { recursive: true });
      for (const f of files)
        fs.copyFileSync(path.join(src, f), path.join(dest, f));
      console.log(
        `[withSmartBeam] copied ${files.length} Kotlin files to ${dest}`,
      );
      return c;
    },
  ]);

  return config;
};
