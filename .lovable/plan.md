Plan to fix the navigation issue:

1. Make AI “Details” links route to a specific place, not a category
- Keep the current chip-based behavior, but make it more robust by ensuring every AI recommendation passes a `place:<payload>` hint to Places.
- Remove the fallback that sends named places to generic Food & Drinks when the place object has a name but missing/partial metadata.

2. Make Places accept direct place hints reliably
- Update `PlacesScreen` so `initialView` changes are re-processed when the user clicks multiple AI Details buttons in the same session.
- Decode `place:<payload>`, immediately open the existing detail layout, and then hydrate the full page from the existing `places-proxy` details endpoint using `placeId` when available.
- If `placeId` is missing, perform a radius-based text search using the place name/address and open the best match’s detail page instead of falling back to Food & Drinks.

3. Ensure AI markdown CTAs can deep-link to place detail too
- Add support for AI-generated links that include a `place` payload / `placeId` hint, so typed assistant responses and rendered “Details” actions behave the same way.
- Preserve the existing category links like `kipita://tab/places?hint=food` for broad requests only.

4. Verify the Canes-style flow
- Test from AI recommended location Details → Places detail page.
- Confirm the resulting page uses the existing full-description detail view shown in the reference: photos, name, type, rating, reviews, address, summary, must-try/hours/contact/directions where data exists.
- Confirm Back returns cleanly to the prior screen rather than leaving the user in Food & Drinks.