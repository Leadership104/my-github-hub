package com.kipita.data.api

import com.squareup.moshi.JsonClass
import retrofit2.http.Body
import retrofit2.http.POST

// --- Request / Response DTOs ---

@JsonClass(generateAdapter = true)
data class DwaatLoginRequest(val email: String, val password: String, val action: String = "Login")

@JsonClass(generateAdapter = true)
data class DwaatLoginResponse(val status: String, val message: String, val userId: String? = null, val token: String? = null)

@JsonClass(generateAdapter = true)
data class DwaatRegisterRequest(
    val email: String, val password: String, val name: String,
    val action: String = "Register"
)

@JsonClass(generateAdapter = true)
data class DwaatGenericResponse(val status: String, val message: String)

@JsonClass(generateAdapter = true)
data class AffiliatesRequest(val action: String = "GetAllList")

@JsonClass(generateAdapter = true)
data class AffiliatesResponse(val status: String? = null, val data: List<PerkItem>? = null)

@JsonClass(generateAdapter = true)
data class PerkItem(
    val id: Int? = null,
    val name: String = "",
    val description: String = "",
    val link: String = "",
    val image: String = "",
    val order: Int? = null
)

interface DwaatApiService {
    @POST("login")
    suspend fun login(@Body request: DwaatLoginRequest): DwaatLoginResponse

    @POST("register")
    suspend fun register(@Body request: DwaatRegisterRequest): DwaatGenericResponse

    @POST("forgotPassword")
    suspend fun forgotPassword(@Body request: Map<String, String>): DwaatGenericResponse

    @POST("affiliates")
    suspend fun getAffiliates(@Body request: AffiliatesRequest = AffiliatesRequest()): AffiliatesResponse
}
