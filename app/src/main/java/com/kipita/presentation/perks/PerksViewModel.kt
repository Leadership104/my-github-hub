package com.kipita.presentation.perks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kipita.data.api.PerkItem
import com.kipita.data.repository.PerksRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PerksViewModel @Inject constructor(
    private val repository: PerksRepository
) : ViewModel() {

    private val _dynamicPerks = MutableStateFlow<List<PerkItem>>(emptyList())
    val dynamicPerks: StateFlow<List<PerkItem>> = _dynamicPerks.asStateFlow()

    val staticPerks: List<PerkItem> = repository.staticPlannerDeals

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadDynamicPerks()
    }

    fun loadDynamicPerks() {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getDynamicPerks().onSuccess { perks ->
                _dynamicPerks.value = perks
            }
            _isLoading.value = false
        }
    }
}
