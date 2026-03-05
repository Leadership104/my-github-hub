package com.kipita.presentation.advisory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kipita.data.error.InHouseErrorLogger
import com.kipita.domain.model.NoticeCategory
import com.kipita.domain.model.TravelNotice
import com.kipita.domain.usecase.TravelDataEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class AdvisoryViewModel @Inject constructor(
    private val travelDataEngine: TravelDataEngine,
    private val errorLogger: InHouseErrorLogger
) : ViewModel() {
    private val _state = MutableStateFlow(AdvisoryUiState())
    val state: StateFlow<AdvisoryUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun selectTab(tab: NoticeCategory) {
        _state.value = _state.value.copy(selectedTab = tab)
    }

    fun load(region: String = "global") {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            runCatching { travelDataEngine.collectRegionNotices(region) }
                .onSuccess { notices ->
                    _state.value = _state.value.copy(loading = false, notices = notices)
                }
                .onFailure {
                    errorLogger.log("AdvisoryViewModel.load", it)
                    _state.value = _state.value.copy(loading = false)
                }
        }
    }
}

data class AdvisoryUiState(
    val loading: Boolean = false,
    val selectedTab: NoticeCategory = NoticeCategory.ADVISORY,
    val notices: List<TravelNotice> = emptyList()
) {
    val tabbedNotices: List<TravelNotice>
        get() = notices.filter { it.category == selectedTab }
}

