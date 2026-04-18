# SwiftRide Security Specification

## Data Invariants
1. A user can only modify their own profile.
2. A ride request must be created by an authenticated passenger.
3. A ride can only be accepted by an authenticated rider.
4. Only the assigned rider or passenger can view/update an active ride (ongoing/completed).
5. Riders can only see ride requests that are in 'requested' status.
6. Once a ride is 'completed', it is immutable (except maybe for ratings, if added later).

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempting to create a ride with `passengerId` not matching `request.auth.uid`.
2. **Profile Theft**: Attempting to update another user's profile role to 'rider'.
3. **Ghost Ride**: Creating a ride with a 1MB string in the `pickup.address`.
4. **State Jumping**: A passenger attempting to update a ride status from 'requested' to 'completed' without a rider.
5. **Double Accept**: Two riders attempting to accept the same ride (handled by state check in rule).
6. **Price Injection**: Passenger creating a ride with a `0.01` fare for a 100km trip.
7. **Rider Impersonation**: A passenger accepting their own ride request as a "rider".
8. **Location Poisoning**: Injecting non-numeric values into latitude/longitude.
9. **History Leak**: A user querying rides they were never a part of.
10. **Zombies**: Updating a 'completed' ride's fare.
11. **Mass Deletion**: Attempting to delete the entire `rides` collection.
12. **Metadata Tampering**: Changing `createdAt` timestamp after ride creation.

## The Test Runner (Mock Logic)
The `firestore.rules` will be verified to reject these.
