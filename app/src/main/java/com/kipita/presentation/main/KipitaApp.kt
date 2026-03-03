package com.kipita.presentation.main

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.kipita.data.api.PlaceCategory
import com.kipita.data.repository.NearbyPlace
import com.kipita.presentation.ai.AiAssistantScreen
import com.kipita.presentation.chat.ChatScreen
import com.kipita.presentation.common.InAppBrowserScreen
import com.kipita.presentation.map.MapScreen
import com.kipita.presentation.places.PlaceDetailScreen
import com.kipita.presentation.places.PlacesCategoryResultScreen
import com.kipita.presentation.places.PlacesScreen
import com.kipita.presentation.settings.SettingsScreen
import com.kipita.presentation.wallet.WalletScreen

enum class MainRoute { EXPERIENCE, MAP, CHAT, AI, WALLET, SETTINGS }

@Composable
fun KipitaApp() {
    var route by rememberSaveable { mutableStateOf(MainRoute.EXPERIENCE) }

    // Sub-navigation within the Explore/Places tab (not saveable — resets on process death is fine)
    var selectedCategory by remember { mutableStateOf<PlaceCategory?>(null) }
    var selectedPlace by remember { mutableStateOf<NearbyPlace?>(null) }
    var browserUrl by remember { mutableStateOf<String?>(null) }
    var browserTitle by remember { mutableStateOf("") }

    Scaffold(
        bottomBar = {
            NavigationBar {
                MainRoute.entries.forEach { destination ->
                    NavigationBarItem(
                        selected = route == destination,
                        onClick = {
                            if (destination == MainRoute.EXPERIENCE && route == MainRoute.EXPERIENCE) {
                                // Tap active tab → pop to root of places sub-nav
                                selectedCategory = null
                                selectedPlace = null
                                browserUrl = null
                            } else {
                                route = destination
                            }
                        },
                        icon = { Text(if (destination == MainRoute.EXPERIENCE) "🗺" else destination.name.take(1)) },
                        label = { Text(if (destination == MainRoute.EXPERIENCE) "Explore" else destination.name) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize()) {
            Crossfade(targetState = route, label = "route-transition") { destination ->
                when (destination) {
                    MainRoute.EXPERIENCE -> {
                        val url = browserUrl
                        when {
                            url != null -> InAppBrowserScreen(
                                url = url,
                                title = browserTitle,
                                paddingValues = padding,
                                onBack = { browserUrl = null }
                            )
                            selectedPlace != null -> PlaceDetailScreen(
                                place = selectedPlace!!,
                                onBack = { selectedPlace = null },
                                onOpenWebView = { u, t -> browserUrl = u; browserTitle = t }
                            )
                            selectedCategory != null -> PlacesCategoryResultScreen(
                                category = selectedCategory!!,
                                onBack = { selectedCategory = null },
                                onOpenWebView = { u, t -> browserUrl = u; browserTitle = t }
                            )
                            else -> PlacesScreen(
                                paddingValues = padding,
                                onCategorySelected = { cat -> selectedCategory = cat },
                                onOpenWebView = { u, t -> browserUrl = u; browserTitle = t }
                            )
                        }
                    }
                    MainRoute.MAP -> MapScreen(padding)
                    MainRoute.CHAT -> ChatScreen(padding)
                    MainRoute.AI -> AiAssistantScreen(padding)
                    MainRoute.WALLET -> WalletScreen(padding)
                    MainRoute.SETTINGS -> SettingsScreen(padding)
                }
            }
        }
    }
}
