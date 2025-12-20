
package com.mobileappyc

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import android.os.Build
import android.os.Bundle
import androidx.core.view.WindowCompat
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {


  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "mobileAppYC"
  override fun onCreate(savedInstanceState: Bundle?) {
       RNBootSplash.init(this, R.style.BootTheme)
    super.onCreate(savedInstanceState)

    // Enable edge-to-edge display for Android 15+ (backward compatible)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
      WindowCompat.setDecorFitsSystemWindows(window, false)
    }
  }
  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
