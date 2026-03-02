package com.kipita.di

import com.kipita.data.api.DwaatApiService
import com.kipita.data.repository.PerksRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object TravelDealsModule {

    @Provides
    @Singleton
    fun providePerksRepository(dwaatApiService: DwaatApiService): PerksRepository =
        PerksRepository(dwaatApiService)
}
