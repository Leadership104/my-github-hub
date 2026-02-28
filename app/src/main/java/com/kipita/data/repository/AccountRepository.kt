package com.kipita.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.kipita.data.local.UserDao
import com.kipita.data.local.UserEntity
import kotlinx.coroutines.tasks.await
import java.security.MessageDigest
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AccountRepository @Inject constructor(
    private val userDao: UserDao
) {
    suspend fun createAccount(
        displayName: String,
        username: String,
        email: String,
        password: String
    ): Result<UserEntity> {
        val normalizedUsername = normalizeUsername(username)
        val normalizedEmail = normalizeEmail(email)
        if (displayName.isBlank()) return Result.failure(IllegalArgumentException("Display name is required."))
        if (normalizedUsername.isBlank()) return Result.failure(IllegalArgumentException("Username is required."))
        if (normalizedEmail.isBlank()) return Result.failure(IllegalArgumentException("Email is required."))
        if (password.length < 8) return Result.failure(IllegalArgumentException("Password must be at least 8 characters."))
        if (userDao.usernameCount(normalizedUsername) > 0) {
            return Result.failure(IllegalStateException("Username is already taken."))
        }
        if (userDao.emailCount(normalizedEmail) > 0) {
            return Result.failure(IllegalStateException("Email is already in use."))
        }
        val user = UserEntity(
            id = UUID.randomUUID().toString(),
            displayName = displayName.trim(),
            username = normalizedUsername,
            usernameNormalized = normalizedUsername,
            email = email.trim(),
            emailNormalized = normalizedEmail,
            emailVerified = false,
            passwordHash = sha256(password),
            createdAtEpochMillis = System.currentTimeMillis()
        )
        userDao.upsert(user)
        return Result.success(user)
    }

    suspend fun deleteAccount(): Result<Unit> = runCatching {
        userDao.deleteAll()
    }

    suspend fun signIn(email: String, password: String): Result<UserEntity> {
        val normalizedEmail = normalizeEmail(email)
        val user = userDao.getByEmail(normalizedEmail)
            ?: return Result.failure(IllegalStateException("No account found for this email."))
        if (user.passwordHash != sha256(password)) {
            return Result.failure(IllegalStateException("Invalid password."))
        }
        return Result.success(user)
    }

    /** Updates display name and avatar URL for an existing user. */
    suspend fun updateProfile(userId: String, displayName: String, avatarUri: String): Result<UserEntity> {
        val user = userDao.getById(userId)
            ?: return Result.failure(IllegalStateException("User not found"))
        val updated = user.copy(
            displayName = displayName.trim().ifBlank { user.displayName },
            avatarUrl = avatarUri
        )
        userDao.upsert(updated)
        return Result.success(updated)
    }

    /**
     * Signs in with a Google ID token obtained from Credential Manager.
     * Creates or updates a local UserEntity from the Firebase user profile.
     *
     * Prerequisites: google-services.json with Google Sign-In enabled in Firebase Console
     * and SHA-1 debug fingerprint registered.
     */
    suspend fun signInWithGoogle(idToken: String): Result<UserEntity> = try {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        val authResult = FirebaseAuth.getInstance().signInWithCredential(credential).await()
        val firebaseUser = authResult.user
            ?: return Result.failure(IllegalStateException("Google sign-in failed: no user"))

        val normalizedEmail = normalizeEmail(firebaseUser.email ?: "")
        val existing = if (normalizedEmail.isNotBlank()) userDao.getByEmail(normalizedEmail) else null

        val user = if (existing != null) {
            val updated = existing.copy(
                displayName = firebaseUser.displayName?.takeIf { it.isNotBlank() } ?: existing.displayName,
                avatarUrl = firebaseUser.photoUrl?.toString() ?: existing.avatarUrl
            )
            userDao.upsert(updated)
            updated
        } else {
            val base = normalizeUsername(firebaseUser.displayName ?: firebaseUser.uid)
            val newUser = UserEntity(
                id = firebaseUser.uid,
                displayName = firebaseUser.displayName ?: "Traveler",
                username = base,
                usernameNormalized = base,
                avatarUrl = firebaseUser.photoUrl?.toString() ?: "",
                email = firebaseUser.email ?: "",
                emailNormalized = normalizedEmail,
                emailVerified = firebaseUser.isEmailVerified,
                createdAtEpochMillis = System.currentTimeMillis()
            )
            userDao.upsert(newUser)
            newUser
        }
        Result.success(user)
    } catch (e: Exception) {
        Result.failure(e)
    }

    private fun normalizeUsername(value: String): String =
        value.trim().lowercase().replace(Regex("[^a-z0-9_\\.]"), "")

    private fun normalizeEmail(value: String): String = value.trim().lowercase()

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
