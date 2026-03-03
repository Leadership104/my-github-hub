package com.kipita.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        TravelNoticeEntity::class,
        MerchantEntity::class,
        NomadPlaceEntity::class,
        TripMessageEntity::class,
        ErrorLogEntity::class,
        TripEntity::class,
        UserEntity::class,
        SavedLocationEntity::class,
        DirectMessageEntity::class
    ],
    version = 6,
    exportSchema = false
)
abstract class KipitaDatabase : RoomDatabase() {
    abstract fun travelNoticeDao(): TravelNoticeDao
    abstract fun merchantDao(): MerchantDao
    abstract fun nomadPlaceDao(): NomadPlaceDao
    abstract fun tripMessageDao(): TripMessageDao
    abstract fun errorLogDao(): ErrorLogDao
    abstract fun tripDao(): TripDao
    abstract fun userDao(): UserDao
    abstract fun savedLocationDao(): SavedLocationDao
    abstract fun directMessageDao(): DirectMessageDao
}
